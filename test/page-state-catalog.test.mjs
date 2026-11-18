#!/usr/bin/env node
// Responsive page-state catalog audit. This gate reads a JSON manifest of
// loading/empty/error/success layouts, re-renders every tier pin under the
// signed state toolchain, and checks state coverage, tier diversity, component
// registration, source anchors, documentation references and toolchain identity.
// Digests are internal Opurom pins, not Flutter pixel-parity claims.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'test/page-state-catalog.json'), 'utf8'));
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

test('responsive page-state catalog covers all four states at three tiers', () => {
  assert.match(catalog.flutter.version, /3\.50\.0/);
  assert.equal(catalog.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.equal(catalog.flutter.noPageStateWidget, 'NO_FLUTTER_EQUIVALENT');
  assert.equal(catalog.toolchain.meta, 'test/state-digests.json');
  assert.equal(catalog.toolchain.profile, meta.profile);
  assert.equal(catalog.toolchain.tick, meta.tick);
  assert.deepEqual(catalog.tiers.map((tier) => tier.name), ['compact', 'medium', 'expanded']);
  for (const tier of catalog.tiers) {
    assert.equal(tierFor(tier.width), tier.name, `${tier.name} tier width drifted`);
  }
  assert.deepEqual(catalog.states.map((state) => state.name), ['loading', 'empty', 'error', 'success']);

  const docs = ['README.md', 'COMPONENT_STATUS.md'].map((file) => ({
    file,
    text: readFileSync(path.join(root, file), 'utf8'),
  }));
  const allDigests = new Set();
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-page-state-catalog-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const state of catalog.states) {
      assert.ok(manifest.files.includes(state.module), `${state.name} module must be registered`);
      const component = readFileSync(path.join(root, state.module), 'utf8');
      assert.ok(component.includes(`component ${state.component}(`), `${state.name} component name drifted`);
      assert.match(component, /Flutter stable 3\.50\.0/, `${state.name} must name Flutter version`);
      for (const anchor of state.anchors) {
        assert.ok(component.includes(anchor), `${state.name} missing anchor ${anchor}`);
        assert.match(anchor, /^(?:[a-z_]+\/)*[a-z_]+\.dart:\d+(?:-\d+)?$/, `${state.name} anchor shape drifted: ${anchor}`);
      }
      for (const doc of docs) {
        assert.ok(doc.text.includes(state.component), `${doc.file} missing ${state.name} component`);
      }

      const digests = Object.values(state.pins);
      assert.deepEqual(Object.keys(state.pins), catalog.tiers.map((tier) => tier.name), `${state.name} tier coverage drifted`);
      assert.equal(new Set(digests).size, digests.length, `${state.name} tier digests must differ`);
      for (const tier of catalog.tiers) {
        const digest = state.pins[tier.name];
        assert.match(digest, /^[0-9a-f]{16}$/, `${state.name} ${tier.name} digest shape drifted`);
        assert.ok(!allDigests.has(digest), `${state.name} ${tier.name} digest duplicates another pin`);
        allDigests.add(digest);

        const src = path.join(tmp, `${state.name}-${tier.name}.opu`);
        const ir = path.join(tmp, `${state.name}-${tier.name}.json`);
        writeFileSync(src, `import "${state.module}";
app Catalog {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${state.use}
}
`);
        const compile = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(compile.status, 0, `${state.name} ${tier.name} compile failed: ${compile.stderr}`);
        const render = spawnSync(renderer, [ir, String(tier.width), String(tier.height), path.join(tmp, `${state.name}-${tier.name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
        assert.equal(render.status, 0, `${state.name} ${tier.name} render failed: ${render.stderr}`);
        const got = (render.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
        assert.equal(got, digest, `${state.name} ${tier.name} catalog pin drifted: got ${got}, pinned ${digest}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
