#!/usr/bin/env node
// Responsive time picker breakpoint gate. Flutter stable 3.50.0 anchors:
//   time_picker.dart:48          216dp landscape header
//   time_picker.dart:2408-2418   524x342 landscape dial, 310x468 portrait dial,
//                                312x252 input size
//   widgets/media_query.dart:34-39,855 orientation from width > height
//   render/src/layout.rs:50-74 compact <600, medium <900, expanded <1200
// This gate pins deterministic frame differences across compact, medium and
// expanded tiers and across portrait/landscape orientation. Digests are
// internal Opurom regression pins, not Flutter pixel-parity claims.
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
  ['compact-portrait', 480, 800, '460c6bdb0bc117b0'],
  ['medium-landscape', 800, 480, '99bf26e281dc6257'],
  ['expanded-landscape', 1280, 720, '7b4f042238cd6c66'],
  ['medium-portrait', 720, 1280, 'f51cb9a2847b9b4b'],
];

function render(dir, name, width, height) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, `import "components/responsive_time_picker_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ResponsiveTimePickerPanelM3("10:30", "default", "ease")
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

test('responsive time picker stays distinct across width tiers and orientation', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-responsive-time-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = [];
    for (const [name, width, height, expected] of CASES) {
      const got = render(tmp, name, width, height);
      assert.equal(got, expected, `${name} breakpoint digest drifted: got ${got}, pinned ${expected}`);
      assert.equal(render(tmp, `${name}-repeat`, width, height), got, `${name} must render deterministically`);
      digests.push(got);
    }
    assert.equal(new Set(digests).size, CASES.length, 'breakpoint and orientation frames must stay distinct');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
