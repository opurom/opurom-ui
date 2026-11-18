#!/usr/bin/env node
// Dark-theme information hierarchy and contrast-polarity gate. It pins light
// vs dark frames for card/list/header across the eight design states and
// asserts the theme mode actually inverts the painted background polarity.
// Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) sources:
//   material/color_scheme.dart:268-541    ColorScheme.fromSeed brightness input
//   material/color_scheme.dart:806        `isDark = brightness == Brightness.dark`
//   material/theme_data.dart:427-460      brightness/dark ThemeData construction
//   material/theme_data.dart:840-862      ThemeData.from(ColorScheme) semantics
//   material/elevation_overlay.dart:146   dark elevation overlay opacity formula
// Opurom expresses dark mode through the authored `theme/dark.opu` module and
// the IR `theme.mode` field (parsed in opurom-render/src/ir.rs); the renderer
// has no WCAG contrast oracle and no per-pixel ink/background separation, so
// this gate pins polarity (dominant background luminance inverts between
// modes) and deterministic distinct frames, never a contrast ratio claim.
// Internal consistency pins only: no Flutter oracle, no 2%/12% pixel threshold.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/dark-hierarchy-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);

assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.modes, ['light', 'dark'], 'both theme modes must be pinned');
assert.deepEqual(meta.kinds, ['card', 'tile', 'header'], 'the three hierarchy shells');
assert.equal(pins.length, 96, 'two modes times three shells times eight states times two ticks');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  return `import "${pin.theme}";
import "${pin.module}";
app One {
  quality { msaa: 4 }
  ${pin.use}
}
`;
}

function run(dir, name, text, tick) {
  const [width, height] = pins[0].viewport;
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  assert.ok(existsSync(ir), `${name} must write its IR artifact`);
  const r = spawnSync(renderer, [ir, String(width), String(height), ppm, '--tick', String(tick)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest && DIGEST_RE.test(digest), `${name} produced a parseable digest, got ${JSON.stringify(digest)}`);
  const buf = readFileSync(ppm);
  let idx = 0;
  const fields = [];
  while (fields.length < 4) {
    while (buf[idx] === 32 || buf[idx] === 10 || buf[idx] === 13) idx += 1;
    const start = idx;
    while (buf[idx] !== 32 && buf[idx] !== 10 && buf[idx] !== 13) idx += 1;
    fields.push(buf.slice(start, idx).toString());
  }
  idx += 1;
  const w = Number(fields[1]);
  const h = Number(fields[2]);
  const counts = new Map();
  for (let i = 0; i < w * h; i += 1) {
    const o = idx + i * 3;
    const key = `${buf[o]},${buf[o + 1]},${buf[o + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant = null;
  let max = -1;
  for (const [key, count] of counts) {
    if (count > max) {
      max = count;
      dominant = key;
    }
  }
  const [r8, g8, b8] = dominant.split(',').map(Number);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r8) + 0.7152 * lin(g8) + 0.0722 * lin(b8);
  return { digest, dominantLuminance: luminance };
}

test('every light/dark hierarchy frame replays its pin across eight states', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-dark-pins-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    cpSync(path.join(root, 'theme'), path.join(tmp, 'theme'), { recursive: true });
    for (const pin of pins) {
      const name = `p-${pin.name}`;
      const { digest } = run(tmp, name, source(pin), pin.tick);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('frames are deterministic and the mode inverts the dominant background polarity', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-dark-polarity-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    cpSync(path.join(root, 'theme'), path.join(tmp, 'theme'), { recursive: true });
    const luminance = new Map();
    let audited = 0;
    for (const pin of pins) {
      const name = `d-${pin.name}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.tick);
      const b = run(tmp, `${name}-2`, source(pin), pin.tick);
      assert.equal(a.digest, b.digest, `${pin.name} must render deterministically`);
      luminance.set(pin.name, a.dominantLuminance);
      audited += 1;
    }
    assert.equal(audited, 96, 'every pin must be replayed');
    for (const kind of meta.kinds) {
      for (const state of meta.states) {
        const lightName = `light-${kind}-${state}-200`;
        const darkName = `dark-${kind}-${state}-200`;
        const light = luminance.get(lightName);
        const dark = luminance.get(darkName);
        assert.ok(light > 0.5, `${lightName} light background must stay bright (luminance ${light.toFixed(3)})`);
        assert.ok(dark < 0.2, `${darkName} dark background must stay dim (luminance ${dark.toFixed(3)})`);
        const lightPin = pins.find((p) => p.name === lightName);
        const darkPin = pins.find((p) => p.name === darkName);
        assert.notEqual(lightPin.digest, darkPin.digest, `${kind} ${state} mode must change the frame`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the IR carries the theme mode and the a11y labels survive both modes', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-dark-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    cpSync(path.join(root, 'theme'), path.join(tmp, 'theme'), { recursive: true });
    let audited = 0;
    for (const mode of meta.modes) {
      const pin = pins.find((p) => p.mode === mode && p.kind === 'card' && p.state === 'default' && p.tick === 200);
      assert.ok(pin, `${mode} must own an a11y pin`);
      const src = path.join(tmp, `a-${mode}.opu`);
      const ir = path.join(tmp, `a-${mode}.json`);
      const tree = path.join(tmp, `a-${mode}-tree.json`);
      writeFileSync(src, source(pin));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${mode} compile failed: ${c.stderr}`);
      const r = spawnSync(renderer, [ir, '320', '240', path.join(tmp, `a-${mode}.ppm`), '--tick', '200', '--a11y', tree], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${mode} render failed: ${r.stderr}`);
      const parsed = JSON.parse(readFileSync(ir, 'utf8'));
      assert.equal(parsed.theme.mode, mode, `${mode} must reach the IR theme`);
      const nodes = JSON.parse(readFileSync(tree, 'utf8'));
      assert.ok(Array.isArray(nodes), `${mode} must produce a data-only a11y tree`);
      assert.ok(nodes.some((n) => n.label === 'elevated card' && !n.hidden), `${mode} must keep the card label`);
      assert.ok(nodes.some((n) => n.label === 'Card title' && n.role === 'text' && !n.hidden), `${mode} must keep the title`);
      audited += 1;
    }
    assert.equal(audited, 2, 'both modes must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('no contrast oracle exists in the renderer, so a ratio claim stays out of scope', () => {
  const r = spawnSync(renderer, [], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'a bare renderer invocation must fail closed');
  const usage = `${r.stderr}\n${r.stdout}`;
  for (const banned of ['--contrast', '--wcag', '--aa', '--aaa']) {
    assert.ok(!usage.includes(banned), `the host must not advertise ${banned}; WCAG ratio claims stay with the render kernel`);
  }
});
