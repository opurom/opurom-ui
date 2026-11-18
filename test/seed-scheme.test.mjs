#!/usr/bin/env node
// Seed-colour parity gate. The expected hex values are Flutter's own pinned
// spot checks in packages/flutter/test/material/color_scheme_test.dart:945-973
// (flutter-golden ab291203, stable 3.50.0). HCT intermediates were also
// cross-checked against the vendored material_color_utilities 0.13.0.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fromSeed, generateThemeTokens, hctFromArgb, hex, solveToInt } from '../tools/seed-scheme.mjs';

const CASES = [
  ['#000000', '#8C4A60'],
  ['#00FF00', '#406836'],
  ['#6559F5', '#5B5891'],
  ['#FFFFFF', '#006874'],
];

test('fromSeed primary matches Flutter pinned spot checks', () => {
  for (const [seed, expected] of CASES) {
    assert.equal(fromSeed(seed).primary, expected, `${seed} primary`);
  }
});

test('HCT intermediates match material_color_utilities 0.13.0', () => {
  const green = hctFromArgb(0xff00ff00);
  assert.ok(Math.abs(green.hue - 142.1398935076457) < 1e-9);
  assert.ok(Math.abs(green.chroma - 108.41006052028891) < 1e-9);
  assert.ok(Math.abs(green.tone - 87.73703347354422) < 1e-9);
  assert.equal(hex(solveToInt(green.hue, 36, 40)), '#406836');
});

test('generateThemeTokens emits complete light/dark parity', () => {
  const doc = generateThemeTokens('#6200EE');
  assert.equal(doc.seed, '#6200EE');
  assert.equal(doc.variant, 'tonalSpot');
  const light = Object.keys(doc.light);
  const dark = Object.keys(doc.dark);
  assert.deepEqual(light, dark);
  assert.ok(light.length >= 23, `expected 23 colour roles, got ${light.length}`);
  for (const key of light) assert.match(doc.light[key], /^#[0-9A-F]{6}$/);
  assert.notEqual(doc.light['md-sys-color-primary'], doc.dark['md-sys-color-primary']);
});
