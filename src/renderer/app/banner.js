(function () {
  const MW = window.MW; const { h, icon } = MW;

  /** Bandeau au-dessus de l'éditeur : fichier modifié extérieurement / supprimé. */
  MW.banner = {
    render() {
      const area = document.getElementById('banner-area');
      MW.clear(area);
      const doc = MW.editor.doc;
      if (!doc || !doc.externalState) return;
      const fa = MW.fileActions;
      if (doc.externalState === 'changed') {
        area.append(h('div', { class: 'banner', role: 'alert' }, icon('alert', 20),
          h('div', { class: 'msg' }, 'Ce fichier a été modifié extérieurement.', h('small', null, doc.isDirty ? 'Vous avez aussi des modifications non enregistrées.' : 'Aucune de vos modifications n’a été perdue.')),
          h('div', { class: 'actions' },
            h('button', { class: 'btn small', onClick: () => fa.reloadFromDisk(doc) }, 'Recharger'),
            h('button', { class: 'btn small', onClick: () => fa.keepMine(doc) }, 'Conserver ma version'),
            h('button', { class: 'btn small', onClick: () => fa.compare(doc) }, 'Comparer'))));
      } else if (doc.externalState === 'deleted') {
        area.append(h('div', { class: 'banner danger', role: 'alert' }, icon('alert', 20),
          h('div', { class: 'msg' }, 'Ce fichier n’existe plus sur le disque.', h('small', null, 'Le contenu actuel est conservé dans l’éditeur.')),
          h('div', { class: 'actions' }, h('button', { class: 'btn small primary', onClick: () => fa.saveAs(doc) }, 'Enregistrer sous'))));
      }
    },
  };
})();
