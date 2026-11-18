#!/usr/bin/env node
// Component parameter value-domain gate.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) source anchors:
//   material/progress_indicator.dart:48-90  determinate value 0.0..1.0
//   material/progress_indicator.dart:414-440 LinearProgressIndicator props
//   material/date_picker.dart:196-215        initialDate/firstDate/lastDate
//   material/text_field.dart:363-366         TextField text constraints
//   material/list_tile.dart:391-430         ListTile title/subtitle text
//   material/chip.dart:118-158               Chip label text constraints
// Opurom keeps the authored value in the IR and never interprets it at
// runtime: the compiler carries an integer slot verbatim, the renderer draws
// it. This gate pins that contract at the edges of the value domain:
//   * every integer slot accepts the 32-bit extremes and reaches the IR
//     unchanged, with no clamping or truncation at compile time;
//   * every free-form string slot accepts an empty and a 10 000 character
//     string and reaches the IR unchanged;
//   * a literal outside the compiler's integer domain is rejected with a
//     typed diagnostic and writes no artifact;
//   * a value outside the renderer's numeric domain fails closed with a
//     typed renderer error instead of a panic;
//   * extreme values render deterministically, also on a tiny viewport.
// The renderer's integer percent mapping (opurom-render/src/ir.rs:930-936)
// and the extended-primitive value contract
// (opurom-render/src/primitives/contracts.rs:204-208) are open kernel gaps
// tracked with the render kernel owner; this gate does not assert them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  componentIndex,
  effectiveProps,
  isFreeString,
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
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);

const PANIC_MARKERS = ['panicked', 'RUST_BACKTRACE', 'stack overflow', 'internal compiler error'];
const INT_MAX = 2147483647;
const INT_MIN = -2147483648;
const LONG_TEXT = 'L'.repeat(10000);
const components = parseComponents(componentsDir);
const byName = componentIndex(components);
const edges = moduleEdges(components);
const effective = effectiveProps(components);

function compileCase(tmp, name, modules, use) {
  const src = path.join(tmp, `${name}.opu`);
  const ir = path.join(tmp, `${name}.json`);
  writeFileSync(src, program(modules, use));
  const run = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  return {
    status: run.status,
    output: `${run.stderr}\n${run.stdout}`,
    artifact: existsSync(ir) ? readFileSync(ir, 'utf8') : null,
  };
}

function renderCase(tmp, name, irPath, width = '320', height = '240') {
  const runs = [];
  for (let i = 0; i < 2; i++) {
    const run = spawnSync(renderer, [irPath, width, height, path.join(tmp, `${name}-${i}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
    runs.push({ status: run.status, output: `${run.stderr}\n${run.stdout}` });
  }
  return runs;
}

function literalsWith(component, index, literal) {
  const literals = literalsFor(component, effective);
  literals[index] = literal;
  return literals;
}

function intSlots(component) {
  return component.params.map((p, i) => (p.type === 'int' ? i : -1)).filter((i) => i >= 0);
}

function freeStringSlots(component) {
  return component.params.map((p, i) => (p.type === 'string' && isFreeString(component, p, effective) ? i : -1)).filter((i) => i >= 0);
}

test('every authored Example call compiles against the current API', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-doc-example-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    const byName = componentIndex(components);
    for (const file of readdirSync(componentsDir).filter((f) => f.endsWith('.opu'))) {
      const raw = readFileSync(path.join(componentsDir, file), 'utf8');
      for (const component of components.filter((c) => c.file === `components/${file}`)) {
        const index = raw.indexOf(`component ${component.name}(`);
        if (index === -1) continue;
        const before = raw.slice(0, index);
        const example = [...before.matchAll(/\/\/.*Example\s+([A-Za-z_][A-Za-z0-9_]*)\(([^\n]*?)\)\s*$/g)].at(-1);
        if (!example) continue;
        audited += 1;
        const callee = byName.get(example[1]);
        assert.ok(callee, `${component.file} Example calls unknown component ${example[1]}`);
        assert.equal(callee.name, component.name, `${component.file} Example for ${component.name} calls ${callee.name}`);
        const src = path.join(tmp, 'example.opu');
        const ir = path.join(tmp, 'example.json');
        writeFileSync(src, program(modulesFor(callee, edges), `${example[1]}(${example[2]})`));
        const result = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
        assert.equal(result.status, 0, `${component.file} Example must compile: ${result.stderr}`);
      }
    }
    assert.ok(audited >= 90, `expected at least 90 authored Examples, found ${audited}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('no component declares a parameter that its body never uses', () => {
  const dead = [];
  for (const component of components) {
    for (const param of component.params) {
      if (!new RegExp(`\\b${param.name}\\b`).test(component.body)) {
        dead.push(`${component.name}.${param.name} (${component.file})`);
      }
    }
  }
  assert.deepEqual(dead, [], 'a declared parameter must reach the IR or be removed from the API');
});

test('integer slots carry the 32-bit extremes into the IR unchanged', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-value-int-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    let carried = 0;
    let rejected = 0;
    for (const component of components) {
      const slots = intSlots(component);
      if (slots.length === 0) continue;
      const modules = modulesFor(component, edges);
      for (const slot of slots) {
        for (const value of [INT_MAX, INT_MIN]) {
          const result = compileCase(tmp, `i-${component.name}-${slot}-${value}`, modules, `${component.name}(${literalsWith(component, slot, String(value)).join(', ')})`);
          if (result.status === 0) {
            assert.ok(result.artifact, `${component.name} with ${value} must write an IR artifact`);
            assert.ok(result.artifact.includes(String(value)), `${component.name} must carry ${value} into the IR unchanged`);
            carried += 1;
            continue;
          }
          // A slot that crosses another slot's bound (minLength against
          // maxLength) is rejected by the compiler, not clamped.
          assert.match(result.output, /error:/, `${component.name} with ${value} must fail with a typed error`);
          assert.match(result.output, /help:/, `${component.name} with ${value} must carry help text`);
          for (const marker of PANIC_MARKERS) {
            assert.ok(!result.output.includes(marker), `the compiler must not panic (${marker})`);
          }
          assert.equal(result.artifact, null, `${component.name} with ${value} must not write an IR artifact`);
          rejected += 1;
        }
      }
    }
    assert.ok(carried >= 60, `expected at least 60 integer slot carries, found ${carried}`);
    assert.ok(rejected >= 1, 'the cross-slot bound must be rejected instead of clamped');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('free-form string slots carry empty and very long text into the IR unchanged', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-value-string-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    let checked = 0;
    for (const component of components) {
      const slots = freeStringSlots(component);
      if (slots.length === 0) continue;
      const modules = modulesFor(component, edges);
      for (const [label, literal] of [['empty', '""'], ['long', JSON.stringify(LONG_TEXT)]]) {
        const result = compileCase(tmp, `s-${component.name}-${label}`, modules, `${component.name}(${literalsWith(component, slots[0], literal).join(', ')})`);
        assert.equal(result.status, 0, `${component.name} with ${label} text must compile: ${result.output}`);
        assert.ok(result.artifact, `${component.name} with ${label} text must write an IR artifact`);
        if (label === 'long') {
          assert.ok(result.artifact.includes(LONG_TEXT), `${component.name} must not truncate the authored text`);
        }
        checked += 1;
      }
    }
    assert.ok(checked >= 100, `expected at least 100 string slot checks, found ${checked}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('a literal outside the integer domain is rejected without an artifact', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-value-domain-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    const component = components.find((c) => c.params.some((p) => p.type === 'int'));
    const slot = intSlots(component)[0];
    const modules = modulesFor(component, edges);
    const literals = literalsWith(component, slot, '9223372036854775808');
    const result = compileCase(tmp, 'domain', modules, `${component.name}(${literals.join(', ')})`);
    assert.notEqual(result.status, 0, 'an out-of-domain literal must fail compilation');
    assert.match(result.output, /integer literal '9223372036854775808' is out of range/, 'the diagnostic must name the literal');
    assert.match(result.output, /error:/, 'the diagnostic must be typed as an error');
    assert.match(result.output, /help:/, 'the diagnostic must carry help text');
    for (const marker of PANIC_MARKERS) {
      assert.ok(!result.output.includes(marker), `the compiler must not panic (${marker})`);
    }
    assert.equal(result.artifact, null, 'a rejected literal must not write an IR artifact');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('a value outside the renderer numeric domain fails closed with a typed error', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-value-render-domain-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    const component = components.find((c) => {
      const props = effective.get(c.name) ?? new Map();
      return c.params.some((p) => p.type === 'int' && (props.get(p.name) ?? new Set()).has('value'));
    });
    assert.ok(component, 'a component with an integer value slot must exist');
    const slot = intSlots(component)[0];
    const modules = modulesFor(component, edges);
    const literals = literalsWith(component, slot, '9223372036854775807');
    const src = path.join(tmp, 'render-domain.opu');
    const ir = path.join(tmp, 'render-domain.json');
    writeFileSync(src, program(modules, `${component.name}(${literals.join(', ')})`));
    const compiled = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, `the compiler must accept the integer literal: ${compiled.stderr}`);
    const runs = renderCase(tmp, 'render-domain', ir);
    for (const run of runs) {
      assert.notEqual(run.status, 0, 'the renderer must fail closed outside its numeric domain');
      assert.ok(run.output.trim().length > 0, 'the renderer must report a typed error');
      for (const marker of PANIC_MARKERS) {
        assert.ok(!run.output.includes(marker), `the renderer must not panic (${marker})`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('extreme values render deterministically, also on a tiny viewport', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-value-render-'));
  try {
    cpSync(componentsDir, path.join(tmp, 'components'), { recursive: true });
    const family = ['components/pickers_m3.opu', 'components/card_m3.opu', 'components/list_tile_m3.opu', 'components/buttons_m3.opu', 'components/forms_m3.opu', 'components/chips_m3.opu', 'components/feedback_m3.opu', 'components/rating_m3.opu'];
    const cases = [
      ['components/pickers_m3.opu', 'DatePickerM3("Label", 2147483647, "default", "none")'],
      ['components/pickers_m3.opu', 'DatePickerM3("", -2147483648, "default", "none")'],
      ['components/card_m3.opu', `ElevatedCardM3("${LONG_TEXT}", "subtitle", "default", "none")`],
      ['components/list_tile_m3.opu', 'ListTileM3("", "", "default", "none")'],
      ['components/buttons_m3.opu', 'ElevatedActionButton("", "default", "none")'],
      ['components/forms_m3.opu', 'FormFieldM3("", "", false, 0, 0, "default", "none")'],
      ['components/chips_m3.opu', 'AssistChipM3("", "default", "none")'],
      ['components/feedback_m3.opu', 'LoadingM3("default", "none")'],
      ['components/rating_m3.opu', 'RatingM3("", 2147483647, 2147483647, "default", "none")'],
    ];
    for (const [index, [mod, use]] of cases.entries()) {
      const modules = modulesFor(byName.get(components.find((c) => c.file === mod).name), edges);
      const src = path.join(tmp, `r${index}.opu`);
      const ir = path.join(tmp, `r${index}.json`);
      writeFileSync(src, program(modules, use));
      const compiled = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(compiled.status, 0, `${use} must compile: ${compiled.stderr}`);
      for (const [width, height] of [['320', '240'], ['40', '24']]) {
        const runs = renderCase(tmp, `r${index}-${width}`, ir, width, height);
        for (const run of runs) {
          assert.equal(run.status, 0, `${use} must render at ${width}x${height}: ${run.output}`);
          for (const marker of PANIC_MARKERS) {
            assert.ok(!run.output.includes(marker), `the renderer must not panic (${marker})`);
          }
        }
        const digests = runs.map((r) => r.output.match(/digest=([0-9a-f]+)/i)?.[1]);
        assert.ok(digests.every(Boolean), `${use} must produce a digest at ${width}x${height}`);
        assert.equal(digests[0], digests[1], `${use} must render deterministically at ${width}x${height}`);
      }
    }
    const covered = new Set(cases.map(([mod]) => mod));
    for (const mod of family) {
      assert.ok(covered.has(mod), `${mod} must be covered by an extreme-value case`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
