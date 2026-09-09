// Read-only local replay. Backups are read from arguments, never copied or written.
const fs = require('node:fs');
const Core = require('../extension/shared.js');
const old = Core.normalizeState(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
const revised = Core.normalizeState(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
const context = { ...revised, channels: old.channels, manualLabels: {} };
const names = new RegExp(process.argv[4] || '(?!)', 'i');
const rows = Object.values(old.channels).filter(c => names.test(c.name)).map(channel => {
  const result = Core.classifyChannel(channel, context, []);
  return { name: channel.name, previous: old.groups.filter(g=>g.channelIds.includes(channel.id)).map(g=>g.name), proposed: result?.name || null, confidence: result?.confidence, userGroups: revised.groups.filter(g=>g.channelIds.includes(channel.id)).map(g=>g.name), alternatives: result?.alternatives.map(g=>g.name) };
});
console.log(JSON.stringify(rows, null, 2));
