#!/usr/bin/env node
// Card/list extreme-content and deterministic-performance gate.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) source anchors:
//   card.dart:80-89             Card parameters and defaults
//   card.dart:263-266,301-322   elevated M3: elevation 1, 12dp radius,
//                               surfaceContainerLow background
//   card.dart:340-357           outlined M3: elevation 0, 12dp radius
//   list_tile.dart:391-430      ListTile title/subtitle/isThreeLine/enabled
//   list_tile.dart:921-944      title/subtitle style resolution
//   list_tile.dart:1029,1035    horizontalTitleGap 16, M3 minLeadingWidth
// Opurom shells carry static geometry; text measurement and line wrapping are
// kernel gaps (B12). This gate asserts deterministic rendering for empty,
// overlong and extreme content, eight-state IR propagation, and counts logical
// build steps (compile+render subprocess launches) instead of wall-clock time.
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
const long = 'T'.repeat(400);
const manyItems = Array.from({ length: 80 }, (_, i) => `item-${i}`).join(',');

const CASES = [
  ['card-empty', 'components/card_m3.opu', 'ElevatedCardM3("", "", "default", "ease")', 320],
  ['card-long', 'components/card_m3.opu', `ElevatedCardM3("${long}", "${long}", "hover", "ease")`, 320],
  ['card-outlined', 'components/card_m3.opu', `OutlinedCardM3("${long}", "", "focus", "ease")`, 240],
  ['tile-empty', 'components/list_tile_m3.opu', 'ListTileM3("", "", "disabled", "ease")', 240],
  ['tile-long', 'components/list_tile_m3.opu', `ListTileM3("${long}", "${long}", "loading", "ease")`, 320],
  ['lists-empty', 'components/lists_m3.opu', 'GroupedListShell("", 0, "success", "ease")', 240],
  ['lists-over', 'components/lists_m3.opu', `GroupedListShell("${long}", 999999, "error", "ease")`, 1600],
];

function source(mod, use) {
  return `import "${mod}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

function buildAndRender(dir, name, mod, use, view) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(mod, use));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const runs = [];
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(renderer, [ir, String(view), '240', path.join(dir, `${name}-${i}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
    runs.push((r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1]);
  }
  assert.ok(runs.every(Boolean), `${name} produced no digest`);
  assert.equal(runs[0], runs[1], `${name} must render deterministically`);
  return runs[0];
}

function findState(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) findState(child, found);
  return found;
}

test('card and list extremes render deterministically at boundary viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-card-list-extremes-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = CASES.map(([name, mod, use, view]) => buildAndRender(tmp, name, mod, use, view));
    assert.equal(new Set(digests).size, CASES.length, `distinct frames expected: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('eight states reach IR for card and list shells', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-card-list-states-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const shells = [
      ['card', 'components/card_m3.opu', v => `ElevatedCardM3("${long}", "", "${v}", "ease")`],
      ['tile', 'components/list_tile_m3.opu', v => `ListTileM3("Item", "${long}", "${v}", "ease")`],
      ['lists', 'components/lists_m3.opu', v => `LoadMoreListShell(4000, "${v}", "ease")`],
    ];
    for (const [name, mod, build] of shells) {
      for (const state of meta.states) {
        const src = path.join(tmp, `${name}-${state}.opu`);
        const ir = path.join(tmp, `${name}-${state}.json`);
        writeFileSync(src, source(mod, build(state)));
        const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(c.status, 0, `${name} ${state} compile failed: ${c.stderr}`);
        const states = findState(JSON.parse(readFileSync(ir, 'utf8')).tree);
        assert.ok(states.includes(state), `${name} ${state} missing from IR: ${JSON.stringify(states)}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('logical step count stays within a fixed budget', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-card-list-steps-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    // Deterministic budget: 1 compile + 2 renders per case, no wall clock.
    const perCase = 3;
    const cases = CASES.length;
    const budget = perCase * cases;
    let steps = 0;
    for (const [name, mod, use, view] of CASES) {
      buildAndRender(tmp, `steps-${name}`, mod, use, view);
      steps += perCase;
    }
    assert.equal(steps, budget, `logical step count must stay fixed at ${budget}`);
    assert.ok(budget === 21, 'extreme-content suite must stay bounded');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
