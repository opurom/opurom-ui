#!/usr/bin/env node
// Five-state compile gate for core layout shells. Flutter stable 3.50.0
// anchors: basic.dart:2331-2340 (Padding), :2493-2505 (Align), :2581-2583
// (Center), :2787-2812 (SizedBox), :2891-2901 (ConstrainedBox). Opurom IR
// emits only static Container/Row geometry; real constraint delegates stay
// reserved (kernel gap L4). No golden is changed by these additive shells.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const compiler = requireNative(root, 'opurom-lang-8state', ['opuromc']);
const STATES = ['default', 'hover', 'active', 'focus', 'disabled'];
const CASES = [
  'FixedBox(80, 40, "{state}")',
  'InsetBox(12, "{state}")',
  'AlignedBox("center", "{state}")',
  'CenteredBox("{state}")',
  'ConstrainedShell(16, 120, "{state}")',
];

function compile(dir, name, call) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(src, `import "components/layout_core.opu";
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`);
  const r = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  return { status: r.status, ir, log: r.stdout + r.stderr };
}

function states(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && typeof node.props.state === 'string') found.push(node.props.state);
  for (const child of node.children ?? []) states(child, found);
  return found;
}

test('core layout shells compile in five states and propagate state to IR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-layout-core-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [index, call] of CASES.entries()) {
      for (const state of STATES) {
        const c = compile(tmp, `c${index}`, call.replace('{state}', state));
        assert.equal(c.status, 0, `${call} ${state} failed: ${c.log}`);
        const emitted = states(JSON.parse(readFileSync(c.ir, 'utf8')).tree);
        assert.ok(emitted.includes(state), `${call} ${state} not in IR: ${JSON.stringify(emitted)}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('layout shells guard zero and overlong sizes', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-layout-edge-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const call of ['FixedBox(0, 0, "default")', 'InsetBox(0, "default")', 'ConstrainedShell(0, 10000, "disabled")']) {
      const c = compile(tmp, 'edge', call);
      assert.equal(c.status, 0, `${call} failed: ${c.log}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
