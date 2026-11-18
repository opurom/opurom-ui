#!/usr/bin/env node
// Page transition consistency gate. Authoritative layer: `opurom-render/src/anim.rs`
// (transition vocabulary `slide`/`fade`/`scale`, fixed-point progress in `0..=ONE`,
// `TRANSITION_MS = 320`). Flutter 3.50.0 (ab291203) sources:
//   material/page_transitions_theme.dart:465-486   kTransitionMilliseconds 450,
//     the analog transition Duration, eased over the full page
//   material/curves.dart:440-525                   `ThreePointCubic` for
//     `easeInOutCubicEmphasized` (present in this checkout)
//   material/motion.dart:40-191                    duration tokens and
//     `Easing.standard` cubic (motion.dart:191)
// Opurom's three documented transition kinds carry a fixed-point progress the
// caller advances with `--tick`, so a 320 ms progression is the settled page.
// This gate asserts that every eight design state reach a transition under all
// three kinds, that progress is deterministic, that the terminated progression
// matches, and that pin reproduction never drifts. It also reads the a11y tree
// from the same transition composition and asserts the semantic role and label
// survive the progress. Internal consistency pins only: there is no Flutter
// page transition oracle and no 2%/12% pixel threshold.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/transition-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
// The pins use the gallery-pinned toolchain, which CI clones into these exact
// sibling dirs from the SHAs declared in the pin file.
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);
const [width, height] = meta.viewport;
const SETTLED = meta.ticks[meta.ticks.length - 1];

assert.equal(width, 320, 'the pin viewport must still be 320 wide');
assert.equal(height, 240, 'the pin viewport must still be 240 high');
assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.states, ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'], 'the eight design states must be the pin vocabulary');
assert.deepEqual(meta.kinds, ['slide', 'fade', 'scale'], 'the three documented transition kinds');
assert.deepEqual(meta.ticks, [0, 40, 80, 160, 320], 'the documented tick progression');
assert.equal(pins.length, 120, 'eight states times three kinds times five ticks');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  const imports = pin.imports.map((file) => `import "${file}";`).join('\n');
  return `${imports}
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${pin.use}
}
`;
}

function run(dir, name, text, tick, kind, a11y = false) {
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  assert.ok(existsSync(ir), `${name} must write its IR artifact`);
  const args = [ir, String(width), String(height), ppm, '--tick', String(tick), '--transition', kind];
  let treePath = null;
  if (a11y) {
    treePath = path.join(dir, `${name}-a11y.json`);
    args.push('--a11y', treePath);
  }
  const r = spawnSync(renderer, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `${name} render failed: ${r.stderr}`);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest && DIGEST_RE.test(digest), `${name} produced a parseable digest, got ${JSON.stringify(digest)}`);
  return { digest, tree: a11y ? JSON.parse(readFileSync(treePath, 'utf8')) : null };
}

test('every eight-state design reach a page transition under all three kinds', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-transition-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      const name = `t-${pin.state}-${pin.kind}-${pin.tick}`;
      const { digest } = run(tmp, name, source(pin), pin.tick, pin.kind);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('transitions are deterministic across repeated runs of the same pin', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-transition-determ-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let checked = 0;
    for (const pin of pins) {
      const name = `d-${pin.state}-${pin.kind}-${pin.tick}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.tick, pin.kind).digest;
      const b = run(tmp, `${name}-2`, source(pin), pin.tick, pin.kind).digest;
      assert.equal(a, b, `${pin.name} must render deterministically`);
      checked += 1;
    }
    assert.ok(checked >= pins.length, 'every pin must be replayed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('every progression starts at progress zero and closes at the settled frame', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-transition-progress-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const state of meta.states) {
      for (const kind of meta.kinds) {
        const first = pins.find((p) => p.state === state && p.kind === kind && p.tick === 0);
        const settled = pins.find((p) => p.state === state && p.kind === kind && p.tick === SETTLED);
        assert.ok(first, `${state} ${kind} must own the first tick`);
        assert.ok(settled, `${state} ${kind} must own the settled tick`);
        const start = run(tmp, `p-${state}-${kind}-start`, source(first), 0, kind).digest;
        const end = run(tmp, `p-${state}-${kind}-end`, source(settled), SETTLED, kind).digest;
        assert.equal(start, first.digest, `${state} ${kind} must start at progress zero`);
        assert.equal(end, settled.digest, `${state} ${kind} must settle at progress one`);
        assert.notEqual(start, end, `${state} ${kind} must change its frame`);
        audited += 1;
      }
    }
    assert.equal(audited, 8 * 3, 'every state times every kind must be covered');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the semantic role and label survive every transition progress', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-transition-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const kind of meta.kinds) {
      for (const tick of meta.ticks) {
        const pin = pins.find((p) => p.state === 'default' && p.kind === kind && p.tick === tick);
        assert.ok(pin, `a pinned default ${kind} ${tick} composition must exist`);
        const { tree } = run(tmp, `a-${kind}-${tick}`, source(pin), tick, kind, true);
        assert.ok(Array.isArray(tree), `${kind} ${tick} must produce a data-only a11y tree`);
        assert.ok(tree.some((n) => n.label === 'FAB' && n.role === 'button' && !n.hidden), `${kind} ${tick} must keep the FAB role and label`);
        assert.ok(tree.some((n) => n.label === 'Item' && n.role === 'text' && !n.hidden), `${kind} ${tick} must keep the list item label`);
        audited += 1;
      }
    }
    assert.equal(audited, 3 * meta.ticks.length, 'every kind and tick must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('an unknown transition kind fails closed without writing a frame', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-transition-invalid-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const pin = pins[0];
    const src = path.join(tmp, 'invalid.opu');
    const ir = path.join(tmp, 'invalid.json');
    const ppm = path.join(tmp, 'invalid.ppm');
    writeFileSync(src, source(pin));
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `invalid-kind input must compile: ${c.stderr}`);
    const r = spawnSync(renderer, [ir, String(width), String(height), ppm, '--tick', '160', '--transition', 'bounce'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'an unknown transition kind must fail the renderer');
    assert.match(r.stderr || '', /unknown transition "bounce": expected slide, fade or scale/, 'the renderer diagnostic must name the supported kinds');
    assert.ok(!existsSync(ppm), 'a rejected transition must write no frame');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
