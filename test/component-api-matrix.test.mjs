#!/usr/bin/env node
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
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const componentsDir = path.join(root, 'components');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);

// Props whose values are validated against a closed vocabulary. The compiler
// rejects a wrong keyword before the component is lowered, so generated
// programs must pass a legal keyword for every forwarded prop.
//   opurom-lang/src/lower.rs:333-349  state/variant/tone design vocabularies
//   opurom-lang/src/lower.rs:248-265  animate vocabulary
//   opurom-lang/src/lower.rs:266-313  curve vocabulary
//   opurom-lang/src/lower.rs:314      gesture vocabulary
//   opurom-lang/src/lower.rs:319-332  iconStyle/role vocabularies
//   opurom-lang/src/lower.rs:1366-1400 color/border/textColor colour strings
//   opurom-lang/src/lower.rs:1507-1571 gradient and gradientDirection
//   opurom-lang/src/lower.rs:1622-1644 animationBehavior vocabulary
//   opurom-lang/src/lower.rs:1218-1234 Icon name vocabulary
const PROP_LITERAL = {
  state: '"default"',
  variant: '"primary"',
  tone: '"info"',
  animate: '"none"',
  curve: '"linear"',
  reverseCurve: '"linear"',
  gesture: '"tap"',
  role: '"button"',
  iconStyle: '"outlined"',
  gradientDirection: '"vertical"',
  animationBehavior: '"normal"',
  color: '"#6200EE"',
  border: '"#6200EE"',
  textColor: '"#6200EE"',
  gradient: '"#6200EE,#006EFF"',
  name: '"home"',
};
const PROP_PRIORITY = ['state', 'variant', 'tone', 'animate', 'curve', 'reverseCurve', 'gesture', 'role', 'iconStyle', 'animationBehavior', 'gradient', 'gradientDirection', 'color', 'border', 'textColor', 'name'];
const TYPE_LITERAL = { string: '"x"', int: '1', bool: 'true' };
const TYPE_NAME = { string: 'string', int: 'int', bool: 'bool' };
const WRONG_LITERAL = { string: '1', int: '"x"', bool: '"x"' };
const WRONG_NAME = { string: 'int', int: 'string', bool: 'string' };
const PANIC_MARKERS = ['panicked', 'RUST_BACKTRACE', 'stack overflow', 'internal compiler error'];
const STATE_VOCABULARY = 'default, hover, active, focus, disabled, loading, success, error';

function stripComments(text) {
  return text
    .split('\n')
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

function bodyOf(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return '';
}

function parseComponents() {
  const files = readdirSync(componentsDir).filter((f) => f.endsWith('.opu')).sort();
  const parsed = [];
  for (const file of files) {
    const raw = readFileSync(path.join(componentsDir, file), 'utf8');
    const text = stripComments(raw);
    for (const m of text.matchAll(/^component\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/gm)) {
      const decl = m[0];
      const params = m[2].trim() === ''
        ? []
        : m[2].split(',').map((p) => p.trim()).map((p) => {
          const [name, type] = p.split(':').map((x) => x.trim());
          return { name, type };
        });
      const body = bodyOf(text, text.indexOf(decl) + decl.length - 1);
      parsed.push({ name: m[1], file: `components/${file}`, params, body });
    }
  }
  return parsed;
}

const components = parseComponents();
const byName = new Map(components.map((c) => [c.name, c]));

function dependenciesOf(component) {
  const found = new Set();
  for (const other of components) {
    if (other.name === component.name) continue;
    if (new RegExp(`\\b${other.name}\\b`).test(component.body)) found.add(other.name);
  }
  return [...found];
}

// The compiler resolves every component of an imported module, not only the
// one the program calls, so a module must be imported together with the
// modules that provide the components it references.
const moduleEdges = new Map();
for (const component of components) {
  const edges = moduleEdges.get(component.file) ?? new Set();
  for (const dep of dependenciesOf(component)) {
    const target = byName.get(dep);
    if (target && target.file !== component.file) edges.add(target.file);
  }
  moduleEdges.set(component.file, edges);
}

function modulesFor(component) {
  const modules = new Set([component.file]);
  const queue = [component.file];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of moduleEdges.get(current) ?? []) {
      if (modules.has(next)) continue;
      modules.add(next);
      queue.push(next);
    }
  }
  return [...modules].sort();
}

function forwardedProps(component) {
  const map = new Map();
  for (const m of component.body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"\{([A-Za-z_][A-Za-z0-9_]*)\}"/g)) {
    if (!map.has(m[2])) map.set(m[2], new Set());
    map.get(m[2]).add(m[1]);
  }
  return map;
}

function literalFor(component, param, props) {
  if (param.type === 'int') return TYPE_LITERAL.int;
  if (param.type === 'bool') return TYPE_LITERAL.bool;
  const forwarded = props.get(param.name) ?? new Set();
  for (const prop of PROP_PRIORITY) {
    if (forwarded.has(prop)) return PROP_LITERAL[prop];
  }
  if (param.name === 'state') return '"default"';
  if (param.name === 'animate') return '"none"';
  return TYPE_LITERAL.string;
}

function literalsFor(component) {
  const props = forwardedProps(component);
  return component.params.map((param) => literalFor(component, param, props));
}

function forwardedParam(component, prop) {
  const m = component.body.match(new RegExp(`\\b${prop}:\\s*"\\{([A-Za-z_][A-Za-z0-9_]*)\\}"`));
  return m ? m[1] : null;
}

function program(modules, use) {
  const imports = modules.map((m) => `import "${m}";`).join('\n');
  return `${imports}
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
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
      const modules = modulesFor(component);
      const arity = component.params.length;
      const literals = literalsFor(component);
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
      const modules = modulesFor(component);
      const first = component.params[0];
      const literals = literalsFor(component);
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
      const forwarded = forwardedParam(component, 'state');
      if (!forwarded) continue;
      const index = component.params.findIndex((p) => p.name === forwarded);
      if (index === -1) continue;
      audited += 1;
      const modules = modulesFor(component);
      const literals = literalsFor(component);
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
      const forwarded = forwardedParam(component, 'animate');
      if (!forwarded) continue;
      const index = component.params.findIndex((p) => p.name === forwarded);
      if (index === -1) continue;
      audited += 1;
      const modules = modulesFor(component);
      const literals = literalsFor(component);
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
