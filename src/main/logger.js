'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');

const MAX_SIZE = 1024 * 1024; // 1 Mo puis rotation (.old)
const RING = 800;
const LEVELS = ['debug', 'info', 'success', 'warn', 'error'];

/**
 * Logs : <userData>/logs/app.log + errors.log, tampon mémoire (console développeur)
 * et abonnés temps réel. Niveaux : debug, info, success, warn, error.
 */
function createLogger({ dir, isDev = false }) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  const rotate = (file) => { try { if (fs.statSync(file).size > MAX_SIZE) fs.renameSync(file, file + '.old'); } catch { /* absent */ } };
  const appLog = path.join(dir, 'app.log');
  const errLog = path.join(dir, 'errors.log');
  rotate(appLog); rotate(errLog);

  const ring = [];
  const subs = new Set();
  let seq = 0;

  function write(file, text) { try { fs.appendFileSync(file, text); } catch { /* ne jamais planter à cause des logs */ } }

  function log(level, msg, err, source = 'main') {
    if (level === 'debug' && !isDev) { /* gardé en mémoire seulement */ }
    const entry = { id: ++seq, ts: Date.now(), level, source, message: String(msg), stack: err ? (err.stack || util.inspect(err)) : undefined };
    ring.push(entry); if (ring.length > RING) ring.shift();
    for (const fn of subs) { try { fn(entry); } catch { /* ignore */ } }
    if (level === 'debug' && !isDev) return entry;
    const line = `${new Date(entry.ts).toISOString()} [${level.toUpperCase()}]${source === 'main' ? '' : ' [' + source + ']'} ${entry.message}` + (entry.stack ? '\n' + entry.stack : '') + '\n';
    write(appLog, line);
    if (level === 'error') write(errLog, line);
    if (isDev) (console[{ debug: 'log', success: 'log' }[level] || level] || console.log)(line.trimEnd());
    return entry;
  }

  return {
    dir, appLog, errLog, LEVELS,
    debug: (m, e) => log('debug', m, e), info: (m, e) => log('info', m, e), success: (m, e) => log('success', m, e),
    warn: (m, e) => log('warn', m, e), error: (m, e) => log('error', m, e),
    log, history: () => ring.slice(),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

module.exports = { createLogger };
