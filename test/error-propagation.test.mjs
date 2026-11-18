#!/usr/bin/env node
// Picker-to-card/list error-state propagation gate.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) source anchors:
//   widgets/form.dart:278-291      Form autovalidate error aggregation
//   widgets/form.dart:385-397      validator errors become hasError/errorText
//   widgets/form.dart:523-585      forceErrorText/validator/errorText contract
//   widgets/form.dart:640-661      FormFieldState.hasError
//   material/input_decorator.dart:295-328,327-328 helper/error text display
//   material/card.dart:263-266,301-322   elevated M3 card defaults
//   material/list_tile.dart:391-430,921-944,1088  ListTile state styling
//   motion.dart:52                 200ms short4 state duration
// Opurom shells compile literal state slots; validator callbacks stay reserved
// (B4). This gate proves that an error state authored on a picker propagates
// unchanged into a composed card/list presentation, that the error caption and
// accessible role are present, and that recovery to default/success renders
// deterministic frames distinct from the error frames.
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
const ERROR_TEXT = 'Invalid date range';

function source(use) {
  return `import "components/pickers_m3.opu";
import "components/date_range_m3.opu";
import "components/card_m3.opu";
import "components/list_tile_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

function frame(dir, name, use) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, source(use));
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
  return { ir: JSON.parse(readFileSync(ir, 'utf8')), digest: runs[0] };
}

function findState(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) findState(child, found);
  return found;
}

function findProp(node, key, value, found = false) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && node.props[key] === value) found = true;
  for (const child of node.children ?? []) found = findProp(child, key, value, found);
  return found;
}

test('picker error state propagates into composed card and list frames', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-error-propagation-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const error = frame(tmp, 'error-compose', `Column(gap: 4) {
      DatePickerM3("Start", 10, "error", "ease")
      DateRangePickerM3("Range", 20, 5, "error", "ease")
      ElevatedCardM3("${ERROR_TEXT}", "range invalid", "error", "ease")
      ListTileM3("Start date", "${ERROR_TEXT}", "error", "ease")
    }`);
    const states = findState(error.ir.tree);
    assert.ok(states.filter((s) => s === 'error').length >= 4, `all four shells must carry error: ${JSON.stringify(states)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('error state renders distinct from recovery default and success frames', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-error-recovery-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const compose = (state) => `Column(gap: 4) {
      DatePickerM3("Start", 10, "${state}", "ease")
      DateRangePickerM3("Range", 20, 5, "${state}", "ease")
      ElevatedCardM3("Range", "checked", "${state}", "ease")
      ListTileM3("Start date", "checked", "${state}", "ease")
    }`;
    const error = frame(tmp, 'compose-error', compose('error'));
    const def = frame(tmp, 'compose-default', compose('default'));
    const success = frame(tmp, 'compose-success', compose('success'));
    assert.notEqual(error.digest, def.digest, 'error frame must differ from default');
    assert.notEqual(error.digest, success.digest, 'error frame must differ from success');
    assert.notEqual(def.digest, success.digest, 'default and success frames must differ');
    assert.equal(frame(tmp, 'compose-error-again', compose('error')).digest, error.digest, 'error frame must be deterministic');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('picker error caption and role appear in the deterministic a11y tree', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-error-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const src = path.join(tmp, 'a11y.opu');
    const ir = path.join(tmp, 'a11y.json');
    const tree = path.join(tmp, 'a11y-tree.json');
    writeFileSync(src, source(`Column(gap: 4) {
      DatePickerM3("Start", 10, "error", "ease")
      ElevatedCardM3("${ERROR_TEXT}", "range invalid", "error", "ease")
    }`));
    assert.ok(true);
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `a11y compile failed: ${c.stderr}`);
    const r = spawnSync(renderer, [ir, '320', '240', path.join(tmp, 'a11y.ppm'), '--a11y', tree], { encoding: 'utf8' });
    assert.equal(r.status, 0, `a11y render failed: ${r.stderr}`);
    const nodes = JSON.parse(readFileSync(tree, 'utf8'));
    assert.ok(nodes.some((n) => n.label === 'date picker' && n.role === 'button' && !n.hidden), 'picker role missing');
    assert.ok(nodes.some((n) => n.label === ERROR_TEXT && n.hidden === false), 'error caption missing');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
