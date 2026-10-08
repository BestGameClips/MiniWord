(function () {
  const MW = window.MW;
  let last = '', savingUntil = 0, savingTimer = null;

  /**
   * Pont renderer → Discord RPC. N'envoie QUE : statut, nom/chemin du fichier, id du document,
   * nombre d'onglets. Jamais le contenu. N'envoie que si l'information a changé.
   */
  function compute() {
    const doc = MW.editor && MW.editor.doc;
    if (!doc) return { status: 'idle', fileName: null, filePath: null, isUntitled: false, docId: null, tabCount: 0 };
    let status = doc.isDirty ? 'editing' : 'reading';
    if (MW.findBar && MW.findBar.open) status = 'searching';
    if (Date.now() < savingUntil || doc.saving) status = 'saving';
    return { status, fileName: doc.name, filePath: doc.path || null, isUntitled: !doc.path, docId: doc.id, tabCount: MW.tabs.order.length };
  }

  MW.rpcBridge = {
    refresh(force) {
      const p = compute();
      const key = JSON.stringify(p);
      if (!force && key === last) return;
      last = key;
      window.api.discord.update(p).catch(() => {});
    },
    /** Affiche « Sauvegarde » pendant ~1,5 s après une écriture. */
    flashSaving() {
      savingUntil = Date.now() + 1500;
      this.refresh();
      clearTimeout(savingTimer);
      savingTimer = setTimeout(() => this.refresh(), 1600);
    },
  };
})();
