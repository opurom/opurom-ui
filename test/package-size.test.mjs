#!/usr/bin/env node
// Package-size baseline for the UI component library. Flutter 3.50.0 has no
// corresponding component-package size oracle; this is an internal regression
// guard for the Opurom zero-runtime-interpretation constraint. It fails on
// unexplained source growth so component bloat is caught before release.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const baseline = JSON.parse(readFileSync(path.join(root, 'test/package-size-baseline.json'), 'utf8'));
const files = readdirSync(path.join(root, 'components'))
  .filter((name) => name.endsWith('.opu'))
  .sort();
const total = files.reduce((sum, name) => sum + readFileSync(path.join(root, 'components', name)).length, 0);

test('component source size stays within the pinned budget', () => {
  assert.equal(files.length, baseline.files, 'new component files must update the size baseline in the same change');
  assert.ok(total <= baseline.maxBytes, `component source grew to ${total} bytes (budget ${baseline.maxBytes})`);
  // A drop means a component was removed or gutted; force an explicit review.
  assert.ok(total >= baseline.minBytes, `component source shrank to ${total} bytes (floor ${baseline.minBytes})`);
});
