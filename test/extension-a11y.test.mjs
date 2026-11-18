#!/usr/bin/env node
// Accessibility gate for the current M3 shell set. Opurom's renderer exposes
// a deterministic data-only a11y tree (id, role, label, bounds, hidden) via
// `--a11y`; IR `label` and `role` are the two generic semantic props available
// today (A11Y_PARITY_GAP.md:29-35). This gate asserts every new interactive
// shell carries an accessible name in that tree. checked/expanded/liveRegion,
// semantic actions and keyboard navigation are kernel gaps (layer 3), so they
// are explicitly out of scope here and are not claimed as Flutter parity.
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

// label/role = expected accessible name and role, use = authored component call.
const CASES = [
  ['FAB', 'FabM3("plus", "default", "ease")', 'FAB', 'button', 'components/actions_m3.opu'],
  ['Rating', 'RatingM3("Rating", 60, 5, "default", "ease")', 'rating value', 'slider', 'components/rating_m3.opu'],
  ['Refresh list', 'RefreshListShell(200, "default", "ease")', 'refresh list', 'none', 'components/lists_m3.opu'],
  ['Form field', 'FormFieldM3("Email", "you@example.com", true, 3, 60, "default", "ease")', 'form field', 'text', 'components/forms_m3.opu'],
  ['Date picker', 'DatePickerM3("Date", 18, "default", "ease")', 'date picker', 'button', 'components/pickers_m3.opu'],
  ['Autocomplete', 'AutocompleteM3("City", 0, "default", "ease")', 'autocomplete', 'text', 'components/inputs_ext_m3.opu'],
  ['Bottom sheet', 'BottomSheetM3("Share", "Choose a target", "default", "ease")', 'bottom sheet', 'heading', 'components/inputs_ext_m3.opu'],
  ['Tooltip', 'TooltipM3("More options", "below", "default", "ease")', 'tooltip', 'text', 'components/inputs_ext_m3.opu'],
  ['Popup menu', 'PopupMenuM3("Open,Copy,Close", 160, "default", "ease")', 'popup menu', 'button', 'components/menu_m3.opu'],
  ['Navigation rail', 'NavigationRailM3("Home,Search,Profile", 1, "default", "ease")', 'navigation rail', 'none', 'components/nav_rail_m3.opu'],
];

test('new M3 shells expose accessible names in the deterministic a11y tree', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [name, use, label, role, mod]] of CASES.entries()) {
      const src = path.join(tmp, `a${index}.opu`);
      const ir = path.join(tmp, `a${index}.json`);
      const tree = path.join(tmp, `a${index}-a11y.json`);
      writeFileSync(src, `import "${mod}";
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
      const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, `a${index}.ppm`), '--a11y', tree], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
      const nodes = JSON.parse(readFileSync(tree, 'utf8'));
      assert.ok(nodes.some((n) => n.label === label && n.role === role && n.hidden === false),
        `${name} must expose accessible name "${label}" with role "${role}"; got ${JSON.stringify(nodes.map((n) => [n.label, n.role]))}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
