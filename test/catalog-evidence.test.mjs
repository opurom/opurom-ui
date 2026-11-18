#!/usr/bin/env node
// UI catalog evidence archive gate. The JSON manifest hashes the five
// breakpoint/state catalogs, their gates, the registry roll-up and the two
// documentation files with SHA-256. The gate recomputes every hash, checks the
// archive covers all five catalogs, verifies pin/anchor counts against the
// registry, confirms the signed state toolchain identity and confirms npm test
// still references every gate. It does not itself claim CI status. The archive
// is the reproducibility contract for the catalog evidence set.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const evidence = JSON.parse(readFileSync(path.join(root, 'test/catalog-evidence.json'), 'utf8'));
const stateMeta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const registry = JSON.parse(readFileSync(path.join(root, 'test/catalog-registry.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function sha256(file) {
  return createHash('sha256').update(readFileSync(path.join(root, file), 'utf8'), 'utf8').digest('hex');
}

test('catalog evidence archive hashes stay complete and reproducible', () => {
  assert.match(evidence.flutter.version, /3\.50\.0/);
  assert.equal(evidence.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.equal(evidence.flutter.engine, '371f77202a73e8dff57a8b3bff75bca55c090aee');
  assert.equal(evidence.algorithm, 'sha256 over the UTF-8 file contents');
  assert.equal(evidence.toolchain.statePins, 'test/state-digests.json');
  assert.equal(evidence.toolchain.renderCommit, stateMeta.render);
  assert.equal(evidence.toolchain.langCommit, stateMeta.lang);
  assert.equal(evidence.toolchain.profile, stateMeta.profile);
  assert.equal(evidence.toolchain.tick, stateMeta.tick);

  assert.equal(evidence.archives.length, 5);
  assert.deepEqual(
    evidence.archives.map((item) => item.name),
    registry.registries.map((item) => item.name),
  );
  let pinTotal = 0;
  for (const item of evidence.archives) {
    assert.equal(sha256(item.manifest), item.manifestHash, `${item.name} manifest hash drifted`);
    assert.equal(sha256(item.gate), item.gateHash, `${item.name} gate hash drifted`);
    assert.ok(packageJson.scripts.test.includes(item.gate), `${item.name} gate must stay wired into npm test`);
    const registryEntry = registry.registries.find((entry) => entry.name === item.name);
    assert.ok(registryEntry, `${item.name} must be registered`);
    assert.equal(item.pinRecords, registryEntry.pinCount, `${item.name} pin record count drifted`);
    assert.equal(item.anchorCount, registryEntry.anchorCount, `${item.name} anchor count drifted`);
    pinTotal += item.pinRecords;
  }

  assert.equal(sha256(evidence.registry.manifest), evidence.registry.manifestHash, 'registry manifest hash drifted');
  assert.equal(sha256(evidence.registry.gate), evidence.registry.gateHash, 'registry gate hash drifted');
  assert.ok(packageJson.scripts.test.includes(evidence.registry.gate), 'registry gate must stay wired into npm test');
  assert.equal(evidence.registry.pinRecords, 53, 'five catalogs must keep 53 pin records');
  assert.equal(evidence.registry.anchorCount, 43, 'five catalogs must keep 43 source anchors');
  assert.equal(pinTotal, evidence.registry.pinRecords, 'archive pin records must roll up to the registry');

  for (const file of evidence.documentation.files) {
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const item of evidence.archives) {
      assert.ok(text.includes(item.manifest.replace('test/', '')), `${file} missing ${item.name} manifest`);
    }
    assert.ok(text.includes(evidence.registry.manifest.replace('test/', '')), `${file} missing registry manifest`);
  }

  for (const step of evidence.reproducibility.steps) {
    assert.ok(step.length > 0, 'reproducibility steps must be declared');
  }
});
