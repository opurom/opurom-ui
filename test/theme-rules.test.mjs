#!/usr/bin/env node
// Theme/breakpoint rule gate. Rules module: tools/theme-rules.mjs.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) anchors: theme_data.dart:265-320,416-420,
// 458-460,491-522,840-862; widgets/media_query.dart:205;
// widgets/layout_builder.dart:381; material/constants.dart:30;
// material/navigation_rail.dart:1236-1244. Opurom tier implementation:
// render/src/layout.rs:50-109. This gate checks rule boundaries, light/dark
// theme construction, and deterministic compile/render of the existing
// responsive shell at every tier boundary. It does not alter shared tokens.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';
import { BREAKPOINTS, breakpointFor, fluidColumns, themeRules } from '../tools/theme-rules.mjs';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);

test('breakpoint tiers match Flutter viewport boundaries', () => {
  const cases = [
    [0, 'compact'], [599, 'compact'], [600, 'medium'], [899, 'medium'],
    [900, 'expanded'], [1199, 'expanded'], [1200, 'wide'], [1599, 'wide'],
    [1600, 'ultra'], [10000, 'ultra'],
  ];
  for (const [width, tier] of cases) assert.equal(breakpointFor(width), tier, `width ${width}`);
  assert.equal(BREAKPOINTS.length, 5);
  assert.throws(() => breakpointFor(-1), RangeError);
  assert.throws(() => breakpointFor(1.5), RangeError);
  assert.equal(fluidColumns(480, 12), 4);
  assert.equal(fluidColumns(600, 12), 5);
  assert.equal(fluidColumns(1280, 12), 10);
  assert.equal(fluidColumns(320, 1), 1);
  assert.throws(() => fluidColumns(480, 0), RangeError);
});

test('ThemeData rules preserve light/dark M3 defaults', () => {
  const scheme = { primary: '#6200EE', surface: '#FFFFFF' };
  const light = themeRules('light', scheme);
  const dark = themeRules('dark', scheme);
  assert.equal(light.useMaterial3, true);
  assert.equal(dark.useMaterial3, true);
  assert.equal(light.applyElevationOverlayColor, false);
  assert.equal(dark.applyElevationOverlayColor, true);
  assert.equal(light.splashFactory, 'inkSparkle');
  assert.equal(light.typography, 'material2021');
  assert.equal(light.toolbarBaseline, 56);
  assert.equal(light.railCompactWidth, 80);
  assert.equal(light.railExtendedWidth, 256);
  assert.deepEqual(light.colorScheme, scheme);
  assert.throws(() => themeRules('system', scheme), RangeError);
});

const WIDTH_CASES = [320, 599, 600, 899, 900, 1199, 1200, 1599, 1600];
const STATES = ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'];

function render(width, mode, name, dir, state = 'default') {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  const theme = mode === 'dark'
    ? 'theme { mode: dark, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#121212", onSurface: "#E5E7EB", stage: "#000000", fontMetrics: proportional }'
    : 'theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }';
  writeFileSync(src, `import "components/responsive_m3.opu";
app One {
  quality { msaa: 4 }
  ${theme}
  ResponsiveGridShell("One,Two,Three", 1, "${state}")
}
`);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(width), '400', ppm, '--tick', '4000'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return digest;
}

test('responsive shell compiles and renders at every tier boundary in light and dark', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-theme-rules-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const light = WIDTH_CASES.map((w, i) => render(w, 'light', `l${i}`, tmp));
    const dark = WIDTH_CASES.map((w, i) => render(w, 'dark', `d${i}`, tmp));
    assert.equal(new Set(light).size, WIDTH_CASES.length, `each width must render deterministically: ${light.join(',')}`);
    assert.equal(new Set(dark).size, WIDTH_CASES.length, `each width must render deterministically: ${dark.join(',')}`);
    // Tier rule itself is checked by breakpointFor(); frames also vary with
    // raw viewport width, so equal tier does not imply an identical digest.
    for (let i = 0; i < WIDTH_CASES.length; i++) {
      assert.notEqual(light[i], dark[i], `mode must affect frame at width ${WIDTH_CASES[i]}`);
      assert.equal(render(WIDTH_CASES[i], 'light', `again${i}`, tmp), light[i], 'determinism');
    }
    for (const mode of ['light', 'dark']) {
      for (const state of STATES) {
        const digest = render(800, mode, `${mode}-${state}`, tmp, state);
        assert.match(digest, /^[0-9a-f]+$/, `${mode} ${state} produced no digest`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
