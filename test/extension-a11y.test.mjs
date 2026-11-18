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
  ['Extended navigation rail', 'ExtendedNavigationRailM3("Home,Search,Profile", 1, "default", "ease")', 'extended navigation rail', 'none', 'components/nav_rail_extended_m3.opu'],
  ['Date range picker', 'DateRangePickerM3("Travel dates", 10, 20, "default", "ease")', 'date range picker', 'button', 'components/date_range_m3.opu'],
  ['Sticky header', 'StickyHeaderM3("Today", 56, 32, "default", "ease")', 'sticky header', 'heading', 'components/sticky_header_m3.opu'],
  ['Navigation drawer', 'NavigationDrawerM3("Home,Search,Profile", 1, "default", "ease")', 'navigation drawer', 'none', 'components/nav_drawer_m3.opu'],
  ['Date time picker', 'DateTimePickerM3("Departure", 18, 9, "default", "ease")', 'date time picker', 'button', 'components/datetime_picker_m3.opu'],
  ['Dropdown menu', 'DropdownMenuM3("Country", 0, "United States,Canada,Mexico", "default", "ease")', 'dropdown menu', 'button', 'components/dropdown_menu_m3.opu'],
  ['Waterfall grid', 'WaterfallGridM3("One,Two,Three", 2, 8, "default", "ease")', 'waterfall grid', 'none', 'components/waterfall_m3.opu'],
  ['Expansion tile', 'ExpandablePanelM3("Details", "Body", "default", "ease")', 'expansion tile', 'button', 'components/expansion_m3.opu'],
  ['Select field', 'SelectFieldM3("Choose", 1, "default", "ease")', 'select field', 'button', 'components/expansion_m3.opu'],
  ['Page loading', 'PageLoadingShell("Loading", "default", "ease")', 'page loading', 'text', 'components/page_states_m3.opu'],
  ['Page empty', 'PageEmptyShell("Empty", "Nothing", "default", "ease")', 'page empty', 'none', 'components/page_states_m3.opu'],
  ['Page error', 'PageErrorShell("Error", "Retry", "error", "ease")', 'page error', 'heading', 'components/page_states_m3.opu'],
  ['Minimum filled button', 'MinFilledButtonM3("Save", "default", "ease")', 'filled min host', 'none', 'components/button_metrics_m3.opu'],
  ['Snackbar', 'SnackBarM3("Saved", "default", "ease")', 'snackbar', 'text', 'components/snackbar_m3.opu'],
  ['Default dialog', 'DefaultDialogM3("Delete", "This cannot be undone", "default", "ease")', 'default dialog', 'heading', 'components/dialog_metrics_m3.opu'],
  ['Linear progress', 'LinearProgress2024M3(60, "default", "ease")', 'linear progress 2024', 'none', 'components/progress_2024_m3.opu'],
  ['Touch checkbox', 'TouchCheckboxM3("default", "ease")', 'checkbox touch target', 'none', 'components/selection_touch_m3.opu'],
  ['M3 FAB', 'M3Fab2024("plus", "default", "ease")', 'M3 FAB', 'button', 'components/fab_2024_m3.opu'],
  ['Segmented button', 'SegmentedButtonM3("Day", "Week", "Month", 1, "default", "ease")', 'segmented button host', 'none', 'components/segmented_button_m3.opu'],
  ['Standard drawer', 'StandardDrawerM3("Navigation", "Overview", "Runs", "default", "ease")', 'standard drawer', 'none', 'components/drawer_metrics_m3.opu'],
  ['Scrolled app bar', 'ScrolledAppBarM3("Title", "home", "default", "ease")', 'scrolled app bar', 'heading', 'components/app_bar_scrolled_m3.opu'],
  ['Default assist chip', 'AssistChipM3Default("Today", "default", "ease")', 'assist chip', 'button', 'components/chip_metrics_m3.opu'],
  ['Bottom app bar', 'BottomAppBarM3("Actions", "default", "ease")', 'bottom app bar', 'none', 'components/bottom_app_bar_m3.opu'],
  ['Default dropdown menu', 'DefaultDropdownMenuM3("Country", 0, "United States,Canada,Mexico", "Choose", "default", "ease")', 'dropdown menu default', 'button', 'components/dropdown_menu_metrics_m3.opu'],
  ['Default list tile', 'DefaultListTileM3("Inbox", "3 unread messages", "default", "ease")', 'default list tile', 'none', 'components/list_tile_metrics_m3.opu'],
  ['Autocomplete field', 'AutocompleteFieldM3("City", "San", "San Francisco,San Diego", 0, "default", "ease")', 'autocomplete field', 'text', 'components/autocomplete_field_m3.opu'],
  ['Default filled card', 'DefaultFilledCardM3("Colors", "Swatch list", "default", "ease")', 'filled card', 'none', 'components/filled_card_metrics_m3.opu'],
  ['Date picker panel', 'DatePickerPanelM3("November 2026", "default", "ease")', 'date picker panel', 'none', 'components/date_picker_panel_m3.opu'],
  ['Time picker panel', 'TimePickerPanelM3("10:30", "default", "ease")', 'time picker panel', 'none', 'components/time_picker_panel_m3.opu'],
  ['Responsive date picker panel', 'ResponsiveDatePickerPanelM3("November 2026", "default", "ease")', 'responsive date picker host', 'none', 'components/responsive_date_picker_m3.opu'],
  ['Responsive time picker panel', 'ResponsiveTimePickerPanelM3("10:30", "default", "ease")', 'responsive time picker host', 'none', 'components/responsive_time_picker_m3.opu'],
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
