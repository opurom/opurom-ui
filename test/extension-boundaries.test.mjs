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
  ['TimePickerM3("Time", -1, "error", "ease")', 'components/pickers_m3.opu'],
  ['ColorPickerM3("", 9999, "default", "ease")', 'components/pickers_m3.opu'],
  ['RegionPickerM3("Region", -5, "success", "ease")', 'components/pickers_m3.opu'],
  ['PopupMenuM3("", 160, "default", "ease")', 'components/menu_m3.opu'],
  [`PopupMenuM3("${long}", 9999, "error", "ease")`, 'components/menu_m3.opu'],
  ['NavigationRailM3("", 999, "default", "ease")', 'components/nav_rail_m3.opu'],
  [`NavigationRailM3("${long}", -1, "error", "ease")`, 'components/nav_rail_m3.opu'],
  ['ExtendedNavigationRailM3("", 999, "default", "ease")', 'components/nav_rail_extended_m3.opu'],
  [`ExtendedNavigationRailM3("${long}", -1, "error", "ease")`, 'components/nav_rail_extended_m3.opu'],
  ['DateRangePickerM3("", -5, -5, "disabled", "ease")', 'components/date_range_m3.opu'],
  [`DateRangePickerM3("${long}", 999999, 0, "error", "ease")`, 'components/date_range_m3.opu'],
  ['StickyHeaderM3("", 0, 0, "disabled", "ease")', 'components/sticky_header_m3.opu'],
  [`StickyHeaderM3("${long}", 9999, 32, "error", "ease")`, 'components/sticky_header_m3.opu'],
  ['NavigationDrawerM3("", 999, "disabled", "ease")', 'components/nav_drawer_m3.opu'],
  [`NavigationDrawerM3("${long}", -1, "error", "ease")`, 'components/nav_drawer_m3.opu'],
  ['DateTimePickerM3("", -1, -1, "disabled", "ease")', 'components/datetime_picker_m3.opu'],
  [`DateTimePickerM3("${long}", 999999, 999999, "error", "ease")`, 'components/datetime_picker_m3.opu'],
  ['DropdownMenuM3("", -1, "", "disabled", "ease")', 'components/dropdown_menu_m3.opu'],
  [`DropdownMenuM3("${long}", 999999, "${long}", "error", "ease")`, 'components/dropdown_menu_m3.opu'],
  ['WaterfallGridM3("", 1, 0, "disabled", "ease")', 'components/waterfall_m3.opu'],
  [`WaterfallGridM3("${long}", 9999, 9999, "error", "ease")`, 'components/waterfall_m3.opu'],
  ['ExpandablePanelM3("", "", "disabled", "ease")', 'components/expansion_m3.opu'],
  [`SelectFieldM3("${long}", 9999, "error", "ease")`, 'components/expansion_m3.opu'],
  ['PageLoadingShell("", "disabled", "ease")', 'components/page_states_m3.opu'],
  [`PageEmptyShell("${long}", "${long}", "error", "ease")`, 'components/page_states_m3.opu'],
  ['PageErrorShell("", "", "loading", "ease")', 'components/page_states_m3.opu'],
  ['MinFilledButtonM3("", "disabled", "ease")', 'components/button_metrics_m3.opu'],
  ['MinIconButtonM3("home", "error", "tap")', 'components/button_metrics_m3.opu'],
  ['SnackBarM3("", "loading", "ease")', 'components/snackbar_m3.opu'],
  ['DefaultDialogM3("", "", "disabled", "ease")', 'components/dialog_metrics_m3.opu'],
  ['LinearProgress2024M3(-10, "loading", "ease")', 'components/progress_2024_m3.opu'],
  ['TouchRadioM3("error", "ease")', 'components/selection_touch_m3.opu'],
  ['M3Fab2024("plus", "loading", "ease")', 'components/fab_2024_m3.opu'],
  ['SegmentedButtonM3("", "", "", -1, "error", "ease")', 'components/segmented_button_m3.opu'],
  ['StandardDrawerM3("", "", "", "error", "ease")', 'components/drawer_metrics_m3.opu'],
  ['ScrolledAppBarM3("", "home", "disabled", "ease")', 'components/app_bar_scrolled_m3.opu'],
  ['AssistChipM3Default("", "error", "ease")', 'components/chip_metrics_m3.opu'],
  ['BottomAppBarM3("", "disabled", "ease")', 'components/bottom_app_bar_m3.opu'],
  [`BottomAppBarM3("${long}", "error", "ease")`, 'components/bottom_app_bar_m3.opu'],
  ['DefaultDropdownMenuM3("", -1, "", "", "disabled", "ease")', 'components/dropdown_menu_metrics_m3.opu'],
  [`DefaultDropdownMenuM3("${long}", 999999, "${long}", "${long}", "error", "ease")`, 'components/dropdown_menu_metrics_m3.opu'],
  ['DefaultListTileM3("", "", "disabled", "ease")', 'components/list_tile_metrics_m3.opu'],
  [`DefaultListTileM3("${long}", "${long}", "error", "ease")`, 'components/list_tile_metrics_m3.opu'],
  ['AutocompleteFieldM3("", "", "", -1, "disabled", "ease")', 'components/autocomplete_field_m3.opu'],
  [`AutocompleteFieldM3("${long}", "${long}", "${long}", 999999, "error", "ease")`, 'components/autocomplete_field_m3.opu'],
  ['DefaultFilledCardM3("", "", "disabled", "ease")', 'components/filled_card_metrics_m3.opu'],
  [`DefaultFilledCardM3("${long}", "${long}", "error", "ease")`, 'components/filled_card_metrics_m3.opu'],
  ['DatePickerPanelM3("", "disabled", "ease")', 'components/date_picker_panel_m3.opu'],
  [`DatePickerPanelM3("${long}", "error", "ease")`, 'components/date_picker_panel_m3.opu'],
  ['TimePickerPanelM3("", "disabled", "ease")', 'components/time_picker_panel_m3.opu'],
  [`TimePickerPanelM3("${long}", "error", "ease")`, 'components/time_picker_panel_m3.opu'],
  ['ResponsiveDatePickerPanelM3("", "disabled", "ease")', 'components/responsive_date_picker_m3.opu'],
  [`ResponsiveDatePickerPanelM3("${long}", "error", "ease")`, 'components/responsive_date_picker_m3.opu'],
  ['ResponsiveTimePickerPanelM3("", "disabled", "ease")', 'components/responsive_time_picker_m3.opu'],
  [`ResponsiveTimePickerPanelM3("${long}", "error", "ease")`, 'components/responsive_time_picker_m3.opu'],

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

test('extreme state and animate values stay inside the declared grammar', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-boundary-invalid-state-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [use, mod] of [
      ['WaterfallGridM3("x", 0, 0, "unknown", "ease")', 'components/waterfall_m3.opu'],
      ['ExpandablePanelM3("x", "y", "unknown", "ease")', 'components/expansion_m3.opu'],
      ['PageErrorShell("x", "y", "error", "unknown")', 'components/page_states_m3.opu'],
    ]) {
      const src = path.join(tmp, 'bad.opu');
      writeFileSync(src, source(mod, use));
      const c = spawnSync(compiler, ['compile', src, '-o', path.join(tmp, 'bad.json')], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${use.slice(0, 32)} must reject an unknown state/animate value`);
      assert.match(c.stderr + c.stdout, /unknown (state|animate) value/);
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
