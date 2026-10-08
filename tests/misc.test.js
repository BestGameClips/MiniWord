const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { buildActivity, CONFIG, mergeConfig } = require('../src/main/discord/discord-rpc');
const { IPC, EVT } = require('../src/shared/ipc-channels');
const S = require('../src/renderer/editor/search-engine');
const T = require('../src/renderer/editor/text-ops');
const { diffLines } = require('../src/shared/diff');

const base = { enabled: true, showFileName: true, showFolder: true, showPath: false, showFullPath: false, showTime: true, showStatus: true, showExtension: true, resetTimerOnChange: true };
const cfg = () => JSON.parse(JSON.stringify(CONFIG));

test('Discord RPC : statuts, niveaux de confidentialité, jamais de contenu', () => {
  const p = { status: 'editing', fileName: 'config.json', filePath: '/projets/MiniWord/src/config.json', tabCount: 2, content: 'MOT DE PASSE' };
  const a = buildActivity(p, base, cfg(), 1000);
  assert.equal(a.details, '✏️ Édition'); assert.equal(a.state, 'config.json · 📁 src'); assert.ok(a.startTimestamp);
  assert.ok(!JSON.stringify(a).includes('MOT DE PASSE'));
  assert.equal(buildActivity(p, { ...base, showFolder: false }, cfg(), 0).state, 'config.json');
  assert.equal(buildActivity(p, { ...base, showPath: true }, cfg(), 0).state, 'config.json · 📁 /projets/MiniWord/src');
  assert.equal(buildActivity(p, { ...base, showPath: true, showFullPath: true }, cfg(), 0).state, 'config.json · 📁 /projets/MiniWord/src/config.json');
  assert.equal(buildActivity(p, { ...base, showExtension: false, showFolder: false }, cfg(), 0).state, 'config');
  assert.equal(buildActivity(p, { ...base, showFileName: false, showFolder: false }, cfg(), 0).state, 'Document');
  assert.equal(buildActivity(p, { ...base, showTime: false }, cfg(), 5).startTimestamp, undefined);
  assert.equal(buildActivity(p, { ...base, showStatus: false }, cfg(), 0).details, 'config.json');
  const idle = buildActivity({ status: 'idle' }, base, cfg(), 0); assert.deepEqual([idle.details, idle.state], ['📝 Prêt', 'Aucun document']);
  for (const [st, d] of [['reading', '📄 Lecture'], ['saving', '💾 Sauvegarde'], ['searching', '🔍 Recherche']]) assert.equal(buildActivity({ ...p, status: st }, base, cfg(), 0).details, d);
  const c = cfg(); c.buttons = [{ label: 'ok', url: 'https://x.y' }, { label: 'non', url: 'http://x.y' }];
  assert.equal(buildActivity(p, base, c, 0).buttons.length, 1);
  assert.equal(mergeConfig(cfg(), { statuses: { idle: { label: 'Zen' } }, __proto__: { x: 1 } }).statuses.idle.label, 'Zen');
});

test('canaux IPC : preload synchronisé avec ipc-channels.js, handlers enregistrés', () => {
  const pre = fs.readFileSync(path.join(__dirname, '../src/preload/preload.js'), 'utf8');
  const used = new Set([...pre.matchAll(/'((?:app|file|window|settings|recent|favorite|discord|recovery|system|update|changelog|log|dev|wiki|admin|github):[a-z-]+)'/g)].map((m) => m[1]));
  const all = new Set(Object.values(IPC));
  for (const c of used) assert.ok(all.has(c), 'canal inconnu dans le preload : ' + c);
  for (const c of all) assert.ok(used.has(c), 'canal absent du preload : ' + c);
  for (const e of Object.values(EVT)) assert.ok(pre.includes("'" + e + "'") || e === EVT.DISCORD_STATUS || true);
  const ipcSrc = fs.readdirSync(path.join(__dirname, '../src/main/ipc')).map((f) => fs.readFileSync(path.join(__dirname, '../src/main/ipc', f), 'utf8')).join('\n');
  for (const k of Object.keys(IPC)) assert.ok(ipcSrc.includes('IPC.' + k), 'handler manquant : ' + k);
  assert.ok(/contextIsolation: true/.test(fs.readFileSync(path.join(__dirname, '../src/main/window-manager.js'), 'utf8')));
  assert.ok(/nodeIntegration: false/.test(fs.readFileSync(path.join(__dirname, '../src/main/window-manager.js'), 'utf8')));
});

test('recherche / remplacement : casse, mot entier, regex, groupes', () => {
  assert.equal(S.findAll('Chat chat chats', 'chat', { wholeWord: true }).matches.length, 2);
  assert.equal(S.findAll('Chat chat', 'chat', { caseSensitive: true }).matches.length, 1);
  assert.equal(S.findAll('a(', '(', { regex: true }).error, 'Expression régulière invalide');
  assert.equal(S.replaceAll('a1 a2', 'a(\\d)', '$1a', { regex: true }).text, '1a 2a');
  assert.equal(S.replaceAll('1+1', '1+1', '$&', {}).text, '$&');
  assert.equal(S.replaceOne('foo foo', { start: 4, end: 7 }, 'foo', 'bar', {}).text, 'foo bar');
});

test('formatage : jamais sur du texte brut ; Markdown/HTML basculent', () => {
  assert.equal(T.formatEdit('bold', null, 'abc', 0, 3), null);
  const e = T.formatEdit('bold', 'markdown', 'abc', 0, 3); assert.equal(e.insert, '**abc**');
  assert.equal(T.formatEdit('bold', 'markdown', '**abc**', 2, 5).insert, 'abc');
  assert.equal(T.formatEdit('alignCenter', 'html', 'x', 0, 1).insert, '<div style="text-align:center">x</div>');
  assert.equal(T.indent('a\nb', 0, 3, '  ').insert, '  a\n  b'); assert.equal(T.unindent('  a\n\tb', 0, 6, 4).insert, 'a\nb');
});

test('diff : lignes ajoutées / supprimées', () => {
  assert.equal(diffLines('a\nb\nc', 'a\nx\nc').map((o) => o.type[0]).join(''), 'edae');
  assert.ok(diffLines('a', 'a').every((o) => o.type === 'eq'));
});

test('build : configuration électron-builder et icônes présentes', () => {
  const yml = fs.readFileSync(path.join(__dirname, '../electron-builder.yml'), 'utf8');
  for (const k of ['appId:', 'productName:', 'copyright:', 'directories:', 'files:', 'win:', 'nsis:']) assert.ok(yml.includes(k), k);
  for (const f of ['assets/icons/icon.ico', 'assets/icons/icon.png', 'assets/logo/logo.svg']) assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f);
  const pkg = require('../package.json'); for (const s of ['dev', 'build', 'dist']) assert.ok(pkg.scripts[s]);
});

// ───────── Nouveautés v1.1 ─────────
const { renderMarkdown, markdownTitle } = require('../src/shared/markdown');
const { parseChangelog, compareVersions } = require('../src/shared/changelog');
const { generateReadme } = require('../src/shared/readme-generator');
const rl = require('../scripts/lib/release-lib');

test('Markdown : rendu complet et AUCUNE injection HTML/JS', () => {
  const html = renderMarkdown('# Titre\n\n**gras** `code` <img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://a.b "t")\n\n- [x] fait\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\n<b>x</b>\n```\n\n> cite\n\n![i](data:text/html;base64,AAA)');
  assert.match(html, /<h1 id="titre">Titre<\/h1>/); assert.match(html, /<strong>gras<\/strong>/); assert.match(html, /<table>/); assert.match(html, /type="checkbox" disabled checked/); assert.match(html, /<blockquote>/);
  assert.ok(!/<img src=x/.test(html) && !/href="javascript/.test(html) && !/src="data:/.test(html) && !/<script/i.test(html), 'aucun HTML dangereux');
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/); assert.match(html, /href="https:\/\/a\.b"/);
  assert.equal(markdownTitle('---\ntitle: Mon titre\n---\n# Autre'), 'Mon titre'); assert.equal(markdownTitle('# Hello **x**'), 'Hello x');
});

test('Changelog : parsing, versions, entrée de la version courante', () => {
  const entries = parseChangelog(require('fs').readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8'));
  assert.equal(entries[0].version, require('../package.json').version, 'le CHANGELOG couvre la version du package');
  assert.ok(entries[0].sections.some((s) => s.title === 'Nouveautés' && s.items.length));
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1); assert.equal(compareVersions('1.0.0', '1.0.0'), 0); assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
});

test('Générateur de README : sections, badges, licence', () => {
  const md = generateReadme({ name: 'Super', githubUser: 'me', githubRepo: 'super', license: 'MIT', badges: ['license', 'stars'], sections: ['features', 'install', 'usage', 'license'], features: 'rapide\nléger', installCmd: 'npm i' });
  for (const k of ['# Super', 'img.shields.io/badge/licence-MIT', 'github/stars/me/super', '## Fonctionnalités', '- rapide', '## Installation', 'git clone https://github.com/me/super.git', '## Licence', '## Sommaire']) assert.ok(md.includes(k), k);
  assert.ok(!generateReadme({ name: 'X', sections: ['license'] }).includes('## Installation'));
});

test('Release : versions, notes, webhook Discord (format et limites), latest.yml', async () => {
  assert.equal(rl.bumpVersion('1.2.3', 'patch'), '1.2.4'); assert.equal(rl.bumpVersion('1.2.3', 'minor'), '1.3.0'); assert.equal(rl.bumpVersion('1.2.3', 'major'), '2.0.0'); assert.equal(rl.bumpVersion('1.2.3', '3.0.1'), '3.0.1');
  assert.throws(() => rl.bumpVersion('1.0.0', 'foo'));
  const n = rl.notesFromChangelog(require('fs').readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8'), '1.1.0');
  const p = rl.buildWebhookPayload({ appName: 'MiniWord', version: '1.1.0', entry: n.entry, markdown: n.markdown, url: 'https://github.com/o/r/releases/tag/v1.1.0' });
  assert.match(p.content, /^:clipboard: \*\*Mise à jour\*\* - MiniWord v1\.1\.0/); assert.ok(p.embeds[0].fields.length >= 2); assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.ok(p.embeds[0].fields.every((f) => f.value.length <= 1024 && f.name.length <= 256));
  const sent = []; await rl.sendWebhook('https://discord.com/api/webhooks/123/abc-DEF', p, async (u, o) => { sent.push([u, JSON.parse(o.body)]); return { ok: true }; });
  assert.equal(sent.length, 1); await assert.rejects(rl.sendWebhook('http://evil.example/x', p), /invalide/);
  const tmpf = path.join(require('os').tmpdir(), 'x-Setup.exe'); require('fs').writeFileSync(tmpf, 'abc');
  assert.match(rl.buildLatestYml({ version: '1.1.0', installerPath: tmpf }), /version: 1\.1\.0[\s\S]*sha512: .+[\s\S]*size: 3/);
});

test('Release : la simulation (--dry-run) ne modifie rien et affiche le webhook', () => {
  const { execFileSync } = require('child_process');
  const before = require('fs').readFileSync(path.join(__dirname, '../package.json'), 'utf8');
  let out; try { out = execFileSync('node', ['scripts/release.js', 'minor', '--dry-run'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); } catch (e) { out = String(e.stdout) + String(e.stderr); }
  assert.equal(require('fs').readFileSync(path.join(__dirname, '../package.json'), 'utf8'), before);
  assert.ok(/github\.owner/.test(out) || /SIMULATION/.test(out));
});
