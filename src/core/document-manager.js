(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shared/utils'), require('../shared/constants'), require('./history-manager'));
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory(root.MW, root.MW, root.MW)); }
})(typeof self !== 'undefined' ? self : this, function (U, C, H) {
  'use strict';

  /**
   * Gère l'ensemble des documents ouverts (état en mémoire côté renderer).
   * Un document = un onglet. Événements : added, removed, content, dirty, meta.
   */
  class DocumentManager extends U.Emitter {
    constructor() { super(); this.docs = new Map(); }

    _base(partial) {
      return Object.assign({
        id: U.uid('doc'),
        path: null, name: '', directory: '', extension: C.DEFAULT_EXTENSION, language: 'plaintext',
        content: '', savedContent: '', forceDirty: false, isDirty: false, status: C.DOC_STATUS.UNTITLED,
        encoding: 'utf8', eol: 'LF', lastSaved: null, mtimeMs: null, size: 0, ino: 0,
        saving: false, saveError: false, externalState: null, externalInfo: null,
        selection: { start: 0, end: 0 }, scrollTop: 0, scrollLeft: 0,
        createdAt: Date.now(), history: new H.HistoryManager(),
      }, partial);
    }

    nextUntitledName() {
      const base = 'Nouveau document';
      const names = new Set([...this.docs.values()].filter((d) => !d.path).map((d) => d.name));
      if (!names.has(base)) return base;
      for (let i = 2; ; i++) if (!names.has(base + ' ' + i)) return base + ' ' + i;
    }

    createUntitled({ content = '', extension = C.DEFAULT_EXTENSION, encoding = 'utf8', eol = 'LF' } = {}) {
      const doc = this._base({ name: this.nextUntitledName(), content, savedContent: '', extension, encoding, eol, language: C.languageForExtension(extension) });
      doc.history.reset(content);
      this._refresh(doc);
      this.docs.set(doc.id, doc);
      this.emit('added', doc);
      return doc;
    }

    createFromFile(f) {
      const doc = this._base({
        path: f.path, name: f.name, directory: f.directory, extension: f.extension, language: f.language || C.languageForExtension(f.extension),
        content: f.content, savedContent: f.content, encoding: f.encoding, eol: f.eol,
        mtimeMs: f.mtimeMs, size: f.size, ino: f.ino, lastSaved: f.mtimeMs,
      });
      doc.history.reset(f.content);
      this._refresh(doc);
      this.docs.set(doc.id, doc);
      this.emit('added', doc);
      return doc;
    }

    get(id) { return this.docs.get(id) || null; }
    all() { return [...this.docs.values()]; }
    get size() { return this.docs.size; }
    findByPath(p) { return this.all().find((d) => d.path && U.samePath(d.path, p)) || null; }
    dirtyDocs() { return this.all().filter((d) => d.isDirty); }

    remove(id) {
      const doc = this.docs.get(id);
      if (!doc) return null;
      this.docs.delete(id);
      this.emit('removed', doc);
      return doc;
    }

    setContent(id, content) {
      const doc = this.docs.get(id);
      if (!doc || doc.content === content) return doc;
      doc.content = content;
      this._refresh(doc);
      this.emit('content', doc);
      return doc;
    }

    /** Marque un document comme sauvegardé (après écriture réussie sur disque). */
    markSaved(id, info) {
      const doc = this.docs.get(id);
      if (!doc) return null;
      doc.savedContent = info.savedContent !== undefined ? info.savedContent : doc.content;
      doc.forceDirty = false;
      if (info.path) this._applyPath(doc, info.path);
      if (info.encoding) doc.encoding = info.encoding;
      if (info.eol) doc.eol = info.eol;
      doc.mtimeMs = info.mtimeMs; doc.size = info.size; doc.ino = info.ino;
      doc.lastSaved = Date.now();
      doc.saveError = false;
      doc.externalState = null; doc.externalInfo = null;
      this._refresh(doc);
      this.emit('meta', doc);
      return doc;
    }

    /** Remplace le contenu "disque" (rechargement). */
    markReloaded(id, f) {
      const doc = this.docs.get(id);
      if (!doc) return null;
      doc.content = f.content; doc.savedContent = f.content; doc.forceDirty = false;
      doc.encoding = f.encoding; doc.eol = f.eol; doc.mtimeMs = f.mtimeMs; doc.size = f.size; doc.ino = f.ino;
      doc.lastSaved = f.mtimeMs; doc.externalState = null; doc.externalInfo = null; doc.saveError = false;
      this._refresh(doc);
      this.emit('content', doc);
      this.emit('meta', doc);
      return doc;
    }

    setPath(id, p) {
      const doc = this.docs.get(id);
      if (!doc) return null;
      this._applyPath(doc, p);
      this._refresh(doc);
      this.emit('meta', doc);
      return doc;
    }

    update(id, patch) {
      const doc = this.docs.get(id);
      if (!doc) return null;
      Object.assign(doc, patch);
      this._refresh(doc);
      this.emit('meta', doc);
      return doc;
    }

    _applyPath(doc, p) {
      doc.path = p; doc.name = U.basename(p); doc.directory = U.dirname(p);
      doc.extension = U.extname(p) || C.DEFAULT_EXTENSION; doc.language = C.languageForExtension(doc.extension);
    }

    _refresh(doc) {
      const was = doc.isDirty;
      doc.isDirty = doc.forceDirty || doc.content !== doc.savedContent;
      doc.status = !doc.path ? C.DOC_STATUS.UNTITLED : doc.isDirty ? C.DOC_STATUS.DIRTY : C.DOC_STATUS.SAVED;
      if (was !== doc.isDirty && this.docs.has(doc.id)) this.emit('dirty', doc);
    }

    refresh(id) { const d = this.docs.get(id); if (d) { this._refresh(d); this.emit('meta', d); } }
  }

  return { DocumentManager };
});
