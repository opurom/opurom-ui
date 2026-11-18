#!/usr/bin/env node
// Picker extreme-sizing and page-state consistency gate.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   date_picker.dart:196-215        showDatePicker parameters/entry mode
//   date_picker.dart:228-244        date range/ordering assertions
//   date_picker.dart:1167-1243      showDateRangePicker ordering assertions
//   time_picker.dart:3246-3290      showTimePicker parameters and labels
//   time_picker.dart:1703-1717,2003 errorInvalidText contract
//   date_picker.dart:3277-3292,3374-3384  range start/end error propagation
//   motion.dart:52                  200ms short4 state duration
// Opurom picker shells compile literal value slots; DateTime conversion and
// routes stay reserved (A3/A4/B3/B4). This gate proves deterministic
// compilation/rendering for extreme sizes, empty data and long labels, that
// the eight design states reach IR across all picker families, and that page
// level empty/error views use the same state vocabulary as the pickers.
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
const long = 'L'.repeat(240);
const VIEWPORTS = [[240, 240], [320, 240], [1600, 900]];

const EXTREMES = [
  ['date-zero', 'components/pickers_m3.opu', 'DatePickerM3("", 0, "disabled", "ease")', 240],
  ['date-over', 'components/pickers_m3.opu', `DatePickerM3("${long}", 999999, "error", "ease")`, 1600],
  ['time-zero', 'components/pickers_m3.opu', 'TimePickerM3("", 0, "disabled", "ease")', 240],
  ['time-over', 'components/pickers_m3.opu', `TimePickerM3("${long}", 999999, "error", "ease")`, 1600],
  ['range-zero', 'components/date_range_m3.opu', 'DateRangePickerM3("", 0, 0, "disabled", "ease")', 240],
  ['range-inverted', 'components/date_range_m3.opu', `DateRangePickerM3("${long}", 999999, -999999, "error", "ease")`, 1600],
  ['datetime-zero', 'components/datetime_picker_m3.opu', 'DateTimePickerM3("", 0, 0, "loading", "ease")', 240],
  ['datetime-over', 'components/datetime_picker_m3.opu', `DateTimePickerM3("${long}", 999999, 999999, "success", "ease")`, 1600],
  ['color-empty', 'components/pickers_m3.opu', 'ColorPickerM3("", -1, "error", "ease")', 240],
  ['region-empty', 'components/pickers_m3.opu', 'RegionPickerM3("", 999999, "disabled", "ease")', 240],
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

function render(dir, name, mod, use, view) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(mod, use));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  if (c.status !== 0) console.error('FAILED SOURCE:\n' + readFileSync(src, 'utf8'));
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const runs = [];
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(renderer, [ir, String(view[0]), String(view[1]), path.join(dir, `${name}-${i}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
    runs.push((r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1]);
  }
  assert.ok(runs.every(Boolean), `${name} produced no digest`);
  assert.equal(runs[0], runs[1], `${name} must render deterministically`);
  return { ir: JSON.parse(readFileSync(ir, 'utf8')), digest: runs[0] };
}

function findState(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) findState(child, found);
  return found;
}

test('picker extremes compile and render deterministically across viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-picker-extremes-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const digests = EXTREMES.map(([name, mod, use, w]) => render(tmp, name, mod, use, [w, 240]).digest);
    assert.equal(new Set(digests).size, EXTREMES.length, `distinct frames expected: ${digests.join(',')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('all eight states reach IR for every picker family at extreme sizes', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-picker-state-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const families = [
      ['date', 'components/pickers_m3.opu', v => `DatePickerM3("Date", ${v}, "{s}", "ease")`],
      ['time', 'components/pickers_m3.opu', v => `TimePickerM3("Time", ${v}, "{s}", "ease")`],
      ['color', 'components/pickers_m3.opu', v => `ColorPickerM3("Color", ${v}, "{s}", "ease")`],
      ['region', 'components/pickers_m3.opu', v => `RegionPickerM3("Region", ${v}, "{s}", "ease")`],
      ['range', 'components/date_range_m3.opu', v => `DateRangePickerM3("Range", ${v}, ${v + 1}, "{s}", "ease")`],
      ['datetime', 'components/datetime_picker_m3.opu', v => `DateTimePickerM3("When", ${v}, ${v}, "{s}", "ease")`],
    ];
    for (const [name, mod, build] of families) {
      for (const state of meta.states) {
        const src = path.join(tmp, `${name}-${state}.opu`);
        const ir = path.join(tmp, `${name}-${state}.json`);
        writeFileSync(src, source(mod, build(999999).replace('{s}', state)));
        const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(c.status, 0, `${name} ${state} compile failed: ${c.stderr}`);
        const states = findState(JSON.parse(readFileSync(ir, 'utf8')).tree);
        assert.ok(states.includes(state), `${name} ${state} missing from IR: ${JSON.stringify(states)}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('page empty and error views use the same state vocabulary as pickers', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-page-state-x-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const imports = 'components/feedback_m3.opu';
    const empty = render(tmp, 'page-empty', imports,
      'EmptyStateM3("folder", "Nothing here", "Add an item", "default", "ease")', VIEWPORTS[1]);
    const error = render(tmp, 'page-error', imports,
      'ErrorViewM3("Failed", "Try again", "error", "ease")', VIEWPORTS[1]);
    assert.ok(findState(empty.ir.tree).includes('default'), 'empty view must carry default state');
    assert.ok(findState(error.ir.tree).includes('error'), 'error view must carry error state');
    assert.notEqual(empty.digest, error.digest, 'empty and error frames must differ');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
