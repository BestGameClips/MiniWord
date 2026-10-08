(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Types de fichiers pris en charge.
   * Pour en ajouter un : ajoute simplement une ligne ici (extension → infos).
   *   formatting : null (texte brut, aucun formatage) | 'markdown' | 'html'
   */
  const FILE_TYPES = {
    txt:  { label: 'TXT',  name: 'Texte brut',  language: 'plaintext',  formatting: null },
    md:   { label: 'MD',   name: 'Markdown',    language: 'markdown',   formatting: 'markdown' },
    log:  { label: 'LOG',  name: 'Journal',     language: 'log',        formatting: null },
    json: { label: 'JSON', name: 'JSON',        language: 'json',       formatting: null },
    csv:  { label: 'CSV',  name: 'CSV',         language: 'csv',        formatting: null },
    xml:  { label: 'XML',  name: 'XML',         language: 'xml',        formatting: null },
    html: { label: 'HTML', name: 'HTML',        language: 'html',       formatting: 'html' },
    css:  { label: 'CSS',  name: 'CSS',         language: 'css',        formatting: null },
    js:   { label: 'JS',   name: 'JavaScript',  language: 'javascript', formatting: null },
    ts:   { label: 'TS',   name: 'TypeScript',  language: 'typescript', formatting: null },
  };
  const DEFAULT_EXTENSION = 'txt';

  function typeForExtension(ext) {
    ext = String(ext || '').toLowerCase();
    return FILE_TYPES[ext] || { label: ext ? ext.toUpperCase() : 'TXT', name: 'Texte', language: 'plaintext', formatting: null };
  }
  function languageForExtension(ext) { return typeForExtension(ext).language; }

  function openDialogFilters() {
    const exts = Object.keys(FILE_TYPES);
    return [
      { name: 'Documents texte', extensions: exts },
      ...exts.map((e) => ({ name: FILE_TYPES[e].name + ' (.' + e + ')', extensions: [e] })),
      { name: 'Tous les fichiers', extensions: ['*'] },
    ];
  }
  function saveDialogFilters(preferredExt) {
    const exts = Object.keys(FILE_TYPES);
    const first = FILE_TYPES[preferredExt] ? preferredExt : DEFAULT_EXTENSION;
    const ordered = [first, ...exts.filter((e) => e !== first)];
    return [...ordered.map((e) => ({ name: FILE_TYPES[e].name + ' (.' + e + ')', extensions: [e] })), { name: 'Tous les fichiers', extensions: ['*'] }];
  }

  const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200];
  const AUTOSAVE_INTERVALS = [
    { label: 'Désactivé', value: 0 },
    { label: '500 ms', value: 500 },
    { label: '1 seconde', value: 1000 },
    { label: '2 secondes', value: 2000 },
    { label: '5 secondes', value: 5000 },
    { label: '10 secondes', value: 10000 },
    { label: '30 secondes', value: 30000 },
  ];
  const FONT_CHOICES = [
    { label: 'Monospace (Consolas / Cascadia)', value: 'Consolas, "Cascadia Mono", "SF Mono", Menlo, "DejaVu Sans Mono", monospace' },
    { label: 'Sans-serif (Segoe UI / Inter)', value: '"Segoe UI", Inter, system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif' },
    { label: 'Serif (Georgia)', value: 'Georgia, "Times New Roman", Times, serif' },
    { label: 'Courier', value: '"Courier New", Courier, monospace' },
    { label: 'Système', value: 'system-ui, sans-serif' },
  ];
  const ENCODINGS = [
    { value: 'utf8', label: 'UTF-8' },
    { value: 'utf8-bom', label: 'UTF-8 avec BOM' },
    { value: 'utf16le', label: 'UTF-16 LE' },
    { value: 'utf16be', label: 'UTF-16 BE' },
    { value: 'windows-1252', label: 'Windows-1252' },
  ];
  const DOC_STATUS = { UNTITLED: 'UNTITLED', DIRTY: 'DIRTY', SAVED: 'SAVED' };
  const MAX_FILE_SIZE_DEFAULT = 20 * 1024 * 1024;

  return {
    FILE_TYPES, DEFAULT_EXTENSION, typeForExtension, languageForExtension, openDialogFilters, saveDialogFilters,
    ZOOM_LEVELS, AUTOSAVE_INTERVALS, FONT_CHOICES, ENCODINGS, DOC_STATUS, MAX_FILE_SIZE_DEFAULT,
  };
});
