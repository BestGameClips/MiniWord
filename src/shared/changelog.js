(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * CHANGELOG.md (format « Keep a Changelog » simplifié) :
   *   ## [1.1.0] - 2026-10-07
   *   ### Nouveautés | Améliorations | Corrections
   *   - élément
   */
  function parseChangelog(text) {
    const entries = [];
    let cur = null, sec = null;
    for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
      let m;
      if ((m = raw.match(/^##\s+\[?v?(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\]?\s*(?:[-–—]\s*(\S.*))?$/))) { cur = { version: m[1], date: (m[2] || '').trim(), sections: [] }; entries.push(cur); sec = null; }
      else if (cur && (m = raw.match(/^###\s+(.+?)\s*$/))) { sec = { title: m[1], items: [] }; cur.sections.push(sec); }
      else if (cur && (m = raw.match(/^\s*[-*]\s+(.+?)\s*$/))) { if (!sec) { sec = { title: 'Changements', items: [] }; cur.sections.push(sec); } sec.items.push(m[1]); }
    }
    return entries;
  }
  function compareVersions(a, b) {
    const pa = String(a).split(/[.+-]/).map((x) => parseInt(x, 10) || 0), pb = String(b).split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; }
    return 0;
  }
  const entryFor = (entries, version) => entries.find((e) => e.version === version) || null;
  /** Texte Markdown d'une entrée (pour GitHub Release / webhook). */
  function entryToMarkdown(e) {
    return e.sections.map((s) => '### ' + s.title + '\n' + s.items.map((i) => '- ' + i).join('\n')).join('\n\n');
  }
  return { parseChangelog, compareVersions, changelogEntryFor: entryFor, changelogEntryToMarkdown: entryToMarkdown };
});
