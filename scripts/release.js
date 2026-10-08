#!/usr/bin/env node
'use strict';
/**
 * Publication d'une release en une commande :
 *   génération (tests + build + installateur + zip) → commit/tag/push → release GitHub (+ fichiers) → webhook Discord.
 *
 *   npm run release -- patch            (ou minor | major | 1.2.3)
 *   npm run release:dry                 (simulation : rien n'est modifié, aucun réseau)
 *
 * Options : --dry-run  --draft  --skip-tests  --skip-build  --no-webhook  --no-push
 * Variables : GITHUB_TOKEN (obligatoire hors dry-run) · DISCORD_WEBHOOK_URL (optionnelle)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const lib = require('./lib/release-lib');
const config = require('../app.config');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const kind = args.find((a) => !a.startsWith('--')) || 'patch';
const dry = flag('dry-run');
const c = { ok: (s) => `\x1b[32m${s}\x1b[0m`, warn: (s) => `\x1b[33m${s}\x1b[0m`, err: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` };
const step = (n, s) => console.log(`\n${c.ok('▶')} [${n}] ${s}`);
const sh = (cmd) => { console.log(c.dim('  $ ' + cmd)); if (!dry) execSync(cmd, { cwd: root, stdio: 'inherit' }); };

(async () => {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = lib.bumpVersion(pkg.version, kind);
  const { owner, repo } = config.github;
  const tag = 'v' + version;
  console.log(`${config.appName} : ${pkg.version} → ${c.ok(version)}${dry ? c.warn('  (SIMULATION)') : ''}`);

  step(1, 'Vérifications');
  if (!owner || !repo) throw new Error('Renseigne github.owner et github.repo dans app.config.js.');
  const token = process.env.GITHUB_TOKEN;
  if (!dry && !token) throw new Error('Variable GITHUB_TOKEN manquante (jeton avec le scope « repo »).');
  if (!dry && execSync('git status --porcelain', { cwd: root }).toString().trim()) throw new Error('Le dépôt git contient des modifications non commitées.');
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
  const notes = lib.notesFromChangelog(changelog, version);
  if (!notes) throw new Error(`CHANGELOG.md n'a pas d'entrée « ## [${version}] - AAAA-MM-JJ ». Ajoute les notes de patch avant de publier.`);
  console.log('  Notes de patch :\n' + notes.markdown.split('\n').map((l) => '    ' + l).join('\n'));

  step(2, 'Version & tests');
  if (!dry) { pkg.version = version; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n'); } else console.log(c.dim(`  package.json → ${version}`));
  if (!flag('skip-tests')) sh('npm test');

  step(3, 'Génération (installateur + archive zip)');
  if (!flag('skip-build')) sh('npm run check && npx electron-builder --win --publish never');
  const dist = path.join(root, 'dist');
  const exe = path.join(dist, `${pkg.productName || config.appName}-Setup-${version}.exe`);
  let assets = [];
  if (!dry) {
    if (!fs.existsSync(exe)) throw new Error('Installateur introuvable : ' + exe);
    const latest = path.join(dist, 'latest.yml');
    if (!fs.existsSync(latest)) { fs.writeFileSync(latest, lib.buildLatestYml({ version, installerPath: exe })); console.log('  latest.yml généré'); }
    assets = fs.readdirSync(dist).filter((f) => f.includes(version) && /\.(exe|zip|blockmap)$/.test(f)).map((f) => path.join(dist, f)).concat(latest);
    console.log('  Fichiers : ' + assets.map((a) => path.basename(a)).join(', '));
  } else console.log(c.dim(`  dist/ : ${path.basename(exe)}, .zip, .blockmap, latest.yml`));

  step(4, 'Commit, tag et push');
  if (!flag('no-push')) {
    sh(`git add package.json CHANGELOG.md`);
    sh(`git commit -m "release: ${tag}" --allow-empty`);
    sh(`git tag -a ${tag} -m "${config.appName} ${tag}"`);
    sh(`git push origin HEAD --follow-tags`);
  } else console.log(c.warn('  ignoré (--no-push)'));

  step(5, 'Release GitHub');
  let url = `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
  if (!dry) {
    const rel = await lib.createGithubRelease({ owner, repo, token, tag, name: `${config.appName} ${tag}`, body: notes.markdown, draft: flag('draft'), assets });
    url = rel.html_url; console.log(c.ok('  Publiée : ' + url));
  } else console.log(c.dim(`  POST /repos/${owner}/${repo}/releases (${tag}) + envoi des fichiers`));

  step(6, 'Webhook Discord');
  const payload = lib.buildWebhookPayload({ appName: config.appName, version, entry: notes.entry, markdown: notes.markdown, url });
  if (flag('no-webhook')) console.log(c.warn('  ignoré (--no-webhook)'));
  else if (dry) { console.log(c.dim('  Aperçu du message :')); console.log(JSON.stringify(payload, null, 2).split('\n').map((l) => '    ' + l).join('\n')); }
  else if (!process.env.DISCORD_WEBHOOK_URL) console.log(c.warn('  DISCORD_WEBHOOK_URL absente : notification non envoyée (le workflow GitHub peut s’en charger).'));
  else { await lib.sendWebhook(process.env.DISCORD_WEBHOOK_URL, payload); console.log(c.ok('  Notification envoyée.')); }

  console.log('\n' + c.ok(dry ? '✔ Simulation terminée — rien n’a été modifié.' : `✔ Release ${tag} publiée.`));
})().catch((e) => { console.error('\n' + c.err('✖ ' + e.message)); process.exit(1); });
