(function () {
  "use strict";
  globalThis.createTubeShelfAutoReview = ({ getState, getSuggestions, translate, escape }) => {
    const list = document.getElementById("auto-suggestion-list");
    const search = document.getElementById("auto-review-search");
    const choices = new Map();
    let destinations = new Map();
    let rows = [];
    const t = translate;

    function selectedGroups() {
      const groups = new Map();
      for (const row of rows) {
        const choice = choices.get(row.id);
        if (!choice?.primary) continue;
        for (const id of new Set([choice.primary, ...choice.extras])) {
          const destination = destinations.get(id);
          if (!destination) continue;
          if (!groups.has(id)) groups.set(id, { ...destination, groupId: id, channelIds: [] });
          groups.get(id).channelIds.push(row.id);
        }
      }
      return [...groups.values()];
    }

    function render() {
      const state = getState();
      const suggestions = getSuggestions();
      destinations = new Map(state.groups.map((group) => [group.id, { ...group, groupId: group.id }]));
      for (const group of suggestions.groups) if (!destinations.has(group.groupId)) destinations.set(group.groupId, group);
      rows = (suggestions.channels || []).filter((row) => state.channels[row.id]);
      const validIds = new Set(rows.map((row) => row.id));
      for (const id of choices.keys()) if (!validIds.has(id)) choices.delete(id);
      for (const row of rows) {
        if (!choices.has(row.id)) choices.set(row.id, { primary: row.candidates[0]?.confidence === "high" ? row.candidates[0].groupId : "", extras: new Set() });
        const choice = choices.get(row.id);
        if (!destinations.has(choice.primary)) { choice.primary = ""; choice.extras.clear(); }
        choice.extras = new Set([...choice.extras].filter((id) => destinations.has(id) && id !== choice.primary));
      }
      const scroll = list.scrollTop;
      const opened = new Set([...list.querySelectorAll("details[open]")].map((node) => node.dataset.reviewDetails));
      const query = search.value.trim().toLocaleLowerCase();
      const visible = rows.filter((row) => `${row.name} ${row.id}`.toLocaleLowerCase().includes(query));
      list.innerHTML = visible.map((row) => {
        const choice = choices.get(row.id);
        const best = row.candidates[0];
        const ordered = [...new Set([...row.candidates.map((item) => item.groupId), ...destinations.keys()])];
        const options = `<option value="">${escape(t("保留待分類"))}</option>` + ordered.map((id) => `<option value="${escape(id)}" ${choice.primary === id ? "selected" : ""}>${escape(destinations.get(id).name)}</option>`).join("");
        const confidence = best ? t({ high: "高信心", medium: "中信心", low: "低信心建議" }[best.confidence]) : "";
        const recommendation = best ? `<span>${escape(t("建議"))}：<span translate="no">${escape(best.name)}</span> <small>${escape(confidence)}</small></span>${choice.primary !== best.groupId ? `<button type="button" class="button ghost compact" data-adopt="${escape(row.id)}">${escape(t("採用"))}</button>` : ""}` : `<span>${escape(t("目前沒有明確建議"))}</span>`;
        const extras = ordered.filter((id) => id !== choice.primary).map((id) => `<label><input type="checkbox" data-extra-channel="${escape(row.id)}" value="${escape(id)}" ${choice.extras.has(id) ? "checked" : ""}><span translate="no">${escape(destinations.get(id).name)}</span></label>`).join("");
        const reasons = row.candidates.map((item) => `<p><strong translate="no">${escape(item.name)}</strong><br>${escape(item.reasons.join(" · "))}</p>`).join("");
        return `<article class="auto-channel-row" data-review-channel="${escape(row.id)}"><div class="auto-channel-heading"><strong translate="no">${escape(row.name)}</strong><label>${escape(t("加入群組"))}<select data-auto-primary="${escape(row.id)}" aria-label="${escape(t("加入群組") + " " + row.name)}" translate="no">${options}</select></label></div><div class="auto-recommendation">${recommendation}</div><div class="auto-row-details">${best ? `<details data-review-details="reason:${escape(row.id)}"><summary>${escape(t("查看原因"))}</summary>${reasons}</details>` : ""}${choice.primary && extras ? `<details data-review-details="extra:${escape(row.id)}"><summary>${escape(t("同時加入其他群組"))}${choice.extras.size ? ` (${choice.extras.size})` : ""}</summary><div class="auto-extra-groups">${extras}</div></details>` : ""}</div></article>`;
      }).join("") || `<p class="auto-review-empty">${escape(t("找不到符合的頻道"))}</p>`;
      list.querySelectorAll("details").forEach((node) => { node.open = opened.has(node.dataset.reviewDetails); });
      list.scrollTop = scroll;
      const groups = selectedGroups();
      const count = new Set(groups.flatMap((group) => group.channelIds)).size;
      const newGroups = groups.filter((group) => !state.groups.some((item) => item.id === group.groupId)).length;
      document.getElementById("auto-selection-summary").textContent = state.settings.language === "en" ? `${count} channels selected · ${newGroups} new groups` : `將整理 ${count} 個頻道 · 新增 ${newGroups} 個群組`;
      document.getElementById("auto-apply").disabled = count === 0;
    }

    list.addEventListener("change", (event) => {
      const primaryId = event.target.dataset.autoPrimary;
      const extraId = event.target.dataset.extraChannel;
      const extraValue = event.target.value;
      if (primaryId && choices.has(primaryId)) {
        const choice = choices.get(primaryId);
        choice.primary = event.target.value;
        if (!choice.primary) choice.extras.clear();
      } else if (extraId && choices.has(extraId)) {
        const extras = choices.get(extraId).extras;
        event.target.checked ? extras.add(event.target.value) : extras.delete(event.target.value);
      } else return;
      render();
      if (primaryId) [...list.querySelectorAll("select")].find((node) => node.dataset.autoPrimary === primaryId)?.focus({ preventScroll: true });
      if (extraId) [...list.querySelectorAll("[data-extra-channel]")].find((node) => node.dataset.extraChannel === extraId && node.value === extraValue)?.focus({ preventScroll: true });
    });
    list.addEventListener("click", (event) => {
      const id = event.target.closest("[data-adopt]")?.dataset.adopt;
      const best = rows.find((row) => row.id === id)?.candidates[0];
      if (!best) return;
      choices.get(id).primary = best.groupId;
      render();
      [...list.querySelectorAll("select")].find((node) => node.dataset.autoPrimary === id)?.focus({ preventScroll: true });
    });
    search.addEventListener("input", render);
    return { render, selectedGroups, reset: () => { choices.clear(); search.value = ""; } };
  };
})();
