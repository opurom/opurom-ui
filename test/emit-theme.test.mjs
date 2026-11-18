#!/usr/bin/env node
// End-to-end theme customization gate: the CLI output must be accepted by the
// compiler's token import and produce distinct light/dark deterministic frames.
// Flutter source and HCT constants are pinned in tools/seed-scheme.mjs and
// test/seed-scheme.test.mjs (stable 3.50.0, ab2912035e160d9cad6306df307576da6128ebdb).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc']);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render']);

function run(tool, args) {
  const r = spawnSync(tool, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `${path.basename(tool)} failed: ${r.stderr}`);
  return r;
}

function frame(dir, mode) {
  const host = path.join(dir, `host-${mode}.opu`);
  const ir = path.join(dir, `host-${mode}.json`);
  const ppm = path.join(dir, `host-${mode}.ppm`);
  writeFileSync(host, `app T {
  theme { mode: ${mode}, accent: "#6200EE", radius: 12, tokens { import "tokens-${mode}.json" } }
  Text("them ed", color: "{@md-sys-color-primary}")
}
`);
  run(compiler, ['compile', host, '-o', ir]);
  const r = run(renderer, [ir, '320', '240', ppm, '--tick', '4000']);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${mode} render produced no digest`);
  return { ir: JSON.parse(readFileSync(ir, 'utf8')), digest };
}

test('CLI emits compiler-ready md colour tokens for both modes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'uibuild-emit-theme-'));
  try {
    for (const mode of ['light', 'dark']) {
      run(process.execPath, [path.join(root, 'tools/emit-theme.mjs'), '#6750A4', path.join(dir, `tokens-${mode}.json`), mode]);
      const tokens = JSON.parse(readFileSync(path.join(dir, `tokens-${mode}.json`), 'utf8'));
      assert.equal(Object.keys(tokens).length, 23);
      for (const [key, value] of Object.entries(tokens)) {
        assert.match(key, /^md-sys-color-/);
        assert.match(value, /^#[0-9A-F]{6}$/);
      }
    }
    const light = frame(dir, 'light');
    const dark = frame(dir, 'dark');
    assert.equal(light.ir.theme.tokens['md-sys-color-primary'], '#65558F');
    assert.equal(dark.ir.theme.tokens['md-sys-color-primary'], '#CFBDFE');
    assert.notEqual(light.digest, dark.digest);
    assert.equal(frame(dir, 'light').digest, light.digest, 'same generated theme must render byte-identically');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
