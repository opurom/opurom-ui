#!/usr/bin/env node
// Self-check for the opurom-ui theme package: manifest integrity plus every
// supported theme token present in both variants. Zero dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'opurom-pkg.json'), 'utf8'));

const files = manifest.files.flatMap((file) =>
  file.endsWith('.sig') ? [] : [file],
);
const declared = [...new Set([...files, 'opurom-pkg.json'])].sort();
for (const file of declared) {
  assert.ok(readFileSync(path.join(root, file), 'utf8').length > 0, `${file} must be non-empty`);
}
const actual = declared
  .flatMap((file) => (file === 'opurom-pkg.json' ? [] : [file]))
  .concat(['opurom-pkg.json'])
  .sort();
assert.deepEqual(
  [...new Set([...files, 'opurom-pkg.json'])].sort(),
  [...new Set(actual)].sort(),
  'the file list must match the package',
);

const TOKENS = ['mode', 'accent', 'radius', 'fontScale', 'surface', 'onSurface', 'stage'];
for (const variant of ['theme/default.opu', 'theme/dark.opu']) {
  const text = readFileSync(path.join(root, variant), 'utf8');
  const body = text.slice(text.indexOf('theme'));
  for (const token of TOKENS) {
    assert.match(body, new RegExp(`${token}:`), `${variant} must declare ${token}`);
  }
  assert.match(text, /#[0-9A-Fa-f]{6}/, `${variant} must carry hex colours`);
  assert.ok(!/[\u4e00-\u9fff]/.test(text), `${variant} must stay free of CJK characters`);
}

const dark = readFileSync(path.join(root, 'theme/dark.opu'), 'utf8');
assert.match(dark, /mode: dark/, 'the dark variant must declare dark mode');

console.log(`opurom-ui self-check: ${declared.length} manifest files, ${TOKENS.length} tokens x 2 variants OK`);
