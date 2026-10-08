const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { tmp, logger } = require('./helpers');
const { WikiManager, checkAdminPassword } = require('../src/main/wiki/wiki-manager');
const { createLogger } = require('../src/main/logger');

function make({ storage = 'files', sync = false, repo = { owner: 'o', repo: 'r', branch: 'main' }, fetchImpl, token = '' } = {}) {
  const d = tmp(), bundled = path.join(d, 'bundled'); fs.mkdirSync(bundled);
  fs.writeFileSync(path.join(bundled, 'accueil.md'), '# Accueil livré'); fs.writeFileSync(path.join(bundled, 'aide.md'), '# Aide livrée');
  const st = { wikiStorage: storage, wikiGithubSync: sync };
  return { d, st, w: new WikiManager({ bundledDir: bundled, dataDir: d, config: { github: repo, wiki: { remote: true, path: 'wiki', timeoutMs: 2000 } }, getSettings: () => st, getToken: () => token, logger, fetchImpl }) };
}
const res = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('Wiki : pages livrées, priorité local > GitHub > livré, validation des noms', async () => {
  const { w } = make({ repo: {} });
  assert.deepEqual((await w.list()).map((p) => p.slug), ['accueil', 'aide']);
  await w.save('aide', '# Aide locale'); const a = await w.get('aide');
  assert.equal(a.source, 'local'); assert.equal(a.title, 'Aide locale');
  await w.delete('aide'); assert.equal((await w.get('aide')).source, 'bundled');
  for (const bad of ['../x', 'A B', '', 'x'.repeat(80)]) await assert.rejects(w.save(bad, 'x'), { code: 'E_ARG' });
  await assert.rejects(w.get('inconnue'), { code: 'E_NOT_FOUND' });
  assert.equal((await w.refresh()).skipped, true, 'sans dépôt : hors ligne sans erreur');
});

test('Wiki : synchronisation GitHub mise en cache, empreintes, suppression distante, hors ligne', async () => {
  const calls = [];
  let listing = [{ type: 'file', name: 'guide.md', sha: 'A', download_url: 'https://raw/guide.md' }, { type: 'file', name: 'x.txt', sha: 'Z', download_url: 'u' }];
  const fetchImpl = async (url) => { calls.push(url); if (url.includes('api.github.com')) return res(listing); return res('# Guide distant'); };
  const { w } = make({ fetchImpl });
  let r = await w.refresh(); assert.equal(r.updated, 1); assert.equal((await w.get('guide')).source, 'remote');
  r = await w.refresh(); assert.equal(r.updated, 0, 'même empreinte : pas de retéléchargement');
  r = await w.refresh({ force: true }); assert.equal(r.updated, 1, 'force = retéléchargement');
  listing = []; r = await w.refresh(); assert.equal(r.removed, 1); await assert.rejects(w.get('guide'), { code: 'E_NOT_FOUND' });
  const off = make({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }); r = await off.w.refresh();
  assert.equal(r.ok, false); assert.equal(r.offline, true); assert.ok((await off.w.list()).length >= 2, 'le contenu livré reste disponible hors ligne');
  assert.equal((await make({ fetchImpl: async () => res({}, false, 404) }).w.refresh()).ok, false);
});

test('Wiki : stockage SQLite (node:sqlite) si disponible', async (t) => {
  try { require('node:sqlite'); } catch { return t.skip('node:sqlite indisponible'); }
  const { w } = make({ storage: 'sqlite', repo: {} });
  await w.save('notes', '# Notes SQL'); assert.equal((await w.get('notes')).source, 'local');
  await w.save('notes', '# Notes v2'); assert.equal((await w.get('notes')).title, 'Notes v2');
  await w.delete('notes'); await assert.rejects(w.get('notes')); w.close();
});

test('Wiki : publication GitHub (PUT avec sha) et jeton requis', async () => {
  const calls = [];
  const fetchImpl = async (url, o = {}) => { calls.push([o.method || 'GET', url, o.body && JSON.parse(o.body)]); return res(o.method === 'PUT' ? {} : { sha: 'abc' }); };
  const noTok = make({ fetchImpl }); await noTok.w.save('p', '# P'); await assert.rejects(noTok.w.push('p'), /jeton/i);
  const { w } = make({ fetchImpl, token: 'ghp_x', sync: true });
  const r = await w.save('p', '# P'); assert.equal(r.pushed.ok, true);
  const put = calls.find((c) => c[0] === 'PUT'); assert.match(put[1], /contents\/wiki\/p\.md$/); assert.equal(put[2].sha, 'abc'); assert.equal(Buffer.from(put[2].content, 'base64').toString(), '# P');
});

test('Admin : mot de passe SHA-256 vérifié', () => {
  const h = require('crypto').createHash('sha256').update('secret').digest('hex');
  assert.equal(checkAdminPassword('secret', h), true); assert.equal(checkAdminPassword('faux', h), false); assert.equal(checkAdminPassword('secret', ''), false);
});

test('Logger : niveaux, tampon, abonnés temps réel, fichiers', () => {
  const dir = tmp(), lg = createLogger({ dir, isDev: false }); const seen = []; const off = lg.subscribe((e) => seen.push(e.level));
  lg.success('ok'); lg.warn('attention'); lg.error('boum', new Error('x')); lg.debug('d'); off(); lg.info('i');
  assert.deepEqual(seen, ['success', 'warn', 'error', 'debug']); assert.equal(lg.history().length, 5);
  assert.match(fs.readFileSync(path.join(dir, 'errors.log'), 'utf8'), /boum[\s\S]*Error: x/); assert.ok(!fs.readFileSync(path.join(dir, 'app.log'), 'utf8').includes('[DEBUG]'));
});
