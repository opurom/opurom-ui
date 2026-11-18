#!/usr/bin/env node
// Validator for the Material 3 token data file: structure, source coverage,
// colour format and light/dark key parity. Zero dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'theme/material-tokens.json'), 'utf8'));

assert.equal(doc.kind, 'design-tokens');
assert.equal(doc.namespace, 'md');
assert.equal(doc.source.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
const cats = doc.tokens;
assert.deepEqual(Object.keys(cats), [
  'color', 'shape', 'elevation', 'typography', 'spacing', 'motion', 'state',
]);

const counts = {};
let missingSource = 0;
function checkSource(entry, key) {
  assert.ok(entry && typeof entry === 'object', `${key} must be an object`);
  if (!entry.source) { missingSource++; return; }
  // Source is a Flutter reference (file:line or file:start-end) or an explicit
  // spec marker. The flutter-golden clone is not a test-time dependency, so the
  // validator checks reference format only, not the external file's presence.
  assert.match(
    entry.source,
    /^(?:[a-z_]+\.dart:\d+(?:-\d+)?|spec:[a-z0-9-]+)$/,
    `${key} source must be file:line or spec:*`,
  );
}

// colors: light/dark key parity + hex format
const light = cats.color.light;
const dark = cats.color.dark;
assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort(), 'light/dark colour keys must match');
for (const mode of [light, dark]) {
  for (const [k, v] of Object.entries(mode)) {
    assert.match(k, /^md-sys-color-[a-z-]+$/, `bad colour token name ${k}`);
    assert.match(v.value, /^#[0-9A-F]{6}$/, `${k} must be a 6-digit hex`);
    checkSource(v, k);
  }
}
counts.color = Object.keys(light).length + Object.keys(dark).length;

// shape: 6 levels
assert.equal(Object.keys(cats.shape).length, 6, 'shape must have 6 levels');
for (const [k, v] of Object.entries(cats.shape)) { assert.match(k, /^md-shape-/); checkSource(v, k); }
counts.shape = Object.keys(cats.shape).length;

// elevation: 6 levels (0,1,2,3,4,6) + 3 colour constants
const elev = cats.elevation;
for (const level of ['md-elev-0', 'md-elev-1', 'md-elev-2', 'md-elev-3', 'md-elev-4', 'md-elev-6']) {
  assert.ok(elev[level], `missing ${level}`);
  checkSource(elev[level], level);
  if (level !== 'md-elev-0') {
    for (const layer of ['umbra', 'penumbra', 'ambient']) {
      assert.ok(elev[level][layer], `${level} missing ${layer}`);
    }
  }
}
for (const c of ['md-color-shadow-umbra', 'md-color-shadow-penumbra', 'md-color-shadow-ambient']) {
  assert.match(elev[c].value, /^#[0-9A-F]{8}$/, `${c} must be ARGB hex`);
  checkSource(elev[c], c);
}
counts.elevation = Object.keys(elev).length;

// typography: 15 styles, size/weight/lineHeight/letterSpacing
assert.equal(Object.keys(cats.typography).length, 15, 'typography must have 15 styles');
for (const [k, v] of Object.entries(cats.typography)) {
  assert.match(k, /^md-type-/);
  for (const f of ['size', 'weight', 'lineHeight', 'letterSpacing']) assert.equal(typeof v[f], 'number', `${k}.${f}`);
  checkSource(v, k);
}
counts.typography = Object.keys(cats.typography).length;

// spacing
for (const [k, v] of Object.entries(cats.spacing)) { assert.match(k, /^md-space-/); checkSource(v, k); }
counts.spacing = Object.keys(cats.spacing).length;

// motion: all 17 Flutter Durations constants and all 9 Easing constants.
const motion = cats.motion;
const durations = {
  short1: 50, short2: 100, short3: 150, short4: 200,
  medium1: 250, medium2: 300, medium3: 350, medium4: 400,
  long1: 450, long2: 500, long3: 550, long4: 600,
  extralong1: 700, extralong2: 800, extralong3: 900, extralong4: 1000,
};
const easings = {
  'emphasized-accelerate': 'cubic-bezier(0.3,0,0.8,0.15)',
  'emphasized-decelerate': 'cubic-bezier(0.05,0.7,0.1,1)',
  linear: 'cubic-bezier(0,0,1,1)',
  standard: 'cubic-bezier(0.2,0,0,1)',
  'standard-accelerate': 'cubic-bezier(0.3,0,1,1)',
  'standard-decelerate': 'cubic-bezier(0,0,0,1)',
  'legacy-decelerate': 'cubic-bezier(0,0,0.2,1)',
  'legacy-accelerate': 'cubic-bezier(0.4,0,1,1)',
  legacy: 'cubic-bezier(0.4,0,0.2,1)',
};
assert.deepEqual(Object.keys(motion).sort(), [
  ...Object.keys(durations).map((k) => `md-motion-duration-${k}`),
  ...Object.keys(easings).map((k) => `md-motion-easing-${k}`),
].sort());
for (const [key, ms] of Object.entries(durations)) {
  const entry = motion[`md-motion-duration-${key}`];
  assert.equal(entry.value, ms, `${key} must be ${ms}ms`);
  checkSource(entry, key);
}
for (const [key, css] of Object.entries(easings)) {
  const entry = motion[`md-motion-easing-${key}`];
  assert.equal(entry.value, css, `${key} easing`);
  checkSource(entry, key);
}
counts.motion = Object.keys(motion).length;

// State-layer alphas are Flutter button constants, not invented values.
const state = cats.state;
assert.deepEqual(state, {
  'md-state-layer-pressed': { value: 0.10, source: 'text_button.dart:230' },
  'md-state-layer-hovered': { value: 0.08, source: 'text_button.dart:231' },
  'md-state-layer-focused': { value: 0.10, source: 'text_button.dart:232' },
  'md-state-disabled-foreground': { value: 0.38, source: 'text_button.dart:387' },
});
counts.state = Object.keys(state).length;

assert.equal(missingSource, 0, 'every token must carry a source reference');
console.log('material-tokens OK', JSON.stringify(counts), 'total=' + Object.values(counts).reduce((a, b) => a + b, 0));
