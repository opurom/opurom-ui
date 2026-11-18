#!/usr/bin/env node
// Scroll container breakpoint catalog audit. The JSON manifest records static
// clipping frames for three scroll shells at compact, medium and expanded
// tiers. Every pin is re-rendered under the signed state toolchain. The audit
// checks tier coverage, declared overflow rules, rebound reservation, source
// anchors, component registration, documentation references and determinism.
// Internal consistency pins only: no Flutter oracle and no bounce-parity claim.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'test/scroll-catalog.json'), 'utf8'));
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

test('scroll catalog pins static clipping across three tiers without faking rebound', () => {
  assert.match(catalog.flutter.version, /3\.50\.0/);
  assert.equal(catalog.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.match(catalog.flutter.bouncingPhysics, /scroll_physics\.dart:748-760/);
  assert.match(catalog.flutter.clampingPhysics, /scroll_physics\.dart:964/);
  assert.match(catalog.flutter.scrollIR, /lower\.rs:715/);
  assert.equal(catalog.toolchain.meta, 'test/state-digests.json');
  assert.equal(catalog.toolchain.profile, meta.profile);
  assert.deepEqual(catalog.toolchain.replayTicks, [0, 200]);
  assert.equal(catalog.overflowRule.mode, 'clip');
  assert.equal(catalog.overflowRule.rebound, 'reserved-B2/B3');
  assert.deepEqual(catalog.tiers.map((tier) => tier.name), ['compact', 'medium', 'expanded']);
  for (const tier of catalog.tiers) {
    assert.equal(tierFor(tier.width), tier.name, `${tier.name} tier width drifted`);
    assert.ok(tier.height > catalog.overflowRule.scrollHeight, `${tier.name} must be taller than declared scroll height`);
  }
  assert.deepEqual(catalog.shells.map((shell) => shell.name), ['refresh', 'grouped', 'loadmore']);

  const docs = catalog.docs.map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-scroll-catalog-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const shell of catalog.shells) {
      assert.ok(manifest.files.includes(shell.module), `${shell.name} module must be registered`);
      const component = readFileSync(path.join(root, shell.module), 'utf8');
      assert.ok(component.includes(`component ${shell.component}(`), `${shell.name} component name drifted`);
      assert.match(component, /stable 3\.50\.0/, `${shell.name} must name Flutter version`);
      assert.ok(component.includes('Scroll(height:'), `${shell.name} must use the IR Scroll primitive`);
      assert.ok(!/(overscroll|velocity|scrollOffset)\s*:/.test(component), `${shell.name} must not fake rebound props`);
      for (const doc of docs) {
        assert.ok(doc.text.includes(shell.component), `${doc.file} missing ${shell.name} component`);
      }

      assert.deepEqual(Object.keys(shell.pins), catalog.tiers.map((tier) => tier.name), `${shell.name} tier coverage drifted`);
      for (const tier of catalog.tiers) {
        const byTick = shell.pins[tier.name];
        assert.deepEqual(Object.keys(byTick).map(Number), catalog.toolchain.replayTicks, `${shell.name} ${tier.name} tick coverage drifted`);
        for (const tick of catalog.toolchain.replayTicks) {
          const digest = byTick[String(tick)];
          assert.match(digest, /^[0-9a-f]{16}$/, `${shell.name} ${tier.name} ${tick} digest shape drifted`);
          for (const otherTick of catalog.toolchain.replayTicks) {
            if (otherTick !== tick) {
              assert.notEqual(byTick[String(otherTick)], digest, `${shell.name} ${tier.name} tick pins must differ`);
            }
          }

          const id = `${shell.name}-${tier.name}-${tick}`;
          const src = path.join(tmp, `${id}.opu`);
          const ir = path.join(tmp, `${id}.json`);
          writeFileSync(src, `import "${shell.module}";
app Catalog {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${shell.use}
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
