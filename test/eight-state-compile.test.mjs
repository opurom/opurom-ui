#!/usr/bin/env node
// Compiler-only eight-state test. It proves component APIs emit the new state
// strings into IR without involving the signed digest renderer, whose NodeState
// parser is still the five-value version at 8a76e1d. Default-state IR must stay
// byte-identical to the compiler used for the pinned frames.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const toolchain = JSON.parse(readFileSync(path.join(root, 'test/eight-state-toolchain.json'), 'utf8'));
const compiler = requireNative(root, 'opurom-lang-8state', ['opuromc']);
const pinnedCompiler = requireNative(root, 'opurom-lang', ['opuromc']);
const STATES = ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'];
const CASES = [
  ['components/buttons_m3.opu', 'ElevatedActionButton("Save", "{state}", "ease")'],
  ['components/card_m3.opu', 'ElevatedCardM3("Title", "Subtitle", "{state}", "ease")'],
  ['components/list_tile_m3.opu', 'ListTileM3("Title", "Subtitle", "{state}", "ease")'],
  ['components/chips_m3.opu', 'AssistChipM3("Label", "{state}", "ease")'],
  ['components/chips_m3.opu', 'SelectedChipM3("Label", "{state}", "ease")'],
  ['components/actions_m3.opu', 'FabM3("plus", "{state}", "ease")'],
  ['components/actions_m3.opu', 'SmallFabM3("plus", "{state}", "ease")'],
  ['components/actions_m3.opu', 'ExtendedFabM3("Create", "plus", "{state}", "ease")'],
  ['components/actions_m3.opu', 'LargeFabM3("plus", "{state}", "ease")'],
  ['components/rating_m3.opu', 'RatingM3("Rating", 60, 5, "{state}", "ease")'],
  ['components/lists_m3.opu', 'RefreshListShell(200, "{state}", "ease")'],
  ['components/lists_m3.opu', 'GroupedListShell("Today", 200, "{state}", "ease")'],
  ['components/lists_m3.opu', 'LoadMoreListShell(200, "{state}", "ease")'],
  ['components/forms_m3.opu', 'FormFieldM3("Email", "you@example.com", true, 3, 60, "{state}", "ease")'],
  ['components/forms_m3.opu', 'FormSectionM3("Sign in", "Email", "Password", true, "{state}", "ease")'],
  ['components/pickers_m3.opu', 'DatePickerM3("Date", 18, "{state}", "ease")'],
  ['components/pickers_m3.opu', 'TimePickerM3("Time", 9, "{state}", "ease")'],
  ['components/pickers_m3.opu', 'ColorPickerM3("Colour", 2, "{state}", "ease")'],
  ['components/pickers_m3.opu', 'RegionPickerM3("Region", 1, "{state}", "ease")'],
  ['components/inputs_ext_m3.opu', 'AutocompleteM3("City", 0, "{state}", "ease")'],
  ['components/inputs_ext_m3.opu', 'MultilineFieldM3("Notes", "Type here", "{state}", "ease")'],
  ['components/inputs_ext_m3.opu', 'NumberFieldM3("Quantity", "0", "{state}", "ease")'],
  ['components/inputs_ext_m3.opu', 'BottomSheetM3("Share", "Choose a target", "{state}", "ease")'],
  ['components/inputs_ext_m3.opu', 'TooltipM3("More options", "below", "{state}", "ease")'],
  ['components/menu_m3.opu', 'PopupMenuM3("Open,Copy,Close", 160, "{state}", "ease")'],
  ['components/nav_rail_m3.opu', 'NavigationRailM3("Home,Search,Profile", 1, "{state}", "ease")'],
  ['components/nav_rail_extended_m3.opu', 'ExtendedNavigationRailM3("Home,Search,Profile", 1, "{state}", "ease")'],
  ['components/date_range_m3.opu', 'DateRangePickerM3("Travel dates", 10, 20, "{state}", "ease")'],
  ['components/sticky_header_m3.opu', 'StickyHeaderM3("Today", 56, 32, "{state}", "ease")'],
  ['components/nav_drawer_m3.opu', 'NavigationDrawerM3("Home,Search,Profile", 1, "{state}", "ease")'],
  ['components/fab_2024_m3.opu', 'M3Fab2024("plus", "{state}", "ease")'],
  ['components/fab_2024_m3.opu', 'M3SmallFab2024("plus", "{state}", "ease")'],
  ['components/fab_2024_m3.opu', 'M3LargeFab2024("plus", "{state}", "ease")'],
  ['components/fab_2024_m3.opu', 'M3ExtendedFab2024("Create", "plus", "{state}", "ease")'],
  ['components/segmented_button_m3.opu', 'SegmentedButtonM3("Day", "Week", "Month", 1, "{state}", "ease")'],
  ['components/datetime_picker_m3.opu', 'DateTimePickerM3("Departure", 18, 9, "{state}", "ease")'],
  ['components/dropdown_menu_m3.opu', 'DropdownMenuM3("Country", 0, "United States,Canada,Mexico", "{state}", "ease")'],
  ['components/waterfall_m3.opu', 'WaterfallGridM3("One,Two,Three", 2, 8, "{state}", "ease")'],
  ['components/expansion_m3.opu', 'ExpandablePanelM3("Details", "Body", "{state}", "ease")'],
  ['components/expansion_m3.opu', 'SelectFieldM3("Choose", 1, "{state}", "ease")'],
  ['components/page_states_m3.opu', 'PageLoadingShell("Loading", "{state}", "ease")'],
  ['components/page_states_m3.opu', 'PageEmptyShell("Empty", "Nothing", "{state}", "ease")'],
  ['components/page_states_m3.opu', 'PageErrorShell("Error", "Retry", "{state}", "ease")'],
  ['components/button_metrics_m3.opu', 'MinFilledButtonM3("Save", "{state}", "ease")'],
  ['components/button_metrics_m3.opu', 'MinOutlinedButtonM3("Cancel", "{state}", "ease")'],
  ['components/button_metrics_m3.opu', 'MinTextButtonM3("More", "{state}", "ease")'],
  ['components/button_metrics_m3.opu', 'MinIconButtonM3("home", "{state}", "tap")'],
  ['components/snackbar_m3.opu', 'SnackBarM3("Saved", "{state}", "ease")'],
  ['components/dialog_metrics_m3.opu', 'DefaultDialogM3("Delete", "This cannot be undone", "{state}", "ease")'],
  ['components/progress_2024_m3.opu', 'LinearProgress2024M3(60, "{state}", "ease")'],
  ['components/selection_touch_m3.opu', 'TouchCheckboxM3("{state}", "ease")'],
  ['components/selection_touch_m3.opu', 'TouchRadioM3("{state}", "ease")'],
  ['components/drawer_metrics_m3.opu', 'StandardDrawerM3("Navigation", "Overview", "Runs", "{state}", "ease")'],
  ['components/app_bar_scrolled_m3.opu', 'ScrolledAppBarM3("Title", "home", "{state}", "ease")'],
  ['components/chip_metrics_m3.opu', 'AssistChipM3Default("Today", "{state}", "ease")'],
  ['components/bottom_app_bar_m3.opu', 'BottomAppBarM3("Actions", "{state}", "ease")'],
  ['components/dropdown_menu_metrics_m3.opu', 'DefaultDropdownMenuM3("Country", 0, "United States,Canada,Mexico", "Choose", "{state}", "ease")'],
  ['components/list_tile_metrics_m3.opu', 'DefaultListTileM3("Inbox", "3 unread messages", "{state}", "ease")'],
  ['components/autocomplete_field_m3.opu', 'AutocompleteFieldM3("City", "San", "San Francisco,San Diego", 0, "{state}", "ease")'],
  ['components/filled_card_metrics_m3.opu', 'DefaultFilledCardM3("Colors", "Swatch list", "{state}", "ease")'],
  ['components/date_picker_panel_m3.opu', 'DatePickerPanelM3("November 2026", "{state}", "ease")'],
];

function source(mod, call) {
  return `import "${mod}";
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`;
}

function compile(tool, dir, name, text) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, text);
  const r = spawnSync(tool, ['compile', src, '-o', ir], { encoding: 'utf8' });
  return { status: r.status, ir, log: r.stdout + r.stderr };
}

function stateValues(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) stateValues(child, found);
  return found;
}

test('m3 components emit all eight state strings into IR', () => {
  assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1');
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-eight-state-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [mod, call]] of CASES.entries()) {
      for (const state of STATES) {
        const c = compile(compiler, tmp, `c${index}`, source(mod, call.replace('{state}', state)));
        assert.equal(c.status, 0, `${mod} ${state} compile failed: ${c.log}`);
        const ir = JSON.parse(readFileSync(c.ir, 'utf8'));
        const emitted = stateValues(ir.tree);
        assert.ok(emitted.length > 0, `${mod} ${state} emitted no state prop`);
        assert.ok(emitted.every((v) => v === state), `${mod} ${state} emitted ${JSON.stringify(emitted)}`);
      }
      console.log(mod, call.split('(')[0], 'eight states emitted');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('default-state IR stays byte-identical to the pinned compiler', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-eight-default-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [mod, call]] of CASES.entries()) {
      const text = source(mod, call.replace('{state}', 'default'));
      const fresh = compile(compiler, tmp, `f${index}`, text);
      const pinned = compile(pinnedCompiler, tmp, `p${index}`, text);
      assert.equal(fresh.status, 0, `fresh default failed: ${fresh.log}`);
      assert.equal(pinned.status, 0, `pinned default failed: ${pinned.log}`);
      assert.equal(readFileSync(fresh.ir, 'utf8'), readFileSync(pinned.ir, 'utf8'),
        `${mod} default IR changed between pinned and eight-state compilers`);
    }
    console.log('default IR byte-identical for all pinned component cases');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
