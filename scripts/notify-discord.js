#!/usr/bin/env node
'use strict';
/**
 * Envoie les notes de patch d'une release sur Discord. Utilisé par .github/workflows/discord-notify.yml
 * (déclenché à la publication d'une release) ou à la main :
 *   DISCORD_WEBHOOK_URL=… node scripts/notify-discord.js 1.1.0 [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib/release-lib');
const config = require('../app.config');

(async () => {
  let version = process.argv.slice(2).find((a) => !a.startsWith('--')), url, body = '';
  if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (ev.release) { version = version || ev.release.tag_name.replace(/^v/, ''); url = ev.release.html_url; body = ev.release.body || ''; }
  }
  if (!version) throw new Error('Version manquante : node scripts/notify-discord.js 1.1.0');
  const notes = lib.notesFromChangelog(fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8'), version);
  const payload = lib.buildWebhookPayload({ appName: config.appName, version, entry: notes && notes.entry, markdown: notes ? notes.markdown : body, url });
  if (process.argv.includes('--dry-run')) return console.log(JSON.stringify(payload, null, 2));
  await lib.sendWebhook(process.env.DISCORD_WEBHOOK_URL, payload);
  console.log('Notification Discord envoyée pour v' + version);
})().catch((e) => { console.error('✖ ' + e.message); process.exit(1); });
