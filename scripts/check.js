'use strict';
/** Vérifications avant build : syntaxe de tous les fichiers JS + présence des icônes. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let errors = 0;

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, out); else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}

for (const f of [...walk(path.join(root, 'src')), path.join(root, 'app.config.js')]) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { errors++; console.error('✖ Erreur de syntaxe dans ' + path.relative(root, f) + ' : ' + e.message); }
}
for (const f of ['assets/icons/icon.ico', 'assets/icons/icon.png', 'assets/logo/logo.svg']) {
  if (!fs.existsSync(path.join(root, f))) { errors++; console.error('✖ Fichier manquant : ' + f); }
}
const rpc = fs.readFileSync(path.join(root, 'src/main/discord/discord-rpc.js'), 'utf8');
if (rpc.includes('REMPLACE_PAR_TON_APPLICATION_ID')) console.warn('⚠ Discord RPC : CONFIG.clientId n’est pas renseigné (src/main/discord/discord-rpc.js). L’application fonctionnera, sans présence Discord.');

if (errors) { console.error(`\n${errors} problème(s) — build annulé.`); process.exit(1); }
console.log('✔ Vérifications OK');
