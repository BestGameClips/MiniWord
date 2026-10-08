'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { markdownTitle } = require('../../shared/markdown');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const err = (code, message) => Object.assign(new Error(message), { code });

/**
 * Wiki à trois sources (priorité décroissante) :
 *   local    pages créées/modifiées par l'administrateur (fichiers .md OU base SQLite)
 *   remote   miroir en cache des .md du dépôt GitHub (rafraîchi au démarrage)
 *   bundled  pages livrées avec l'application (assets/wiki)
 */
class WikiManager {
  constructor({ bundledDir, dataDir, config, getSettings, getToken, logger, fetchImpl }) {
    this.bundledDir = bundledDir;
    this.cacheDir = path.join(dataDir, 'wiki', 'cache');
    this.localDir = path.join(dataDir, 'wiki', 'pages');
    this.dbFile = path.join(dataDir, 'wiki', 'wiki.sqlite');
    this.config = config; this.getSettings = getSettings; this.getToken = getToken || (() => '');
    this.logger = logger; this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.db = null;
    this.lastRefresh = null;
  }

  get repo() { const g = this.config.github || {}; return g.owner && g.repo ? g : null; }
  get remoteEnabled() { return !!(this.repo && this.config.wiki.remote); }
  static validSlug(slug) { return typeof slug === 'string' && SLUG_RE.test(slug); }
  static slugify(t) { return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page'; }

  // ── SQLite (node:sqlite, intégré à Node/Electron récents — aucune dépendance native) ──
  _openDb() {
    if (this.db) return this.db;
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch { throw err('E_SQLITE', 'SQLite n’est pas disponible dans cette version d’Electron : utilisez le stockage « fichiers ».'); }
    fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
    this.db = new DatabaseSync(this.dbFile);
    this.db.exec('CREATE TABLE IF NOT EXISTS pages (slug TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at INTEGER NOT NULL)');
    return this.db;
  }
  close() { try { this.db && this.db.close(); } catch { /* ignore */ } this.db = null; }

  async _readDir(dir, source) {
    let names; try { names = await fsp.readdir(dir); } catch { return []; }
    const out = [];
    for (const n of names) {
      if (!n.endsWith('.md')) continue;
      const slug = n.slice(0, -3); if (!WikiManager.validSlug(slug)) continue;
      try { const full = path.join(dir, n); const [content, st] = [await fsp.readFile(full, 'utf8'), await fsp.stat(full)]; out.push({ slug, source, content, updatedAt: st.mtimeMs }); } catch { /* ignore */ }
    }
    return out;
  }

  _localPages() {
    if (this.getSettings().wikiStorage === 'sqlite') {
      try { return this._openDb().prepare('SELECT slug, content, updated_at FROM pages').all().map((r) => ({ slug: r.slug, source: 'local', content: r.content, updatedAt: r.updated_at })); }
      catch (e) { this.logger.warn('Wiki SQLite : ' + e.message); return []; }
    }
    return null;
  }

  async _all() {
    const map = new Map();
    for (const p of await this._readDir(this.bundledDir, 'bundled')) map.set(p.slug, p);
    for (const p of await this._readDir(this.cacheDir, 'remote')) map.set(p.slug, p);
    const local = this._localPages() || await this._readDir(this.localDir, 'local');
    for (const p of local) map.set(p.slug, { ...p, overrides: map.has(p.slug) ? map.get(p.slug).source : null });
    return map;
  }

  async list() {
    const all = [...(await this._all()).values()].map((p) => ({ slug: p.slug, title: markdownTitle(p.content, p.slug), source: p.source, updatedAt: p.updatedAt, overrides: p.overrides || null }));
    const order = (s) => (s === 'accueil' ? 0 : 1);
    return all.sort((a, b) => order(a.slug) - order(b.slug) || a.title.localeCompare(b.title, 'fr'));
  }

  async get(slug) {
    if (!WikiManager.validSlug(slug)) throw err('E_ARG', 'Nom de page invalide.');
    const p = (await this._all()).get(slug);
    if (!p) throw err('E_NOT_FOUND', 'Page introuvable.');
    return { slug, title: markdownTitle(p.content, slug), source: p.source, content: p.content, updatedAt: p.updatedAt };
  }

  // ── Synchronisation GitHub → cache ──
  _headers() {
    const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'MiniWord', 'X-GitHub-Api-Version': '2022-11-28' };
    const t = this.getToken(); if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  async _json(url, opts = {}) {
    const res = await this.fetch(url, { ...opts, headers: { ...this._headers(), ...(opts.headers || {}) }, signal: AbortSignal.timeout(this.config.wiki.timeoutMs || 8000) });
    if (!res.ok) throw err('E_NETWORK', 'GitHub a répondu ' + res.status + (res.status === 404 ? ' (dépôt ou dossier introuvable)' : res.status === 403 ? ' (limite d’appels ou accès refusé)' : ''));
    return res.json();
  }

  /** Télécharge les .md du dépôt dans le cache. `force` ignore les empreintes déjà connues. */
  async refresh({ force = false } = {}) {
    if (!this.remoteEnabled) return { ok: true, skipped: true, updated: 0, removed: 0, message: 'Wiki distant non configuré (app.config.js › github).' };
    const { owner, repo, branch } = this.repo;
    const dir = this.config.wiki.path;
    try {
      const items = await this._json(`https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${encodeURIComponent(branch || 'main')}`);
      await fsp.mkdir(this.cacheDir, { recursive: true });
      const idxFile = path.join(this.cacheDir, '.index.json');
      let idx = {}; try { idx = JSON.parse(await fsp.readFile(idxFile, 'utf8')); } catch { /* premier passage */ }
      const next = {}; let updated = 0; const errors = [];
      for (const it of Array.isArray(items) ? items : []) {
        if (it.type !== 'file' || !it.name.endsWith('.md')) continue;
        const slug = it.name.slice(0, -3); if (!WikiManager.validSlug(slug) || !it.download_url) continue;
        next[slug] = it.sha;
        if (!force && idx[slug] === it.sha && fs.existsSync(path.join(this.cacheDir, slug + '.md'))) continue;
        try {
          const res = await this.fetch(it.download_url, { headers: { 'User-Agent': 'MiniWord' }, signal: AbortSignal.timeout(this.config.wiki.timeoutMs || 8000) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const text = await res.text();
          if (text.length > 2 * 1024 * 1024) throw new Error('page trop volumineuse');
          await fsp.writeFile(path.join(this.cacheDir, slug + '.md'), text, 'utf8'); updated++;
        } catch (e) { errors.push(slug + ' : ' + e.message); delete next[slug]; if (idx[slug]) next[slug] = idx[slug]; }
      }
      let removed = 0;
      for (const slug of Object.keys(idx)) if (!(slug in next)) { await fsp.unlink(path.join(this.cacheDir, slug + '.md')).catch(() => {}); removed++; }
      await fsp.writeFile(idxFile, JSON.stringify(next), 'utf8');
      this.lastRefresh = { at: Date.now(), ok: !errors.length };
      return { ok: !errors.length, updated, removed, errors, message: updated || removed ? `${updated} page(s) mise(s) à jour, ${removed} supprimée(s).` : 'Wiki déjà à jour.' };
    } catch (e) {
      this.logger.warn('Synchronisation du wiki impossible : ' + e.message);
      this.lastRefresh = { at: Date.now(), ok: false };
      return { ok: false, updated: 0, removed: 0, offline: true, message: 'Wiki distant inaccessible : le contenu en cache est utilisé. (' + (e.code === 'E_NETWORK' ? e.message : 'hors ligne ou délai dépassé') + ')' };
    }
  }

  // ── Administration (l'autorisation est vérifiée par la couche IPC) ──
  async save(slug, content) {
    if (!WikiManager.validSlug(slug)) throw err('E_ARG', 'Nom de page invalide (a–z, 0–9, tirets).');
    if (typeof content !== 'string' || content.length > 2 * 1024 * 1024) throw err('E_ARG', 'Contenu invalide ou trop volumineux.');
    if (this.getSettings().wikiStorage === 'sqlite') {
      this._openDb().prepare('INSERT INTO pages (slug, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at').run(slug, content, Date.now());
    } else {
      await fsp.mkdir(this.localDir, { recursive: true });
      const f = path.join(this.localDir, slug + '.md'); await fsp.writeFile(f + '.tmp', content, 'utf8'); await fsp.rename(f + '.tmp', f);
    }
    let pushed = null;
    if (this.getSettings().wikiGithubSync && this.repo) pushed = await this.push(slug).catch((e) => ({ ok: false, message: e.message }));
    return { ok: true, pushed };
  }

  async delete(slug) {
    if (!WikiManager.validSlug(slug)) throw err('E_ARG', 'Nom de page invalide.');
    if (this.getSettings().wikiStorage === 'sqlite') this._openDb().prepare('DELETE FROM pages WHERE slug = ?').run(slug);
    else await fsp.unlink(path.join(this.localDir, slug + '.md')).catch(() => {});
    let pushed = null;
    if (this.getSettings().wikiGithubSync && this.repo && this.getToken()) pushed = await this.push(slug, { remove: true }).catch((e) => ({ ok: false, message: e.message }));
    return { ok: true, pushed };
  }

  /** Publie (ou supprime) une page dans le dépôt GitHub via l'API Contents. Jeton `repo` requis. */
  async push(slug, { remove = false } = {}) {
    if (!this.repo) throw err('E_GITHUB', 'Dépôt GitHub non configuré (app.config.js › github).');
    if (!this.getToken()) throw err('E_GITHUB', 'Aucun jeton GitHub : enregistrez-en un dans le panneau d’administration.');
    const { owner, repo, branch } = this.repo;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${this.config.wiki.path}/${slug}.md`;
    let sha; try { sha = (await this._json(url + '?ref=' + encodeURIComponent(branch || 'main'))).sha; } catch { sha = undefined; }
    if (remove) {
      if (!sha) return { ok: true, message: 'Déjà absente du dépôt.' };
      await this._json(url, { method: 'DELETE', body: JSON.stringify({ message: 'wiki: suppression de ' + slug, sha, branch: branch || 'main' }), headers: { 'Content-Type': 'application/json' } });
      return { ok: true, message: 'Page supprimée du dépôt.' };
    }
    const page = await this.get(slug);
    await this._json(url, { method: 'PUT', body: JSON.stringify({ message: 'wiki: mise à jour de ' + slug, content: Buffer.from(page.content, 'utf8').toString('base64'), sha, branch: branch || 'main' }), headers: { 'Content-Type': 'application/json' } });
    return { ok: true, message: 'Page publiée sur GitHub.' };
  }

  info() {
    return { storage: this.getSettings().wikiStorage, githubSync: this.getSettings().wikiGithubSync, remoteEnabled: this.remoteEnabled, repo: this.repo ? `${this.repo.owner}/${this.repo.repo}` : null,
      hasToken: !!this.getToken(), lastRefresh: this.lastRefresh, localDir: this.localDir, onlineUrl: this.repo ? `https://github.com/${this.repo.owner}/${this.repo.repo}/tree/${this.repo.branch || 'main'}/${this.config.wiki.path}` : null };
  }
}

/** Vérifie un mot de passe admin contre le SHA-256 configuré (comparaison à temps constant). */
function checkAdminPassword(password, expectedHex) {
  if (!expectedHex || typeof password !== 'string') return false;
  const a = crypto.createHash('sha256').update(password).digest();
  let b; try { b = Buffer.from(expectedHex, 'hex'); } catch { return false; }
  return b.length === a.length && crypto.timingSafeEqual(a, b);
}

module.exports = { WikiManager, checkAdminPassword };
