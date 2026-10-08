(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Chemins (indépendants de la plateforme, utilisables dans le renderer) ──
  function basename(p) {
    const parts = String(p || '').split(/[\\/]/);
    return parts[parts.length - 1];
  }
  function dirname(p) {
    p = String(p || '');
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    if (i < 0) return '';
    if (i === 0) return p[0];
    const d = p.slice(0, i);
    return /^[A-Za-z]:$/.test(d) ? d + p[i] : d;
  }
  function extname(p) {
    const b = basename(p);
    const i = b.lastIndexOf('.');
    return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
  }
  function stripExtension(name) {
    const i = String(name).lastIndexOf('.');
    return i <= 0 ? String(name) : String(name).slice(0, i);
  }
  function parentFolderName(p) { return basename(dirname(p)) || dirname(p); }
  function samePath(a, b) {
    if (!a || !b) return false;
    const norm = (x) => {
      let s = String(x).replace(/\\/g, '/').replace(/\/+$/, '');
      if (/^[A-Za-z]:/.test(s) || s.startsWith('//')) s = s.toLowerCase();
      return s;
    };
    return norm(a) === norm(b);
  }

  // ── Texte ──
  function detectEol(text) {
    let crlf = 0, lf = 0;
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
      if (i > 0 && text.charCodeAt(i - 1) === 13) crlf++; else lf++;
    }
    return crlf > 0 && crlf >= lf ? 'CRLF' : 'LF';
  }
  function normalizeEol(text) { return text.indexOf('\r') === -1 ? text : text.replace(/\r\n?/g, '\n'); }
  function applyEol(text, eol) { return eol === 'CRLF' ? text.replace(/\r?\n/g, '\r\n') : text.replace(/\r\n/g, '\n'); }
  function countWords(text) {
    let n = 0, inWord = false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      const space = c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 0x2028 || c === 0x2029 || c === 0x3000;
      if (space) inWord = false; else if (!inWord) { inWord = true; n++; }
    }
    return n;
  }
  function lineColAt(text, offset) {
    let line = 1, last = -1;
    for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) { line++; last = i; }
    return { line, col: offset - last };
  }
  function countLines(text) {
    let n = 1;
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
    return n;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function truncateMiddle(s, max) {
    s = String(s);
    if (s.length <= max) return s;
    const keep = Math.max(1, max - 1);
    return '…' + s.slice(s.length - keep);
  }
  function truncateEnd(s, max) {
    s = String(s);
    return s.length <= max ? s : s.slice(0, Math.max(1, max - 1)) + '…';
  }

  // ── Divers ──
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function deepClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  let uidCounter = 0;
  function uid(prefix) {
    uidCounter++;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function debounce(fn, ms) {
    let t = null;
    const d = function (...args) { clearTimeout(t); t = setTimeout(() => { t = null; fn.apply(this, args); }, ms); };
    d.cancel = () => { clearTimeout(t); t = null; };
    d.flush = function (...args) { if (t) { clearTimeout(t); t = null; fn.apply(this, args); } };
    return d;
  }
  function formatBytes(n) {
    if (n < 1024) return n + ' o';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' Ko';
    return (n / 1048576).toFixed(1) + ' Mo';
  }

  class Emitter {
    constructor() { this._h = new Map(); }
    on(evt, fn) {
      if (!this._h.has(evt)) this._h.set(evt, new Set());
      this._h.get(evt).add(fn);
      return () => this.off(evt, fn);
    }
    off(evt, fn) { const s = this._h.get(evt); if (s) s.delete(fn); }
    emit(evt, ...args) {
      const s = this._h.get(evt);
      if (!s) return;
      for (const fn of [...s]) {
        try { fn(...args); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      }
    }
  }

  return {
    basename, dirname, extname, stripExtension, parentFolderName, samePath,
    detectEol, normalizeEol, applyEol, countWords, countLines, lineColAt, escapeHtml, truncateMiddle, truncateEnd,
    clamp, isPlainObject, deepClone, uid, debounce, formatBytes, Emitter,
  };
});
