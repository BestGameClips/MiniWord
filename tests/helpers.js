const fs = require('fs'), os = require('os'), path = require('path');
exports.tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'miniword-'));
exports.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
exports.logger = { info() {}, warn() {}, error() {}, debug() {} };
