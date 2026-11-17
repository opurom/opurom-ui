#!/usr/bin/env node
// Button-family state test: compile the M3 buttons and assert the five states
// paint distinct fills (hover lightens, active darkens, disabled desaturates).
// Skips honestly when the sibling toolchain binaries are absent.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function siblingBinary(roots, names) {
  for (const repo of roots) {
    for (const profile of ['debug', 'release']) {
      for (const name of names) {
        // lang-clean / render-clean hold the unified toolchain; fall back to the
        // main checkouts only if those are absent.
        for (const base of ['../' + repo, '../../opurom-dist/' + repo]) {
          const candidate = path.resolve(root, base, 'target', profile, name);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  }
  return null;
}

const compiler = siblingBinary(['opurom-lang'], ['opuromc']) ??
  (existsSync('/Users/mac/work/opurom/opurom-dist/lang-clean/target/debug/opuromc')
    ? '/Users/mac/work/opurom/opurom-dist/lang-clean/target/debug/opuromc' : null);
const renderer = existsSync('/Users/mac/work/opurom/opurom-dist/lang-clean-target/debug/opurom-render')
  ? '/Users/mac/work/opurom/opurom-dist/lang-clean-target/debug/opurom-render' : null;

const STATES = ['default', 'hover', 'active', 'focus', 'disabled'];
const BUTTONS = [
  'ElevatedActionButton', 'FilledActionButton', 'OutlinedActionButton',
  'TextActionButton', 'DangerActionButton',
];

function compileOne(tmp, call) {
  const src = path.join(tmp, 'one.opu');
  const ir = path.join(tmp, 'one.json');
  writeFileSync(src, `import "components/buttons_m3.opu";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `compile failed: ${c.stderr}`);
  return ir;
}

function compileAndRender(tmp, state) {
  const ir = compileOne(tmp, `ElevatedActionButton("State", "${state}", "ease")`);
  const ppm = path.join(tmp, 'one.ppm');
  const r = spawnSync(renderer, [ir, '400', '200', ppm], { encoding: 'utf8' });
  assert.equal(r.status, 0, `render ${state} failed: ${r.stderr}`);
  // dominant non-white colour = solid fill
  const buf = readFileSync(ppm);
  const header = buf.subarray(0, 60).toString('latin1').split('\n');
  const dims = header[1].trim().split(/\s+/).map(Number);
  const off = header[0].length + header[1].length + header[2].length + 3;
  const counts = new Map();
  for (let i = 0; i < dims[0] * dims[1]; i++) {
    const p = off + i * 3;
    const key = `${buf[p]},${buf[p + 1]},${buf[p + 2]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null, bestN = -1;
  for (const [k, n] of counts) if (k !== '255,255,255' && n > bestN) { best = k; bestN = n; }
  return best.split(',').map(Number);
}

test('button five states paint distinct fills', { skip: !compiler || !renderer }, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-buttons-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const fill = {};
    for (const s of STATES) fill[s] = compileAndRender(tmp, s);
    // default vs hover: hover is lighter (sum higher)
    const sum = (c) => c[0] + c[1] + c[2];
    assert.ok(sum(fill.hover) > sum(fill.default), `hover ${fill.hover} must be lighter than default ${fill.default}`);
    assert.ok(sum(fill.active) < sum(fill.default), `active ${fill.active} must be darker than default ${fill.default}`);
    assert.deepEqual(fill.focus, fill.default, 'focus keeps the fill (outer ring only)');
    // disabled: desaturated -> channel spread smaller than default's
    const spread = (c) => Math.max(...c) - Math.min(...c);
    assert.ok(spread(fill.disabled) < spread(fill.default), `disabled ${fill.disabled} must be less saturated than default ${fill.default}`);
    console.log('button states OK', JSON.stringify(fill));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('m3 buttons render a 40dp stadium with the built-in 12dp inset', {
  skip: !compiler || !renderer,
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-btngeom-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const attr = (line, key) => {
      const m = line.match(new RegExp(`${key}="([^"]+)"`));
      return m ? m[1] : null;
    };
    for (const name of BUTTONS) {
      const ir = compileOne(tmp, `${name}("Save", "default", "ease")`);
      const svg = path.join(tmp, 'one.svg');
      const r = spawnSync(renderer, [ir, '500', '200', path.join(tmp, 'one.ppm'), '--svg', svg], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${name} svg failed: ${r.stderr}`);
      const lines = readFileSync(svg, 'utf8').split('\n');
      const text = lines.find((l) => l.includes('<text') && l.includes('data-role="button"'));
      assert.ok(text, `${name} must render a label`);
      const tx = Number(attr(text, 'x'));
      assert.ok(Math.abs(tx - 12) <= 1, `${name} inset ${tx} must be the built-in 12dp`);
      const filled = name !== 'TextActionButton';
      if (filled) {
        const rect = lines.find((l) => l.includes('<rect') && l.includes('data-role="button"'));
        assert.ok(rect, `${name} must render a filled stadium`);
        const h = Number(attr(rect, 'height'));
        const rx = Number(attr(rect, 'rx'));
        assert.equal(h, 40, `${name} height must be 40dp`);
        assert.equal(rx, 20, `${name} radius must be half the height`);
        assert.equal(rx, h / 2, `${name} must be a stadium`);
      }
      console.log(name, filled ? '40dp stadium rx20 inset12' : 'text variant inset12');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
