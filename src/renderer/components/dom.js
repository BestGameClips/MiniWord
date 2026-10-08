(function () {
  const MW = (window.MW = window.MW || {});
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  /** h('div', {class:'x', onClick: fn}, enfants…) */
  MW.h = function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  };
  MW.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  MW.$ = (s, r) => (r || document).querySelector(s);
  MW.isMac = window.api && window.api.platform === 'darwin';
})();
