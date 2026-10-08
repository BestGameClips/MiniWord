(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Diff ligne à ligne (LCS) avec réduction préfixe/suffixe commun.
   * Retourne [{type:'eq'|'add'|'del', line}] — "del" = présent dans A seulement, "add" = dans B seulement.
   * Au-delà de LIMIT cellules, le bloc central est affiché comme un remplacement global.
   */
  const LIMIT = 4000000;

  function diffLines(a, b) {
    const A = a.split('\n'), B = b.split('\n');
    let start = 0;
    while (start < A.length && start < B.length && A[start] === B[start]) start++;
    let endA = A.length, endB = B.length;
    while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) { endA--; endB--; }

    const out = [];
    for (let i = 0; i < start; i++) out.push({ type: 'eq', line: A[i] });
    const midA = A.slice(start, endA), midB = B.slice(start, endB);
    let truncated = false;

    if (midA.length * midB.length > LIMIT) {
      truncated = true;
      for (const l of midA) out.push({ type: 'del', line: l });
      for (const l of midB) out.push({ type: 'add', line: l });
    } else if (midA.length === 0) {
      for (const l of midB) out.push({ type: 'add', line: l });
    } else if (midB.length === 0) {
      for (const l of midA) out.push({ type: 'del', line: l });
    } else {
      const n = midA.length, m = midB.length;
      const w = m + 1;
      const t = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          t[i * w + j] = midA[i] === midB[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
        }
      }
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (midA[i] === midB[j]) { out.push({ type: 'eq', line: midA[i] }); i++; j++; }
        else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) { out.push({ type: 'del', line: midA[i++] }); }
        else { out.push({ type: 'add', line: midB[j++] }); }
      }
      while (i < n) out.push({ type: 'del', line: midA[i++] });
      while (j < m) out.push({ type: 'add', line: midB[j++] });
    }
    for (let i = endA; i < A.length; i++) out.push({ type: 'eq', line: A[i] });
    out.truncated = truncated;
    return out;
  }

  return { diffLines };
});
