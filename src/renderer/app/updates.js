(function () {
  const MW = window.MW;
  let lastPrompt = '';

  /** Flux de mise à jour piloté par le processus principal (GitHub Releases). */
  MW.updates = {
    init() {
      window.api.app.onUpdateStatus((st) => this.onStatus(st).catch((e) => console.error(e)));
    },
    async onStatus(st) {
      if (st.status === 'available' && lastPrompt !== 'a' + st.version) {
        lastPrompt = 'a' + st.version;
        const ok = await MW.dialogs.show({ title: 'Mise à jour disponible', dismissValue: false,
          body: MW.h('div', null, MW.h('p', null, 'La version ', MW.h('strong', null, st.version), ' de ' + MW.Store.info.name + ' est disponible (vous avez la ' + MW.Store.info.version + ').'), st.notes ? MW.h('p', { class: 'dim', style: { whiteSpace: 'pre-line' } }, st.notes.slice(0, 600)) : null),
          buttons: [{ label: 'Plus tard', value: false }, { label: 'Télécharger', value: true, variant: 'primary', default: true }] }).promise;
        if (ok) { MW.notify.info('Téléchargement de la mise à jour…'); window.api.app.downloadUpdate().catch((e) => MW.notify.error(e.message)); }
      } else if (st.status === 'downloading' && st.percent != null && st.percent % 25 === 0) {
        MW.notify.info('Téléchargement : ' + st.percent + ' %', { timeout: 1500 });
      } else if (st.status === 'downloaded' && lastPrompt !== 'd' + st.version) {
        lastPrompt = 'd' + st.version;
        const ok = await MW.dialogs.confirm('Mise à jour prête', 'La version ' + st.version + ' est téléchargée. Redémarrer maintenant pour l’installer ? (Vos documents seront d’abord enregistrés ou vous seront proposés à l’enregistrement.)', { ok: 'Redémarrer et installer', cancel: 'Au prochain démarrage' });
        if (ok && (await MW.fileActions.prepareQuit())) window.api.app.installUpdate().catch((e) => MW.notify.error(e.message));
      } else if (st.status === 'error' && st.message) MW.notify.error(st.message);
    },
  };
})();
