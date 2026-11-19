#!/usr/bin/env node
// product-v1 source-of-truth gate. It verifies that the product layer is
// real compiled source (not a generated dump): token/recipe/theme files parse,
// both light and dark showcase programs compile and render deterministically,
// and the pinned frames stay stable under the signed default toolchain.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'product-v1');
const doc = JSON.parse(readFileSync(path.join(dir, 'digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const compiler = requireNative(root, 'opurom-lang', ['opuromc'], toolchain.profile);
const renderer = requireNative(root, 'opurom-render', ['opurom-render', 'opurom_render'], toolchain.profile);

assert.equal(toolchain.render, '8a76e1dfdddc8b82ed5284cabd2921f17cd73571', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, '6d5cb7454d904a7a62af5aef3cf6672e892d9013', 'the pinned lang commit must be unchanged');
assert.equal(pins.length, 4, 'light and dark showcase frames at two ticks must be pinned');

test('product token, recipe and theme sources are valid JSON and nonempty Opurom sources', () => {
  const tokens = JSON.parse(readFileSync(path.join(dir, 'product-v1.tokens.json'), 'utf8'));
  const mdTokens = JSON.parse(readFileSync(path.join(dir, 'md-tokens.json'), 'utf8'));
  const recipes = JSON.parse(readFileSync(path.join(dir, 'recipes.json'), 'utf8'));
  assert.equal(tokens.name, 'opurom-product-v1');
  assert.equal(tokens.namespace, 'op');
  assert.ok(tokens.tokens && Object.keys(tokens.tokens).length >= 8, 'the product token groups must be present');
  assert.ok(mdTokens['md-sys-color-primary'], 'the material token source must be present');
  assert.ok(recipes.AppBar && Array.isArray(recipes.AppBar.states) && recipes.Card, 'the recipe contract must be present');
  const components = readFileSync(path.join(dir, 'components.opu'), 'utf8');
  const light = readFileSync(path.join(dir, 'theme.opu'), 'utf8');
  const dark = readFileSync(path.join(dir, 'theme-dark.opu'), 'utf8');
  assert.match(components, /component ProductAppBar/);
  assert.match(components, /component ProductProgress/);
  assert.match(light, /mode: light/);
  assert.match(dark, /mode: dark/);
});

test('both showcase programs compile and replay their pinned frames', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-product-v1-'));
  try {
    cpSync(dir, path.join(tmp, 'product-v1'), { recursive: true });
    for (const pin of pins) {
      const ir = path.join(tmp, `${pin.name}.json`);
      const c = spawnSync(compiler, ['compile', path.join(tmp, 'product-v1', pin.file), '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${pin.name} compile failed: ${c.stderr}`);
      const r = spawnSync(renderer, [ir, String(meta.viewport[0]), String(meta.viewport[1]), path.join(tmp, `${pin.name}.ppm`), '--tick', String(pin.tick)], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${pin.name} render failed: ${r.stderr}`);
      const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
