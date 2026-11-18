#!/usr/bin/env node
// Static provenance and eight-state coverage auditor for M3 shell modules.
// Flutter stable 3.50.0 is the only accepted reference; every shell with a
// `state` parameter must carry a `file:line` anchor and a Flutter version
// marker in its header, and every registered eight-state compile case must
// target a module that is also registered in the package manifest.
// This gate is data-only: no component, token or IR file is modified.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'opurom-pkg.json'), 'utf8'));
const compileTest = readFileSync(path.join(root, 'test/eight-state-compile.test.mjs'), 'utf8');
const a11yTest = readFileSync(path.join(root, 'test/extension-a11y.test.mjs'), 'utf8');
const STATE_MODULES = new Set();
for (const m of compileTest.matchAll(/\['(components\/[^']+\.opu)'/g)) STATE_MODULES.add(m[1]);

const REQUIRED = [
  'components/actions_m3.opu',
  'components/lists_m3.opu',
  'components/forms_m3.opu',
  'components/pickers_m3.opu',
  'components/inputs_ext_m3.opu',
  'components/rating_m3.opu',
  'components/menu_m3.opu',
  'components/nav_rail_m3.opu',
  'components/nav_rail_extended_m3.opu',
  'components/bottom_app_bar_m3.opu',
  'components/dropdown_menu_metrics_m3.opu',
  'components/list_tile_metrics_m3.opu',
  'components/autocomplete_field_m3.opu',
  'components/filled_card_metrics_m3.opu',
  'components/date_picker_panel_m3.opu',
  'components/time_picker_panel_m3.opu',
  'components/responsive_date_picker_m3.opu',
  'components/date_range_m3.opu',
  'components/sticky_header_m3.opu',
  'components/nav_drawer_m3.opu',
  'components/datetime_picker_m3.opu',
  'components/dropdown_menu_m3.opu',
];

test('M3 shells declare Flutter source anchors and version', () => {
  for (const file of REQUIRED) {
    const text = readFileSync(path.join(root, file), 'utf8');
    assert.ok(manifest.files.includes(file), `${file} must be in package manifest`);
    assert.ok(/3\.50\.0|ab291203/.test(text), `${file} must name Flutter version/commit`);
    assert.ok(/\b[a-z_]+\.dart:\d+/.test(text), `${file} must carry Flutter file:line anchor`);
    if (/state:\s*string/.test(text)) {
      assert.ok(STATE_MODULES.has(file), `${file} must have an eight-state compile case`);
    }
  }
});

test('new interactive shells expose a semantic role in the a11y gate', () => {
  for (const file of [
    'components/actions_m3.opu', 'components/forms_m3.opu', 'components/pickers_m3.opu',
    'components/inputs_ext_m3.opu', 'components/rating_m3.opu', 'components/menu_m3.opu',
    'components/date_range_m3.opu', 'components/sticky_header_m3.opu',
    'components/datetime_picker_m3.opu', 'components/dropdown_menu_m3.opu',
  ]) {
    assert.ok(a11yTest.includes(file), `${file} must have an accessibility-tree case`);
  }
});
