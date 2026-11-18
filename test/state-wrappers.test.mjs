#!/usr/bin/env node
// Five-state compile gate for the additive legacy state wrappers. Flutter
// stable 3.50.0 interaction vocabulary lives in widgets.dart WidgetState;
// Opurom IR maps it to default/hover/active/focus/disabled. This gate proves
// the static state prop reaches IR for every wrapper without touching pins.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const compiler = requireNative(root, 'opurom-lang-8state', ['opuromc']);
const STATES = ['default', 'hover', 'active', 'focus', 'disabled'];
const WRAPPERS = [
  ['StateAppBarShell', 'app_bar'], ['StateAvatarGroup', 'avatar_group'], ['StateBanner', 'banner'],
  ['StateBreadcrumb', 'breadcrumb'], ['StateChartCard', 'chart_card'], ['StateCodeSnippet', 'code_block'],
  ['StateConfirmDialog', 'confirm_dialog'], ['StateDetailRow', 'detail_row'], ['StateDrawer', 'drawer'],
  ['StateEmptyState', 'empty_state'], ['StateFileTree', 'filetree'], ['StateFilterChip', 'chip'],
  ['StateFormField', 'form_field'], ['StateGridTile', 'grid_tile'], ['StateHeroHeader', 'hero_header'],
  ['StateMetricCard', 'stat_card'], ['StateNumberFlow', 'number_flow'], ['StatePaginationBar', 'pagination'],
  ['StateProfileHeader', 'profile_header'], ['StateProgressTrack', 'progress'], ['StateSearchField', 'search'],
  ['StateSectionHeader', 'section_header'], ['StateSecureField', 'secure_field'], ['StateSegmentedControl', 'segmented'],
  ['StateSidebarNav', 'sidebar'], ['StateSkeleton', 'skeleton'], ['StateStarRating', 'rating'],
  ['StateStatusPill', 'status_pill'], ['StateStepBar', 'stepper'], ['StateTabsBar', 'tabs'],
  ['StateTimeline', 'timeline'], ['StateTipCallout', 'tooltip'], ['StateToolbar', 'toolbar'],
];
const NAMES = WRAPPERS.map((w) => w[0]);

function stateValues(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) stateValues(child, found);
  return found;
}

test('legacy state wrappers propagate five states into IR', () => {
  assert.equal(NAMES.length, 33, `expected 33 wrappers, found ${NAMES.length}`);
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-state-wrappers-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [name] of WRAPPERS) {
      for (const state of STATES) {
        const src = path.join(tmp, `${name}-${state}.opu`);
        const ir = path.join(tmp, `${name}-${state}.json`);
        const imports = [...new Set(WRAPPERS.map(([, m]) => m))].map((m) => `import "components/${m}.opu";`).join('\n');
        writeFileSync(src, `import "components/state_wrappers.opu";
${imports}
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${name}("${state}")
}
`);
        const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(c.status, 0, `${name} ${state} compile failed: ${c.stderr}`);
        const emitted = stateValues(JSON.parse(readFileSync(ir, 'utf8')).tree);
        assert.ok(emitted.includes(state), `${name} ${state} did not reach IR: ${JSON.stringify(emitted)}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
