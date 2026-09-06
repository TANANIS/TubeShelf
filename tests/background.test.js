const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../extension/shared.js");

function loadBackground(initialState) {
  const store = { tubeShelfState: Core.normalizeState(initialState) };
  let messageListener = null;
  const context = {
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: {
          get: async (key) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return typeof key === "string" ? { [key]: store[key] } : { ...store };
          },
          set: async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            Object.assign(store, values);
          }
        }
      },
      runtime: {
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: (listener) => { messageListener = listener; } },
        openOptionsPage: async () => {}
      },
      tabs: { update: async () => ({}), create: async () => ({ id: 1 }), remove: async () => {} },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
      i18n: { getUILanguage: () => "en" }
    }
  };
  context.globalThis = context;
  context.importScripts = () => { context.TubeShelfCore = Core; };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/background.js"), "utf8"), context, { filename: "background.js" });
  return {
    store,
    send(message) {
      return new Promise((resolve, reject) => {
        const keepAlive = messageListener(message, { tab: { id: 1, url: "https://www.youtube.com/" } }, resolve);
        if (keepAlive !== true) reject(new Error("Background listener did not keep the response channel open"));
      });
    }
  };
}

test("background serializes concurrent state mutations without losing either intent", async () => {
  const initial = Core.defaultState();
  initial.channels = {
    "/@one": { id: "/@one", name: "One", url: "https://www.youtube.com/@one" },
    "/@two": { id: "/@two", name: "Two", url: "https://www.youtube.com/@two" }
  };
  const background = loadBackground(initial);
  const [first, second] = await Promise.all([
    background.send({ type: "TUBESHELF_MUTATE", operation: { type: "toggle-membership", payload: { channelId: "/@one", groupId: "learning", enabled: true } } }),
    background.send({ type: "TUBESHELF_MUTATE", operation: { type: "toggle-membership", payload: { channelId: "/@two", groupId: "relax", enabled: true } } })
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(background.store.tubeShelfState.revision, 2);
  assert.deepEqual(background.store.tubeShelfState.groups.find((group) => group.id === "learning").channelIds, ["/@one"]);
  assert.deepEqual(background.store.tubeShelfState.groups.find((group) => group.id === "relax").channelIds, ["/@two"]);
});
