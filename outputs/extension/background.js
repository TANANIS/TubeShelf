chrome.runtime.onInstalled.addListener(async () => {
  const saved = await chrome.storage.local.get("tubeShelfState");
  if (!saved.tubeShelfState) {
    const language = /^zh(?:-|_|$)/i.test(String(chrome.i18n?.getUILanguage?.() || "")) ? "zh-TW" : "en";
    await chrome.storage.local.set({
      tubeShelfState: {
        version: 11,
        groups: [
          { id: "learning", name: language === "en" ? "Learning" : "學習", icon: "book", color: "#7c5cff", channelIds: [] },
          { id: "relax", name: language === "en" ? "Relaxation" : "放鬆", icon: "sparkles", color: "#ff6b8a", channelIds: [] }
        ],
        channels: {},
        manualLabels: {},
        settings: { blockHome: false, hideShorts: false, hideSecondary: false, disableAutoplay: false, hideWatched: false, compactMode: false, onboardingComplete: false, language }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  if (message?.type === "START_SUBSCRIPTION_UPDATE") {
    (async () => {
      const saved = await chrome.storage.local.get("tubeShelfScanStatus");
      const current = saved.tubeShelfScanStatus;
      if (["starting", "running"].includes(current?.state) && current.tabId && Date.now() - current.startedAt < 300000) {
        try {
          await chrome.tabs.update(current.tabId, { active: true });
          sendResponse({ ok: true, tabId: current.tabId, existing: true });
          return;
        } catch (_error) {}
      }
      const tab = await chrome.tabs.create({ url: "https://www.youtube.com/feed/channels#tubeshelf-update-subscriptions", active: true });
      await chrome.storage.local.set({ tubeShelfScanStatus: { state: "starting", count: 0, startedAt: Date.now(), tabId: tab.id } });
      sendResponse({ ok: true, tabId: tab.id });
    })().catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_PROGRESS") {
    chrome.storage.local.set({ tubeShelfScanStatus: { state: "running", count: Number(message.count) || 0, startedAt: Number(message.startedAt) || Date.now(), tabId: _sender.tab?.id } });
    sendResponse({ ok: true });
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_COMPLETE") {
    const count = Number(message.count) || 0;
    chrome.storage.local.set({ tubeShelfScanStatus: { state: "complete", count, completedAt: Date.now() } });
    chrome.action.setBadgeBackgroundColor({ color: "#2dbd9b" });
    chrome.action.setBadgeText({ text: "✓" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
    if (_sender.tab?.id && _sender.tab.url?.includes("#tubeshelf-update-subscriptions")) {
      setTimeout(() => chrome.tabs.remove(_sender.tab.id).catch(() => {}), 900);
    }
    sendResponse({ ok: true });
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_FAILED") {
    chrome.storage.local.set({ tubeShelfScanStatus: { state: "failed", count: Number(message.count) || 0, completedAt: Date.now() } });
    sendResponse({ ok: true });
  }
});
