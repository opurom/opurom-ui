#!/usr/bin/env node
// Sticky-header breakpoint catalog audit. The JSON manifest records static
// extent frames for four authored modes at compact, medium and expanded tiers.
// Every pin is re-rendered under the signed state toolchain. The audit checks
// tier/mode coverage, pinned and floating reservations, source anchors,
// component registration, documentation references and tick determinism.
// Internal consistency pins only: no Flutter oracle or sliver-parity claim.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'test/sticky-header-catalog.json'), 'utf8'));
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const manifest = JSON.parse(readFileSync(path.join(root, 'opurom-pkg.json'), 'utf8'));
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);

function tierFor(width) {
  if (width < 600) return 'compact';
  if (width < 900) return 'medium';
  if (width < 1200) return 'expanded';
  if (width < 1600) return 'wide';
  return 'ultra';
}

test('sticky header catalog pins static extents across four modes and three tiers', () => {
  assert.match(catalog.flutter.version, /3\.50\.0/);
  assert.equal(catalog.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.match(catalog.flutter.delegate, /sliver_persistent_header\.dart:20-67/);
  assert.match(catalog.flutter.pinnedFloating, /sliver_persistent_header\.dart:125-173/);
  assert.match(catalog.flutter.pinnedSliver, /pinned_header_sliver\.dart:57-131/);
  assert.equal(catalog.flutter.sliverGap, 'B2/B3/L');
  assert.equal(catalog.toolchain.meta, 'test/state-digests.json');
  assert.equal(catalog.toolchain.profile, meta.profile);
  assert.deepEqual(catalog.toolchain.replayTicks, [0, 200]);
  assert.deepEqual(catalog.tiers.map((tier) => tier.name), ['compact', 'medium', 'expanded']);
  for (const tier of catalog.tiers) {
    assert.equal(tierFor(tier.width), tier.name, `${tier.name} tier width drifted`);
  }
  assert.deepEqual(catalog.modes.map((mode) => mode.name), ['expanded', 'compact', 'equal', 'zero']);
  assert.match(catalog.component.pinned, /reserved/);
  assert.match(catalog.component.floating, /reserved/);

  const docs = catalog.docs.map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-catalog-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    assert.ok(manifest.files.includes(catalog.component.module), 'sticky header module must be registered');
    const component = readFileSync(path.join(root, catalog.component.module), 'utf8');
    assert.ok(component.includes(`component ${catalog.component.name}(`), 'sticky header component name drifted');
    assert.match(component, /Flutter stable 3\.50\.0/, 'sticky header must name Flutter version');
    assert.ok(component.includes('sliver_persistent_header.dart:20-67'), 'delegate anchor missing');
    assert.ok(component.includes('sliver_persistent_header.dart:125-161'), 'pinned/floating anchor missing');
    assert.ok(component.includes('sliver_persistent_header.dart:165-173'), 'mode selection anchor missing');
    assert.ok(!/(SliverPersistentHeader|shrinkOffset|overlapsContent)\s*:/.test(component), 'shell must not fake sliver-only props');
    for (const doc of docs) {
      assert.ok(doc.text.includes(catalog.component.name), `${doc.file} missing sticky header component`);
    }

    for (const mode of catalog.modes) {
      assert.deepEqual(Object.keys(mode.pins), catalog.tiers.map((tier) => tier.name), `${mode.name} tier coverage drifted`);
      const modeDigests = new Set();
      for (const tier of catalog.tiers) {
        const byTick = mode.pins[tier.name];
        assert.deepEqual(Object.keys(byTick).map(Number), catalog.toolchain.replayTicks, `${mode.name} ${tier.name} tick coverage drifted`);
        for (const tick of catalog.toolchain.replayTicks) {
          const digest = byTick[String(tick)];
          assert.match(digest, /^[0-9a-f]{16}$/, `${mode.name} ${tier.name} ${tick} digest shape drifted`);
          if (tick !== 0) {
            assert.ok(!modeDigests.has(digest), `${mode.name} ${tier.name} ${tick} digest duplicates another tier/mode`);
          }
          modeDigests.add(digest);

          const id = `${mode.name}-${tier.name}-${tick}`;
          const src = path.join(tmp, `${id}.opu`);
          const ir = path.join(tmp, `${id}.json`);
          writeFileSync(src, `import "${catalog.component.module}";
app Catalog {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${mode.use}
}
`);
          const compile = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
          assert.equal(compile.status, 0, `${id} compile failed: ${compile.stderr}`);
          for (let run = 0; run < 2; run += 1) {
            const render = spawnSync(renderer, [ir, String(tier.width), String(tier.height), path.join(tmp, `${id}-${run}.ppm`), '--tick', String(tick)], { encoding: 'utf8' });
            assert.equal(render.status, 0, `${id} render failed: ${render.stderr}`);
            const got = (render.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
            assert.equal(got, digest, `${id} catalog pin drifted: got ${got}, pinned ${digest}`);
          }
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
