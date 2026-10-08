'use strict';
const { basename, extname, samePath } = require('../shared/utils');

/** Fichiers récents + favoris, stockés dans les paramètres. */
class RecentFilesManager {
  constructor(settings) { this.settings = settings; }

  list() { return this.settings.get('recentFiles'); }

  add(filePath) {
    const limit = this.settings.get('recentLimit');
    const entry = { path: filePath, name: basename(filePath), type: extname(filePath), openedAt: Date.now() };
    const list = [entry, ...this.list().filter((e) => !samePath(e.path, filePath))].slice(0, limit);
    this.settings.set({ recentFiles: list });
    return list;
  }

  remove(filePath) {
    const list = this.list().filter((e) => !samePath(e.path, filePath));
    this.settings.set({ recentFiles: list });
    return list;
  }

  clear() { this.settings.set({ recentFiles: [] }); return []; }

  /** Applique la limite configurée (appelé quand l'utilisateur la change). */
  trim() {
    const limit = this.settings.get('recentLimit');
    const list = this.list();
    if (list.length > limit) this.settings.set({ recentFiles: list.slice(0, limit) });
  }
}

class FavoritesManager {
  constructor(settings) { this.settings = settings; }
  list() { return this.settings.get('favorites'); }
  add(filePath) {
    if (this.list().some((e) => samePath(e.path, filePath))) return this.list();
    const list = [...this.list(), { path: filePath, name: basename(filePath), addedAt: Date.now() }];
    this.settings.set({ favorites: list });
    return list;
  }
  remove(filePath) {
    const list = this.list().filter((e) => !samePath(e.path, filePath));
    this.settings.set({ favorites: list });
    return list;
  }
}

module.exports = { RecentFilesManager, FavoritesManager };
