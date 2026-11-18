#!/usr/bin/env node
// UI catalog registry audit. This data-only gate rolls five existing JSON
// breakpoint/state catalogs into one manifest, checking registry completeness,
// pin counts, component coverage, source-anchor shape and documentation wiring.
// Flutter stable 3.50.0 is the sole source authority. Each catalog's own gate
// remains responsible for re-rendering its signed frame pins.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const registry = JSON.parse(readFileSync(path.join(root, 'test/catalog-registry.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(root, 'opurom-pkg.json'), 'utf8'));

const ANCHOR = /^(?:[a-z_]+\/)*[a-z_]+\.dart:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$|^(?:render|opurom-lang)\/src\/[a-z_]+\.rs:\d+(?:-\d+)?$/;

function collectAnchors(value, found = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/(?:[a-z_]+\/)*[a-z_]+\.dart:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*|(?:render|opurom-lang)\/src\/[a-z_]+\.rs:\d+(?:-\d+)?/g)) {
      found.push(match[0]);
    }
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAnchors(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAnchors(item, found);
  }
  return found;
}

function countPins(doc, property) {
  const rows = doc[property];
  assert.ok(Array.isArray(rows), `${property} must be an array`);
  return rows.reduce((total, row) => {
    if (row.pins && Array.isArray(row.pins)) return total + row.pins.length;
    if (row.pins && typeof row.pins === 'object') return total + Object.values(row.pins).length;
    return total;
  }, 0);
}

test('catalog registry covers five complete, wired and source-anchored audits', () => {
  assert.match(registry.flutter.version, /3\.50\.0/);
  assert.equal(registry.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.deepEqual(registry.docs, ['README.md', 'COMPONENT_STATUS.md']);
  assert.deepEqual(
    registry.registries.map((item) => item.name),
    ['responsive-components', 'page-states', 'scroll-clipping', 'sticky-header', 'collapsible-content'],
  );

  let totalPins = 0;
  const allModules = new Set();
  const docs = registry.docs.map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  for (const entry of registry.registries) {
    const doc = JSON.parse(readFileSync(path.join(root, entry.manifest), 'utf8'));
    assert.match(doc.flutter.version, /3\.50\.0/, `${entry.name} version drifted`);
    assert.equal(doc.flutter.commit, registry.flutter.commit, `${entry.name} commit drifted`);
    assert.ok(packageJson.scripts.test.includes(entry.gate), `${entry.name} gate must be wired into npm test`);
    assert.ok(Array.isArray(doc[entry.property]) && doc[entry.property].length > 0, `${entry.name} ${entry.property} missing`);

    const pins = countPins(doc, entry.property);
    assert.equal(pins, entry.pinCount, `${entry.name} pin count drifted`);
    totalPins += pins;

    const anchors = collectAnchors(doc);
    assert.equal(anchors.length, entry.anchorCount, `${entry.name} anchor count drifted`);
    for (const anchor of anchors) {
      assert.match(anchor, ANCHOR, `${entry.name} anchor shape drifted: ${anchor}`);
    }
    for (const subject of entry.anchorSubjects) {
      assert.ok(JSON.stringify(doc).includes(subject), `${entry.name} missing anchor subject ${subject}`);
    }

    const modules = new Set();
    JSON.stringify(doc, (key, value) => {
      if (key === 'module' && typeof value === 'string') modules.add(value);
      if (key === 'component' && typeof value === 'string') modules.add(value);
      return value;
    });
    for (const module of modules) {
      if (!module.endsWith('.opu')) continue;
      assert.ok(manifest.files.includes(module), `${entry.name} module must be registered: ${module}`);
      allModules.add(module);
    }
    for (const docFile of docs) {
      assert.ok(docFile.text.includes(entry.manifest.replace('test/', '')), `${docFile.file} missing ${entry.name} manifest`);
    }
  }

  assert.equal(totalPins, 53, 'five catalogs must pin 53 catalog records');
  assert.ok(allModules.size >= 5, 'registry must cover at least five registered modules');
});
