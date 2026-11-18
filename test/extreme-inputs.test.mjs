#!/usr/bin/env node
// Extreme-input robustness gate for representative M3 shells. Flutter stable
// 3.50.0 anchors are carried in each component header; this gate focuses on
// Opurom boundary behaviour: zero/negative/extreme numeric slots, empty and
// overlong captions, and all eight design states. It is independent from the
// shared boundary suite and does not modify any existing file.
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
const long = 'W'.repeat(512);

const CASES = [
  ['actions', 'components/actions_m3.opu', 'FabM3("plus", "{s}", "ease")'],
  ['lists', 'components/lists_m3.opu', 'RefreshListShell(4000, "{s}", "ease")'],
  ['forms', 'components/forms_m3.opu', `FormFieldM3("${long}", "", true, 0, 99999, "{s}", "ease")`],
  ['pickers', 'components/pickers_m3.opu', 'DatePickerM3("", -999, "{s}", "ease")'],
  ['datetime', 'components/datetime_picker_m3.opu', `DateTimePickerM3("${long}", -1, 999999, 0, "{s}", "ease")`],
  ['drawer', 'components/nav_drawer_m3.opu', 'NavigationDrawerM3("", -1, "{s}", "ease")'],
  ['sticky', 'components/sticky_header_m3.opu', 'StickyHeaderM3("", 0, 0, "{s}", "ease")'],
  ['menu', 'components/menu_m3.opu', `PopupMenuM3("${long}", 9999, "{s}", "ease")`],
  ['extended rail', 'components/nav_rail_extended_m3.opu', `ExtendedNavigationRailM3("${long}", -1, "{s}", "ease")`],
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

test('extreme numeric and text inputs compile and render in all eight states', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-extreme-inputs-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let checks = 0;
    for (const [name, mod, use] of CASES) {
      for (const state of meta.states) {
        const id = `${name}-${state}`;
        const src = path.join(tmp, `${id}.opu`);
        const ir = path.join(tmp, `${id}.json`);
        writeFileSync(src, source(mod, use.replace('{s}', state)));
        const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(c.status, 0, `${id} compile failed: ${c.stderr}`);
        const r = spawnSync(renderer, [ir, '320', '240', path.join(tmp, `${id}.ppm`), '--tick', '4000'], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${id} render failed: ${r.stderr}`);
        assert.match(r.stdout || '', /digest=[0-9a-f]+/i, `${id} produced no frame`);
        checks += 1;
      }
    }
    assert.equal(checks, CASES.length * 8);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
