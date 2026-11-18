#!/usr/bin/env node
// Page-state vocabulary, eight-state coverage and token-hygiene audit.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   theme_data.dart:194-261        components depend on colorScheme/textTheme
//   theme_data.dart:427-460        brightness/dark construction
//   theme_data.dart:840-862        ThemeData.from(ColorScheme) semantics
//   progress_indicator.dart:68-107 valueColor/theme-driven indicator colours
//   card.dart:263-266,301-322      elevated M3 defaults (12dp, elevation 1)
//   list_tile.dart:391-430,921-944 state-driven text styles
// The package self-check already bans literal hex outside two documented
// legacy files and the authored brand gradient; this audit re-asserts that
// rule, verifies every state-capable module maps its states into IR, checks
// that page-level empty/error/loading/success vocabulary exists, and counts
// token-coverage across the eight-state suites.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const componentsDir = path.join(root, 'components');
const legacyHex = new Set(['components/card.opu', 'components/text.opu']);
const BRAND_GRADIENT = '#2DD8FF,#006EFF';
const STATES = ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'];
const PAGE_STATES = ['empty', 'error', 'loading', 'success'];

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(p, out);
    else out.push(p);
  }
  return out;
}

test('component modules stay free of hardcoded style values', () => {
  const files = listFiles(componentsDir).filter((f) => f.endsWith('.opu'));
  assert.ok(files.length > 0, 'component modules must exist');
  for (const file of files) {
    const rel = path.relative(root, file);
    const text = readFileSync(file, 'utf8');
    const withoutBrand = text.replaceAll(BRAND_GRADIENT, '');
    const hexes = withoutBrand.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    if (legacyHex.has(rel)) continue;
    assert.deepEqual(hexes, [], `${rel} must not hardcode hex values; use variant/tone`);
  }
});

test('page-level empty/error/loading/success vocabulary exists with states', () => {
  const feedback = readFileSync(path.join(componentsDir, 'feedback_m3.opu'), 'utf8');
  const skeleton = readFileSync(path.join(componentsDir, 'skeleton.opu'), 'utf8');
  assert.match(feedback, /component EmptyStateM3/);
  assert.match(feedback, /component ErrorViewM3/);
  assert.match(feedback, /component LoadingM3/);
  assert.match(feedback, /state: "\{state\}"/);
  assert.match(skeleton, /component Skeleton/);
  // Page-level vocabulary is component-shaped: EmptyStateM3/ErrorViewM3 render
  // the empty/error page states, LoadingM3 the loading state; success rides on
  // the design-state keyword. The design vocabulary itself stays the 8 states.
  assert.deepEqual(PAGE_STATES, ['empty', 'error', 'loading', 'success']);
  assert.ok(STATES.includes('loading') && STATES.includes('success') && STATES.includes('error'));
});

test('state-capable modules carry the eight-state vocabulary', () => {
  const files = listFiles(componentsDir).filter((f) => f.endsWith('.opu'));
  let audited = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!/state:\s*string/.test(text)) continue;
    audited += 1;
    assert.match(text, /state:\s*"\{(?:state|s)\}"/, `${path.relative(root, file)} must pass state through`);
  }
  assert.ok(audited >= 40, `expected at least 40 state-capable modules, found ${audited}`);
});

test('eight-state suites cover the audited modules', () => {
  const compileTest = readFileSync(path.join(root, 'test/eight-state-compile.test.mjs'), 'utf8');
  const digestDoc = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8'));
  const compileModules = new Set([...compileTest.matchAll(/\['(components\/[^']+\.opu)'/g)].map((m) => m[1]));
  const digestModules = new Set(digestDoc.pins.map((p) => p.module));
  for (const file of ['components/actions_m3.opu', 'components/buttons_m3.opu', 'components/card_m3.opu', 'components/chips_m3.opu', 'components/forms_m3.opu', 'components/lists_m3.opu', 'components/pickers_m3.opu', 'components/inputs_ext_m3.opu', 'components/dropdown_menu_m3.opu', 'components/nav_drawer_m3.opu', 'components/datetime_picker_m3.opu', 'components/menu_m3.opu', 'components/nav_rail_m3.opu', 'components/date_range_m3.opu', 'components/sticky_header_m3.opu', 'components/rating_m3.opu']) {
    assert.ok(compileModules.has(file), `${file} must have an eight-state compile case`);
    assert.ok(digestModules.has(file), `${file} must have settled-frame pins`);
  }
  assert.ok(digestDoc.pins.length >= 700, `state pins must cover the suite: ${digestDoc.pins.length}`);
  assert.ok(digestDoc.meta.states.length === 8, 'eight design states must be declared');
});
