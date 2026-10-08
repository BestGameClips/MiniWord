(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LICENSES = { 'MIT': 'MIT', 'Apache-2.0': 'Apache 2.0', 'GPL-3.0': 'GPL v3', 'ISC': 'ISC', 'BSD-3-Clause': 'BSD 3-Clause', 'Unlicense': 'Unlicense' };
  const SECTIONS = [
    ['features', 'Fonctionnalités'], ['screenshots', 'Captures d’écran'], ['install', 'Installation'], ['usage', 'Utilisation'],
    ['config', 'Configuration'], ['roadmap', 'Feuille de route'], ['contributing', 'Contribuer'], ['license', 'Licence'], ['author', 'Auteur & contact'],
  ];

  /** Gabarits prêts à l'emploi : remplissent le formulaire. */
  const TEMPLATES = {
    app: { label: 'Application desktop', data: { sections: ['features', 'install', 'usage', 'contributing', 'license'], installCmd: 'npm install\nnpm run dev', usageText: 'Lancez l’application puis ouvrez ou créez un document.', badges: ['license', 'version', 'node'] } },
    lib: { label: 'Bibliothèque / paquet', data: { sections: ['features', 'install', 'usage', 'config', 'contributing', 'license'], installCmd: 'npm install nom-du-paquet', usageText: '```js\nconst lib = require(\'nom-du-paquet\');\n```', badges: ['license', 'version', 'node', 'issues'] } },
    bot: { label: 'Bot Discord', data: { sections: ['features', 'install', 'config', 'usage', 'license'], installCmd: 'npm install\ncp .env.example .env\nnpm start', configText: '| Variable | Description |\n|---|---|\n| `DISCORD_TOKEN` | Jeton du bot |\n| `CLIENT_ID` | ID de l’application |', usageText: 'Invitez le bot sur votre serveur puis utilisez `/aide`.', badges: ['license', 'node', 'stars'] } },
    minimal: { label: 'Minimal', data: { sections: ['install', 'license'], installCmd: '', usageText: '', badges: ['license'] } },
  };

  const enc = (s) => encodeURIComponent(String(s).replace(/-/g, '--').replace(/_/g, '__'));
  function badgeLines(o) {
    const out = [], gh = o.githubUser && o.githubRepo ? o.githubUser + '/' + o.githubRepo : '';
    const b = new Set(o.badges || []);
    if (b.has('license') && o.license) out.push('![Licence](https://img.shields.io/badge/licence-' + enc(o.license) + '-blue)');
    if (b.has('version') && o.version) out.push('![Version](https://img.shields.io/badge/version-' + enc(o.version) + '-6b7cff)');
    if (b.has('node')) out.push('![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)');
    if (b.has('build') && gh) out.push('![Build](https://img.shields.io/github/actions/workflow/status/' + gh + '/release.yml)');
    if (b.has('stars') && gh) out.push('![Stars](https://img.shields.io/github/stars/' + gh + '?style=flat)');
    if (b.has('issues') && gh) out.push('![Issues](https://img.shields.io/github/issues/' + gh + ')');
    if (b.has('discord') && o.discordInvite) out.push('[![Discord](https://img.shields.io/badge/Discord-rejoindre-5865F2?logo=discord&logoColor=white)](' + o.discordInvite + ')');
    return out;
  }
  const lines = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const code = (t, lang) => '```' + (lang || '') + '\n' + String(t).trim() + '\n```';

  function generateReadme(o) {
    o = Object.assign({ name: 'Mon projet', tagline: '', description: '', license: 'MIT', sections: ['features', 'install', 'usage', 'license'], badges: ['license'], features: '', installCmd: '', usageText: '', configText: '', roadmap: '', author: '', contact: '', screenshotUrl: '', toc: true }, o);
    const has = (k) => o.sections.includes(k);
    const out = ['# ' + (o.emoji ? o.emoji + ' ' : '') + o.name.trim()];
    if (o.tagline) out.push('> ' + o.tagline.trim());
    const badges = badgeLines(o); if (badges.length) out.push(badges.join(' '));
    if (o.description) out.push(o.description.trim());

    const blocks = [];
    const add = (key, title, body) => { if (has(key) && body) blocks.push({ title, body }); };
    add('features', 'Fonctionnalités', lines(o.features).map((l) => '- ' + l.replace(/^[-*]\s*/, '')).join('\n') || '- _À compléter_');
    add('screenshots', 'Captures d’écran', o.screenshotUrl ? '![Capture d’écran](' + o.screenshotUrl.trim() + ')' : '_Ajoutez vos captures ici._');
    add('install', 'Installation', (o.githubUser && o.githubRepo ? code('git clone https://github.com/' + o.githubUser + '/' + o.githubRepo + '.git\ncd ' + o.githubRepo, 'bash') + '\n\n' : '') + (o.installCmd.trim() ? code(o.installCmd, 'bash') : '_Instructions à compléter._'));
    add('usage', 'Utilisation', o.usageText.trim() || '_Décrivez ici comment utiliser le projet._');
    add('config', 'Configuration', o.configText.trim() || '_Décrivez les options de configuration._');
    add('roadmap', 'Feuille de route', lines(o.roadmap).map((l) => '- [ ] ' + l.replace(/^[-*]\s*(\[.\]\s*)?/, '')).join('\n') || '- [ ] _À définir_');
    add('contributing', 'Contribuer', 'Les contributions sont les bienvenues !\n\n1. Forkez le dépôt\n2. Créez une branche (`git checkout -b ma-fonctionnalite`)\n3. Committez vos changements (`git commit -m "Ajoute ma fonctionnalité"`)\n4. Poussez la branche et ouvrez une Pull Request');
    add('license', 'Licence', 'Distribué sous licence **' + (LICENSES[o.license] || o.license) + '**. Voir le fichier `LICENSE` pour plus d’informations.');
    add('author', 'Auteur & contact', [o.author && '**' + o.author.trim() + '**', o.contact && o.contact.trim()].filter(Boolean).join(' — ') || '_À compléter_');

    if (o.toc && blocks.length > 2) out.push('## Sommaire\n' + blocks.map((b) => '- [' + b.title + '](#' + b.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ')').join('\n'));
    for (const b of blocks) out.push('## ' + b.title + '\n\n' + b.body);
    return out.join('\n\n') + '\n';
  }

  return { generateReadme, README_TEMPLATES: TEMPLATES, README_LICENSES: LICENSES, README_SECTIONS: SECTIONS };
});
