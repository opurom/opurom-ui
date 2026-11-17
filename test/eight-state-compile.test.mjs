#!/usr/bin/env node
// Compiler-only eight-state test. It proves component APIs emit the new state
// strings into IR without involving the signed digest renderer, whose NodeState
// parser is still the five-value version at 8a76e1d. Default-state IR must stay
// byte-identical to the compiler used for the pinned frames.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const toolchain = JSON.parse(readFileSync(path.join(root, 'test/eight-state-toolchain.json'), 'utf8'));
const compiler = requireNative(root, 'opurom-lang-8state', ['opuromc']);
const pinnedCompiler = requireNative(root, 'opurom-lang', ['opuromc']);
const STATES = ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'];
const CASES = [
  ['components/buttons_m3.opu', 'ElevatedActionButton("Save", "{state}", "ease")'],
  ['components/card_m3.opu', 'ElevatedCardM3("Title", "Subtitle", "{state}", "ease")'],
  ['components/list_tile_m3.opu', 'ListTileM3("Title", "Subtitle", "{state}", "ease")'],
  ['components/chips_m3.opu', 'AssistChipM3("Label", "{state}", "ease")'],
  ['components/chips_m3.opu', 'SelectedChipM3("Label", "{state}", "ease")'],
];

function source(mod, call) {
  return `import "${mod}";
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`;
}

function compile(tool, dir, name, text) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, text);
  const r = spawnSync(tool, ['compile', src, '-o', ir], { encoding: 'utf8' });
  return { status: r.status, ir, log: r.stdout + r.stderr };
}

function stateValues(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) stateValues(child, found);
  return found;
}

test('m3 components emit all eight state strings into IR', () => {
  assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1');
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-eight-state-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [mod, call]] of CASES.entries()) {
      for (const state of STATES) {
        const c = compile(compiler, tmp, `c${index}`, source(mod, call.replace('{state}', state)));
        assert.equal(c.status, 0, `${mod} ${state} compile failed: ${c.log}`);
        const ir = JSON.parse(readFileSync(c.ir, 'utf8'));
        const emitted = stateValues(ir.tree);
        assert.ok(emitted.length > 0, `${mod} ${state} emitted no state prop`);
        assert.ok(emitted.every((v) => v === state), `${mod} ${state} emitted ${JSON.stringify(emitted)}`);
      }
      console.log(mod, call.split('(')[0], 'eight states emitted');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('default-state IR stays byte-identical to the pinned compiler', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-eight-default-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, [mod, call]] of CASES.entries()) {
      const text = source(mod, call.replace('{state}', 'default'));
      const fresh = compile(compiler, tmp, `f${index}`, text);
      const pinned = compile(pinnedCompiler, tmp, `p${index}`, text);
      assert.equal(fresh.status, 0, `fresh default failed: ${fresh.log}`);
      assert.equal(pinned.status, 0, `pinned default failed: ${pinned.log}`);
      assert.equal(readFileSync(fresh.ir, 'utf8'), readFileSync(pinned.ir, 'utf8'),
        `${mod} default IR changed between pinned and eight-state compilers`);
    }
    console.log('default IR byte-identical for all five component cases');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
