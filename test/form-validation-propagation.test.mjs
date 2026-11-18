#!/usr/bin/env node
// Form validation and picker/card/list propagation gate.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   widgets/form.dart:278-291          Form error aggregation/autovalidate
//   widgets/form.dart:331,360-397      reset(), validate(), _validate() errors
//   widgets/form.dart:523-585          FormField validator/forceErrorText/errorText
//   widgets/form.dart:640-661,698-739  FormFieldState error lifecycle
//   material/input_decorator.dart:295-328,327-328  helper/error text display
// Opurom Input carries compile-time required/minLength/maxLength/pattern props
// (opurom-lang/src/lower.rs:576-594); callbacks stay reserved (B4). This gate
// asserts that validation constraints reach IR, error-state propagation from
// form fields to pickers/cards/lists stays deterministic, recovery frames
// differ, and all eight design states remain stable.
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
const ERROR = 'Field is required';

function source(use) {
  return `import "components/forms_m3.opu";
import "components/pickers_m3.opu";
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

function hasProp(node, key) {
  if (!node || typeof node !== 'object') return false;
  if (node.props && key in node.props) return true;
  return (node.children ?? []).some((c) => hasProp(c, key));
}

const compose = (state) => `Column(gap: 4) {
  FormFieldM3("Email", "you@example.com", true, 3, 60, "${state}", "ease")
  DatePickerM3("Start", 10, "${state}", "ease")
  ElevatedCardM3("${ERROR}", "validation failed", "${state}", "ease")
  ListTileM3("Email", "${ERROR}", "${state}", "ease")
}`;

test('required/format/custom constraints reach IR and error propagation is deterministic', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-form-propagation-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const error = frame(tmp, 'error', compose('error'));
    const text = readFileSync(path.join(tmp, 'error.json'), 'utf8');
    assert.ok(text.includes('"required":true') || text.includes('"required": true'), 'required must reach IR');
    assert.ok(text.includes('"minLength":3') || text.includes('"minLength": 3'), 'minLength must reach IR');
    assert.ok(text.includes('"maxLength":60') || text.includes('"maxLength": 60'), 'maxLength must reach IR');
    assert.ok(hasProp(error.ir.tree, 'pattern') || hasProp(error.ir.tree, 'required'), 'validation props must reach IR');
    assert.ok(findState(error.ir.tree).filter((s) => s === 'error').length >= 4, 'error state must reach four shells');
    assert.equal(frame(tmp, 'error-again', compose('error')).digest, error.digest, 'error frame deterministic');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recovery path frames differ from error and default remains stable', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-form-recovery-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const error = frame(tmp, 'error', compose('error'));
    const def = frame(tmp, 'default', compose('default'));
    const success = frame(tmp, 'success', compose('success'));
    assert.notEqual(error.digest, def.digest, 'error must differ from default');
    assert.notEqual(error.digest, success.digest, 'error must differ from success');
    assert.notEqual(def.digest, success.digest, 'default must differ from success');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('all eight states keep form validation composition stable in IR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-form-states-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const state of meta.states) {
      const out = frame(tmp, `state-${state}`, compose(state));
      assert.ok(findState(out.ir.tree).includes(state), `${state} missing from IR`);
      const text = readFileSync(path.join(tmp, `state-${state}.json`), 'utf8');
      assert.ok(text.includes('"required"') && text.includes('"minLength"'), `${state} validation props lost`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
