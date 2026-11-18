#!/usr/bin/env node
// Dedicated gate for the M3 autocomplete input presentation shell.
// Flutter stable 3.50.0 source anchors are recorded in
// components/autocomplete_field_m3.opu: material/autocomplete.dart:61-68,113,
// 205-220,278-298; widgets/autocomplete.dart:404-417,531-547; motion.dart:52.
// This gate checks state propagation, settled-frame determinism, empty/overlong
// inputs, out-of-range selection, accessible name/role and error presentation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);
const [width, height] = meta.viewport;
const MOD = 'components/autocomplete_field_m3.opu';
const long = 'W'.repeat(400);

function source(use) {
  return `import "${MOD}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

function compileAndRender(dir, name, use) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(use));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(width), String(height), path.join(dir, `${name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  return (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
}

function stateValues(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) stateValues(child, found);
  return found;
}

const STATES = meta.states;
const BOUNDARIES = [
  'AutocompleteFieldM3("", "", "", -1, "default", "ease")',
  `AutocompleteFieldM3("${long}", "${long}", "${long}", 999999, "error", "ease")`,
  'AutocompleteFieldM3("Empty options", "q", "", 0, "disabled", "ease")',
];

test('autocomplete shell emits all eight states and settles to distinct frames', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-autocomplete-states-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = [];
    for (const state of STATES) {
      const use = `AutocompleteFieldM3("City", "San", "San Francisco,San Diego", 0, "${state}", "ease")`;
      const src = path.join(tmp, `${state}.opu`);
      const ir = path.join(tmp, `${state}.json`);
      writeFileSync(src, source(use));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${state} compile failed: ${c.stderr}`);
      const emitted = stateValues(JSON.parse(readFileSync(ir, 'utf8')).tree);
      assert.ok(emitted.includes(state), `${state} not present in IR: ${JSON.stringify(emitted)}`);
      const digest = compileAndRender(tmp, `render-${state}`, use);
      assert.ok(digest, `${state} produced no digest`);
      assert.equal(compileAndRender(tmp, `again-${state}`, use), digest, `${state} must be deterministic`);
      digests.push(digest);
    }
    assert.equal(new Set(digests).size, 8, `all states must differ: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('autocomplete shell guards empty, overlong and out-of-range inputs', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-autocomplete-edge-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, use] of BOUNDARIES.entries()) {
      assert.ok(compileAndRender(tmp, `edge-${index}`, use), `${use.slice(0, 40)} produced no frame`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('autocomplete shell exposes accessible name and text role', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-autocomplete-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const src = path.join(tmp, 'a11y.opu');
    const ir = path.join(tmp, 'a11y.json');
    const tree = path.join(tmp, 'a11y-tree.json');
    writeFileSync(src, source('AutocompleteFieldM3("City", "San", "San Francisco,San Diego", 0, "default", "ease")'));
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `a11y compile failed: ${c.stderr}`);
    const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, 'a11y.ppm'), '--a11y', tree], { encoding: 'utf8' });
    assert.equal(r.status, 0, `a11y render failed: ${r.stderr}`);
    const nodes = JSON.parse(readFileSync(tree, 'utf8'));
    assert.ok(nodes.some((n) => n.label === 'autocomplete field' && n.role === 'text' && !n.hidden),
      `missing accessible autocomplete field: ${JSON.stringify(nodes.map((n) => [n.label, n.role]))}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
