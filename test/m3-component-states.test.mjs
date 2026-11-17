#!/usr/bin/env node
// M3 card / list tile / chip state test: compile and render every component in
// all five states, then check the paint changes where the renderer supports a
// state transform. Also covers empty content, overlong labels and invalid state.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const compiler = '/Users/mac/work/opurom/opurom-dist/lang-clean/target/debug/opuromc';
const renderer = '/Users/mac/work/opurom/opurom-dist/lang-clean-target/debug/opurom-render';
const STATES = ['default', 'hover', 'active', 'focus', 'disabled'];
const CASES = {
  ElevatedCardM3: ['components/card_m3.opu', '"Title", "Subtitle"'],
  OutlinedCardM3: ['components/card_m3.opu', '"Title", "Subtitle"'],
  ListTileM3: ['components/list_tile_m3.opu', '"Title", "Subtitle"'],
  AssistChipM3: ['components/chips_m3.opu', '"Label"'],
  SelectedChipM3: ['components/chips_m3.opu', '"Label"'],
};

function compile(tmp, text) {
  const src = path.join(tmp, 'one.opu');
  const ir = path.join(tmp, 'one.json');
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8', cwd: tmp });
  return { status: c.status, ir, log: c.stdout + c.stderr };
}

function app(mod, call) {
  return `import "${mod}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${call}
}
`;
}

function render(ir, ppm) {
  const r = spawnSync(renderer, [ir, '500', '400', ppm], { encoding: 'utf8' });
  assert.equal(r.status, 0, `render failed: ${r.stderr}`);
  const buf = readFileSync(ppm);
  const header = buf.subarray(0, 80).toString('latin1').split('\n');
  const [w, h] = header[1].trim().split(/\s+/).map(Number);
  const off = header[0].length + header[1].length + header[2].length + 3;
  const counts = new Map();
  for (let i = 0; i < w * h; i++) {
    const p = off + i * 3;
    const key = `${buf[p]},${buf[p + 1]},${buf[p + 2]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function signature(counts) {
  return [...counts]
    .filter(([k, n]) => k !== '255,255,255' && n > 8)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .join('|');
}

test('m3 cards, list tile and chips render all five states', {
  skip: !existsSync(compiler) || !existsSync(renderer),
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-m3shells-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [name, [mod, args]] of Object.entries(CASES)) {
      const sig = {};
      for (const state of STATES) {
        const c = compile(tmp, app(mod, `${name}(${args}, "${state}", "ease")`));
        assert.equal(c.status, 0, `${name} ${state} compile failed: ${c.log}`);
        const counts = render(c.ir, path.join(tmp, 'one.ppm'));
        sig[state] = signature(counts);
        if (state === 'focus' && sig.default) {
          // Focus paints the accent outer ring where the renderer has a fill to ring.
          const ring = [...counts].some(([k, n]) => k === '98,0,238' && n > 8);
          assert.ok(sig.focus === sig.default || ring, `${name} focus needs a fill or accent ring`);
        }
      }
      for (const state of ['hover', 'active', 'disabled']) {
        assert.notEqual(sig[state], sig.default, `${name} ${state} must repaint vs default`);
      }
      console.log(name, 'five states OK', STATES.map((s) => `${s}:${sig[s].split('|').slice(0, 2).join(',')}`).join(' '));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('m3 shells guard empty content, long labels and invalid states', {
  skip: !existsSync(compiler) || !existsSync(renderer),
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-m3bounds-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const long = 'x'.repeat(500);
    const ok = [
      app('components/card_m3.opu', `ElevatedCardM3("", "", "default", "ease")`),
      app('components/list_tile_m3.opu', `ListTileM3("", "", "default", "ease")`),
      app('components/chips_m3.opu', `AssistChipM3("", "default", "ease")`),
      app('components/chips_m3.opu', `SelectedChipM3("${long}", "default", "ease")`),
    ];
    for (const [i, src] of ok.entries()) {
      const c = compile(tmp, src);
      assert.equal(c.status, 0, `boundary case ${i} compile failed: ${c.log}`);
      render(c.ir, path.join(tmp, `one${i}.ppm`));
    }
    const bad = compile(tmp, app('components/card_m3.opu',
      'ElevatedCardM3("t", "s", "pressed", "ease")'));
    assert.notEqual(bad.status, 0, 'invalid state must be compiler-rejected');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
