// Signature-derived component API diagnostic matrix.
// Flutter stable 3.50.0 (ab291203) source anchors:
//   widgets/app.dart:1009-1038        WidgetState vocabulary (default/hovered/
//                                     pressed/focused/disabled)
//   material/card.dart:80-89          Card constructor contract
//   material/list_tile.dart:391-430   ListTile constructor contract
//   material/date_picker.dart:196-215 showDatePicker required parameters
//   material/time_picker.dart:3246-3290 showTimePicker required initialTime
//   material/autocomplete.dart:61-68  Autocomplete required optionsBuilder
// Opurom compiler diagnostics (pinned binary, sources):
//   opurom-lang/src/typecheck.rs:155,171-180  parameter type mismatch message
//   opurom-lang/src/lower.rs:1581-1594        animate keyword vocabulary
//   opurom-lang/src/lower.rs:314              gesture vocabulary
//   opurom-lang/src/lower.rs:1226             icon name vocabulary
//   opurom-lang/tests/cli.rs:7849-7890        design-value rejection contract
// Every component signature in components/*.opu is parsed and turned into
// generated invalid programs: too few arguments, too many arguments, a wrong
// parameter type, an unknown design state and an unknown animate keyword. Each
// one must fail closed with a typed diagnostic that names the component and the
// expectation, carry help text, never panic and never write an IR artifact.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  TYPE_LITERAL,
  TYPE_NAME,
  WRONG_LITERAL,
  WRONG_NAME,
  componentIndex,
  effectiveProps,
  literalsFor,
  moduleEdges,
  modulesFor,
  parseComponents,
  program,
} from './component-model.mjs';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const componentsDir = path.join(root, 'components');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);

const PANIC_MARKERS = ['panicked', 'RUST_BACKTRACE', 'stack overflow', 'internal compiler error'];
const STATE_VOCABULARY = 'default, hover, active, focus, disabled, loading, success, error';

const components = parseComponents(componentsDir);
const byName = componentIndex(components);
const edges = moduleEdges(components);
const effective = effectiveProps(components);

function slotsReaching(component, prop) {
  const props = effective.get(component.name) ?? new Map();
  return component.params.map((p, i) => (props.get(p.name)?.has(prop) ? i : -1)).filter((i) => i >= 0);
}

function compileCase(tmp, name, modules, use) {
  const src = path.join(tmp, `${name}.opu`);
  const ir = path.join(tmp, `${name}.json`);
  writeFileSync(src, program(modules, use));
  const run = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stderr}\n${run.stdout}`, artifact: existsSync(ir) };
}

function assertFailsClosed(result, pattern, label) {
  assert.notEqual(result.status, 0, `${label} must fail compilation`);
  assert.match(result.output, pattern, `${label} diagnostic drifted`);
  assert.match(result.output, /error:/, `${label} diagnostic must be typed as an error`);
  assert.match(result.output, /help:/, `${label} diagnostic must carry help text`);
  for (const marker of PANIC_MARKERS) {
    assert.ok(!result.output.includes(marker), `${label} must not panic (${marker})`);
  }
  assert.ok(!result.artifact, `${label} must not write an IR artifact`);
}

test('the module set parses into unique, non-empty component signatures', () => {
  assert.ok(components.length >= 180, `expected at least 180 components, found ${components.length}`);
  assert.equal(byName.size, components.length, 'component names must be unique across modules');
  for (const component of components) {
    assert.ok(component.params.length > 0, `${component.name} must declare parameters`);
    for (const param of component.params) {
      assert.ok(TYPE_LITERAL[param.type], `${component.name}.${param.name} has unsupported type ${param.type}`);
    }
  }
});

test('every component rejects a wrong argument count without writing an artifact', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-api-arity-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    for (const component of components) {
      const modules = modulesFor(component, edges);
      const arity = component.params.length;
      const literals = literalsFor(component, effective);
      const missing = compileCase(tmp, `m-${component.name}`, modules, `${component.name}()`);
      assertFailsClosed(missing, new RegExp(`expects ${arity} arguments?, found 0`), `${component.name} missing args`);
      assert.ok(missing.output.includes(component.name), `${component.name} diagnostic must name the component`);
      const extra = compileCase(tmp, `e-${component.name}`, modules, `${component.name}(${literals.join(', ')}, "x")`);
      assertFailsClosed(extra, new RegExp(`expects ${arity} arguments?, found ${arity + 1}`), `${component.name} extra args`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('every component rejects a wrong parameter type with a typed diagnostic', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-api-types-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    for (const component of components) {
      const modules = modulesFor(component, edges);
      const first = component.params[0];
      const literals = literalsFor(component, effective);
      literals[0] = WRONG_LITERAL[first.type];
      const result = compileCase(tmp, `t-${component.name}`, modules, `${component.name}(${literals.join(', ')})`);
      const pattern = new RegExp(`parameter '${first.name}' of component '${component.name}' expects ${TYPE_NAME[first.type]}, found ${WRONG_NAME[first.type]}`);
      assertFailsClosed(result, pattern, `${component.name} wrong type`);
      assert.ok(result.output.includes(`pass a ${TYPE_NAME[first.type]} literal`), `${component.name} help must name the expected type`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('every state-forwarding component rejects an unknown design state', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-api-state-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const component of components) {
      const slots = slotsReaching(component, 'state');
      if (slots.length === 0) continue;
      const index = slots[0];
      audited += 1;
      const modules = modulesFor(component, edges);
      const literals = literalsFor(component, effective);
      literals[index] = '"bogus"';
      const result = compileCase(tmp, `s-${component.name}`, modules, `${component.name}(${literals.join(', ')})`);
      assertFailsClosed(result, /unknown state value 'bogus'/, `${component.name} unknown state`);
      assert.ok(result.output.includes(STATE_VOCABULARY), `${component.name} help must list the state vocabulary`);
    }
    assert.ok(audited >= 80, `expected at least 80 state-forwarding components, found ${audited}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('every animate-forwarding component rejects an unknown animate keyword', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-api-animate-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const component of components) {
      const slots = slotsReaching(component, 'animate');
      if (slots.length === 0) continue;
      const index = slots[0];
      audited += 1;
      const modules = modulesFor(component, edges);
      const literals = literalsFor(component, effective);
      literals[index] = '"bogus"';
      const result = compileCase(tmp, `a-${component.name}`, modules, `${component.name}(${literals.join(', ')})`);
      assertFailsClosed(result, /unknown animate value 'bogus'/, `${component.name} unknown animate`);
    }
    assert.ok(audited >= 70, `expected at least 70 animate-forwarding components, found ${audited}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('unknown component names are rejected with a declaration hint', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-api-unknown-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    const result = compileCase(tmp, 'unknown', ['components/pickers_m3.opu'], 'NotAComponentM3("x")');
    assertFailsClosed(result, /unknown component 'NotAComponentM3'/, 'unknown component');
    assert.ok(result.output.includes("declare it with 'component"), 'unknown component diagnostic must hint the declaration');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
