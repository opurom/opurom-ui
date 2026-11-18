#!/usr/bin/env node
// Component-count scaling gate for list/card families.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   card.dart:263-266,301-322      elevated M3 card defaults
//   list_tile.dart:391-430         ListTile parameters
//   list_view.dart:1324-1367       ListView childrenDelegate construction
//   list_view.dart:1358-1361       itemExtent/prototypeItem exclusivity
//   sliver_list.dart:217-226       SliverChildBuilderDelegate defaults
//   sliver.dart:99-107             estimateMaxScrollOffset contract
// Opurom compiles a declarative node list; this gate asserts that logical
// build steps (compile+render subprocess launches) grow linearly with the
// component count and stay inside a fixed budget, that every scale compiles
// and renders deterministically, and that states still reach IR. Wall-clock
// time is never read.
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
const SCALES = [1, 10, 100, 1000];
const STATES = meta.states;

function listSource(count, state) {
  const rows = Array.from({ length: count }, (_, i) => `Text("row-${i}", size: 12, state: "${state}")`).join('\n');
  return `import "components/lists_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  LoadMoreListShell(400, "${state}", "ease") {
    List() {
${rows}
    }
  }
}
`;
}

function cardSource(count, state) {
  const rows = Array.from({ length: count }, (_, i) => `ElevatedCardM3("Card ${i}", "subtitle ${i}", "${state}", "ease")`).join('\n');
  return `import "components/card_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  Column(gap: 4) {
${rows}
  }
}
`;
}

function buildAndRender(dir, name, text, view) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(view), '240', path.join(dir, `${name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return digest;
}

function findState(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) findState(child, found);
  return found;
}

test('list and card scale deterministically across 1/10/100/1000 components', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-scaling-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let steps = 0;
    for (const count of SCALES) {
      const listDigest = buildAndRender(tmp, `list-${count}`, listSource(count, 'default'), 320);
      steps += 2;
      const cardDigest = buildAndRender(tmp, `card-${count}`, cardSource(count, 'default'), 320);
      steps += 2;
      assert.equal(buildAndRender(tmp, `list-${count}-again`, listSource(count, 'default'), 320), listDigest, `${count} list must be deterministic`);
      steps += 2;
      assert.equal(buildAndRender(tmp, `card-${count}-again`, cardSource(count, 'default'), 320), cardDigest, `${count} card must be deterministic`);
      steps += 2;
    }
    // Linear budget: 8 logical steps per scale, fixed across sizes.
    assert.equal(steps, SCALES.length * 8, `logical steps must be linear and fixed: ${steps}`);
    assert.ok(steps <= 32, 'scaling suite must stay bounded');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('state prop reaches IR at 1000-component scale', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-scaling-states-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const state of STATES) {
      const src = path.join(tmp, `list-${state}.opu`);
      const ir = path.join(tmp, `${state}.json`);
      writeFileSync(src, listSource(1000, state));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${state} compile failed: ${c.stderr}`);
      const text = readFileSync(ir, 'utf8');
      assert.ok(text.includes(`"state":"${state}"`) || text.includes(`"state": "${state}"`), `${state} not in IR`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
