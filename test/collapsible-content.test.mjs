#!/usr/bin/env node
// Collapsible content (ExpansionPanelList / AnimatedCrossFade) UI-side
// consistency gate. It pins the authored static shell across the eight design
// states and proves that cross-fade/panel controllers are not faked.
// Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) sources:
//   material/expansion_panel.dart:185-250    ExpansionPanelList constructor:
//     expansionCallback, animationDuration = kThemeAnimationDuration
//   material/expansion_panel.dart:420-470    AnimatedContainer fastOutSlowIn
//     header margin and the AnimatedCrossFade body with staggered Intervals
//   material/theme.dart:20                   kThemeAnimationDuration = 200 ms
//   widgets/animated_cross_fade.dart:123-145 crossFadeState, first/secondCurve,
//     sizeCurve, duration, reverseDuration, layoutBuilder
//   widgets/animated_cross_fade.dart:239-264 default Stack + Positioned layout
//   widgets/animated_cross_fade.dart:390-417 excludeBottomFocus, clipBehavior
// Opurom IR has no ExpansionPanelList/AnimatedCrossFade widget: the compiler
// rejects the widget kinds and the advanced props (`crossFadeState`,
// `firstCurve`, `onEnd`, `excludeBottomFocus`). The static shell consumes the
// 200 ms token and the eight-state placeholder; the missing controller is
// registered under A2 geometry lerp and B4 callbacks/focus. This gate replays
// deterministic frames, checks the a11y roles and labels, asserts the missing
// props fail closed, and verifies the authored 200 ms duration reaches IR.
// Internal consistency pins only: no Flutter oracle, no pixel threshold.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/collapsible-content-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);

assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.states, ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'], 'the eight design states must be the pin vocabulary');
assert.deepEqual(meta.cases, ['single', 'pair', 'empty'], 'the three authored shell cases');
assert.equal(pins.length, 144, 'three cases times eight states times two viewports times three ticks');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  return `import "components/expansion_m3.opu";
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

test('every collapsible shell case replays its pins across eight states and two viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-collapsible-pins-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      const name = `p-${pin.case}-${pin.state}-${pin.viewport.join('x')}-${pin.tick}`;
      const { digest } = run(tmp, name, source(pin), pin.viewport, pin.tick);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('collapsible frames are deterministic and the 200 ms token reaches the IR', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-collapsible-static-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const pin of pins) {
      const name = `s-${pin.case}-${pin.state}-${pin.viewport.join('x')}-${pin.tick}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.viewport, pin.tick).digest;
      const b = run(tmp, `${name}-2`, source(pin), pin.viewport, pin.tick).digest;
      assert.equal(a, b, `${pin.name} must render deterministically`);
      audited += 1;
    }
    assert.equal(audited, 144, 'every pin must be replayed');
    const pin = pins.find((p) => p.case === 'single' && p.state === 'default' && p.tick === 0);
    const src = path.join(tmp, 'duration.opu');
    const ir = path.join(tmp, 'duration.json');
    writeFileSync(src, source(pin));
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `duration compile failed: ${c.stderr}`);
    assert.match(readFileSync(ir, 'utf8'), /"duration":\s*200/, 'the Flutter 200 ms token must reach the IR');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the header role, title and body labels survive every state and viewport', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-collapsible-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const state of meta.states) {
      for (const viewport of meta.viewports) {
        const pin = pins.find((p) => p.case === 'single' && p.state === state && p.tick === 0 && String(p.viewport) === String(viewport));
        assert.ok(pin, `single ${state} ${viewport} must own an a11y pin`);
        const { tree } = run(tmp, `a-${state}-${viewport.join('x')}`, source(pin), viewport, 0, true);
        assert.ok(Array.isArray(tree), `${state} ${viewport} must produce a data-only a11y tree`);
        assert.ok(tree.some((n) => n.label === 'expansion tile' && n.role === 'button' && !n.hidden), `${state} ${viewport} must keep the expansion role and label`);
        assert.ok(tree.some((n) => n.label === 'Details' && n.role === 'text' && !n.hidden), `${state} ${viewport} must keep the title`);
        assert.ok(tree.some((n) => n.label === 'Body content' && n.role === 'text' && !n.hidden), `${state} ${viewport} must keep the body`);
        audited += 1;
      }
    }
    assert.equal(audited, 8 * 2, 'every state and viewport must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('cross-fade and panel controller props fail closed because the IR has no widgets', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-collapsible-gap-'));
  try {
    for (const [label, body, pattern] of [
      ['crossFadeState', 'Container(crossFadeState: 1) { Text("x") }', /unknown prop 'crossFadeState' on Container/],
      ['firstCurve', 'Container(firstCurve: "linear") { Text("x") }', /unknown prop 'firstCurve' on Container/],
      ['onEnd', 'Container(onEnd: "x") { Text("x") }', /unknown prop 'onEnd' on Container/],
      ['excludeBottomFocus', 'Container(excludeBottomFocus: true) { Text("x") }', /unknown prop 'excludeBottomFocus' on Container/],
      ['clipBehavior', 'Container(clipBehavior: "hardEdge") { Text("x") }', /unknown prop 'clipBehavior' on Container/],
    ]) {
      const src = path.join(tmp, `${label}.opu`);
      const ir = path.join(tmp, `${label}.json`);
      writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${body}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${label} must stay rejected until A2/B4 lands`);
      assert.match(c.stderr || '', pattern, `${label} diagnostic drifted`);
      assert.ok(!existsSync(ir), `${label} must not write an IR artifact`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
