const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(path.join(process.env.TUBESHELF_NODE_MODULES, "playwright"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ locale: "en-US" });
  try {
    await page.goto("http://127.0.0.1:8766/extension/dashboard/dashboard.html?lang=en", { waitUntil: "networkidle" });
    assert.equal(await page.locator("#language-select").inputValue(), "en");
    assert.equal(await page.locator(".page-header h1").textContent(), "Subscription shelf");
    assert.match(await page.locator("body").innerText(), /Auto-organize groups \(local\)/);
    assert.doesNotMatch(await page.locator(".sidebar, .page-header, .stats, .channel-toolbar").allInnerTexts().then((parts) => parts.join(" ")), /[\u3400-\u9fff]/);

    await page.locator('[data-group="learning"]').click();
    await page.locator("#edit-selected-group").click();
    await page.locator("#merge-group-section").waitFor({ state: "visible" });
    assert.match(await page.locator("#merge-group-section").innerText(), /Merge into another group/);
    assert.doesNotMatch(await page.locator("#group-dialog").innerText(), /[\u3400-\u9fff]/);
    await page.locator("#merge-group-target").selectOption("relax");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#merge-group").click();
    await page.locator('[data-group="learning"]').waitFor({ state: "detached" });
    assert.equal(await page.locator('[data-group="relax"] .group-number').textContent(), "2");

    await page.goto("http://127.0.0.1:8766/extension/dashboard/dashboard.html?tour=1&lang=en&smoke=1", { waitUntil: "networkidle" });
    await page.locator("#onboarding-title").waitFor({ state: "visible" });
    assert.equal(await page.locator("#onboarding").getAttribute("hidden"), null);
    assert.equal(await page.locator("#onboarding-title").textContent(), "Welcome to TubeShelf");
    assert.equal(await page.locator("#onboarding-skip").textContent(), "Skip tutorial");
    assert.doesNotMatch(await page.locator("#onboarding").innerText(), /[\u3400-\u9fff]/);

    await page.locator("#onboarding-skip").click();
    await page.locator("#auto-organize").click();
    assert.match(await page.locator("#auto-dialog").innerText(), /No cloud AI/);
    assert.doesNotMatch(await page.locator("#auto-dialog").innerText(), /[\u3400-\u9fff]/);
    await page.locator("#auto-start").click();
    await page.locator("#auto-results").waitFor({ state: "visible" });
    const autoChrome = await page.locator("#auto-dialog").evaluate((dialog) => {
      const clone = dialog.cloneNode(true);
      clone.querySelectorAll(".suggestion-copy small").forEach((node) => node.remove());
      return clone.innerText;
    });
    assert.match(autoChrome, /Local dictionary/);
    assert.match(autoChrome, /Low \d+/);
    assert.doesNotMatch(autoChrome, /[\u3400-\u9fff]/);
    const suggestionChecks = page.locator('[data-auto-group]');
    assert.ok(await suggestionChecks.count() > 0);
    for (let index = 0; index < await suggestionChecks.count(); index += 1) assert.equal(await suggestionChecks.nth(index).isChecked(), true);

    await page.goto("http://127.0.0.1:8766/extension/popup/popup.html?lang=en", { waitUntil: "networkidle" });
    assert.match(await page.locator("body").innerText(), /Your subscriptions, organized your way/);
    assert.doesNotMatch(await page.locator("body").innerText(), /[\u3400-\u9fff]/);

    const content = page;
    await content.goto("http://127.0.0.1:8766/tests/content-harness.html", { waitUntil: "networkidle" });
    const control = content.locator("#tubeshelf-channel-control");
    await control.waitFor({ state: "visible" });
    await content.waitForFunction(() => document.querySelector('[data-ts-current-group="gaming"]')?.checked === true);
    assert.equal(await control.getAttribute("data-channel-id"), "/@mattsgamenight");
    const repairedIdentity = await content.evaluate(() => globalThis.__getStoredState());
    assert.deepEqual(Object.keys(repairedIdentity.channels), ["/@mattsgamenight"]);
    assert.deepEqual(repairedIdentity.groups.find((group) => group.id === "gaming").channelIds, ["/@mattsgamenight"]);
    assert.equal(await control.locator(".ts-current-trigger").innerText(), "Groups");
    assert.equal(await control.evaluate((node) => node.previousElementSibling?.classList.contains("ytFlexibleActionsViewModelAction")), true);
    assert.equal(await control.evaluate((node) => node.parentElement?.tagName), "YT-FLEXIBLE-ACTIONS-VIEW-MODEL");
    await control.locator(".ts-current-trigger").click();
    assert.match(await control.locator(".ts-current-menu").innerText(), /Choose groups/);
    assert.doesNotMatch(await control.innerText(), /[\u3400-\u9fff]/);
    const learningMembership = control.locator('[data-ts-current-group="learning"]');
    assert.equal(await learningMembership.isChecked(), false);
    await learningMembership.click();
    assert.equal(await control.locator('[data-ts-current-group="learning"]').isChecked(), true);

    await content.goto("http://127.0.0.1:8766/tests/subscriptions-harness.html", { waitUntil: "networkidle" });
    const shortsShelf = content.locator("#shorts-shelf");
    await shortsShelf.waitFor({ state: "attached" });
    assert.equal(await shortsShelf.evaluate((node) => getComputedStyle(node).display), "none");
    assert.equal(await content.locator("#regular-shelf").isVisible(), true);
    await content.locator('#tubeshelf-toolbar [data-ts-group="unfiled"]').click();
    assert.match(content.url(), /#tubeshelf-group=unfiled$/);
    assert.equal(await content.locator("#categorized-card").isVisible(), false);
    assert.equal(await content.locator("#unfiled-card").isVisible(), true);

    await content.goto("http://127.0.0.1:8766/tests/identity-scan-harness.html", { waitUntil: "networkidle" });
    await content.waitForFunction(() => globalThis.__capturedIdentities.length > 0);
    const scannedIdentity = await content.evaluate(() => globalThis.__capturedIdentities[0]);
    assert.equal(scannedIdentity.channelId, "UCNqVXfC231oVcZEcUKrW0DQ");
    assert.equal(scannedIdentity.alias, "/@TenaciousTrilobite");
    console.log("UI smoke checks passed: English UI, group merge, channel identity repair, scan identity extraction, unfiled filtering, synchronized group URL, and dynamic Shorts hiding.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
