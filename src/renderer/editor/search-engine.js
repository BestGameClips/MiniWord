(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Construit la RegExp de recherche. Lève une erreur si l'expression régulière est invalide. */
  function buildRegex(query, { caseSensitive = false, wholeWord = false, regex = false } = {}, extraFlags = 'g') {
    const body = regex ? query : escapeRe(query);
    const base = extraFlags + (caseSensitive ? '' : 'i');
    if (!wholeWord) return new RegExp(body, base);
    try { return new RegExp('(?<![\\p{L}\\p{N}_])(?:' + body + ')(?![\\p{L}\\p{N}_])', base + 'u'); }
    catch { return new RegExp('\\b(?:' + body + ')\\b', base); }
  }

  function findAll(text, query, opts, limit = 20000) {
    if (!query) return { matches: [], error: null, truncated: false };
    let re;
    try { re = buildRegex(query, opts); } catch (e) { return { matches: [], error: 'Expression régulière invalide', truncated: false }; }
    const matches = [];
    let m, truncated = false;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (matches.length >= limit) { truncated = true; break; }
    }
    return { matches, error: null, truncated };
  }

  /** Remplace la correspondance située à `match.start` (gère $1, $& en mode regex). */
  function replaceOne(text, match, query, replacement, opts) {
    const re = buildRegex(query, opts, 'y');
    re.lastIndex = match.start;
    const out = text.replace(re, opts.regex ? replacement : () => replacement);
    const newLen = out.length - text.length + (match.end - match.start);
    return { text: out, replacedEnd: match.start + newLen };
  }

  function replaceAll(text, query, replacement, opts) {
    const re = buildRegex(query, opts, 'g');
    const count = findAll(text, query, opts, Infinity).matches.length;
    const out = opts.regex ? text.replace(re, replacement) : text.replace(re, () => replacement);
    return { text: out, count };
  }

  return { buildRegex, findAll, replaceOne, replaceAll };
});
