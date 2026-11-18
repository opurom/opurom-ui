#!/usr/bin/env node
// Complex-boundary gate for the M3 autocomplete presentation shell.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) source anchors:
//   material/autocomplete.dart:113,205-220    optionsMaxHeight 200dp, elevation 4
//   material/autocomplete.dart:208-218        highlightedIndex, constrained list
//   material/autocomplete.dart:276-298        ListView.builder highlight mapping
//   widgets/autocomplete.dart:447-451         options view hidden when empty
//   widgets/autocomplete.dart:510,520         empty-state transition
//   widgets/autocomplete.dart:531-547         selection collapses text and closes
//   widgets/autocomplete.dart:551             highlight clamped to 0 when empty
// Opurom compiles literal presentation slots; no runtime filtering/keyboard
// behaviour is claimed. This gate asserts deterministic compilation/rendering
// for empty options, long candidate lists, clamped/out-of-range selection,
// clear/disabled/error presentation and all eight design states.
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
const longOption = `Option-${'X'.repeat(180)}`;
const manyOptions = Array.from({ length: 120 }, (_, i) => `candidate-${i}`).join(',');

const CASES = [
  ['empty-options', `AutocompleteFieldM3("", "", "", -1, "default", "ease")`],
  ['empty-query', `AutocompleteFieldM3("City", "", "Paris,Rome", 0, "hover", "ease")`],
  ['long-candidate', `AutocompleteFieldM3("City", "San", "${longOption}", 0, "active", "ease")`],
  ['many-candidates', `AutocompleteFieldM3("City", "can", "${manyOptions}", 119, "focus", "ease")`],
  ['clamp-high', `AutocompleteFieldM3("City", "can", "${manyOptions}", 999999, "disabled", "ease")`],
  ['clamp-low', `AutocompleteFieldM3("City", "", "Paris,Rome", -99, "loading", "ease")`],
  ['clear-state', `AutocompleteFieldM3("City", "", "Paris,Rome", 0, "success", "ease")`],
  ['error-state', `AutocompleteFieldM3("City", "???", "", -1, "error", "ease")`],
];

function source(use) {
  return `import "${MOD}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

function frame(dir, name, use) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(use));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const digests = [];
  for (let run = 0; run < 2; run++) {
    const r = spawnSync(renderer, [ir, String(width), String(height), path.join(dir, `${name}-${run}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
    digests.push((r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1]);
  }
  assert.ok(digests.every(Boolean), `${name} produced no digest`);
  assert.equal(digests[0], digests[1], `${name} must render deterministically`);
  return digests[0];
}

test('autocomplete complex boundaries compile and render deterministically', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-autocomplete-boundaries-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = CASES.map(([name, use]) => frame(tmp, name, use));
    assert.equal(new Set(digests).size, CASES.length, `distinct boundary frames expected: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('autocomplete state prop reaches IR in all eight states at long-list boundary', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-autocomplete-boundary-states-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const state of meta.states) {
      const src = path.join(tmp, `${state}.opu`);
      const ir = path.join(tmp, `${state}.json`);
      writeFileSync(src, source(`AutocompleteFieldM3("City", "can", "${manyOptions}", 999999, "${state}", "ease")`));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${state} compile failed: ${c.stderr}`);
      const text = readFileSync(ir, 'utf8');
      assert.ok(text.includes(`"state":"${state}"`) || text.includes(`"state": "${state}"`), `${state} not present in IR`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
