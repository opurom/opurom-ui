#!/usr/bin/env node
// Boundary checks for the M3 extension families added by ui-dev. These use the
// signed state toolchain (compile only where no native renderer is needed and
// compile+render where a frame must be produced). They prove that empty labels,
// overlong labels and extreme numeric bounds neither crash nor leave a state
// un-emitted. They are internal consistency gates, not Flutter pixel parity.
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
const [width, height] = meta.viewport;
const long = 'W'.repeat(400);

const CASES = [
  ['FabM3("plus", "default", "ease")', 'components/actions_m3.opu'],
  ['SmallFabM3("plus", "disabled", "ease")', 'components/actions_m3.opu'],
  [`ExtendedFabM3("${long}", "plus", "error", "ease")`, 'components/actions_m3.opu'],
  ['LargeFabM3("plus", "loading", "ease")', 'components/actions_m3.opu'],
  ['RatingM3("", 0, 5, "default", "ease")', 'components/rating_m3.opu'],
  ['RatingM3("Rate", 999, 5, "success", "ease")', 'components/rating_m3.opu'],
  ['RefreshListShell(2000, "default", "ease")', 'components/lists_m3.opu'],
  ['GroupedListShell("", 200, "loading", "ease")', 'components/lists_m3.opu'],
  ['LoadMoreListShell(200, "loading", "ease")', 'components/lists_m3.opu'],
  [`FormFieldM3("${long}", "", true, 3, 9999, "error", "ease")`, 'components/forms_m3.opu'],
  ['FormSectionM3("", "", "", false, "default", "ease")', 'components/forms_m3.opu'],
  ['DatePickerM3("", 999999, "disabled", "ease")', 'components/pickers_m3.opu'],
  ['TimePickerM3("Time", -1, 0, "error", "ease")', 'components/pickers_m3.opu'],
  ['ColorPickerM3("", 9999, "default", "ease")', 'components/pickers_m3.opu'],
  ['RegionPickerM3("Region", -5, "success", "ease")', 'components/pickers_m3.opu'],
  ['PopupMenuM3("", 160, "default", "ease")', 'components/menu_m3.opu'],
  [`PopupMenuM3("${long}", 9999, "error", "ease")`, 'components/menu_m3.opu'],
  ['NavigationRailM3("", 999, "default", "ease")', 'components/nav_rail_m3.opu'],
  [`NavigationRailM3("${long}", -1, "error", "ease")`, 'components/nav_rail_m3.opu'],
];

function source(mod, use) {
  return `import "${mod}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

test('M3 extension families survive empty, overlong and extreme inputs', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-boundary-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [use, mod]] of CASES.entries()) {
      const src = path.join(tmp, `b${index}.opu`);
      const ir = path.join(tmp, `b${index}.json`);
      writeFileSync(src, source(mod, use));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${use.slice(0, 40)} compile failed: ${c.stderr}`);
      const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, `b${index}.ppm`), '--tick', '4000'], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${use.slice(0, 40)} render failed: ${r.stderr}`);
      assert.match(r.stdout || '', /digest=[0-9a-f]+/i, `${use.slice(0, 40)} produced no frame`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('invalid form bounds are rejected with a typed diagnostic', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-boundary-invalid-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const src = path.join(tmp, 'invalid.opu');
    writeFileSync(src, source('components/forms_m3.opu', 'FormFieldM3("Email", "", true, 9999, 0, "error", "ease")'));
    const c = spawnSync(compiler, ['compile', src, '-o', path.join(tmp, 'invalid.json')], { encoding: 'utf8' });
    assert.notEqual(c.status, 0, 'maxLength below minLength must fail compilation');
    assert.match(c.stderr + c.stdout, /maxLength 0 is less than minLength 9999/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
