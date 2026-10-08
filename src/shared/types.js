/**
 * Définitions de types (JSDoc) partagées. Aucun code exécutable ici :
 * ce fichier sert de documentation pour l'IDE.
 *
 * @typedef {Object} FileData        Résultat d'une lecture de fichier
 * @property {string} path
 * @property {string} name
 * @property {string} directory
 * @property {string} extension      sans le point, en minuscules
 * @property {string} language
 * @property {string} content        fins de ligne normalisées en "\n"
 * @property {string} encoding       utf8 | utf8-bom | utf16le | utf16be | windows-1252
 * @property {'LF'|'CRLF'} eol
 * @property {number} size
 * @property {number} mtimeMs
 * @property {number} ino
 *
 * @typedef {Object} MWDocument      Document ouvert dans un onglet (renderer)
 * @property {string} id
 * @property {string|null} path
 * @property {string} name
 * @property {string} directory
 * @property {string} extension
 * @property {string} content
 * @property {boolean} isDirty
 * @property {string} encoding
 * @property {string} language
 * @property {number|null} lastSaved
 * @property {'UNTITLED'|'DIRTY'|'SAVED'} status
 *
 * @typedef {Object} DiscordPayload  Envoyé par le renderer au module Discord RPC
 * @property {'idle'|'reading'|'editing'|'saving'|'searching'} status
 * @property {string|null} fileName
 * @property {string|null} filePath
 * @property {string|null} docId
 * @property {number} tabCount
 */
module.exports = {};
