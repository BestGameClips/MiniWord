(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Interpréteur Markdown maison, SÛR par construction : tout le texte est échappé,
   * le HTML brut est affiché tel quel (jamais interprété), seuls http(s)/mailto/#/chemins relatifs sont autorisés pour les liens.
   * Prend en charge : titres, gras, italique, barré, code, blocs de code, listes (+ tâches), citations,
   * tableaux, règles horizontales, liens, images, retours à la ligne.
   */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => {
    u = String(u).trim();
    if (/^(https?:\/\/|mailto:|#|\.{0,2}\/)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return /^(javascript|data|vbscript|file):/i.test(u) ? '' : u;
    return '';
  };
  const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function inline(text) {
    const codes = [];
    let s = String(text).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, c) => { codes.push('<code>' + esc(c.trim()) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s);
    // images puis liens
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, url) => { const u = safeUrl(url.replace(/&amp;/g, '&')); return u ? '<img src="' + esc(u) + '" alt="' + alt + '" loading="lazy">' : alt; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, label, url) => { const u = safeUrl(url.replace(/&amp;/g, '&')); return u ? '<a href="' + esc(u) + '" data-md-link="1">' + label + '</a>' : label; });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => pre + '<a href="' + url + '" data-md-link="1">' + url + '</a>');
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/ {2,}\n/g, '<br>\n');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  }

  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
  const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  function stripFrontMatter(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { body: md, meta: {} };
    const meta = {};
    m[1].split(/\r?\n/).forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, ''); });
    return { body: md.slice(m[0].length), meta };
  }

  function render(md, { headingIds = true } = {}) {
    const lines = stripFrontMatter(String(md || '').replace(/\r\n?/g, '\n')).body.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      let m;
      if ((m = line.match(/^(\s*)(```|~~~)\s*([\w+-]*)\s*$/))) { // bloc de code
        const fence = m[2], lang = m[3]; const buf = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
        i++;
        out.push('<pre class="md-code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(buf.join('\n')) + '</code></pre>');
      } else if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
        const lvl = m[1].length;
        out.push('<h' + lvl + (headingIds ? ' id="' + slugify(m[2]) + '"' : '') + '>' + inline(m[2]) + '</h' + lvl + '>'); i++;
      } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; }
      else if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote>' + render(buf.join('\n'), { headingIds: false }) + '</blockquote>');
      } else if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = splitRow(line), aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''));
        i += 2; const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
        const cell = (tag, c, k) => '<' + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c) + '</' + tag + '>';
        out.push('<div class="md-table"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + head.map((_, k) => cell('td', r[k] || '', k)).join('') + '</tr>').join('') + '</tbody></table></div>');
      } else if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]/.test(line);
        const baseIndent = line.match(/^\s*/)[0].length;
        const items = [];
        while (i < lines.length && lines[i].trim() && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
          const l = lines[i];
          const lm = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (lm && lm[1].length <= baseIndent + 1) items.push({ text: lm[3], sub: [] });
          else if (items.length) items[items.length - 1].sub.push(l.replace(/^\s{2,4}/, ''));
          i++;
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.map((it) => {
          let t = it.text, cls = '';
          const task = t.match(/^\[( |x|X)\]\s+(.*)$/);
          if (task) { cls = ' class="task"'; t = '<input type="checkbox" disabled' + (task[1] !== ' ' ? ' checked' : '') + '> ' + inline(task[2]); } else t = inline(t);
          return '<li' + cls + '>' + t + (it.sub.length ? render(it.sub.join('\n'), { headingIds: false }) : '') + '</li>';
        }).join('') + (ordered ? '</ol>' : '</ul>'));
      } else { // paragraphe
        const buf = [];
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*(```|~~~)|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) && !/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(lines[i])) buf.push(lines[i++]);
        if (!buf.length) { buf.push(lines[i++]); }
        out.push('<p>' + inline(buf.join('\n')).replace(/\n/g, '<br>') + '</p>');
      }
    }
    return out.join('\n');
  }

  /** Premier titre `# …` (ou titre du front matter) — sert de nom de page. */
  function titleOf(md, fallback) {
    const { body, meta } = stripFrontMatter(String(md || ''));
    if (meta.title) return meta.title;
    const m = body.match(/^#\s+(.+?)\s*#*\s*$/m);
    return m ? m[1].replace(/[*_`]/g, '') : fallback || 'Sans titre';
  }

  return { renderMarkdown: render, markdownTitle: titleOf, markdownEscape: esc, stripFrontMatter };
});
