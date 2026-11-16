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
assert.equal(doc.source.commit, 'ab291203');
const cats = doc.tokens;
assert.deepEqual(Object.keys(cats).sort(), ['color', 'elevation', 'shape', 'spacing', 'typography']);

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

assert.equal(missingSource, 0, 'every token must carry a source reference');
console.log('material-tokens OK', JSON.stringify(counts), 'total=' + Object.values(counts).reduce((a, b) => a + b, 0));
