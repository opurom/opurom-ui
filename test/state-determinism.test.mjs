#!/usr/bin/env node
// Repeated-state determinism gate. Opurom promises deterministic rendering;
// this test renders the same settled IR three times in each of the eight
// design states for a complex M3 shell and requires one digest per state,
// plus eight distinct digests overall. Flutter stable 3.50.0 state naming:
// widgets.dart WidgetState pressed/hovered/focused/disabled; Opurom maps to
// default/hover/active/focus/disabled plus business loading/success/error.
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

test('complex shell repeated renders stay deterministic in every state', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-state-determinism-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = [];
    for (const state of meta.states) {
      const src = path.join(tmp, `${state}.opu`);
      const ir = path.join(tmp, `${state}.json`);
      writeFileSync(src, `import "components/datetime_picker_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  DateTimePickerM3("Departure", 18, 9, 1, "${state}", "ease")
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${state} compile failed: ${c.stderr}`);
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, `${state}-${i}.ppm`), '--tick', '4000'], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${state} render failed: ${r.stderr}`);
        runs.push((r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1]);
      }
      assert.ok(runs.every(Boolean), `${state} produced no digest`);
      assert.equal(new Set(runs).size, 1, `${state} must be deterministic: ${runs.join(',')}`);
      digests.push(runs[0]);
    }
    assert.equal(new Set(digests).size, 8, `all eight states must differ: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
