'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { basename, dirname, extname, detectEol, normalizeEol, applyEol } = require('../../shared/utils');
const { languageForExtension, MAX_FILE_SIZE_DEFAULT } = require('../../shared/constants');

class FileError extends Error {
  constructor(code, message, cause) { super(message); this.name = 'FileError'; this.code = code; this.cause = cause; }
}

function mapFsError(err) {
  if (err instanceof FileError) return err;
  const map = {
    ENOENT: ['E_NOT_FOUND', 'Le fichier est introuvable.'],
    EACCES: ['E_ACCESS', 'Accès refusé à ce fichier.'],
    EPERM: ['E_ACCESS', 'Accès refusé à ce fichier.'],
    EBUSY: ['E_BUSY', 'Le fichier est utilisé par une autre application.'],
    ENOSPC: ['E_DISK_FULL', 'Espace disque insuffisant.'],
    EROFS: ['E_READONLY', 'Le support est en lecture seule.'],
    EISDIR: ['E_ISDIR', 'Ce chemin est un dossier.'],
    ENAMETOOLONG: ['E_PATH', 'Le chemin est trop long.'],
  };
  const m = map[err && err.code];
  return new FileError(m ? m[0] : 'E_IO', m ? m[1] : 'Erreur d’accès au fichier.', err);
}

// ── Encodages ──
const CP1252_HIGH = { 0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178 };
const CP1252_REVERSE = new Map(Object.entries(CP1252_HIGH).map(([b, cp]) => [cp, Number(b)]));

function detectEncoding(buf) {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return { encoding: 'utf8-bom', offset: 3 };
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) return { encoding: 'utf16le', offset: 2 };
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) return { encoding: 'utf16be', offset: 2 };
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return { encoding: 'utf8', offset: 0 }; }
  catch { return { encoding: 'windows-1252', offset: 0 }; }
}

function decodeBuffer(buf, encoding, offset) {
  const body = buf.subarray(offset);
  switch (encoding) {
    case 'utf16le': return Buffer.from(body).toString('utf16le');
    case 'utf16be': return Buffer.from(body).swap16().toString('utf16le');
    case 'windows-1252': return new TextDecoder('windows-1252').decode(body);
    default: return Buffer.from(body).toString('utf8');
  }
}

function encodeWindows1252(str) {
  const out = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp < 0x80 || (cp >= 0xA0 && cp <= 0xFF) || [0x81, 0x8D, 0x8F, 0x90, 0x9D].includes(cp)) out[i] = cp;
    else if (CP1252_REVERSE.has(cp)) out[i] = CP1252_REVERSE.get(cp);
    else throw new FileError('E_ENCODING', 'Le document contient des caractères que Windows-1252 ne peut pas représenter.');
  }
  return out;
}

function encodeString(str, encoding) {
  switch (encoding) {
    case 'utf8-bom': return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(str, 'utf8')]);
    case 'utf16le': return Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(str, 'utf16le')]);
    case 'utf16be': return Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.from(str, 'utf16le').swap16()]);
    case 'windows-1252': return encodeWindows1252(str);
    default: return Buffer.from(str, 'utf8');
  }
}

/** Gestionnaire de format par défaut : texte. Remplaçable par extension (.docx, .rtf…). */
const textHandler = {
  read(buf) {
    const { encoding, offset } = detectEncoding(buf);
    if (!encoding.startsWith('utf16') && buf.subarray(0, 8192).includes(0)) {
      throw new FileError('E_BINARY', 'Ce fichier semble être binaire et ne peut pas être ouvert comme texte.');
    }
    const decoded = decodeBuffer(buf, encoding, offset);
    return { content: normalizeEol(decoded), encoding, eol: detectEol(decoded) };
  },
  write(content, { encoding, eol }) { return encodeString(applyEol(content, eol), encoding); },
};

class FileManager {
  constructor({ maxFileSize = MAX_FILE_SIZE_DEFAULT, logger } = {}) {
    this.maxFileSize = maxFileSize;
    this.logger = logger;
    this.handlers = new Map();
  }

  /**
   * Prépare l'ajout de .docx / .rtf :
   *   fm.registerHandler(['docx'], { read(buffer)→{content,encoding,eol}, write(content, meta)→Buffer })
   */
  registerHandler(extensions, handler) { for (const e of extensions) this.handlers.set(e.toLowerCase(), handler); }
  _handler(ext) { return this.handlers.get(ext) || textHandler; }

  static validatePath(p) {
    if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0') || !path.isAbsolute(p)) {
      throw new FileError('E_PATH', 'Chemin de fichier invalide.');
    }
    return p;
  }

  async stat(p) {
    FileManager.validatePath(p);
    try { const st = await fsp.stat(p); return { mtimeMs: st.mtimeMs, size: st.size, ino: st.ino, isDirectory: st.isDirectory() }; }
    catch (e) { throw mapFsError(e); }
  }

  async readFile(p) {
    FileManager.validatePath(p);
    let st;
    try { st = await fsp.stat(p); } catch (e) { throw mapFsError(e); }
    if (st.isDirectory()) throw new FileError('E_ISDIR', 'Ce chemin est un dossier, pas un fichier.');
    if (st.size > this.maxFileSize) {
      throw new FileError('E_TOO_LARGE', `Fichier trop volumineux (${(st.size / 1048576).toFixed(1)} Mo, maximum ${(this.maxFileSize / 1048576).toFixed(0)} Mo).`);
    }
    let buf;
    try { buf = await fsp.readFile(p); } catch (e) { throw mapFsError(e); }
    const ext = extname(p);
    const r = this._handler(ext).read(buf, { ext });
    return {
      path: p, name: basename(p), directory: dirname(p), extension: ext, language: languageForExtension(ext),
      content: r.content, encoding: r.encoding, eol: r.eol, size: st.size, mtimeMs: st.mtimeMs, ino: st.ino,
    };
  }

  /**
   * Écriture atomique (fichier temporaire + renommage).
   * Retourne { conflict:true, ... } si le fichier a changé sur le disque depuis la lecture
   * (sauf si force). `beforeWrite(target)` permet de créer une sauvegarde.
   */
  async writeFile(p, content, { encoding = 'utf8', eol = 'LF', expectedMtimeMs = null, expectedSize = null, force = false, beforeWrite = null } = {}) {
    FileManager.validatePath(p);
    if (typeof content !== 'string') throw new FileError('E_ARG', 'Contenu invalide.');
    const ext = extname(p);
    const handler = this._handler(ext);

    let target = p, existing = null;
    try { target = await fsp.realpath(p); existing = await fsp.stat(target); }
    catch (e) { if (e.code !== 'ENOENT') throw mapFsError(e); target = p; existing = null; }
    if (existing && existing.isDirectory()) throw new FileError('E_ISDIR', 'Ce chemin est un dossier.');

    if (existing && !force && expectedMtimeMs != null) {
      const changed = Math.abs(existing.mtimeMs - expectedMtimeMs) > 1 || (expectedSize != null && existing.size !== expectedSize);
      if (changed) return { conflict: true, mtimeMs: existing.mtimeMs, size: existing.size, ino: existing.ino };
    }

    const data = handler.write(content, { encoding, eol, ext }); // peut lever E_ENCODING
    if (existing && beforeWrite) {
      try { await beforeWrite(target); } catch (e) { this.logger && this.logger.warn('Backup impossible : ' + e.message); }
    }

    const tmp = path.join(dirname(target), `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
    try {
      await fsp.writeFile(tmp, data);
      if (existing) { try { await fsp.chmod(tmp, existing.mode); } catch { /* ignore */ } }
      await fsp.rename(tmp, target);
    } catch (e) {
      fsp.unlink(tmp).catch(() => {});
      if (existing && (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EBUSY')) {
        try { await fsp.writeFile(target, data); } catch (e2) { throw mapFsError(e2); } // repli : écriture directe
      } else throw mapFsError(e);
    }
    let st;
    try { st = await fsp.stat(target); } catch (e) { throw mapFsError(e); }
    return { conflict: false, path: p, mtimeMs: st.mtimeMs, size: st.size, ino: st.ino, encoding, eol };
  }
}

module.exports = { FileManager, FileError, mapFsError, detectEncoding, decodeBuffer, encodeString, textHandler };
