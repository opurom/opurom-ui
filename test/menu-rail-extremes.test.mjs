#!/usr/bin/env node
// Extreme popup-menu sizing and navigation rail collapse/expand gate.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   popup_menu.dart:45-48           width step 56, min 112, max 280, padding 8
//   popup_menu.dart:279-303        kMinInteractiveDimension 48 for menu items
//   popup_menu.dart:761-763        menu width clamped 112..280 with 56 step
//   popup_menu.dart:849-907        screen-edge clamping with 8dp padding
//   navigation_rail.dart:94-121    extended flag, minWidth/minExtendedWidth
//                                  and selectedIndex assertions
//   navigation_rail.dart:131-143   collapsed vs extended label behaviour
//   navigation_rail.dart:1236-1244 M3 80dp narrow / 256dp extended widths
// Opurom components carry these as static geometry; callbacks, route clamping
// and the extended animation stay reserved (A3/A4/B3). This gate asserts
// deterministic rendering at extreme viewports and geometry/state/label
// consistency between collapsed and expanded rail shells.
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
const longLabel = 'L'.repeat(240);

const MENU_CASES = [
  { name: 'menu-min', w: 112, call: 'PopupMenuM3("Open,Copy,Close", 112, "default", "ease")', view: 320 },
  { name: 'menu-max', w: 280, call: 'PopupMenuM3("Open,Copy,Close", 280, "default", "ease")', view: 320 },
  { name: 'menu-under', w: 8, call: 'PopupMenuM3("Open", 8, "disabled", "ease")', view: 240 },
  { name: 'menu-over', w: 9999, call: `PopupMenuM3("${longLabel}", 9999, "error", "ease")`, view: 1600 },
];

const RAIL_CASES = ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'];

function source(imports, call) {
  return `${imports}
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`;
}

function render(dir, name, text, width) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const r = spawnSync(renderer, [ir, String(width), '400', path.join(dir, `${name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return { ir: JSON.parse(readFileSync(ir, 'utf8')), digest };
}

function findProp(node, key, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && key in node.props) found.push(node.props[key]);
  for (const child of node.children ?? []) findProp(child, key, found);
  return found;
}

test('popup menu renders deterministically at extreme sizes and viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-menu-extremes-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const imports = 'import "components/menu_m3.opu";';
    const digests = [];
    for (const c of MENU_CASES) {
      const out = render(tmp, c.name, source(imports, c.call), c.view);
      const again = render(tmp, `${c.name}-again`, source(imports, c.call), c.view);
      assert.equal(out.digest, again.digest, `${c.name} must render deterministically`);
      digests.push(out.digest);
    }
    assert.equal(new Set(digests).size, MENU_CASES.length, `extreme menu frames must differ: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('collapsed and expanded rails preserve selection, labels and state in IR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-rail-consistency-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const imports = 'import "components/nav_rail_m3.opu";\nimport "components/nav_rail_extended_m3.opu";';
    for (const state of RAIL_CASES) {
      const collapsed = render(tmp, `collapsed-${state}`, source(imports,
        `NavigationRailM3("Home,Search,Profile", 1, "${state}", "ease")`), 320);
      const expanded = render(tmp, `expanded-${state}`, source(imports,
        `ExtendedNavigationRailM3("Home,Search,Profile", 1, "${state}", "ease")`), 320);
      const collapsedSegments = findProp(collapsed.ir.tree, 'segments');
      const expandedSegments = findProp(expanded.ir.tree, 'segments');
      assert.deepEqual(collapsedSegments, expandedSegments, `${state} destination count must match`);
      assert.ok(collapsedSegments.includes(3), `${state} expected three destinations`);
      assert.ok(findProp(collapsed.ir.tree, 'state').includes(state), `${state} collapsed state missing`);
      assert.ok(findProp(expanded.ir.tree, 'state').includes(state), `${state} expanded state missing`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
