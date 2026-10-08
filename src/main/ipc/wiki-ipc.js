'use strict';
const { shell } = require('electron');
const { IPC, EVT } = require('../../shared/ipc-channels');
const { v, IpcError } = require('./register');
const { checkAdminPassword } = require('../wiki/wiki-manager');

function registerWikiIpc(ctx, handle) {
  const { wiki, config, settings, secrets, logger, windowManager } = ctx;
  ctx.adminUnlocked = false;
  const isAdmin = () => ctx.adminUnlocked || ctx.isDev || settings.get('developerMode');
  const requireAdmin = () => { if (!isAdmin()) throw new IpcError('E_ADMIN', 'Accès administrateur requis (mode développeur ou mot de passe admin).'); };

  handle(IPC.WIKI_LIST, () => wiki.list());
  handle(IPC.WIKI_GET, (_e, slug) => wiki.get(v.str(slug, 'slug', 64)));
  handle(IPC.WIKI_INFO, () => wiki.info());
  handle(IPC.WIKI_REFRESH, async () => {
    const r = await wiki.refresh({ force: true });
    (r.ok ? logger.success : logger.warn).call(logger, 'Wiki : ' + r.message);
    windowManager.send(EVT.WIKI_UPDATED, r);
    return r;
  });

  handle(IPC.ADMIN_STATE, () => ({ admin: isAdmin(), viaDev: ctx.isDev || settings.get('developerMode'), passwordRequired: !!config.admin.passwordSha256 && !ctx.adminUnlocked && !(ctx.isDev || settings.get('developerMode')) }));
  handle(IPC.ADMIN_UNLOCK, async (_e, password) => {
    v.str(password, 'password', 200);
    await new Promise((r) => setTimeout(r, 400)); // freine le brute-force
    const ok = checkAdminPassword(password, config.admin.passwordSha256);
    if (ok) { ctx.adminUnlocked = true; logger.success('Rôle administrateur déverrouillé.'); } else logger.warn('Tentative de déverrouillage admin refusée.');
    return ok;
  });

  handle(IPC.WIKI_SAVE, async (_e, a) => { requireAdmin(); v.obj(a, 'page'); const r = await wiki.save(v.str(a.slug, 'slug', 64), v.str(a.content, 'content', 3 * 1024 * 1024)); logger.success('Wiki : page « ' + a.slug + ' » enregistrée.'); return r; });
  handle(IPC.WIKI_DELETE, async (_e, slug) => { requireAdmin(); const r = await wiki.delete(v.str(slug, 'slug', 64)); logger.info('Wiki : page « ' + slug + ' » supprimée.'); return r; });
  handle(IPC.WIKI_PUSH, async (_e, slug) => { requireAdmin(); return wiki.push(v.str(slug, 'slug', 64)); });
  handle(IPC.GITHUB_TOKEN_SET, (_e, token) => { requireAdmin(); secrets.setToken(v.str(token, 'token', 300).trim()); return wiki.info(); });

  handle(IPC.SYSTEM_OPEN_EXTERNAL, async (_e, url) => {
    v.str(url, 'url', 2000);
    let u; try { u = new URL(url); } catch { throw new IpcError('E_ARG', 'Adresse invalide.'); }
    if (u.protocol !== 'https:') throw new IpcError('E_ARG', 'Seules les adresses https sont ouvertes.');
    await shell.openExternal(u.href);
  });
}

module.exports = { registerWikiIpc };
