#!/usr/bin/env node
// Responsive color picker breakpoint gate. Flutter stable 3.50.0 anchors:
//   painting/colors.dart:420-432  ColorSwatch holds a keyed shade table
//   material/colors.dart:174-204,1912-1937 swatch keys and primaries list
//   rendering/sliver_grid.dart:174-190,354-375,449-518 grid column derivation
//   render/src/layout.rs:50-109 compact <600, medium <900, expanded <1200
// This gate pins deterministic frame differences across compact, medium and
// expanded tiers. Digests are internal Opurom regression pins, not Flutter
// pixel-parity claims or a standalone color-picker parity claim.
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

const CASES = [
  ['compact', 480, 800, '63f7cdedc942856a'],
  ['medium', 800, 480, '287ac40a842f4bf7'],
  ['expanded', 1280, 720, 'd0b6f917665728b7'],
];

function render(dir, name, width, height) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, `import "components/responsive_color_picker_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ResponsiveColorPickerPanelM3("Blue", "default", "ease")
}
`);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(width), String(height), path.join(dir, `${name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return digest;
}

test('responsive color picker swatch grid stays distinct across width tiers', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-responsive-color-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = [];
    for (const [name, width, height, expected] of CASES) {
      const got = render(tmp, name, width, height);
      assert.equal(got, expected, `${name} breakpoint digest drifted: got ${got}, pinned ${expected}`);
      assert.equal(render(tmp, `${name}-repeat`, width, height), got, `${name} must render deterministically`);
      digests.push(got);
    }
    assert.equal(new Set(digests).size, CASES.length, 'breakpoint frames must stay distinct');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
