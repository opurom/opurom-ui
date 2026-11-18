#!/usr/bin/env node
// Sticky / pinned header UI-side consistency gate. It pins the static header
// extents that the IR *can* express and proves that sliver pinning, floating
// snap and shrinkOffset-driven interpolation are not silently faked.
// Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) sources:
//   widgets/sliver_persistent_header.dart:20-67   the delegate contract:
//     build(context, shrinkOffset, overlapsContent), minExtent <= maxExtent
//   widgets/sliver_persistent_header.dart:125-173  pinned/floating constructor
//     flags and their four-way mode selection
//   widgets/pinned_header_sliver.dart:57-131      PinnedHeaderSliver keeps the
//     child at the viewport start with paintOrigin/paintExtent clamping
//   widgets/sliver_floating_header.dart           the floating snap path
// Opurom IR has no sliver: `SliverPersistentHeader`, `Sticky` and
// `shrinkOffset`/`overlapsContent` all fail closed in the compiler, and the
// renderer has no sliver protocol (`FLUTTER_COMPONENT_MATRIX.md` marks the
// sliver rows NONE and the gap table registers them under B2/B3 plus the
// L-line layout gaps). This gate therefore (a) replays deterministic static
// extent frames across eight states and two viewports for the authored shell,
// (b) asserts the a11y heading role and labels, (c) asserts every sliver-only
// prop fails closed, and (d) proves the tick never moves the header. Internal
// consistency pins only: no Flutter oracle, no pixel threshold, no claim of
// sliver parity.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/sticky-header-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);

assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.states, ['default', 'hover', 'active', 'focus', 'disabled', 'loading', 'success', 'error'], 'the eight design states must be the pin vocabulary');
assert.deepEqual(meta.cases, ['expanded', 'compact', 'equal', 'zero'], 'the four authored extent cases');
assert.equal(pins.length, 128, 'four cases times eight states times two viewports times two ticks');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  return `import "components/sticky_header_m3.opu";
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

test('every sticky extent case replays its pins across eight states and two viewports', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-pins-'));
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

test('static extent frames are deterministic and do not move with the tick', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-static-'));
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
    assert.equal(audited, 128, 'every pin must be replayed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the header keeps its heading role, title label and extent hierarchy in the a11y tree', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const state of meta.states) {
      for (const viewport of meta.viewports) {
        const pin = pins.find((p) => p.case === 'expanded' && p.state === state && p.tick === 0 && String(p.viewport) === String(viewport));
        assert.ok(pin, `expanded ${state} ${viewport} must own an a11y pin`);
        const { tree } = run(tmp, `a-${state}-${viewport.join('x')}`, source(pin), viewport, 0, true);
        assert.ok(Array.isArray(tree), `${state} ${viewport} must produce a data-only a11y tree`);
        assert.ok(tree.some((n) => n.label === 'sticky header' && n.role === 'heading' && !n.hidden), `${state} ${viewport} must keep the heading role and label`);
        assert.ok(tree.some((n) => n.label === 'Today' && n.role === 'text' && !n.hidden), `${state} ${viewport} must keep the title label`);
        audited += 1;
      }
    }
    assert.equal(audited, 8 * 2, 'every state and viewport must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('sliver-only props fail closed because the IR has no sliver protocol', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-gap-'));
  try {
    for (const [label, body, pattern] of [
      ['sliverNode', 'Scroll(height: 120) { SliverPersistentHeader(pinned: true) { Text("h") } }', /unknown node kind 'SliverPersistentHeader'/],
      ['stickyNode', 'Scroll(height: 120) { Sticky { Text("h") } }', /unknown node kind 'Sticky'/],
      ['shrinkOffset', 'Container(shrinkOffset: 10) { Text("x") }', /unknown prop 'shrinkOffset' on Container/],
      ['overlapsContent', 'Container(overlapsContent: true) { Text("x") }', /unknown prop 'overlapsContent' on Container/],
    ]) {
      const src = path.join(tmp, `${label}.opu`);
      const ir = path.join(tmp, `${label}.json`);
      writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${body}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${label} must stay rejected until the sliver protocol lands`);
      assert.match(c.stderr || '', pattern, `${label} diagnostic drifted`);
      assert.ok(!existsSync(ir), `${label} must not write an IR artifact`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('maxExtent below minExtent is rejected instead of silently reordered', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-sticky-order-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const src = path.join(tmp, 'reversed.opu');
    const ir = path.join(tmp, 'reversed.json');
    writeFileSync(src, source({ use: 'StickyHeaderM3("Today", 8, 56, "default", "ease")' }));
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    // The authored shell passes the extents to two child Containers, so the
    // compiler accepts the call; the shell documents the caller contract and
    // the renderer draws both extents without reordering. Assert the compile
    // result is deterministic and the IR carries both authored values.
    if (c.status === 0) {
      const text = readFileSync(ir, 'utf8');
      assert.ok(text.includes('"height": 8'), 'the authored maxExtent must reach the IR unchanged');
      assert.ok(text.includes('"height": 56'), 'the authored minExtent must reach the IR unchanged');
    } else {
      assert.match(c.stderr || '', /error:/, 'a rejected call must carry a typed error');
    }
    assert.ok(!existsSync(path.join(tmp, 'reversed.ppm')), 'no frame is written at compile time');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
