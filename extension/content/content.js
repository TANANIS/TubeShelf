(function () {
  "use strict";

  if (window.top !== window || document.getElementById("tubeshelf-launcher")) return;
  const Core = globalThis.TubeShelfCore;
  const STORAGE_KEY = "tubeShelfState";
  let state = Core.defaultState();
  let activeGroupId = "all";
  let scanTimer = null;
  let lastPathname = location.pathname;
  let homeRedirecting = false;
  let shortsRedirecting = false;
  const VIDEO_CARD_SELECTOR = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-channel-renderer, ytd-compact-video-renderer, yt-lockup-view-model";
  const STRUCTURE_SELECTOR = 'ytd-guide-renderer, ytd-mini-guide-renderer, ytd-browse[page-subtype="subscriptions"], ytd-watch-flexy, yt-page-header-view-model, yt-page-header-renderer, yt-content-metadata-view-model, .ytContentMetadataViewModelMetadataRow, yt-flexible-actions-view-model, yt-subscribe-button-view-model';
  const pendingCards = new Set();
  let pendingFullRefresh = false;
  let pendingStructureRefresh = false;
  let trackedSubscription = { channelId: "", subscribed: null };
  let subscriptionSyncTimer = null;
  let guideCollapsed = true;
  const scanIdentityByAlias = new Map();
  const IDENTITY_BRIDGE_SOURCE = "tubeshelf-identity-bridge";
  const OWN_UI_SELECTOR = '#tubeshelf-favorites-page, #tubeshelf-panel, #tubeshelf-toolbar, #tubeshelf-guide-section, #tubeshelf-launcher, #tubeshelf-backdrop, #tubeshelf-scan-progress, #tubeshelf-channel-control, #tubeshelf-channel-classification, .tubeshelf-card-classification';
  let membershipsByChannel = new Map();
  let unfiledIds = [];
  let stateLoaded = false;
  let scanGeneration = 0;
  let autoplayRestore = null;
  let startupScanTimer = null;
  const favorites = globalThis.createTubeShelfFavorites({ getState: () => state, commit, openGroup: openSubscriptionGroup });
  document.documentElement.classList.add("tubeshelf-disabled");

  function publishPowerState() {
    window.postMessage({ source: IDENTITY_BRIDGE_SOURCE, type: "SET_ENABLED", enabled: state.settings.enabled }, location.origin);
  }

  function pauseIntegration() {
    favorites.clear();
    observer.disconnect();
    clearTimeout(scanTimer);
    clearTimeout(subscriptionSyncTimer);
    clearTimeout(startupScanTimer);
    clearTimeout(toast.timer);
    scanTimer = null;
    pendingCards.clear();
    pendingFullRefresh = false;
    pendingStructureRefresh = false;
    scanGeneration++;
    scanIdentityByAlias.clear();
    trackedSubscription = { channelId: "", subscribed: null };
    homeRedirecting = shortsRedirecting = false;
    closePanel();
    document.documentElement.classList.add("tubeshelf-disabled");
    document.documentElement.classList.remove("tubeshelf-block-home", "tubeshelf-hide-shorts", "tubeshelf-hide-secondary", "tubeshelf-integrated");
    $$(".tubeshelf-hidden, .tubeshelf-shorts-hidden").forEach((card) => card.classList.remove("tubeshelf-hidden", "tubeshelf-shorts-hidden"));
    $$("#tubeshelf-toolbar, #tubeshelf-guide-section, #tubeshelf-channel-control, #tubeshelf-channel-classification, .tubeshelf-card-classification, #tubeshelf-scan-progress").forEach((node) => node.remove());
    const autoplay = autoplayRestore?.deref();
    autoplayRestore = null;
    if (autoplay?.isConnected && autoplay.getAttribute("aria-checked") === "false") autoplay.click();
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pageKind = () => Core.youtubePageKind(location.href);
  const isSubscriptionsPage = () => pageKind() === "subscriptions";
  const currentLanguage = () => Core.languageCode(state.settings?.language);
  function localizeExtensionUi(root) { Core.localizeDom(root, currentLanguage()); }

  function unfiledChannelIds() {
    return unfiledIds;
  }

  function channelGroups(id) {
    return membershipsByChannel.get(Core.resolveChannelRecordId(state, id) || id) || [];
  }

  function rebuildMembershipIndex() {
    membershipsByChannel = new Map();
    for (const group of state.groups) for (const id of group.channelIds) {
      if (!membershipsByChannel.has(id)) membershipsByChannel.set(id, []);
      membershipsByChannel.get(id).push(group);
    }
    unfiledIds = Object.keys(state.channels).filter((id) => !membershipsByChannel.has(id));
  }

  function registerScanIdentity(channelId, alias) {
    const stableId = String(channelId || "").trim();
    const aliasKey = Core.channelKey(String(alias || ""));
    if (!/^UC[A-Za-z0-9_-]{20,}$/.test(stableId) || !aliasKey) return;
    const canonicalAlias = Core.channelKey(`/channel/${stableId}`);
    const identity = { channelId: stableId, aliases: [...new Set([aliasKey, canonicalAlias].filter(Boolean))] };
    identity.aliases.forEach((key) => scanIdentityByAlias.set(key, identity));
  }

  function enrichChannelIdentity(channel) {
    const identity = scanIdentityByAlias.get(Core.channelKey(channel?.url || channel?.id));
    return identity ? { ...channel, channelId: identity.channelId, aliases: identity.aliases } : channel;
  }

  window.addEventListener("message", (event) => {
    if (event.source === window && event.origin === location.origin && event.data?.source === IDENTITY_BRIDGE_SOURCE && event.data?.type === "BRIDGE_READY") {
      if (stateLoaded) publishPowerState();
      return;
    }
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== IDENTITY_BRIDGE_SOURCE || event.data?.type !== "CHANNEL_IDENTITY") return;
    if (!state.settings.enabled || location.pathname !== "/feed/channels") return;
    registerScanIdentity(event.data.channelId, event.data.alias);
  });

  function canonicalCard(element) {
    let card = element instanceof Element ? element.closest(VIDEO_CARD_SELECTOR) : null;
    if (!card) return null;
    let parent = card.parentElement?.closest(VIDEO_CARD_SELECTOR);
    while (parent) {
      card = parent;
      parent = card.parentElement?.closest(VIDEO_CARD_SELECTOR);
    }
    return card;
  }

  function collectCards(root, target) {
    if (!(root instanceof Element)) return;
    const ownCard = canonicalCard(root);
    if (ownCard) target.add(ownCard);
    root.querySelectorAll(VIDEO_CARD_SELECTOR).forEach((card) => target.add(canonicalCard(card) || card));
  }

  function allCards() {
    const cards = new Set();
    document.querySelectorAll(VIDEO_CARD_SELECTOR).forEach((card) => cards.add(canonicalCard(card) || card));
    return [...cards];
  }

  function openSubscriptionGroup(groupId) {
    if (!isSubscriptionsPage()) {
      location.assign(Core.subscriptionGroupUrl(groupId));
      return false;
    }
    activeGroupId = validGroupId(groupId) ? groupId : "all";
    const url = new URL(location.href);
    url.hash = `tubeshelf-group=${encodeURIComponent(activeGroupId)}`;
    history.replaceState(history.state, "", url);
    renderGroups();
    renderIntegratedControls();
    applyFilters();
    return true;
  }

  async function readState() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    acceptState(result[STORAGE_KEY], true);
    stateLoaded = true;
    return state;
  }

  function validGroupId(groupId) {
    return ["all", "unfiled"].includes(groupId) || state.groups.some((group) => group.id === groupId);
  }

  function syncActiveGroupFromLocation() {
    if (!isSubscriptionsPage()) return;
    const requested = new URLSearchParams(location.hash.replace(/^#/, "")).get("tubeshelf-group") || "all";
    activeGroupId = validGroupId(requested) ? requested : "all";
    if (requested !== activeGroupId) {
      const url = new URL(location.href);
      url.hash = `tubeshelf-group=${encodeURIComponent(activeGroupId)}`;
      history.replaceState(history.state, "", url);
    }
  }

  function acceptState(next, force = false) {
    if (!force && Number.isSafeInteger(next?.revision) && next.revision <= state.revision) return false;
    const incoming = Core.normalizeState(next);
    if (!force && incoming.revision <= state.revision) return false;
    state = incoming;
    rebuildMembershipIndex();
    if (!validGroupId(activeGroupId)) {
      activeGroupId = "all";
      if (isSubscriptionsPage()) {
        const url = new URL(location.href);
        url.hash = "tubeshelf-group=all";
        history.replaceState(history.state, "", url);
      }
    }
    return true;
  }

  function refreshFromState() {
    publishPowerState();
    if (!state.settings.enabled) { pauseIntegration(); return; }
    document.documentElement.classList.remove("tubeshelf-disabled");
    if (document.hidden) { pendingFullRefresh = true; pendingStructureRefresh = true; return; }
    updateObservation();
    renderGroups();
    renderIntegratedControls();
    renderCurrentChannelControl();
    applyFilters();
    scheduleSubscriptionSync();
  }

  async function commit(operation) {
    const result = await chrome.runtime.sendMessage({ type: "TUBESHELF_MUTATE", operation });
    if (!result?.ok) throw Object.assign(new Error(result?.error || "State update failed"), { code: result?.code });
    if (acceptState(result.state)) refreshFromState();
    return state;
  }

  function currentChannelFromPage() {
    const watchOwner = document.querySelector('ytd-watch-metadata #owner a[href^="/@"], ytd-watch-metadata #owner a[href^="/channel/"], #upload-info a[href^="/@"], #upload-info a[href^="/channel/"]');
    const pageLink = watchOwner || document.querySelector('yt-page-header-view-model a[href^="/@"], yt-page-header-view-model a[href^="/channel/"], yt-page-header-renderer a[href^="/@"], ytd-c4-tabbed-header-renderer a[href^="/@"], link[rel="canonical"]');
    const locationId = Core.channelKey(location.href);
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || "";
    const canonicalId = Core.channelKey(canonicalUrl);
    const rawUrl = locationId ? location.href : pageLink?.href || "";
    const id = Core.channelKey(rawUrl);
    if (!id) return null;
    const name = (watchOwner?.textContent || document.querySelector('yt-page-header-view-model h1, yt-page-header-view-model .yt-page-header-view-model__page-header-title, yt-page-header-renderer h1, ytd-c4-tabbed-header-renderer #channel-name')?.textContent || id).trim();
    const avatar = document.querySelector('ytd-watch-metadata #owner #avatar img, yt-page-header-view-model img, yt-page-header-renderer img, ytd-c4-tabbed-header-renderer #avatar img')?.src || "";
    let channelId = "";
    try { channelId = new URL(canonicalUrl).pathname.match(/^\/channel\/([^/]+)/i)?.[1] || ""; } catch (_error) {}
    return {
      id,
      url: new URL(rawUrl, location.origin).href,
      name,
      avatar,
      channelId,
      aliasIds: canonicalId && canonicalId !== id ? [canonicalId] : []
    };
  }

  function currentSubscriptionStatus() {
    const roots = [...document.querySelectorAll('ytd-watch-metadata ytd-subscribe-button-renderer, ytd-watch-metadata yt-subscribe-button-view-model, yt-page-header-view-model yt-subscribe-button-view-model, yt-page-header-view-model ytd-subscribe-button-renderer, yt-page-header-renderer ytd-subscribe-button-renderer, yt-page-header-renderer yt-subscribe-button-view-model, ytd-c4-tabbed-header-renderer ytd-subscribe-button-renderer')];
    const root = roots.find((node) => node.getClientRects().length) || null;
    if (!root) return null;
    if (root.hasAttribute("subscribed")) return true;
    const button = root.querySelector("button");
    const aria = button?.getAttribute("aria-label") || "";
    const text = button?.textContent?.trim() || "";
    if (/unsubscribe|取消訂閱|取消订阅/i.test(`${aria} ${text}`)) return true;
    if (/^(subscribed|已訂閱|已订阅)$/i.test(text)) return true;
    if (/^(subscribe|訂閱|订阅)$/i.test(text) || /subscribe to|訂閱「|订阅“/i.test(aria)) return false;
    return null;
  }

  function currentControlHost() {
    const selectors = [
      'ytd-watch-metadata #owner #subscribe-button',
      'ytd-watch-metadata yt-subscribe-button-view-model',
      'yt-page-header-view-model yt-subscribe-button-view-model',
      'yt-page-header-view-model ytd-subscribe-button-renderer',
      'yt-page-header-renderer yt-subscribe-button-view-model',
      'yt-page-header-renderer #subscribe-button',
      'ytd-c4-tabbed-header-renderer #subscribe-button',
      '#page-header #subscribe-button'
    ];
    const subscribe = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
      .find((node) => node.getClientRects().length && !node.closest("#tubeshelf-channel-control"));
    return subscribe?.closest(".ytFlexibleActionsViewModelAction") || subscribe || null;
  }

  function currentChannelRecordId(channel) {
    const identities = [
      channel?.id,
      channel?.url,
      ...(channel?.aliasIds || []),
      channel?.channelId ? `/channel/${channel.channelId}` : ""
    ];
    return identities.map((identity) => Core.resolveChannelRecordId(state, identity)).find(Boolean) || "";
  }

  function classificationBadges(groups) {
    return groups.length
      ? groups.map((group) => `<span class="ts-channel-classification-group"><span class="ts-channel-classification-dot" style="background:${group.color}"></span>${escapeHtml(group.name)}</span>`).join("")
      : `<span class="ts-channel-classification-group ts-unfiled">${escapeHtml(Core.translateUiText("未分類", currentLanguage()))}</span>`;
  }

  function renderCurrentChannelClassification(channel) {
    const existing = document.getElementById("tubeshelf-channel-classification");
    const recordId = currentChannelRecordId(channel);
    const pageHeader = document.querySelector("yt-page-header-view-model, yt-page-header-renderer, ytd-c4-tabbed-header-renderer");
    const rows = [...(pageHeader?.querySelectorAll("yt-content-metadata-view-model .ytContentMetadataViewModelMetadataRow, .ytContentMetadataViewModelMetadataRow") || [])]
      .filter((row) => row.getClientRects().length);
    const metadataRow = rows.at(-1) || null;
    if (!recordId || !metadataRow) { existing?.remove(); return; }

    const groups = channelGroups(recordId);
    const signature = JSON.stringify([recordId, currentLanguage(), groups.map((group) => [group.id, group.name, group.color])]);
    const classification = existing || document.createElement("div");
    classification.id = "tubeshelf-channel-classification";
    if (classification.previousElementSibling !== metadataRow) metadataRow.insertAdjacentElement("afterend", classification);
    if (classification.dataset.signature === signature) return;
    classification.dataset.signature = signature;
    const label = Core.translateUiText("分類", currentLanguage());
    classification.innerHTML = `<span class="ts-channel-classification-label">${escapeHtml(label)}</span><span class="ts-channel-classification-groups">${classificationBadges(groups)}</span>`;
  }

  function renderCurrentChannelControl() {
    if (!state.settings.enabled) return;
    if (location.pathname !== "/watch" && !Core.channelKey(location.href)) {
      document.getElementById("tubeshelf-channel-control")?.remove();
      document.getElementById("tubeshelf-channel-classification")?.remove();
      return;
    }
    const channel = currentChannelFromPage();
    renderCurrentChannelClassification(channel);
    const host = currentControlHost();
    const recordId = currentChannelRecordId(channel);
    const subscribed = currentSubscriptionStatus();
    if (!channel || !host || !recordId || subscribed === false) { document.getElementById("tubeshelf-channel-control")?.remove(); return; }
    let control = document.getElementById("tubeshelf-channel-control");
    if (!control) {
      control = document.createElement("div");
      control.id = "tubeshelf-channel-control";
      control.addEventListener("click", onCurrentChannelClick);
      host.insertAdjacentElement("afterend", control);
    } else if (control.previousElementSibling !== host) {
      host.insertAdjacentElement("afterend", control);
    }
    const memberships = new Set(channelGroups(channel.id).map((group) => group.id));
    const favorite = state.favoriteChannelIds.includes(recordId);
    const signature = JSON.stringify([channel.id, channel.name, subscribed, favorite, currentLanguage(), [...memberships], state.groups.map((group) => [group.id, group.name, group.color])]);
    if (control.dataset.signature === signature) return;
    const wasOpen = control.classList.contains("ts-current-open");
    control.dataset.signature = signature;
    control.dataset.channelId = channel.id;
    const options = state.groups.length
      ? state.groups.map((group) => `<label class="ts-current-option"><input type="checkbox" data-ts-current-group="${escapeHtml(group.id)}" ${memberships.has(group.id) ? "checked" : ""}><span class="ts-current-dot" style="background:${group.color}"></span><span>${escapeHtml(group.name)}</span></label>`).join("")
      : '<span class="ts-current-empty">尚未建立群組</span>';
    control.innerHTML = `<button class="ts-current-trigger" type="button" aria-expanded="${wasOpen}" title="更改這個頻道的分類"><span>${Core.iconSvg("book", "currentColor", 15)}</span><span>分類</span></button><div class="ts-current-menu"><strong>${escapeHtml(channel.name)}</strong><small>${memberships.size ? "選擇所屬群組" : "目前在未分類"}</small><div>${options}</div><button data-ts-current-manage type="button">管理全部群組 ↗</button></div>`;
    control.classList.toggle("ts-current-open", wasOpen);
    const star = document.createElement("button");
    star.className = "ts-current-favorite";
    star.type = "button";
    star.setAttribute("aria-pressed", String(favorite));
    star.title = Core.translateUiText(favorite ? "取消關注" : "關注頻道", currentLanguage());
    star.textContent = `${favorite ? "★" : "☆"} ${Core.translateUiText(favorite ? "已關注" : "關注頻道", currentLanguage())}`;
    control.append(star);
    localizeExtensionUi(control);
  }

  async function onCurrentChannelClick(event) {
    const star = event.target.closest(".ts-current-favorite");
    if (star) {
      const id = currentChannelRecordId(currentChannelFromPage());
      if (!id || star.disabled || currentSubscriptionStatus() === false) return;
      star.disabled = true;
      try {
        await commit({ type: "edit-favorites", payload: { changes: [{ channelId: id, enabled: !state.favoriteChannelIds.includes(id) }] } });
      } catch (_) { toast("儲存失敗，請重試。"); }
      finally { star.disabled = false; renderCurrentChannelControl(); }
      return;
    }
    const trigger = event.target.closest(".ts-current-trigger");
    if (trigger) {
      const control = event.currentTarget;
      control.classList.toggle("ts-current-open");
      trigger.setAttribute("aria-expanded", String(control.classList.contains("ts-current-open")));
      return;
    }
    if (event.target.closest("[data-ts-current-manage]")) {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
      return;
    }
    const input = event.target.closest("[data-ts-current-group]");
    if (!input) return;
    const channel = currentChannelFromPage();
    if (!channel || currentSubscriptionStatus() === false) { input.checked = false; toast("請先訂閱這個頻道，再加入群組"); return; }
    const group = state.groups.find((item) => item.id === input.dataset.tsCurrentGroup);
    await commit({ type: "toggle-membership", payload: { channel, channelId: channel.id, aliasIds: channel.aliasIds, groupId: input.dataset.tsCurrentGroup, enabled: input.checked } });
    toast(input.checked ? `已加入「${group?.name || "群組"}」` : `已移出「${group?.name || "群組"}」`);
  }

  async function syncSubscriptionState() {
    if (!state.settings.enabled) return;
    const channel = currentChannelFromPage();
    const subscribed = currentSubscriptionStatus();
    if (!channel || subscribed === null) return;
    const storedAliases = (channel.aliasIds || []).filter((id) => id !== channel.id && state.channels[id]);
    if (storedAliases.length) {
      await commit({ type: "coalesce-channel-identities", payload: { primaryChannel: channel, aliasIds: storedAliases } });
      if (!state.settings.enabled) return;
    }
    if (trackedSubscription.channelId !== channel.id) {
      trackedSubscription = { channelId: channel.id, subscribed };
      if (subscribed && !state.channels[channel.id]) await commit({ type: "set-subscription", payload: { subscribed: true, channel, aliasIds: channel.aliasIds } });
      renderCurrentChannelControl();
      return;
    }
    if (trackedSubscription.subscribed === subscribed) return;
    const previous = trackedSubscription.subscribed;
    trackedSubscription.subscribed = subscribed;
    if (previous === false && subscribed === true) {
      if (!state.channels[channel.id]) {
        await commit({ type: "set-subscription", payload: { subscribed: true, channel, aliasIds: channel.aliasIds } });
      }
      toast("已加入未分類，稍後可以選擇群組");
    } else if (previous === true && subscribed === false && state.channels[channel.id]) {
      await commit({ type: "set-subscription", payload: { subscribed: false, channelId: channel.id, aliasIds: channel.aliasIds } });
      toast("已取消訂閱並從 TubeShelf 移除");
    }
    renderCurrentChannelControl();
  }

  function scheduleSubscriptionSync() {
    if (!state.settings.enabled) return;
    clearTimeout(subscriptionSyncTimer);
    subscriptionSyncTimer = setTimeout(() => syncSubscriptionState().catch(() => {}), 700);
  }

  function makeShell() {
    const launcher = document.createElement("button");
    launcher.id = "tubeshelf-launcher";
    launcher.type = "button";
    launcher.title = "開啟 TubeShelf";
    launcher.setAttribute("aria-label", "開啟 TubeShelf 訂閱整理");
    launcher.innerHTML = `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" aria-hidden="true"><path d="M5 5.8A2.8 2.8 0 0 1 7.8 3H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7.8A2.8 2.8 0 0 1 5 16.2V5.8Z" fill="currentColor" opacity=".3"/><path d="M4 7a2 2 0 0 1 2-2h10.5a1.5 1.5 0 0 1 0 3H8v8h8.5a1.5 1.5 0 0 1 0 3H6a2 2 0 0 1-2-2V7Z" fill="currentColor"/><path d="m11 10 5 3-5 3v-6Z" fill="currentColor"/></svg>`;

    const backdrop = document.createElement("div");
    backdrop.id = "tubeshelf-backdrop";
    const panel = document.createElement("aside");
    panel.id = "tubeshelf-panel";
    panel.setAttribute("aria-label", "TubeShelf");
    panel.innerHTML = `
      <header class="ts-panel-header">
        <div class="ts-logo"><svg viewBox="0 0 24 24" width="21" height="21" fill="white"><path d="M5 5.8A2.8 2.8 0 0 1 7.8 3H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7.8A2.8 2.8 0 0 1 5 16.2V5.8Zm6 4.2v6l5-3-5-3Z"/></svg></div>
        <div class="ts-title-wrap"><h2 class="ts-title">TubeShelf</h2><div class="ts-subtitle">你的 YouTube 訂閱書架</div></div>
        <button class="ts-icon-button" data-action="close" aria-label="關閉"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="m7.4 6 4.6 4.6L16.6 6 18 7.4 13.4 12l4.6 4.6-1.4 1.4-4.6-4.6L7.4 18 6 16.6l4.6-4.6L6 7.4 7.4 6Z"/></svg></button>
      </header>
      <nav class="ts-page-switch" aria-label="YouTube 內容來源">
        <button data-action="home" type="button"><span class="ts-page-icon">⌂</span><span><strong>首頁推薦</strong><small>YouTube 演算法</small></span></button>
        <button data-action="subscriptions" type="button"><span class="ts-page-icon">▦</span><span><strong>訂閱內容</strong><small>TubeShelf 群組</small></span></button>
      </nav>
      <p class="ts-page-note" id="ts-page-note"></p>
      <section class="ts-section ts-groups-section">
        <div class="ts-section-label"><span>訂閱群組</span><span id="ts-channel-total"></span></div>
        <div class="ts-groups" id="ts-groups"></div>
      </section>
      <div class="ts-divider"></div>
      <section class="ts-section ts-settings-section">
        <div class="ts-section-label"><span>減少干擾</span></div>
        <div class="ts-toggles">
          <label class="ts-toggle-row"><span>封鎖首頁</span><button class="ts-switch" data-setting="blockHome" role="switch" aria-checked="false"></button></label>
          <label class="ts-toggle-row"><span>關閉 Shorts</span><button class="ts-switch" data-setting="hideShorts" role="switch" aria-checked="false"></button></label>
          <label class="ts-toggle-row"><span><strong>隱藏影片右側欄</strong><small>隱藏觀看頁的推薦內容，並預設關閉自動播放</small></span><button class="ts-switch" data-setting="hideSecondary" role="switch" aria-checked="false"></button></label>
          <label class="ts-toggle-row"><span>關閉自動播放</span><button class="ts-switch" data-setting="disableAutoplay" role="switch" aria-checked="false"></button></label>
          <label class="ts-toggle-row"><span>隱藏已觀看影片</span><button class="ts-switch" data-setting="hideWatched" role="switch" aria-checked="false"></button></label>
        </div>
      </section>
      <footer class="ts-panel-footer">
        <button class="ts-button" data-action="update-subscriptions">更新訂閱內容</button>
        <button class="ts-button ts-primary" data-action="manage">管理群組</button>
        <div class="ts-support-card"><a class="ts-support-link" href="https://buymeacoffee.com/tananis" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span><span>支持與回饋 ↗</span></a><p>有問題想回報，或有功能想許願？</p><small>用一杯咖啡支持開發，也把你的想法留給我。</small></div>
      </footer>`;

    const toast = document.createElement("div");
    toast.className = "ts-toast";
    toast.id = "ts-toast";
    document.documentElement.append(launcher, backdrop, panel, toast);

    launcher.addEventListener("click", openPanel);
    backdrop.addEventListener("click", closePanel);
    panel.addEventListener("click", onPanelClick);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanel();
    });
  }

  function openPanel() {
    $("#tubeshelf-backdrop")?.classList.add("ts-open");
    $("#tubeshelf-panel")?.classList.add("ts-open");
  }

  function closePanel() {
    $("#tubeshelf-backdrop")?.classList.remove("ts-open");
    $("#tubeshelf-panel")?.classList.remove("ts-open");
  }

  function toast(message) {
    if (!state.settings.enabled) return;
    const node = $("#ts-toast");
    if (!node) return;
    node.textContent = Core.translateUiText(message, currentLanguage());
    node.classList.add("ts-show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("ts-show"), 2200);
  }

  function renderGroups() {
    if (!state.settings.enabled) return;
    const host = $("#ts-groups");
    if (!host) return;
    const total = Object.keys(state.channels).length;
    $("#ts-channel-total").textContent = `${total} 個頻道`;
    const all = { id: "all", name: "全部訂閱", icon: "star", color: "#7c5cff", channelIds: Object.keys(state.channels) };
    const unfiled = { id: "unfiled", name: "未分類", icon: "sparkles", color: "#f0a44b", channelIds: unfiledChannelIds() };
    const currentPage = pageKind();
    host.innerHTML = [all, unfiled, ...state.groups].map((group) => `
      <button class="ts-group ${currentPage === "subscriptions" && group.id === activeGroupId ? "ts-active" : ""}" data-group="${escapeHtml(group.id)}">
        <span class="ts-group-icon" style="color:${group.color};background:${group.color}20">${Core.iconSvg(group.icon, "currentColor", 18)}</span>
        <span><span class="ts-group-name">${escapeHtml(group.name)}</span><span class="ts-group-count" style="display:block">${group.id === "all" ? "目前已收集" : group.id === "unfiled" ? "等待整理" : "已分類"}</span></span>
        <span class="ts-pill">${group.channelIds.length}</span>
      </button>`).join("");
    $$('[data-action="home"], [data-action="subscriptions"]', $("#tubeshelf-panel")).forEach((button) => {
      const active = button.dataset.action === currentPage;
      button.classList.toggle("ts-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    const homeButton = $('[data-action="home"]', $("#tubeshelf-panel"));
    if (homeButton) homeButton.hidden = Boolean(state.settings.blockHome);
    const pageNote = $("#ts-page-note");
    if (pageNote) pageNote.textContent = currentPage === "home"
      ? state.settings.blockHome ? "首頁推薦目前已封鎖，將直接前往訂閱內容。" : "首頁由 YouTube 演算法決定，不套用訂閱群組。"
      : currentPage === "subscriptions" ? "只有訂閱內容會套用群組與已觀看影片篩選。" : "這個頁面不套用訂閱群組；減少干擾設定仍然有效。";
    $$('[data-setting]', $("#tubeshelf-panel")).forEach((button) => button.setAttribute("aria-checked", String(Boolean(state.settings[button.dataset.setting]))));
    localizeExtensionUi($("#tubeshelf-launcher"));
    localizeExtensionUi($("#tubeshelf-panel"));
  }

  function integratedSignature() {
    return JSON.stringify({
      activeGroupId,
      favorites: favorites.active(),
      groups: state.groups.map((group) => [group.id, group.name, group.icon, group.color, group.channelIds.length]),
      channels: Object.keys(state.channels).length,
      settings: state.settings,
      page: pageKind()
    });
  }

  function groupButtons(className) {
    const all = { id: "all", name: "全部", icon: "star", color: "#7c5cff", channelIds: Object.keys(state.channels) };
    const unfiled = { id: "unfiled", name: "未分類", icon: "sparkles", color: "#f0a44b", channelIds: unfiledChannelIds() };
    return [all, unfiled, ...state.groups].map((group) => {
      if (className === "ts-guide-item") {
        return `<button class="ts-guide-item ${isSubscriptionsPage() && !favorites.active() && group.id === activeGroupId ? "ts-active" : ""}" data-ts-group="${escapeHtml(group.id)}" type="button"><span class="ts-guide-dot" style="color:${group.color};background:${group.color}20">${Core.iconSvg(group.icon, "currentColor", 15)}</span><span class="ts-guide-name">${escapeHtml(group.id === "all" ? "全部訂閱" : group.name)}</span><span class="ts-guide-count">${group.channelIds.length}</span></button>`;
      }
      return `<button class="ts-toolbar-chip ${isSubscriptionsPage() && !favorites.active() && group.id === activeGroupId ? "ts-active" : ""}" data-ts-group="${escapeHtml(group.id)}" type="button">${escapeHtml(group.name)} <small>${group.channelIds.length}</small></button>`;
    }).join("");
  }

  function mountIntegratedControls() {
    const guideSections = document.querySelector("ytd-guide-renderer #sections");
    if (guideSections && !document.getElementById("tubeshelf-guide-section")) {
      const section = document.createElement("section");
      section.id = "tubeshelf-guide-section";
      section.addEventListener("click", onIntegratedClick);
      guideSections.insertBefore(section, guideSections.children[1] || null);
    }

    if (!isSubscriptionsPage()) document.getElementById("tubeshelf-toolbar")?.remove();
    const browse = isSubscriptionsPage() ? document.querySelector('ytd-browse[page-subtype="subscriptions"]') : null;
    const primary = browse?.querySelector("#primary");
    if (primary && !document.getElementById("tubeshelf-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.id = "tubeshelf-toolbar";
      toolbar.addEventListener("click", onIntegratedClick);
      primary.insertBefore(toolbar, primary.firstChild);
    }
    const visibleGuide = document.getElementById("tubeshelf-guide-section");
    document.documentElement.classList.toggle("tubeshelf-integrated", Boolean(visibleGuide || document.getElementById("tubeshelf-toolbar")));
  }

  function renderIntegratedControls() {
    if (!state.settings.enabled) return;
    mountIntegratedControls();
    favorites.render();
    const signature = integratedSignature();
    const guide = document.getElementById("tubeshelf-guide-section");
    if (guide && guide.dataset.signature !== signature) {
      guide.dataset.signature = signature;
      guide.innerHTML = `<div class="ts-favorite-entry"><button class="ts-guide-item ${favorites.active() ? "ts-active" : ""}" data-ts-action="favorites" type="button" aria-current="${favorites.active() ? "page" : "false"}"><span class="ts-guide-dot">☆</span><span class="ts-guide-name">最關注頻道</span></button></div><div class="ts-guide-heading"><span>TubeShelf 群組</span><span class="ts-guide-actions"><button class="ts-guide-toggle" data-ts-action="toggle-guide" type="button"><span aria-hidden="true">▴</span></button><button data-ts-action="update-subscriptions" type="button" title="更新訂閱內容" aria-label="更新訂閱內容">↻</button><button data-ts-action="manage" type="button" title="管理群組" aria-label="管理 TubeShelf 群組">＋</button></span></div><div class="ts-guide-list">${groupButtons("ts-guide-item")}</div>`;
      localizeExtensionUi(guide);
    }
    if (guide) {
      guide.classList.toggle("ts-collapsed", guideCollapsed);
      const toggle = guide.querySelector(".ts-guide-toggle");
      const toggleLabel = Core.translateUiText(guideCollapsed ? "展開 TubeShelf 群組" : "收合 TubeShelf 群組", currentLanguage());
      toggle?.setAttribute("aria-expanded", String(!guideCollapsed));
      toggle?.setAttribute("title", toggleLabel);
      toggle?.setAttribute("aria-label", toggleLabel);
    }
    const toolbar = document.getElementById("tubeshelf-toolbar");
    if (toolbar && toolbar.dataset.signature !== signature) {
      toolbar.dataset.signature = signature;
      toolbar.innerHTML = `<div class="ts-toolbar-groups">${groupButtons("ts-toolbar-chip")}</div><div class="ts-toolbar-tools"><button class="ts-toolbar-action" data-ts-action="manage" type="button" title="開啟 TubeShelf" aria-label="開啟 TubeShelf 群組與設定">⚙</button></div>`;
      localizeExtensionUi(toolbar);
    }
  }

  async function onIntegratedClick(event) {
    const groupId = event.target.closest("[data-ts-group]")?.dataset.tsGroup;
    const action = event.target.closest("[data-ts-action]")?.dataset.tsAction;
    const setting = event.target.closest("[data-ts-setting]")?.dataset.tsSetting;
    if (groupId) {
      openSubscriptionGroup(groupId);
      return;
    }
    if (setting) {
      await changeSetting(setting, !state.settings[setting]);
      return;
    }
    if (action === "favorites") {
      if (!isSubscriptionsPage()) { location.assign("https://www.youtube.com/feed/subscriptions#tubeshelf-view=favorites"); return; }
      location.hash = "tubeshelf-view=favorites";
      renderIntegratedControls();
      return;
    }
    if (action === "toggle-guide") {
      guideCollapsed = !guideCollapsed;
      renderIntegratedControls();
      return;
    }
    if (action === "manage") openPanel();
    if (action === "update-subscriptions") await startSubscriptionUpdate();
  }

  async function onPanelClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const groupId = event.target.closest("[data-group]")?.dataset.group;
    const setting = event.target.closest("[data-setting]")?.dataset.setting;
    if (action === "close") closePanel();
    if (action === "manage") chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    if (action === "update-subscriptions") await startSubscriptionUpdate();
    if (action === "home") { location.assign("https://www.youtube.com/"); return; }
    if (action === "subscriptions") { openSubscriptionGroup("all"); return; }
    if (groupId) {
      if (openSubscriptionGroup(groupId)) toast(groupId === "all" ? "顯示全部訂閱" : groupId === "unfiled" ? "只顯示未分類頻道" : `只顯示「${state.groups.find((g) => g.id === groupId)?.name || "群組"}」`);
    }
    if (setting) {
      await changeSetting(setting, !state.settings[setting]);
    }
  }

  async function changeSetting(setting, enabled) {
    await commit({ type: "set-setting", payload: { setting, enabled } });
    if (setting === "hideSecondary" && enabled) toast("已隱藏影片右側欄，並關閉自動播放");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function findChannelInCard(card) {
    const link = card.querySelector('a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
    if (!link) return null;
    const id = Core.channelKey(link.href || link.getAttribute("href"));
    if (!id) return null;
    const nameNode = card.querySelector("#text, #channel-title, #channel-name, yt-formatted-string.ytd-channel-name");
    const avatar = card.querySelector("#avatar img, yt-img-shadow img")?.src || "";
    return enrichChannelIdentity({ id, url: link.href, name: nameNode?.textContent?.trim() || link.textContent?.trim() || id, avatar });
  }

  function renderCardClassification(card, channel, recordId) {
    const existing = card.querySelector(":scope .tubeshelf-card-classification");
    const metadata = card.querySelector("yt-lockup-metadata-view-model yt-content-metadata-view-model, yt-content-metadata-view-model");
    const rows = [...(metadata?.querySelectorAll(":scope > .ytContentMetadataViewModelMetadataRow") || [])];
    const metadataRow = rows.at(-1) || null;
    if (!channel || !recordId || !metadataRow) { existing?.remove(); return; }

    const groups = channelGroups(recordId);
    const signature = JSON.stringify([recordId, currentLanguage(), groups.map((group) => [group.id, group.name, group.color])]);
    const classification = existing || document.createElement("div");
    classification.className = "tubeshelf-card-classification";
    if (classification.previousElementSibling !== metadataRow) metadataRow.insertAdjacentElement("afterend", classification);
    if (classification.dataset.signature === signature) return;
    classification.dataset.signature = signature;
    classification.innerHTML = `<span class="ts-channel-classification-label">${escapeHtml(Core.translateUiText("分類", currentLanguage()))}</span><span class="ts-channel-classification-groups">${classificationBadges(groups)}</span>`;
  }

  function isWatchedCard(card) {
    if (card.querySelector("ytd-thumbnail-overlay-resume-playback-renderer, yt-thumbnail-overlay-progress-bar-view-model")) return true;
    const progress = card.querySelector('#progress[style*="width"], [class*="Progress"][style*="width"], [class*="progress"][style*="width"]');
    if (progress) {
      const width = Number.parseFloat(progress.style.width || "0");
      if (width > 0) return true;
    }
    return Boolean(card.querySelector('[aria-label*="已觀看"], [aria-label*="觀看過"], [aria-label*="Watched" i]'));
  }

  async function startSubscriptionUpdate() {
    toast("即將更新全部訂閱內容…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "START_SUBSCRIPTION_UPDATE" });
      if (!result?.ok) toast("無法啟動訂閱更新");
    } catch (_error) {
      toast("無法更新訂閱內容，請重新載入擴充套件");
    }
  }

  function renderScanProgress(count, done) {
    if (!state.settings.enabled) return;
    let overlay = document.getElementById("tubeshelf-scan-progress");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tubeshelf-scan-progress";
      document.documentElement.append(overlay);
    }
    overlay.innerHTML = `<div class="ts-scan-card"><div class="ts-scan-symbol">${done ? "✓" : "↻"}</div><h2>${done ? "訂閱內容已更新" : "正在更新訂閱內容"}</h2><p>${done ? "這個分頁即將自動關閉。" : "TubeShelf 正在自動向下載入所有訂閱頻道，請暫時不要關閉這個分頁。"}</p><strong>${count}</strong><small>個頻道</small></div>`;
    localizeExtensionUi(overlay);
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function runSubscriptionUpdate() {
    if (!state.settings.enabled) return;
    const generation = ++scanGeneration;
    const checkActive = () => {
      if (!state.settings.enabled || generation !== scanGeneration) throw Object.assign(new Error("TubeShelf paused"), { code: "TUBESHELF_DISABLED" });
    };
    const startedAt = Date.now();
    const found = new Map();
    let stableRounds = 0;
    let lastCount = -1;
    let lastHeight = -1;
    let reachedEnd = false;
    window.postMessage({ source: IDENTITY_BRIDGE_SOURCE, type: "REQUEST_IDENTITIES" }, location.origin);
    renderScanProgress(0, false);
    try {
      for (let readyRound = 0; readyRound < 30; readyRound++) {
        checkActive();
        if (document.querySelector("ytd-channel-renderer")) break;
        await wait(500);
      }
      for (let round = 0; round < 240; round++) {
        checkActive();
        document.querySelectorAll("ytd-channel-renderer").forEach((card) => {
          const channel = findChannelInCard(card);
          if (channel) found.set(channel.id, channel);
        });
        renderScanProgress(found.size, false);
        if (round % 4 === 0) chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_PROGRESS", count: found.size, startedAt }).catch(() => {});
        const height = document.documentElement.scrollHeight;
        const atBottom = window.scrollY + window.innerHeight >= height - 120;
        stableRounds = found.size === lastCount && height === lastHeight && atBottom ? stableRounds + 1 : 0;
        if (stableRounds >= 5) { reachedEnd = true; break; }
        lastCount = found.size;
        lastHeight = height;
        window.scrollTo(0, height);
        await wait(700);
      }
      if (!found.size) throw new Error("No channels found");
      if (!reachedEnd) throw new Error("Subscription list did not reach a stable end");
      const scannedChannels = [...found.values()].map(enrichChannelIdentity);
      checkActive();
      await commit({ type: "reconcile-subscription-scan", payload: { channels: scannedChannels } });
      checkActive();
      renderScanProgress(found.size, true);
      await chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_COMPLETE", count: found.size });
    } catch (error) {
      if (error?.code === "TUBESHELF_DISABLED") {
        chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_FAILED", count: found.size, error: "TUBESHELF_DISABLED" }).catch(() => {});
        return;
      }
      renderScanProgress(found.size, false);
      const card = document.querySelector("#tubeshelf-scan-progress .ts-scan-card");
      const guarded = error?.code === "SCAN_SHRINK_GUARD";
      if (card) card.innerHTML = `<div class="ts-scan-symbol">!</div><h2>更新未完成</h2><p>${guarded ? "本次找到的頻道比現有書架少太多，已保留原資料以避免分類遺失。請確認清單完整，或手動確認使用本次結果。" : "請確認 YouTube 的所有訂閱頻道頁能正常顯示，再重新執行。"}</p><strong>${found.size}</strong><small>個已找到頻道</small>${guarded ? '<button id="tubeshelf-scan-force-apply" class="ts-button" type="button">仍以本次清單更新</button>' : ""}`;
      localizeExtensionUi(card);
      if (guarded) document.getElementById("tubeshelf-scan-force-apply")?.addEventListener("click", async (event) => {
        if (!confirm(Core.translateUiText(`本次只找到 ${found.size} 個頻道。仍要以這份清單取代目前書架嗎？被移除頻道的分類資料也會刪除。`, currentLanguage()))) return;
        event.currentTarget.disabled = true;
        try {
          const scannedChannels = [...found.values()].map(enrichChannelIdentity);
          await commit({ type: "reconcile-subscription-scan", payload: { channels: scannedChannels, allowLargeRemoval: true } });
          renderScanProgress(found.size, true);
          await chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_COMPLETE", count: found.size });
        } catch (forceError) {
          event.currentTarget.disabled = false;
          toast(String(forceError?.message || forceError));
        }
      });
      chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_FAILED", count: found.size, error: error?.code || String(error) }).catch(() => {});
    }
  }

  function applyDistractionControls(cards = null) {
    if (!state.settings.enabled) return;
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      homeRedirecting = false;
      shortsRedirecting = false;
    }
    const root = document.documentElement;
    root.classList.toggle("tubeshelf-block-home", Boolean(state.settings.blockHome));
    root.classList.toggle("tubeshelf-hide-shorts", Boolean(state.settings.hideShorts));
    root.classList.toggle("tubeshelf-hide-secondary", Boolean(state.settings.hideSecondary));

    const redirectUrl = Core.blockedPageRedirect(state.settings, location.href);
    if (redirectUrl && pageKind() === "home" && !homeRedirecting) {
      homeRedirecting = true;
      location.replace(redirectUrl);
      return;
    }

    if (redirectUrl && location.pathname.startsWith("/shorts") && !shortsRedirecting) {
      shortsRedirecting = true;
      location.replace(redirectUrl);
      return;
    }

    if (state.settings.hideShorts) {
      const shortCandidates = cards || allCards();
      for (const card of shortCandidates) {
        const isShorts = card.tagName.toLowerCase().includes("reel") || Boolean(card.querySelector('a[href^="/shorts/"], [is-shorts]'));
        card.classList.toggle("tubeshelf-shorts-hidden", isShorts);
      }
    } else if (cards) {
      cards.forEach((card) => card.classList.remove("tubeshelf-shorts-hidden"));
    } else {
      $$(".tubeshelf-shorts-hidden").forEach((card) => card.classList.remove("tubeshelf-shorts-hidden"));
    }

    if (state.settings.disableAutoplay) {
      const autoplayToggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (autoplayToggle instanceof HTMLElement) { autoplayRestore = new WeakRef(autoplayToggle); autoplayToggle.click(); }
    }
  }

  function applyFilters(cards = null) {
    if (!state.settings.enabled) return;
    applyDistractionControls(cards);
    if (!isSubscriptionsPage()) {
      (cards || $$('.tubeshelf-hidden')).forEach((card) => card.classList.remove("tubeshelf-hidden"));
      $$(".tubeshelf-card-classification").forEach((classification) => classification.remove());
      return;
    }
    const group = ["all", "unfiled"].includes(activeGroupId) ? null : state.groups.find((item) => item.id === activeGroupId);
    const allowed = activeGroupId === "unfiled" ? new Set(unfiledChannelIds()) : group ? new Set(group.channelIds) : null;
    const candidates = cards || allCards();
    for (const card of candidates) {
      let hidden = false;
      const channel = findChannelInCard(card);
      const recordId = channel ? Core.resolveChannelRecordId(state, channel.id) : "";
      const channelId = recordId || channel?.id || "";
      renderCardClassification(card, channel, recordId);
      if (allowed && (!channelId || !allowed.has(channelId))) hidden = true;
      if (state.settings.hideWatched) {
        if (isWatchedCard(card)) hidden = true;
      }
      card.classList.toggle("tubeshelf-hidden", hidden);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "OPEN_TUBESHELF") {
      if (!state.settings.enabled) { sendResponse({ ok: false, disabled: true }); return; }
      if (["all", "unfiled"].includes(message.groupId) || state.groups.some((group) => group.id === message.groupId)) activeGroupId = message.groupId;
      if (message.groupId && !isSubscriptionsPage()) {
        location.assign(Core.subscriptionGroupUrl(activeGroupId));
        sendResponse({ ok: true, navigating: true });
        return;
      }
      renderGroups();
      applyFilters();
      openPanel();
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      if (acceptState(changes[STORAGE_KEY].newValue)) refreshFromState();
    }
  });

  function collectMutationWork(mutations) {
    let structure = location.pathname !== lastPathname;
    const cards = new Set();
    const trackCards = isSubscriptionsPage() || state.settings.hideShorts;
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target?.closest(OWN_UI_SELECTOR)) continue;
      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (changedNodes.length && changedNodes.every((node) => node instanceof Element && node.matches(OWN_UI_SELECTOR))) continue;
      if (mutation.type === "attributes" && mutation.attributeName === "style" && (!isSubscriptionsPage() || !state.settings.hideWatched || !target?.matches('#progress, [class*="Progress"], [class*="progress"]'))) continue;
      if (mutation.target instanceof Element && mutation.target.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model")) structure = true;
      if (trackCards && mutation.target instanceof Element) {
        const targetCard = canonicalCard(mutation.target);
        if (targetCard) cards.add(targetCard);
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.closest(OWN_UI_SELECTOR)) continue;
        if (trackCards) collectCards(node, cards);
        if (!canonicalCard(node) && (node.matches(STRUCTURE_SELECTOR) || node.querySelector(STRUCTURE_SELECTOR) || node.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model") || node.querySelector("ytd-subscribe-button-renderer, yt-subscribe-button-view-model"))) structure = true;
      }
    }
    return { cards, structure };
  }

  function scheduleRefresh(delay = 32, options = {}) {
    if (!state.settings.enabled) return;
    if (options.full) pendingFullRefresh = true;
    if (options.structure) pendingStructureRefresh = true;
    options.cards?.forEach((card) => pendingCards.add(card));
    if (document.hidden) { pendingFullRefresh = true; pendingCards.clear(); return; }
    // Keep the first deadline: a busy feed must not postpone filtering indefinitely.
    if (scanTimer !== null && delay !== 0) return;
    if (scanTimer !== null) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const full = pendingFullRefresh;
      const structure = pendingStructureRefresh;
      const cards = full ? null : [...pendingCards].filter((card) => card.isConnected);
      pendingFullRefresh = false;
      pendingStructureRefresh = false;
      pendingCards.clear();
      if (full) renderGroups();
      if (full || structure) renderIntegratedControls();
      if (full || structure) renderCurrentChannelControl();
      applyFilters(cards);
      if (structure) scheduleSubscriptionSync();
    }, delay);
  }

  const observer = new MutationObserver((mutations) => {
    const work = collectMutationWork(mutations);
    if (work.structure || work.cards.size) scheduleRefresh(32, work);
  });

  function updateObservation() {
    observer.disconnect();
    if (state.settings.enabled && !document.hidden && document.body) {
      const attributeFilter = ["href", "subscribed", "aria-pressed", "aria-checked"];
      if (isSubscriptionsPage() && state.settings.hideWatched) attributeFilter.push("style");
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter });
    }
    if (document.hidden) {
      clearTimeout(scanTimer);
      scanTimer = null;
      clearTimeout(subscriptionSyncTimer);
      pendingCards.clear();
      pendingFullRefresh = true;
      pendingStructureRefresh = true;
    }
  }

  async function init() {
    makeShell();
    await readState();
    syncActiveGroupFromLocation();
    refreshFromState();
    await syncSubscriptionState();
    applyFilters();
    updateObservation();
    document.addEventListener("yt-navigate-finish", () => {
      if (location.pathname !== "/feed/channels") scanIdentityByAlias.clear();
      updateObservation();
      pendingCards.clear();
      syncActiveGroupFromLocation();
      scheduleRefresh(0, { full: true, structure: true });
    });
    window.addEventListener("hashchange", () => { syncActiveGroupFromLocation(); scheduleRefresh(0, { full: true }); });
    document.addEventListener("click", (event) => {
      if (!state.settings.enabled) return;
      if (event.isTrusted && event.target.closest(".ytp-autonav-toggle-button")) autoplayRestore = null;
      const button = event.target.closest("button");
      if (!button) return;
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`;
      if (/subscribe|unsubscribe|訂閱|订阅/i.test(label) && !button.closest("#tubeshelf-panel, #tubeshelf-channel-control")) scheduleSubscriptionSync();
    }, true);
    document.addEventListener("visibilitychange", () => {
      updateObservation();
      if (!document.hidden) scheduleRefresh(0, { full: true, structure: true });
    });
    if (state.settings.enabled && location.pathname === "/feed/channels" && location.hash === "#tubeshelf-update-subscriptions") startupScanTimer = setTimeout(runSubscriptionUpdate, 900);
  }

  init();
})();
