(function () {
  const MW = window.MW; const { h, icon } = MW;
  const ICONS = { success: 'checkCircle', warn: 'alert', error: 'xCircle', info: 'info' };
  const TIMEOUT = { success: 2600, info: 3500, warn: 6500, error: 8000 };

  /** NotificationManager : toasts non bloquants (annoncés aux lecteurs d'écran via aria-live). */
  function show(type, message, opts) {
    opts = opts || {};
    if (MW.devConsole && MW.devConsole.active) window.api.app.log(type === 'success' ? 'success' : type, '[UI] ' + message);
    const root = document.getElementById('toasts');
    while (root.children.length >= 5) root.firstChild.remove();
    const el = h('div', { class: 'toast ' + type, role: type === 'error' ? 'alert' : 'status' }, icon(ICONS[type] || 'info', 18),
      h('div', { class: 'msg' }, message,
        opts.action ? h('button', { class: 't-action', onClick: () => { close(); opts.action.onClick(); } }, opts.action.label) : null),
      h('button', { class: 'icon-btn', 'aria-label': 'Fermer la notification', style: { width: '22px', height: '22px' }, onClick: () => close() }, icon('x', 14)));
    let timer;
    function close() { clearTimeout(timer); el.classList.add('leaving'); setTimeout(() => el.remove(), 220); }
    root.append(el);
    timer = setTimeout(close, opts.timeout || TIMEOUT[type] || 4000);
    return close;
  }
  MW.notify = {
    success: (m, o) => show('success', m, o), info: (m, o) => show('info', m, o),
    warn: (m, o) => show('warn', m, o), error: (m, o) => show('error', m, o),
  };
})();
