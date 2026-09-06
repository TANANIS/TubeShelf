import fs from "node:fs";
import Core from "../extension/shared.js";

const inputPath = process.argv[2];
const state = Core.normalizeState(JSON.parse(fs.readFileSync(inputPath, "utf8")));
const channels = Object.values(state.channels);
const memberships = new Map(channels.map((channel) => [channel.id, Core.groupForChannel(state, channel.id)]));
const unfiled = Core.unfiledChannelIds(state);
const predictions = new Map(channels.map((channel) => [channel.id, Core.classifyChannel(channel)]));
const predicted = [...predictions.values()].filter(Boolean).length;
const learning = state.groups.find((group) => group.name === "學習");
const learningMismatches = (learning?.channelIds || [])
  .map((id) => ({ channel: state.channels[id], prediction: predictions.get(id) }))
  .filter(({ prediction }) => prediction && prediction.name !== "學習")
  .map(({ channel, prediction }) => ({ name: channel.name, predicted: prediction.name, reasons: prediction.reasons }));
const classifiedMismatches = channels
  .map((channel) => ({ channel, groups: memberships.get(channel.id), prediction: predictions.get(channel.id) }))
  .filter(({ groups, prediction }) => groups.length && prediction && !groups.some((group) => group.name === prediction.name))
  .map(({ channel, groups, prediction }) => ({ name: channel.name, current: groups.map((group) => group.name), predicted: prediction.name, reasons: prediction.reasons }));
const technology = state.groups.find((group) => group.name === "科技");
const technologyReasonCounts = {};
for (const id of technology?.channelIds || []) {
  for (const reason of predictions.get(id)?.reasons || []) technologyReasonCounts[reason] = (technologyReasonCounts[reason] || 0) + 1;
}

console.log(JSON.stringify({
  channels: channels.length,
  groups: state.groups.map((group) => ({ name: group.name, count: group.channelIds.length })),
  groupSamples: Object.fromEntries(state.groups.map((group) => [group.name, group.channelIds.slice(0, 15).map((id) => state.channels[id]?.name)])),
  classifiedUnique: channels.length - unfiled.length,
  unfiled: unfiled.length,
  multiGroup: channels.filter((channel) => memberships.get(channel.id).length > 1).length,
  profileCoverage: {
    profiled: channels.filter((channel) => channel.profiledAt).length,
    descriptions: channels.filter((channel) => channel.description).length,
    recentTitles: channels.filter((channel) => channel.recentTitles?.length).length,
    keywords: channels.filter((channel) => channel.keywords).length
  },
  localPredictionCoverage: { predicted, uncertain: channels.length - predicted },
  learningMismatches: { count: learningMismatches.length, sample: learningMismatches.slice(0, 20) },
  classifiedMismatches: { count: classifiedMismatches.length, sample: classifiedMismatches.slice(0, 20) },
  technologyReasonCounts: Object.entries(technologyReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 20),
  technologyPhoneSamples: (technology?.channelIds || []).filter((id) => predictions.get(id)?.reasons.includes("手機")).slice(0, 5).map((id) => ({ name: state.channels[id].name, description: state.channels[id].description.slice(0, 260), keywords: state.channels[id].keywords.slice(0, 260) })),
  remainingSuggestions: Core.buildAutoGroupSuggestions(state).groups.map((group) => ({ name: group.name, count: group.channelIds.length }))
}, null, 2));
