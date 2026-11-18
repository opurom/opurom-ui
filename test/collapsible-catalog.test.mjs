#!/usr/bin/env node
// Collapsible content breakpoint catalog audit. The JSON manifest records the
// authored expanded presentation for single, pair and empty panel cases at
// compact, medium and expanded tiers. Every pin is re-rendered under the signed
// state toolchain. The audit checks case/tier coverage, tick frames, animation
// boundary, collapsed reservation, source anchors, component registration,
// documentation references and determinism. Internal pins only: no Flutter
// parity or panel-controller claim.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'test/collapsible-catalog.json'), 'utf8'));
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

test('collapsible catalog pins expanded panels across three cases and three tiers', () => {
  assert.match(catalog.flutter.version, /3\.50\.0/);
  assert.equal(catalog.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.match(catalog.flutter.expansionPanel, /expansion_panel\.dart:185-195/);
  assert.match(catalog.flutter.themeDuration, /theme\.dart:20/);
  assert.match(catalog.flutter.crossFade, /animated_cross_fade\.dart:123-145/);
  assert.equal(catalog.flutter.gap, 'A2/B4');
  assert.equal(catalog.toolchain.meta, 'test/state-digests.json');
  assert.equal(catalog.toolchain.profile, meta.profile);
  assert.deepEqual(catalog.toolchain.replayTicks, [0, 100, 200]);
  assert.deepEqual(catalog.tiers.map((tier) => tier.name), ['compact', 'medium', 'expanded']);
  for (const tier of catalog.tiers) {
    assert.equal(tierFor(tier.width), tier.name, `${tier.name} tier width drifted`);
  }
  assert.deepEqual(catalog.cases.map((item) => item.name), ['single', 'pair', 'empty']);
  assert.match(catalog.component.expanded, /static/);
  assert.match(catalog.component.collapsed, /reserved/);
  assert.match(catalog.component.animation, /200 ms/);

  const docs = catalog.docs.map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-collapsible-catalog-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    assert.ok(manifest.files.includes(catalog.component.module), 'collapsible module must be registered');
    const component = readFileSync(path.join(root, catalog.component.module), 'utf8');
    assert.ok(component.includes(`component ${catalog.component.name}(`), 'collapsible component name drifted');
    assert.match(component, /Flutter stable 3\.50\.0/, 'collapsible component must name Flutter version');
    assert.ok(component.includes('expansion_tile.dart:118-140'), 'expansion tile anchor missing');
    assert.ok(component.includes('material/motion.dart:52'), 'motion anchor missing');
    assert.ok(!/(crossFadeState|firstCurve|onEnd|excludeBottomFocus|clipBehavior)\s*:/.test(component), 'shell must not fake controller props');
    for (const doc of docs) {
      assert.ok(doc.text.includes(catalog.component.name), `${doc.file} missing collapsible component`);
    }

    for (const item of catalog.cases) {
      assert.deepEqual(Object.keys(item.pins), catalog.tiers.map((tier) => tier.name), `${item.name} tier coverage drifted`);
      const tickFrames = new Set();
      for (const tier of catalog.tiers) {
        const byTick = item.pins[tier.name];
        assert.deepEqual(Object.keys(byTick).map(Number), catalog.toolchain.replayTicks, `${item.name} ${tier.name} tick coverage drifted`);
        for (const tick of catalog.toolchain.replayTicks) {
          const digest = byTick[String(tick)];
          assert.match(digest, /^[0-9a-f]{16}$/, `${item.name} ${tier.name} ${tick} digest shape drifted`);
          if (tick === 200) {
            assert.ok(!tickFrames.has(digest), `${item.name} ${tier.name} ${tick} digest duplicates another tier`);
          }
          tickFrames.add(digest);

          const id = `${item.name}-${tier.name}-${tick}`;
          const src = path.join(tmp, `${id}.opu`);
          const ir = path.join(tmp, `${id}.json`);
          writeFileSync(src, `import "${catalog.component.module}";
app Catalog {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${item.use}
}
`);
          const compile = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
          assert.equal(compile.status, 0, `${id} compile failed: ${compile.stderr}`);
          if (tick === 200) {
            assert.match(readFileSync(ir, 'utf8'), /"duration":\s*200/, `${id} must carry the 200 ms animation token`);
          }
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
