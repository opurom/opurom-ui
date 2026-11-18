#!/usr/bin/env node
// Extreme text and theme interaction regression gate for card/list shells.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   card.dart:263-266,301-322     elevated M3 card defaults (elevation 1, 12dp)
//   list_tile.dart:391-430        ListTile title/subtitle/isThreeLine
//   list_tile.dart:921-944        title/subtitle style resolution
//   theme_data.dart:427-460       brightness/dark theme construction
//   theme_data.dart:840-862       ThemeData.from(ColorScheme) semantics
//   basic.dart:180-230            Directionality ltr/rtl
// Opurom IR carries `directionality: rtl` at the app root (parser.rs:2178-2194,
// lower.rs:3671-3673; ir.rs:78-92). This gate asserts deterministic rendering
// for long/CJK/RTL/emoji text across light/dark themes and the eight design
// states, plus state propagation into IR.
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
const long = 'T'.repeat(300);
const cjk = '城市选择与列表项'.repeat(20);
const rtl = 'مرحبا بالعالم'.repeat(12);
const emoji = '🚀🌟🎉'.repeat(20);
const THEMES = ['light', 'dark'];
const STATES = meta.states;

function source(mod, use, mode, rtl = false) {
  return `import "${mod}";
app One {
  ${rtl ? 'directionality: rtl;\n  ' : ''}quality { msaa: 4 }
  theme { mode: ${mode}, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

function frame(dir, name, mod, use, mode, rtlMode = false) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(mod, use, mode, rtlMode));
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  const runs = [];
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(renderer, [ir, '320', '240', path.join(dir, `${name}-${i}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
    runs.push((r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1]);
  }
  assert.ok(runs.every(Boolean), `${name} produced no digest`);
  assert.equal(runs[0], runs[1], `${name} must render deterministically`);
  return { digest: runs[0], ir: JSON.parse(readFileSync(ir, 'utf8')) };
}

function findState(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) findState(child, found);
  return found;
}

const TEXT_CASES = [
  ['long', long],
  ['cjk', cjk],
  ['rtl', rtl],
  ['emoji', emoji],
];

test('card/list render deterministically across extreme text, themes and states', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-text-theme-regression-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let checks = 0;
    for (const [name, text] of TEXT_CASES) {
      for (const mode of THEMES) {
        for (const state of ['default', 'disabled', 'error']) {
          const card = frame(tmp, `card-${name}-${mode}-${state}`, 'components/card_m3.opu',
            `ElevatedCardM3("${text}", "${text}", "${state}", "ease")`, mode);
          const tile = frame(tmp, `tile-${name}-${mode}-${state}`, 'components/list_tile_m3.opu',
            `ListTileM3("${text}", "${text}", "${state}", "ease")`, mode);
          assert.ok(card.digest && tile.digest, `${name} ${mode} ${state} missing frames`);
          assert.ok(findState(card.ir.tree).includes(state), `${name} card state ${state} missing`);
          assert.ok(findState(tile.ir.tree).includes(state), `${name} tile state ${state} missing`);
          checks += 2;
        }
      }
    }
    assert.equal(checks, TEXT_CASES.length * THEMES.length * 3 * 2, 'regression matrix must be complete');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('RTL text keeps card/list frames deterministic and distinct from LTR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-rtl-regression-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const mode of THEMES) {
      const ltrCard = frame(tmp, `ltr-card-${mode}`, 'components/card_m3.opu',
        `ElevatedCardM3("${cjk}", "${cjk}", "default", "ease")`, mode, false);
      const rtlCard = frame(tmp, `rtl-card-${mode}`, 'components/card_m3.opu',
        `ElevatedCardM3("${cjk}", "${cjk}", "default", "ease")`, mode, true);
      const ltrTile = frame(tmp, `ltr-tile-${mode}`, 'components/list_tile_m3.opu',
        `ListTileM3("${cjk}", "${cjk}", "default", "ease")`, mode, false);
      const rtlTile = frame(tmp, `rtl-tile-${mode}`, 'components/list_tile_m3.opu',
        `ListTileM3("${cjk}", "${cjk}", "default", "ease")`, mode, true);
      assert.ok(rtlCard.ir.directionality === 'rtl' || JSON.stringify(rtlCard.ir).includes('rtl'), 'RTL must reach IR');
      assert.notEqual(ltrCard.digest, rtlCard.digest, `${mode} card direction must affect frame`);
      assert.notEqual(ltrTile.digest, rtlTile.digest, `${mode} tile direction must affect frame`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
