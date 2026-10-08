(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Une édition = remplacer text[from:to] par `insert`, puis sélectionner [selStart, selEnd]. */

  function lineBounds(text, start, end) {
    const from = text.lastIndexOf('\n', start - 1) + 1;
    let to = end;
    if (end > start && text[end - 1] === '\n') to = end - 1; // la ligne où s'arrête la sélection n'est pas incluse si elle est vide
    const nl = text.indexOf('\n', to);
    return { from, to: nl < 0 ? text.length : nl };
  }

  function indent(text, start, end, unit) {
    if (start === end) return { from: start, to: end, insert: unit, selStart: start + unit.length, selEnd: start + unit.length };
    const { from, to } = lineBounds(text, start, end);
    const lines = text.slice(from, to).split('\n');
    const insert = lines.map((l) => unit + l).join('\n');
    return { from, to, insert, selStart: start + unit.length, selEnd: end + unit.length * lines.length };
  }

  function unindent(text, start, end, tabSize) {
    const { from, to } = lineBounds(text, start, end);
    const lines = text.slice(from, to).split('\n');
    let removedFirst = 0, removedTotal = 0;
    const out = lines.map((l, i) => {
      let n = 0;
      if (l[0] === '\t') n = 1; else { while (n < tabSize && l[n] === ' ') n++; }
      if (i === 0) removedFirst = n;
      removedTotal += n;
      return l.slice(n);
    });
    if (!removedTotal) return null;
    return { from, to, insert: out.join('\n'), selStart: Math.max(from, start - removedFirst), selEnd: Math.max(from, end - removedTotal) };
  }

  /** Entoure la sélection (ou bascule : retire l'entourage s'il existe déjà). */
  function wrap(text, start, end, before, after, placeholder) {
    const sel = text.slice(start, end);
    if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
      const inner = sel.slice(before.length, sel.length - after.length);
      return { from: start, to: end, insert: inner, selStart: start, selEnd: start + inner.length };
    }
    if (text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after && start >= before.length) {
      return { from: start - before.length, to: end + after.length, insert: sel, selStart: start - before.length, selEnd: start - before.length + sel.length };
    }
    const inner = sel || placeholder || '';
    return { from: start, to: end, insert: before + inner + after, selStart: start + before.length, selEnd: start + before.length + inner.length };
  }

  function mapLines(text, start, end, fn) {
    const from = text.lastIndexOf('\n', start - 1) + 1;
    const nl = text.indexOf('\n', end);
    const to = nl < 0 ? text.length : nl;
    const lines = text.slice(from, to).split('\n').map(fn);
    const insert = lines.join('\n');
    return { from, to, insert, selStart: from, selEnd: from + insert.length };
  }

  const MD = {
    bold: (t, s, e) => wrap(t, s, e, '**', '**', 'texte'),
    italic: (t, s, e) => wrap(t, s, e, '*', '*', 'texte'),
    underline: (t, s, e) => wrap(t, s, e, '<u>', '</u>', 'texte'),
    strike: (t, s, e) => wrap(t, s, e, '~~', '~~', 'texte'),
    code: (t, s, e) => wrap(t, s, e, '`', '`', 'code'),
    codeblock: (t, s, e) => wrap(t, s, e, '```\n', '\n```', 'code'),
    h1: (t, s, e) => mapLines(t, s, e, (l) => '# ' + l.replace(/^#{1,6}\s+/, '')),
    h2: (t, s, e) => mapLines(t, s, e, (l) => '## ' + l.replace(/^#{1,6}\s+/, '')),
    h3: (t, s, e) => mapLines(t, s, e, (l) => '### ' + l.replace(/^#{1,6}\s+/, '')),
    ul: (t, s, e) => mapLines(t, s, e, (l) => (/^- /.test(l) ? l.slice(2) : '- ' + l)),
    ol: (t, s, e) => { let i = 0; return mapLines(t, s, e, (l) => (/^\d+\. /.test(l) ? l.replace(/^\d+\. /, '') : ++i + '. ' + l)); },
    quote: (t, s, e) => mapLines(t, s, e, (l) => (/^> /.test(l) ? l.slice(2) : '> ' + l)),
    link: (t, s, e, extra) => { const label = t.slice(s, e) || 'lien'; const ins = '[' + label + '](' + (extra || 'https://') + ')'; return { from: s, to: e, insert: ins, selStart: s + 1, selEnd: s + 1 + label.length }; },
  };
  const tag = (name, ph) => (t, s, e) => wrap(t, s, e, '<' + name + '>', '</' + name + '>', ph || 'texte');
  const HTML = {
    bold: tag('strong'), italic: tag('em'), underline: tag('u'), strike: tag('s'), code: tag('code', 'code'), highlight: tag('mark'),
    codeblock: (t, s, e) => wrap(t, s, e, '<pre><code>', '</code></pre>', 'code'),
    h1: tag('h1'), h2: tag('h2'), h3: tag('h3'), quote: tag('blockquote'),
    ul: (t, s, e) => { const sel = t.slice(s, e) || 'élément'; const ins = '<ul>\n' + sel.split('\n').map((l) => '  <li>' + l + '</li>').join('\n') + '\n</ul>'; return { from: s, to: e, insert: ins, selStart: s, selEnd: s + ins.length }; },
    ol: (t, s, e) => { const sel = t.slice(s, e) || 'élément'; const ins = '<ol>\n' + sel.split('\n').map((l) => '  <li>' + l + '</li>').join('\n') + '\n</ol>'; return { from: s, to: e, insert: ins, selStart: s, selEnd: s + ins.length }; },
    link: (t, s, e, extra) => { const label = t.slice(s, e) || 'lien'; const ins = '<a href="' + (extra || 'https://') + '">' + label + '</a>'; return { from: s, to: e, insert: ins, selStart: s, selEnd: s + ins.length }; },
    alignLeft: (t, s, e) => wrap(t, s, e, '<div style="text-align:left">', '</div>', 'texte'),
    alignCenter: (t, s, e) => wrap(t, s, e, '<div style="text-align:center">', '</div>', 'texte'),
    alignRight: (t, s, e) => wrap(t, s, e, '<div style="text-align:right">', '</div>', 'texte'),
  };
  const FORMATTERS = { markdown: MD, html: HTML };

  /** Renvoie l'édition de formatage, ou null si le type de fichier ne le permet pas. */
  function formatEdit(kind, formatting, text, start, end, extra) {
    const set = FORMATTERS[formatting];
    return set && set[kind] ? set[kind](text, start, end, extra) : null;
  }

  return { indent, unindent, wrap, formatEdit, lineBounds, FORMATTERS };
});
