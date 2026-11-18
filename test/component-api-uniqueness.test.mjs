#!/usr/bin/env node
// Component API uniqueness gate. Duplicate component names across modules make
// imports ambiguous and would silently shadow a pinned implementation. This is
// an internal Opurom package invariant; no Flutter-derived numeric value is
// involved. The gate is deterministic and dependency-free.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const names = new Map();
for (const file of readdirSync(path.join(root, 'components'))) {
  if (!file.endsWith('.opu')) continue;
  const text = readFileSync(path.join(root, 'components', file), 'utf8');
  for (const match of text.matchAll(/^component\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/gm)) {
    const name = match[1];
    assert.ok(!names.has(name), `${name} is declared in both ${names.get(name)} and ${file}`);
    names.set(name, file);
  }
}

test('component names are unique across the package', () => {
  assert.ok(names.size >= 150, `expected a substantial component catalog, got ${names.size}`);
});
