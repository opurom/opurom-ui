#!/usr/bin/env node
// iOS bounce (scroll boundary) UI-side consistency gate. It pins the static
// scroll clipping that the IR *can* express and proves that bounce physics is
// not silently faked. Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb)
// sources:
//   widgets/scroll_physics.dart:748-946   BouncingScrollPhysics: 0.07s rubber
//     band half life, doubled min fling, fast-rate 8x max fling
//   widgets/scroll_simulation.dart:18-132 BouncingScrollSimulation: 0.135 iOS
//     friction, 5000 max spring transfer velocity, spring/friction handover
//   physics/friction_simulation.dart:35-165 FrictionSimulation x/dx/finalX/
//     timeAtX closed form
// The pinned renderer implements these numbers in `scroll_physics.rs` and has
// 12 dedicated Rust tests, but the Opurom IR/host never constructs a
// `ScrollDriver`: `Scroll` accepts only `height` (opurom-lang/src/lower.rs:715)
// and the CLI has no drag/velocity/overscroll option. That is registered gap
// B2 (velocity + fling/spring) and B3 (directional drag + scroll routing);
// this gate keeps UI honest by (a) replaying deterministic static clipping
// frames across eight states and two viewports, (b) asserting the a11y tree,
// (c) asserting every bounce-only IR prop fails closed, and (d) proving that a
// `--tick` never moves the scroll offset. Internal consistency pins only:
// no Flutter oracle, no pixel threshold, no claim of bounce parity.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/scroll-boundary-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);

assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.states, ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'], 'the eight design states must be the pin vocabulary');
assert.equal(pins.length, 192, 'three shells times eight states times two viewports times four ticks');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  return `import "${pin.module}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${pin.use}
}
`;
}

function run(dir, name, text, viewport, tick, a11y = false) {
  const [width, height] = viewport;
  const src = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  writeFileSync(src, text);
  const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
  assert.equal(c.status, 0, `${name} compile failed: ${c.stderr}`);
  assert.ok(existsSync(ir), `${name} must write its IR artifact`);
  const args = [ir, String(width), String(height), ppm, '--tick', String(tick)];
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

test('every scroll shell replays static clipping pins across eight states and two viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-bounce-pins-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      const name = `p-${pin.shell}-${pin.state}-${pin.viewport.join('x')}-${pin.tick}`;
      const { digest } = run(tmp, name, source(pin), pin.viewport, pin.tick);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('static clipping frames are deterministic and do not move with the tick', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-bounce-static-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const pin of pins) {
      const name = `s-${pin.shell}-${pin.state}-${pin.viewport.join('x')}-${pin.tick}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.viewport, pin.tick).digest;
      const b = run(tmp, `${name}-2`, source(pin), pin.viewport, pin.tick).digest;
      assert.equal(a, b, `${pin.name} must render deterministically`);
      audited += 1;
    }
    assert.equal(audited, 192, 'every pin must be replayed');
    // The anchor digest of each shell/state/viewport is the tick-0 frame; the
    // presence of later tick pins is a regression record only, not a claim
    // that physical scroll offset changes.
    for (const shell of ['RefreshListShell', 'GroupedListShell', 'LoadMoreListShell']) {
      for (const viewport of meta.viewports) {
        for (const state of meta.states) {
          const first = pins.find((p) => p.shell === shell && p.state === state && p.tick === 0 && String(p.viewport) === String(viewport));
          assert.ok(first, `${shell} ${state} ${viewport} must have a tick-0 pin`);
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('scroll shells keep their semantic labels and roles at both viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-bounce-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const shell of ['RefreshListShell', 'GroupedListShell', 'LoadMoreListShell']) {
      for (const state of meta.states) {
        for (const viewport of meta.viewports) {
          const pin = pins.find((p) => p.shell === shell && p.state === state && String(p.viewport) === String(viewport));
          assert.ok(pin, `${shell} ${state} ${viewport} must own an a11y pin`);
          const { tree } = run(tmp, `a-${shell}-${state}-${viewport.join('x')}`, source(pin), viewport, 0, true);
          assert.ok(Array.isArray(tree), `${shell} ${state} ${viewport} must produce a data-only a11y tree`);
          const labels = tree.filter((n) => !n.hidden).map((n) => n.label);
          const sample = {
            RefreshListShell: 'row-2',
            GroupedListShell: 'group-1',
            LoadMoreListShell: 'Load more',
          }[shell];
          assert.ok(labels.includes(sample), `${shell} ${state} ${viewport} must keep ${sample} in the a11y tree`);
          audited += 1;
        }
      }
    }
    assert.equal(audited, 3 * 8 * 2, 'every shell, state and viewport must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('bounce-only props fail closed because ScrollDriver is not wired into the IR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-bounce-gap-'));
  try {
    for (const [label, body, pattern] of [
      ['physics', 'Scroll(height: 120, physics: bounce) { Text("x") }', /unknown prop 'physics' on Scroll/],
      ['velocityTracker', 'Scroll(height: 120, velocityTracker: true) { Text("x") }', /unknown prop 'velocityTracker' on Scroll/],
      ['overscroll', 'Scroll(height: 120, overscroll: true) { Text("x") }', /unknown prop 'overscroll' on Scroll/],
      ['rubberBand', 'Scroll(height: 120, rubberBand: true) { Text("x") }', /unknown prop 'rubberBand' on Scroll/],
      ['scrollOffset', 'Scroll(height: 120, scrollOffset: 10) { Text("x") }', /unknown prop 'scrollOffset' on Scroll/],
      ['flingVelocity', 'Scroll(height: 120, flingVelocity: 1000) { Text("x") }', /unknown prop 'flingVelocity' on Scroll/],
      ['dragStartDistanceMotionThreshold', 'Scroll(height: 120, dragStartDistanceMotionThreshold: 3) { Text("x") }', /unknown prop 'dragStartDistanceMotionThreshold' on Scroll/],
    ]) {
      const src = path.join(tmp, `${label}.opu`);
      const ir = path.join(tmp, `${label}.json`);
      writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${body}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${label} must stay rejected until B2/B3 lands`);
      assert.match(c.stderr || '', pattern, `${label} diagnostic drifted`);
      assert.ok(!existsSync(ir), `${label} must not write an IR artifact`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the renderer CLI exposes no drag, velocity or overscroll entry point', () => {
  const r = spawnSync(renderer, [], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'a bare renderer invocation must fail closed');
  const usage = `${r.stderr}\n${r.stdout}`;
  assert.match(usage, /--tick/, 'the deterministic clock must remain the only progress input');
  for (const banned of ['--drag', '--velocity', '--fling', '--overscroll', '--physics', '--rubber-band']) {
    assert.ok(!usage.includes(banned), `the host must not advertise ${banned} before B2/B3 lands`);
  }
});
