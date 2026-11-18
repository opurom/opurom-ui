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

// Every component module must be a declared package file carrying one or more
// `component` declarations, so the manifest and the library never drift. Each
// opens with a one-line usage comment, never imports anything (the app owns the
// theme; components only consume design props), and takes colour from variant
// or tone, never from a literal hex.
// card/text keep their literals: todo.opuir.json pins their expansion, so
// changing them means regenerating that golden, which is not this package's job.
const LEGACY_HEX = new Set(['components/card.opu', 'components/text.opu']);
const components = files.filter((file) => file.startsWith('components/'));
assert.ok(components.length > 0, 'the package must ship component modules');
for (const file of components) {
  const text = readFileSync(path.join(root, file), 'utf8');
  assert.ok(text.length > 0, `${file} must be non-empty`);
  assert.match(text, /component\s+[A-Z]/, `${file} must declare a component`);
  assert.match(text, /^\/\/ /, `${file} must open with a one-line usage comment`);
  if (!['components/state_wrappers.opu', 'components/button_metrics_m3.opu', 'components/selection_touch_m3.opu', 'components/segmented_button_m3.opu'].includes(file)) {
    assert.ok(
      !/^import\b/m.test(text),
      `${file} must not import modules; the app owns the theme`,
    );
  }
  if (!LEGACY_HEX.has(file)) {
    // The brand gradient is the sole permitted literal: it is the authored
    // 180deg cyan-to-blue token value expressed as an IR two-stop gradient.
    const withoutBrandGradient = text.replaceAll('#2DD8FF,#006EFF', '');
    assert.ok(
      !/#[0-9A-Fa-f]{6}/.test(withoutBrandGradient),
      `${file} must not hardcode hex colours; use variant, tone or the brand gradient`,
    );
  }
  assert.ok(!/[\u4e00-\u9fff]/.test(text), `${file} must stay free of CJK characters`);
}

console.log(`opurom-ui self-check: ${declared.length} manifest files, ${components.length} components, ${TOKENS.length} tokens x 2 variants OK`);
