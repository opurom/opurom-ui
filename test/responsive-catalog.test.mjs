#!/usr/bin/env node
// Responsive component catalog audit. This gate reads a JSON manifest that
// summarizes the date/time/color breakpoint suites, then re-renders every pin
// under the signed toolchain. It checks pin coverage, tier/orientation
// diversity, source anchors, module registration, authored grid columns,
// documentation references and toolchain identity. Flutter stable 3.50.0 is
// the sole source authority.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'test/responsive-catalog.json'), 'utf8'));
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const manifest = JSON.parse(readFileSync(path.join(root, 'opurom-pkg.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);

function tierFor(width) {
  if (width < 600) return 'compact';
  if (width < 900) return 'medium';
  if (width < 1200) return 'expanded';
  if (width < 1600) return 'wide';
  return 'ultra';
}

function orientationFor(width, height) {
  return width > height ? 'landscape' : 'portrait';
}

test('responsive catalog keeps complete and distinct breakpoint evidence', async () => {
  assert.match(catalog.flutter.version, /3\.50\.0/);
  assert.equal(catalog.flutter.commit, 'ab2912035e160d9cad6306df307576da6128ebdb');
  assert.equal(catalog.toolchain.meta, 'test/state-digests.json');
  assert.equal(catalog.toolchain.profile, meta.profile);
  assert.equal(catalog.toolchain.tick, meta.tick);
  assert.equal(catalog.suites.length, 3, 'date, time and color suites are required');
  assert.deepEqual(
    catalog.suites.map((suite) => suite.name),
    ['date', 'time', 'color'],
  );

  const allDigests = new Set();
  for (const suite of catalog.suites) {
    assert.ok(manifest.files.includes(suite.module), `${suite.name} module must be registered`);
    const component = readFileSync(path.join(root, suite.module), 'utf8');
    assert.ok(component.includes(`component ${suite.component}(`), `${suite.name} component name drifted`);
    assert.match(component, /Flutter stable 3\.50\.0/, `${suite.name} must name Flutter version`);
    for (const anchor of suite.anchors) {
      assert.ok(component.includes(anchor), `${suite.name} missing anchor ${anchor}`);
      assert.match(anchor, /^(?:[a-z_]+\/)*[a-z_]+\.dart:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/, `${suite.name} anchor shape drifted: ${anchor}`);
    }
    assert.ok(component.includes(`Grid(columns: ${suite.grid.columns}, compactColumns: ${suite.grid.compactColumns}`), `${suite.name} grid columns drifted`);
    assert.ok(suite.grid.columns > suite.grid.compactColumns, `${suite.name} compact columns must be fewer`);
    assert.ok(packageJson.scripts.test.includes(suite.gate), `${suite.name} gate must be wired into npm test`);
    for (const doc of suite.docs) {
      const text = readFileSync(path.join(root, doc), 'utf8');
      assert.ok(text.includes(suite.module), `${doc} missing ${suite.name} module`);
      assert.ok(text.includes(suite.component), `${doc} missing ${suite.name} component`);
    }

    const pins = suite.pins;
    assert.ok(pins.length >= 3, `${suite.name} needs at least three tiers`);
    assert.equal(new Set(pins.map((pin) => pin.name)).size, pins.length, `${suite.name} pin names must be unique`);
    const tiers = new Set();
    const orientations = new Set();
    for (const pin of pins) {
      assert.match(pin.digest, /^[0-9a-f]{16}$/, `${suite.name} ${pin.name} digest shape drifted`);
      assert.ok(!allDigests.has(pin.digest), `${suite.name} ${pin.name} digest duplicates another pin`);
      allDigests.add(pin.digest);
      assert.equal(tierFor(pin.width), pin.tier, `${suite.name} ${pin.name} tier drifted`);
      assert.equal(orientationFor(pin.width, pin.height), pin.orientation, `${suite.name} ${pin.name} orientation drifted`);
      tiers.add(pin.tier);
      orientations.add(pin.orientation);
    }
    for (const required of ['compact', 'medium', 'expanded']) {
      assert.ok(tiers.has(required), `${suite.name} missing ${required} tier`);
    }
    if (suite.requiresOrientationDifference) {
      assert.equal(orientations.size, 2, `${suite.name} must cover both orientations`);
    }
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-responsive-catalog-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const suite of catalog.suites) {
      for (const pin of suite.pins) {
        const src = path.join(tmp, `${suite.name}-${pin.name}.opu`);
        const ir = path.join(tmp, `${suite.name}-${pin.name}.json`);
        writeFileSync(src, `import "${suite.module}";
app Catalog {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${suite.pinUse}
}
`);
        const compile = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(compile.status, 0, `${suite.name} ${pin.name} compile failed: ${compile.stderr}`);
        const render = spawnSync(renderer, [ir, String(pin.width), String(pin.height), path.join(tmp, `${suite.name}-${pin.name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
        assert.equal(render.status, 0, `${suite.name} ${pin.name} render failed: ${render.stderr}`);
        const digest = (render.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
        assert.equal(digest, pin.digest, `${suite.name} ${pin.name} catalog pin drifted: got ${digest}, pinned ${pin.digest}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
