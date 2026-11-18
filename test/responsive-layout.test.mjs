#!/usr/bin/env node
// Responsive layout gate: the same declarative IR must produce different
// deterministic frames at Flutter's compact/medium/expanded tiers. Flutter
// 3.50.0 anchors: widgets/layout_builder.dart:381 (LayoutBuilder),
// widgets/media_query.dart:205 (viewport size), material/constants.dart:30
// (56dp toolbar baseline). Opurom's renderer implements the tier rule at
// render/src/layout.rs:50-74 and the 120px minimum column at :76-109.
// This test only checks observable deterministic adaptation, not pixel parity.
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
const WIDTHS = [480, 800, 1280];

function render(dir, name, width) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  writeFileSync(src, `import "components/responsive_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ResponsiveGridShell("One,Two,Three", 1, "default")
}
`);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(width), '400', ppm, '--tick', '4000'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `render ${width} failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `render ${width} produced no digest`);
  return digest;
}

test('responsive grid adapts across compact, medium and expanded widths', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-responsive-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = WIDTHS.map((w, i) => render(tmp, `w${i}`, w));
    assert.equal(new Set(digests).size, 3, `all tiers must differ: ${digests.join(',')}`);
    // Same width and source must stay byte-identical across runs.
    assert.equal(render(tmp, 'again', WIDTHS[1]), digests[1]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
