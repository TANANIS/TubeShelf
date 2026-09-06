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
  const STRUCTURE_SELECTOR = 'ytd-guide-renderer, ytd-mini-guide-renderer, ytd-browse[page-subtype="subscriptions"], ytd-watch-flexy, yt-page-header-view-model, yt-page-header-renderer, yt-flexible-actions-view-model, yt-subscribe-button-view-model';
  const pendingCards = new Set();
  let pendingFullRefresh = false;
  let pendingStructureRefresh = false;
  let trackedSubscription = { channelId: "", subscribed: null };
  let subscriptionSyncTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pageKind = () => Core.youtubePageKind(location.href);
  const isSubscriptionsPage = () => pageKind() === "subscriptions";
  const currentLanguage = () => Core.languageCode(state.settings?.language);
  function localizeExtensionUi(root) { Core.localizeDom(root, currentLanguage()); }

  function unfiledChannelIds() {
    const filed = new Set(state.groups.flatMap((group) => group.channelIds));
    return Object.keys(state.channels).filter((id) => !filed.has(id));
  }

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
    activeGroupId = groupId || "all";
    renderGroups();
    renderIntegratedControls();
    applyFilters();
    return true;
  }

  async function readState() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    state = Core.normalizeState(result[STORAGE_KEY]);
    return state;
  }

  async function writeState(next) {
    state = Core.normalizeState(next);
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    renderGroups();
    renderIntegratedControls();
    renderCurrentChannelControl();
    applyFilters();
  }

  function currentChannelFromPage() {
    const watchOwner = document.querySelector('ytd-watch-metadata #owner a[href^="/@"], ytd-watch-metadata #owner a[href^="/channel/"], #upload-info a[href^="/@"], #upload-info a[href^="/channel/"]');
    const pageLink = watchOwner || document.querySelector('yt-page-header-view-model a[href^="/@"], yt-page-header-view-model a[href^="/channel/"], yt-page-header-renderer a[href^="/@"], ytd-c4-tabbed-header-renderer a[href^="/@"], link[rel="canonical"]');
    const rawUrl = pageLink?.href || (Core.channelKey(location.href) ? location.href : "");
    const id = Core.channelKey(rawUrl);
    if (!id) return null;
    const name = (watchOwner?.textContent || document.querySelector('yt-page-header-view-model h1, yt-page-header-view-model .yt-page-header-view-model__page-header-title, yt-page-header-renderer h1, ytd-c4-tabbed-header-renderer #channel-name')?.textContent || id).trim();
    const avatar = document.querySelector('ytd-watch-metadata #owner #avatar img, yt-page-header-view-model img, yt-page-header-renderer img, ytd-c4-tabbed-header-renderer #avatar img')?.src || "";
    return { id, url: new URL(rawUrl, location.origin).href, name, avatar };
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

  function renderCurrentChannelControl() {
    const channel = currentChannelFromPage();
    const host = currentControlHost();
    if (!channel || !host) { document.getElementById("tubeshelf-channel-control")?.remove(); return; }
    let control = document.getElementById("tubeshelf-channel-control");
    if (!control) {
      control = document.createElement("div");
      control.id = "tubeshelf-channel-control";
      control.addEventListener("click", onCurrentChannelClick);
      host.insertAdjacentElement("afterend", control);
    } else if (control.previousElementSibling !== host) {
      host.insertAdjacentElement("afterend", control);
    }
    const subscribed = currentSubscriptionStatus();
    const memberships = new Set(Core.groupForChannel(state, channel.id).map((group) => group.id));
    const signature = JSON.stringify([channel.id, channel.name, subscribed, [...memberships], state.groups.map((group) => [group.id, group.name, group.color])]);
    if (control.dataset.signature === signature) return;
    const wasOpen = control.classList.contains("ts-current-open");
    control.dataset.signature = signature;
    control.dataset.channelId = channel.id;
    const canOrganize = subscribed === true || Boolean(state.channels[channel.id]);
    const options = state.groups.length
      ? state.groups.map((group) => `<label class="ts-current-option"><input type="checkbox" data-ts-current-group="${escapeHtml(group.id)}" ${memberships.has(group.id) ? "checked" : ""} ${canOrganize ? "" : "disabled"}><span class="ts-current-dot" style="background:${group.color}"></span><span>${escapeHtml(group.name)}</span></label>`).join("")
      : '<span class="ts-current-empty">尚未建立群組</span>';
    control.innerHTML = `<button class="ts-current-trigger" type="button" aria-expanded="${wasOpen}" title="更改這個頻道的分類"><span>${Core.iconSvg("book", "currentColor", 15)}</span><span>分類</span></button><div class="ts-current-menu"><strong>${escapeHtml(channel.name)}</strong><small>${canOrganize ? (memberships.size ? "選擇所屬群組" : "目前在未分類") : "訂閱後即可分類"}</small><div>${options}</div><button data-ts-current-manage type="button">管理全部群組 ↗</button></div>`;
    control.classList.toggle("ts-current-open", wasOpen);
    localizeExtensionUi(control);
  }

  async function onCurrentChannelClick(event) {
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
    if (!state.channels[channel.id]) state = Core.upsertChannels(state, [channel]);
    state = Core.recordManualMembership(state, channel.id, input.dataset.tsCurrentGroup, input.checked);
    const group = state.groups.find((item) => item.id === input.dataset.tsCurrentGroup);
    await writeState(state);
    toast(input.checked ? `已加入「${group?.name || "群組"}」` : `已移出「${group?.name || "群組"}」`);
  }

  async function syncSubscriptionState() {
    const channel = currentChannelFromPage();
    const subscribed = currentSubscriptionStatus();
    if (!channel || subscribed === null) return;
    if (trackedSubscription.channelId !== channel.id) {
      trackedSubscription = { channelId: channel.id, subscribed };
      renderCurrentChannelControl();
      return;
    }
    if (trackedSubscription.subscribed === subscribed) return;
    const previous = trackedSubscription.subscribed;
    trackedSubscription.subscribed = subscribed;
    if (previous === false && subscribed === true) {
      if (!state.channels[channel.id]) {
        state = Core.upsertChannels(state, [channel]);
        await writeState(state);
      }
      toast("已加入未分類，稍後可以選擇群組");
    } else if (previous === true && subscribed === false && state.channels[channel.id]) {
      state = Core.removeChannel(state, channel.id);
      await writeState(state);
      toast("已取消訂閱並從 TubeShelf 移除");
    }
    renderCurrentChannelControl();
  }

  function scheduleSubscriptionSync() {
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
    const node = $("#ts-toast");
    if (!node) return;
    node.textContent = Core.translateUiText(message, currentLanguage());
    node.classList.add("ts-show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("ts-show"), 2200);
  }

  function renderGroups() {
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
        return `<button class="ts-guide-item ${isSubscriptionsPage() && group.id === activeGroupId ? "ts-active" : ""}" data-ts-group="${escapeHtml(group.id)}" type="button"><span class="ts-guide-dot" style="color:${group.color};background:${group.color}20">${Core.iconSvg(group.icon, "currentColor", 15)}</span><span class="ts-guide-name">${escapeHtml(group.id === "all" ? "全部訂閱" : group.name)}</span><span class="ts-guide-count">${group.channelIds.length}</span></button>`;
      }
      return `<button class="ts-toolbar-chip ${isSubscriptionsPage() && group.id === activeGroupId ? "ts-active" : ""}" data-ts-group="${escapeHtml(group.id)}" type="button">${escapeHtml(group.name)} <small>${group.channelIds.length}</small></button>`;
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
    mountIntegratedControls();
    const signature = integratedSignature();
    const guide = document.getElementById("tubeshelf-guide-section");
    if (guide && guide.dataset.signature !== signature) {
      guide.dataset.signature = signature;
      guide.innerHTML = `<div class="ts-guide-heading"><span>TubeShelf 群組</span><span class="ts-guide-actions"><button data-ts-action="update-subscriptions" type="button" title="更新訂閱內容" aria-label="更新訂閱內容">↻</button><button data-ts-action="manage" type="button" title="管理群組" aria-label="管理 TubeShelf 群組">＋</button></span></div><div class="ts-guide-list">${groupButtons("ts-guide-item")}</div>`;
      localizeExtensionUi(guide);
    }
    const toolbar = document.getElementById("tubeshelf-toolbar");
    if (toolbar && toolbar.dataset.signature !== signature) {
      toolbar.dataset.signature = signature;
      toolbar.innerHTML = `<div class="ts-toolbar-brand"><span>${Core.iconSvg("book", "currentColor", 15)}</span><strong>TubeShelf</strong></div><div class="ts-toolbar-groups">${groupButtons("ts-toolbar-chip")}</div><div class="ts-toolbar-tools"><button class="ts-toolbar-action" data-ts-action="manage" type="button" title="開啟 TubeShelf" aria-label="開啟 TubeShelf 群組與設定">⚙</button></div>`;
      localizeExtensionUi(toolbar);
    }
    renderCurrentChannelControl();
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
    state.settings = Core.settingsAfterToggle(state.settings, setting, enabled);
    await writeState(state);
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
    return { id, url: link.href, name: nameNode?.textContent?.trim() || link.textContent?.trim() || id, avatar };
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
    const startedAt = Date.now();
    const found = new Map();
    let stableRounds = 0;
    let lastCount = -1;
    let lastHeight = -1;
    let reachedEnd = false;
    renderScanProgress(0, false);
    try {
      for (let readyRound = 0; readyRound < 30; readyRound++) {
        if (document.querySelector("ytd-channel-renderer")) break;
        await wait(500);
      }
      for (let round = 0; round < 240; round++) {
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
      await readState();
      await writeState(Core.replaceChannels(state, [...found.values()]));
      renderScanProgress(found.size, true);
      await chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_COMPLETE", count: found.size });
    } catch (_error) {
      renderScanProgress(found.size, false);
      const card = document.querySelector("#tubeshelf-scan-progress .ts-scan-card");
      if (card) card.innerHTML = `<div class="ts-scan-symbol">!</div><h2>更新未完成</h2><p>請確認 YouTube 的所有訂閱頻道頁能正常顯示，再重新執行。</p><strong>${found.size}</strong><small>個已找到頻道</small>`;
      localizeExtensionUi(card);
      chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_FAILED", count: found.size }).catch(() => {});
    }
  }

  function applyDistractionControls(cards = null) {
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
      if (autoplayToggle instanceof HTMLElement) autoplayToggle.click();
    }
  }

  function applyFilters(cards = null) {
    applyDistractionControls(cards);
    if (!isSubscriptionsPage()) {
      (cards || $$('.tubeshelf-hidden')).forEach((card) => card.classList.remove("tubeshelf-hidden"));
      return;
    }
    const group = ["all", "unfiled"].includes(activeGroupId) ? null : state.groups.find((item) => item.id === activeGroupId);
    const allowed = activeGroupId === "unfiled" ? new Set(unfiledChannelIds()) : group ? new Set(group.channelIds) : null;
    const candidates = cards || allCards();
    for (const card of candidates) {
      let hidden = false;
      const channel = findChannelInCard(card);
      if (allowed && (!channel || !allowed.has(channel.id))) hidden = true;
      if (state.settings.hideWatched) {
        if (isWatchedCard(card)) hidden = true;
      }
      card.classList.toggle("tubeshelf-hidden", hidden);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "OPEN_TUBESHELF") {
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
      state = Core.normalizeState(changes[STORAGE_KEY].newValue);
      renderGroups();
      renderIntegratedControls();
      renderCurrentChannelControl();
      applyFilters();
    }
  });

  function collectMutationWork(mutations) {
    let structure = location.pathname !== lastPathname;
    const cards = new Set();
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model")) structure = true;
      if (mutation.target instanceof Element) {
        const targetCard = canonicalCard(mutation.target);
        if (targetCard) cards.add(targetCard);
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.closest("#tubeshelf-panel, #tubeshelf-toolbar, #tubeshelf-guide-section, #tubeshelf-launcher, #tubeshelf-backdrop, #tubeshelf-scan-progress")) continue;
        collectCards(node, cards);
        if (node.matches(STRUCTURE_SELECTOR) || node.querySelector(STRUCTURE_SELECTOR) || node.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model") || node.querySelector("ytd-subscribe-button-renderer, yt-subscribe-button-view-model")) structure = true;
      }
    }
    return { cards, structure };
  }

  function scheduleRefresh(delay = 180, options = {}) {
    if (options.full) pendingFullRefresh = true;
    if (options.structure) pendingStructureRefresh = true;
    options.cards?.forEach((card) => pendingCards.add(card));
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      const full = pendingFullRefresh;
      const structure = pendingStructureRefresh;
      const cards = full ? null : [...pendingCards].filter((card) => card.isConnected);
      pendingFullRefresh = false;
      pendingStructureRefresh = false;
      pendingCards.clear();
      if (full || structure) renderIntegratedControls();
      renderCurrentChannelControl();
      applyFilters(cards);
      if (structure) scheduleSubscriptionSync();
    }, delay);
  }

  const observer = new MutationObserver((mutations) => {
    const work = collectMutationWork(mutations);
    if (work.structure || work.cards.size) scheduleRefresh(180, work);
  });

  function updateObservation() {
    observer.disconnect();
    if (!document.hidden && document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    makeShell();
    await readState();
    if (isSubscriptionsPage()) {
      const requestedGroup = new URLSearchParams(location.hash.replace(/^#/, "")).get("tubeshelf-group");
      if (["all", "unfiled"].includes(requestedGroup) || state.groups.some((group) => group.id === requestedGroup)) activeGroupId = requestedGroup;
    }
    renderGroups();
    renderIntegratedControls();
    renderCurrentChannelControl();
    await syncSubscriptionState();
    applyFilters();
    updateObservation();
    document.addEventListener("yt-navigate-finish", () => scheduleRefresh(0, { full: true, structure: true }));
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`;
      if (/subscribe|unsubscribe|訂閱|订阅/i.test(label) && !button.closest("#tubeshelf-panel, #tubeshelf-channel-control")) scheduleSubscriptionSync();
    }, true);
    document.addEventListener("visibilitychange", () => {
      updateObservation();
      if (!document.hidden) scheduleRefresh(0, { full: true, structure: true });
    });
    if (location.pathname === "/feed/channels" && location.hash === "#tubeshelf-update-subscriptions") setTimeout(runSubscriptionUpdate, 900);
  }

  init();
})();
