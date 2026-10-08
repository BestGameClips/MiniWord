(function () {
  const MW = window.MW;

  /** Cache des paramètres + application de l'apparence (thème, accent, police, densité…). */
  const Store = new MW.Emitter();
  Store.settings = null;
  Store.info = null;

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  Store.init = async function () {
    this.info = await window.api.app.getInfo();
    this.settings = await window.api.settings.get();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.apply());
    this.apply();
  };

  Store.set = async function (patch) {
    const next = await window.api.settings.set(patch);
    this.settings = next;
    this.apply();
    this.emit('change', patch);
    return next;
  };
  Store.refresh = async function () {
    this.settings = await window.api.settings.get();
    this.apply();
    this.emit('change', { recentFiles: 1, favorites: 1, __refresh: true });
  };
  Store.reset = async function () {
    this.settings = await window.api.settings.reset();
    this.apply();
    this.emit('change', { __refresh: true, recentFiles: 1, sidebarCollapsed: 1 });
  };

  Store.apply = function () {
    const s = this.settings, root = document.documentElement, st = root.style;
    const theme = s.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;
    root.dataset.theme = theme;
    root.dataset.animations = s.animations ? 'on' : 'off';
    root.dataset.platform = this.info ? this.info.platform : '';
    st.setProperty('--accent', s.accentColor);
    st.setProperty('--accent-fg', luminance(s.accentColor) > 0.5 ? '#111111' : '#ffffff');
    st.setProperty('--radius', s.radius + 'px');
    st.setProperty('--pad-y', { compact: '3px', normal: '6px', comfortable: '9px' }[s.density]);
    st.setProperty('--editor-font', s.font);
    st.setProperty('--editor-font-size', (s.fontSize * s.zoom / 100).toFixed(2) + 'px');
    st.setProperty('--editor-line-height', String(s.lineHeight));
    st.setProperty('--editor-tab-size', String(s.tabSize));
    const sb = document.getElementById('statusbar');
    if (sb) sb.hidden = !s.statusBarVisible;
    if (MW.editor && MW.editor.ta) MW.editor.applySettings();
    if (MW.statusbar && MW.statusbar.cells.zoom) MW.statusbar.update();
  };

  MW.Store = Store;
})();
