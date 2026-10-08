const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { tmp, sleep, logger } = require('./helpers');
const { FileManager } = require('../src/main/filesystem/file-manager');
const { FileWatcher } = require('../src/main/filesystem/file-watcher');
const { BackupManager } = require('../src/main/filesystem/backup-manager');
const { RecoveryManager } = require('../src/main/filesystem/recovery-manager');

test('ouvrir → modifier → sauvegarder → relire (UTF-8, CRLF conservé)', async () => {
  const d = tmp(), f = path.join(d, 'a.txt'), fm = new FileManager({ logger });
  fs.writeFileSync(f, 'ligne1\r\nligne2\r\n');
  const r = await fm.readFile(f);
  assert.equal(r.content, 'ligne1\nligne2\n'); assert.equal(r.eol, 'CRLF'); assert.equal(r.encoding, 'utf8');
  const w = await fm.writeFile(f, 'ligne1\nmodifié\n', { encoding: r.encoding, eol: r.eol, expectedMtimeMs: r.mtimeMs, expectedSize: r.size });
  assert.equal(w.conflict, false);
  assert.equal(fs.readFileSync(f, 'utf8'), 'ligne1\r\nmodifié\r\n');
  assert.deepEqual(fs.readdirSync(d), ['a.txt']); // aucun fichier temporaire résiduel
});

test('encodages : BOM, UTF-16, Windows-1252, binaire refusé', async () => {
  const d = tmp(), fm = new FileManager({ logger });
  fs.writeFileSync(path.join(d, 'bom.txt'), Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('é€')]));
  assert.equal((await fm.readFile(path.join(d, 'bom.txt'))).encoding, 'utf8-bom');
  fs.writeFileSync(path.join(d, 'w.txt'), Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x80])); // « café€ » en cp1252
  const w = await fm.readFile(path.join(d, 'w.txt'));
  assert.equal(w.encoding, 'windows-1252'); assert.equal(w.content, 'café€');
  await fm.writeFile(path.join(d, 'w.txt'), 'café€', { encoding: 'windows-1252' });
  assert.deepEqual([...fs.readFileSync(path.join(d, 'w.txt'))], [0x63, 0x61, 0x66, 0xE9, 0x80]);
  await assert.rejects(fm.writeFile(path.join(d, 'w.txt'), '日本', { encoding: 'windows-1252' }), { code: 'E_ENCODING' });
  fs.writeFileSync(path.join(d, 'u16.txt'), Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('salut', 'utf16le')]));
  assert.equal((await fm.readFile(path.join(d, 'u16.txt'))).content, 'salut');
  fs.writeFileSync(path.join(d, 'bin.txt'), Buffer.from([1, 2, 0, 3]));
  await assert.rejects(fm.readFile(path.join(d, 'bin.txt')), { code: 'E_BINARY' });
  await assert.rejects(fm.readFile(path.join(d, 'nope.txt')), { code: 'E_NOT_FOUND' });
  await assert.rejects(fm.readFile('relatif.txt'), { code: 'E_PATH' });
});

test('modifié depuis une autre application → conflit détecté, rien n’est écrasé', async () => {
  const d = tmp(), f = path.join(d, 'c.txt'), fm = new FileManager({ logger });
  fs.writeFileSync(f, 'v1');
  const r = await fm.readFile(f);
  await sleep(20); fs.writeFileSync(f, 'externe!');
  const w = await fm.writeFile(f, 'ma version', { expectedMtimeMs: r.mtimeMs, expectedSize: r.size });
  assert.equal(w.conflict, true);
  assert.equal(fs.readFileSync(f, 'utf8'), 'externe!');
  const forced = await fm.writeFile(f, 'ma version', { force: true });
  assert.equal(forced.conflict, false); assert.equal(fs.readFileSync(f, 'utf8'), 'ma version');
});

test('watcher : modification, suppression, renommage ; ignore nos propres écritures', async () => {
  const d = tmp(), f = path.join(d, 'w.txt'), fm = new FileManager({ logger });
  fs.writeFileSync(f, 'a');
  const events = [];
  const w = new FileWatcher({ logger, debounceMs: 60, onEvent: (e) => events.push(e) });
  const r = await fm.readFile(f); w.watch(f, r);
  const own = await fm.writeFile(f, 'écriture interne', {}); w.updateKnown(f, own);
  await sleep(400); assert.equal(events.length, 0, 'écriture interne ignorée');
  fs.writeFileSync(f, 'externe plus long'); await sleep(500);
  assert.equal(events.at(-1).type, 'changed');
  const f2 = path.join(d, 'renamed.txt'); fs.renameSync(f, f2); await sleep(600);
  assert.equal(events.at(-1).type, 'moved'); assert.equal(events.at(-1).newPath, f2);
  fs.unlinkSync(f2); await sleep(500);
  assert.equal(events.at(-1).type, 'deleted');
  w.closeAll();
});

test('backups : copie avant écrasement + nettoyage automatique', async () => {
  const d = tmp(), f = path.join(d, 'b.txt');
  const bm = new BackupManager({ dir: path.join(d, 'bk'), getKeep: () => 3, minIntervalMs: 0, logger });
  for (let i = 0; i < 6; i++) { fs.writeFileSync(f, 'v' + i); await bm.backup(f, { force: true }); await sleep(5); }
  const list = await bm.list(f);
  assert.equal(list.length, 3);
  assert.equal(fs.readFileSync(path.join(bm.folderFor(f), list[0]), 'utf8'), 'v5');
});

test('récupération après crash : enregistrer, lister, restaurer, effacer', async () => {
  const rm = new RecoveryManager({ dir: path.join(tmp(), 'rec'), logger });
  await rm.save({ id: 'doc-1', name: 'x.txt', path: null, content: 'non sauvegardé', encoding: 'utf8', eol: 'LF' });
  assert.equal((await rm.list()).length, 1);
  assert.equal((await rm.get('doc-1')).content, 'non sauvegardé');
  await assert.rejects(rm.save({ id: '../evil', content: '' }), { code: 'E_ARG' });
  await rm.clear('doc-1'); assert.equal((await rm.list()).length, 0);
});
