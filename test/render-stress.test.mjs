#!/usr/bin/env node
// Deterministic render stress gate. Flutter stable 3.50.0 viewport source:
// widgets/media_query.dart:205 (size) and widgets/layout_builder.dart:381
// (constraints). Opurom tier rule: render/src/layout.rs:50-109. This gate
// checks that a complex M3 composition yields byte-identical digests across
// repeated runs, stays distinct across compact/medium/ultra widths, and
// remains deterministic in light and dark modes. It adds no component/IR code.
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
const VIEWPORTS = [[320, 240], [800, 600], [1600, 900]];
const MODES = ['light', 'dark'];

function source(mode) {
  const theme = mode === 'dark'
    ? 'theme { mode: dark, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#121212", onSurface: "#E5E7EB", stage: "#000000", fontMetrics: proportional }'
    : 'theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }';
  return `import "components/actions_m3.opu";
import "components/lists_m3.opu";
import "components/datetime_picker_m3.opu";
app Stress {
  quality { msaa: 4 }
  ${theme}
  Column(gap: 4) {
    FabM3("plus", "focus", "ease")
    RefreshListShell(80, "hover", "ease")
    DateTimePickerM3("When", 18, 9, 1, "default", "ease")
  }
}
`;
}

function render(dir, name, width, height, mode) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(mode));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const digests = [];
  for (let run = 0; run < 3; run++) {
    const r = spawnSync(renderer, [ir, String(width), String(height), path.join(dir, `${name}-${run}.ppm`), '--tick', '4000'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
    const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
    assert.ok(digest, `${name} produced no digest`);
    digests.push(digest);
  }
  assert.equal(new Set(digests).size, 1, `${name} must be deterministic: ${digests.join(',')}`);
  return digests[0];
}

test('complex M3 frame stays deterministic and mode/width sensitive', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-render-stress-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const results = [];
    for (const mode of MODES) {
      for (const [i, [width, height]] of VIEWPORTS.entries()) {
        results.push(render(tmp, `${mode}-${i}`, width, height, mode));
      }
    }
    assert.equal(new Set(results.slice(0, 3)).size, 3, 'width must change frame in light mode');
    assert.equal(new Set(results.slice(3)).size, 3, 'width must change frame in dark mode');
    for (let i = 0; i < VIEWPORTS.length; i++) {
      assert.notEqual(results[i], results[i + 3], 'theme mode must change frame');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
