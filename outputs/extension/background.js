importScripts("shared.js");

const Core = globalThis.TubeShelfCore;
const STORAGE_KEY = "tubeShelfState";
const API_KEY_STORAGE = "tubeShelfYouTubeApiKey";
let stateWriteQueue = Promise.resolve();

function enqueueStateTask(task) {
  const transaction = stateWriteQueue.then(task);
  stateWriteQueue = transaction.catch(() => {});
  return transaction;
}

function enqueueStateOperation(operation) {
  return enqueueStateTask(async () => {
    const saved = await chrome.storage.local.get(STORAGE_KEY);
    const current = Core.normalizeState(saved[STORAGE_KEY]);
    const next = Core.applyStateOperation(current, operation);
    next.revision = current.revision + 1;
    const normalized = Core.normalizeState(next);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  });
}

chrome.runtime.onInstalled.addListener(() => enqueueStateTask(async () => {
  const saved = await chrome.storage.local.get(STORAGE_KEY);
  const current = Core.normalizeState(saved[STORAGE_KEY]);
  const normalized = Core.normalizeState({ ...current, revision: current.revision + 1 });
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
}));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  if (message?.type === "TUBESHELF_MUTATE") {
    enqueueStateOperation(message.operation)
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, code: error?.code || "STATE_MUTATION_FAILED", error: String(error?.message || error) }));
    return true;
  }
  if (message?.type === "TUBESHELF_SET_API_KEY") {
    chrome.storage.local.set({ [API_KEY_STORAGE]: String(message.value || "") })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
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
    chrome.storage.local.set({ tubeShelfScanStatus: { state: "running", count: Number(message.count) || 0, startedAt: Number(message.startedAt) || Date.now(), tabId: _sender.tab?.id } })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_COMPLETE") {
    const count = Number(message.count) || 0;
    (async () => {
      await chrome.storage.local.set({ tubeShelfScanStatus: { state: "complete", count, completedAt: Date.now() } });
      await chrome.action.setBadgeBackgroundColor({ color: "#2dbd9b" });
      await chrome.action.setBadgeText({ text: "✓" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
      if (_sender.tab?.id && _sender.tab.url?.includes("#tubeshelf-update-subscriptions")) setTimeout(() => chrome.tabs.remove(_sender.tab.id).catch(() => {}), 900);
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_FAILED") {
    chrome.storage.local.set({ tubeShelfScanStatus: { state: "failed", count: Number(message.count) || 0, completedAt: Date.now(), error: String(message.error || "") } })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});
