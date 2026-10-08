const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
const { tmp, sleep, logger } = require('./helpers');
const { SettingsManager } = require('../src/core/settings-manager');
const { RecentFilesManager, FavoritesManager } = require('../src/core/recent-files-manager');
const { HistoryManager } = require('../src/core/history-manager');
const { DocumentManager } = require('../src/core/document-manager');
const { TabManager } = require('../src/core/tab-manager');
const { AutosaveManager } = require('../src/core/autosave-manager');
const { CommandManager } = require('../src/core/command-manager');
const { ShortcutManager } = require('../src/core/shortcut-manager');

test('paramètres : défauts, validation, persistance atomique, fichier corrompu', () => {
  const f = path.join(tmp(), 's.json'), s = new SettingsManager(f, logger); s.load();
  assert.equal(s.get('theme'), 'dark');
  s.set({ theme: 'light', discordRPC: { showPath: true } });
  assert.equal(s.get('discordRPC').showPath, true); assert.equal(s.get('discordRPC').enabled, true);
  assert.throws(() => s.set({ zoom: 123 })); assert.throws(() => s.set({ inconnu: 1 })); assert.throws(() => s.set({ accentColor: 'rouge' }));
  s.flush();
  const s2 = new SettingsManager(f, logger); s2.load(); assert.equal(s2.get('theme'), 'light');
  fs.writeFileSync(f, '{pas du json'); const s3 = new SettingsManager(f, logger); s3.load(); assert.equal(s3.get('theme'), 'dark');
});

test('fichiers récents (limite, doublons) et favoris', () => {
  const s = new SettingsManager(path.join(tmp(), 's.json'), logger); s.load(); s.set({ recentLimit: 3 });
  const r = new RecentFilesManager(s);
  ['/a/1.txt', '/a/2.txt', '/a/3.txt', '/a/4.txt', '/a/2.txt'].forEach((p) => r.add(p));
  assert.deepEqual(r.list().map((e) => e.name), ['2.txt', '4.txt', '3.txt']);
  r.remove('/a/4.txt'); assert.equal(r.list().length, 2); r.clear(); assert.equal(r.list().length, 0);
  const f = new FavoritesManager(s); f.add('/a/x.md'); f.add('/a/x.md'); assert.equal(f.list().length, 1); f.remove('/a/x.md'); assert.equal(f.list().length, 0);
});

test('historique : regroupement des frappes, undo/redo, indépendance par document', () => {
  const h = new HistoryManager(); h.reset('');
  h.record('a', 1, 1, { coalesce: true, now: 0 }); h.record('ab', 2, 2, { coalesce: true, now: 100 }); h.record('abc', 3, 3, { coalesce: true, now: 200 });
  h.record('abc!', 4, 4, { coalesce: false, now: 300 });
  assert.equal(h.undo().value, 'abc'); assert.equal(h.undo().value, ''); assert.equal(h.undo(), null);
  assert.equal(h.redo().value, 'abc'); h.record('abc?', 4, 4, { now: 5000 }); assert.equal(h.canRedo, false);
  const d = new DocumentManager(); const a = d.createUntitled(), b = d.createUntitled();
  a.history.record('x', 1, 1); assert.equal(b.history.canUndo, false);
});

test('documents : UNTITLED, dirty, markSaved, noms uniques', () => {
  const d = new DocumentManager(); const events = [];
  d.on('dirty', (x) => events.push(x.isDirty));
  const a = d.createUntitled(), b = d.createUntitled();
  assert.equal(a.status, 'UNTITLED'); assert.equal(a.name, 'Nouveau document'); assert.equal(b.name, 'Nouveau document 2');
  d.setContent(a.id, 'abc'); assert.equal(a.isDirty, true);
  d.setContent(a.id, ''); assert.equal(a.isDirty, false); assert.deepEqual(events, [true, false]);
  const f = d.createFromFile({ path: 'C:\\Projets\\notes.md', name: 'notes.md', directory: 'C:\\Projets', extension: 'md', content: 'x', encoding: 'utf8', eol: 'LF', mtimeMs: 1, size: 1, ino: 1 });
  assert.equal(f.status, 'SAVED'); assert.equal(f.language, 'markdown'); assert.equal(d.findByPath('c:/projets/NOTES.md'), f);
  d.setContent(f.id, 'y'); assert.equal(f.status, 'DIRTY');
  d.markSaved(f.id, { mtimeMs: 2, size: 1, ino: 1 }); assert.equal(f.isDirty, false); assert.equal(f.status, 'SAVED');
  d.markSaved(a.id, { path: '/tmp/nouveau.txt', mtimeMs: 1, size: 0, ino: 1 }); assert.equal(a.name, 'nouveau.txt'); assert.equal(a.status, 'SAVED');
});

test('onglets : épinglage, déplacement, fermeture groupée, réouverture', () => {
  const t = new TabManager(); ['a', 'b', 'c', 'd'].forEach((id) => t.add(id));
  assert.equal(t.activeId, 'd'); t.togglePin('c'); assert.deepEqual(t.order, ['c', 'a', 'b', 'd']);
  assert.deepEqual(t.idsOthers('a'), ['b', 'd']); assert.deepEqual(t.idsAll(), ['a', 'b', 'd']); assert.deepEqual(t.idsRight('a'), ['b', 'd']);
  t.move('d', 0); assert.equal(t.order[0], 'c', 'un onglet normal ne passe pas devant un épinglé');
  assert.equal(t.remove('d'), 'a'); t.pushClosed({ name: 'd' }); assert.equal(t.popClosed().name, 'd'); assert.equal(t.popClosed(), null);
});

test('auto-save : debounce (une seule sauvegarde après l’inactivité)', async () => {
  let saves = 0; const doc = { id: 'x', path: '/a', isDirty: true };
  const a = new AutosaveManager({ getInterval: () => 80, save: async () => { saves++; } });
  for (let i = 0; i < 5; i++) { a.notifyChange(doc); await sleep(30); }
  assert.equal(saves, 0); await sleep(150); assert.equal(saves, 1);
  const off = new AutosaveManager({ getInterval: () => 0, save: async () => { saves++; } }); off.notifyChange(doc); await sleep(50); assert.equal(saves, 1);
  const noPath = new AutosaveManager({ getInterval: () => 10, canAutosave: (d) => !!d.path, save: async () => { saves++; } }); noPath.notifyChange({ id: 'y', path: null, isDirty: true }); await sleep(50); assert.equal(saves, 1);
});

test('commandes et raccourcis : exécution, personnalisation, conflits, AZERTY', async () => {
  const cm = new CommandManager(); const ran = [];
  cm.registerAll([{ id: 'file.new', title: 'Nouveau document', category: 'Fichier', shortcut: 'Ctrl+N', run: () => ran.push('new') },
    { id: 'view.zoomIn', title: 'Zoom avant', category: 'Affichage', shortcut: 'Ctrl+Plus', run: () => ran.push('zoom') },
    { id: 'hidden', title: 'Masquée', when: () => false, run() {} }]);
  assert.throws(() => cm.register({ id: 'file.new', title: 'x', run() {} }));
  assert.deepEqual(cm.search('nvdoc').map((c) => c.id), ['file.new']); assert.equal(cm.search('masq').length, 0);
  let ov = {}; const sm = new ShortcutManager({ commands: cm, getOverrides: () => ov });
  const ev = (k, o = {}) => ({ key: k, ctrlKey: true, preventDefault() {}, stopPropagation() {}, ...o });
  assert.equal(sm.handleKeydown(ev('n')), true); assert.equal(sm.handleKeydown(ev('+', { shiftKey: true })), true); assert.equal(sm.handleKeydown(ev('=')), true);
  await new Promise((r) => setImmediate(r)); assert.deepEqual(ran, ['new', 'zoom', 'zoom']);
  assert.deepEqual(sm.findConflict('Ctrl+N', 'view.zoomIn'), { id: 'file.new', title: 'Nouveau document' }); assert.ok(sm.findConflict('Ctrl+C').reserved);
  ov = { 'file.new': 'Ctrl+Alt+N' }; sm.invalidate(); assert.equal(sm.handleKeydown(ev('n')), false); assert.equal(sm.handleKeydown(ev('n', { altKey: true, code: 'KeyN' })), true);
  sm.suspended = true; assert.equal(sm.handleKeydown(ev('n', { altKey: true, code: 'KeyN' })), false);
});
