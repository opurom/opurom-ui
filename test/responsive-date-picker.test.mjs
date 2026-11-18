#!/usr/bin/env node
// Responsive date picker breakpoint gate. Flutter stable 3.50.0 anchors:
//   date_picker.dart:891-892  152dp landscape header, 120dp portrait header
//   date_picker.dart:1949-1955 384dp landscape/480dp portrait calendar caps
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
  ['compact-portrait', 480, 800, '4e02b675476dc651'],
  ['medium-landscape', 800, 480, '926b0a06ee1aada1'],
  ['expanded-landscape', 1280, 720, 'a649bf0bf2b40d0c'],
  ['medium-portrait', 720, 1280, 'b79050baf541eaee'],
];

function render(dir, name, width, height) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, `import "components/responsive_date_picker_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ResponsiveDatePickerPanelM3("November 2026", "default", "ease")
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

test('responsive date picker stays distinct across width tiers and orientation', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-responsive-date-'));
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
