#!/usr/bin/env node
// Expansion/collapse animation consistency gate. Authoritative layer:
// `opurom-render/src/anim.rs` (the fixed-point `animate` schedule) and
// `opurom-ui/components/expansion_m3.opu` (the ExpandablePanelM3 shell).
// Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) sources:
//   material/expansion_tile.dart:118-140   constructor, title/subtitle,
//     initiallyExpanded/maintainState contract
//   material/expansion_tile.dart:27        `_kExpand` = 200 ms
//   material/expansion_tile.dart:504-530   `_easeInTween` (Curves.easeIn),
//     `_easeOutTween`, `_halfTween`; the default `_curve`/`_duration`
//   material/expansion_tile.dart:807-870   `_updateAnimationDuration` keeps
//     200 ms, `_updateHeightFactorCurve` defaults `_curve` to `Curves.easeIn`
//   widgets/expansible.dart:390-475        the 0..1 heightFactor tween driven
//     by a `CurvedAnimation` (curve + `reverseCurve`), rendered as
//     `ClipRect(child: Align(heightFactor: ...))`
// Opurom has no `heightFactor`/`ClipRect` in the IR (align accepts only
// start/center/end; `FLUTTER_COMPONENT_MATRIX.md` marks `heightFactor` a gap
// in the Align row), and `reverseCurve` has no consumer (`opurom-lang/src/
// lower.rs:1599` accepts the keyword but the render IR parses no such prop).
// The kernel gap is A2 (geometry lerp) plus a heightFactor/ClipRect primitive:
// the component therefore animates the pinned five animated props with the
// 200 ms token and never fakes an expand/collapse height. This gate asserts
// the shell's pinned animation schedule is deterministic across the eight
// design states, that the two accepted `animate` tokens produce distinct
// progressions, and that the a11y role/label survive every progress. Internal
// consistency pins only: there is no Flutter expansion oracle and no 2%/12%
// pixel threshold.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/expansion-animation-digests.json'), 'utf8'));
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
assert.deepEqual(meta.animates, ['ease', 'spring'], 'the two accepted animate tokens');
assert.deepEqual(meta.ticks, [0, 50, 100, 200, 400], 'the documented tick progression across the 200 ms token');
assert.equal(pins.length, 80, 'eight states times two tokens times five ticks');

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

function run(dir, name, text, tick, a11y = false) {
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

test('every eight-state design reaches an expansion animation under both tokens', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-expansion-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      const name = `t-${pin.state}-${pin.animate}-${pin.tick}`;
      const { digest } = run(tmp, name, source(pin), pin.tick);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('expansion animations are deterministic across repeated runs of the same pin', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-expansion-determ-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let checked = 0;
    for (const pin of pins) {
      const name = `d-${pin.state}-${pin.animate}-${pin.tick}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.tick).digest;
      const b = run(tmp, `${name}-2`, source(pin), pin.tick).digest;
      assert.equal(a, b, `${pin.name} must render deterministically`);
      checked += 1;
    }
    assert.ok(checked >= pins.length, 'every pin must be replayed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the two animate tokens produce distinct progressions and settle by 200 ms', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-expansion-tokens-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const state of meta.states) {
      const easeStart = pins.find((p) => p.state === state && p.animate === 'ease' && p.tick === 0);
      const springStart = pins.find((p) => p.state === state && p.animate === 'spring' && p.tick === 0);
      assert.equal(easeStart.digest, springStart.digest, `${state} must start from the same rest frame`);
      const easeSettled = pins.find((p) => p.state === state && p.animate === 'ease' && p.tick === SETTLED);
      const springSettled = pins.find((p) => p.state === state && p.animate === 'spring' && p.tick === SETTLED);
      // Both tokens reach the same authored target by the end of the 200 ms
      // shell schedule; their intermediate trajectories are distinct below.
      assert.equal(easeSettled.digest, springSettled.digest, `${state} must reach the same authored target`);
      assert.notEqual(easeStart.digest, easeSettled.digest, `${state} ease must change its frame`);
      const easeMid = pins.find((p) => p.state === state && p.animate === 'ease' && p.tick === 50);
      const springMid = pins.find((p) => p.state === state && p.animate === 'spring' && p.tick === 50);
      assert.notEqual(easeMid.digest, springMid.digest, `${state} tokens must differ at 50 ms`);
      audited += 1;
    }
    assert.equal(audited, 8, 'every state must be audited for token distinctness');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the 200 ms token matches Flutter expansion_tile duration and the a11y role survives every progress', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-expansion-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const pin = pins.find((p) => p.state === 'default' && p.animate === 'ease' && p.tick === 0);
    assert.ok(pin, 'a pinned default ease composition must exist');
    const ir = path.join(tmp, 'a11y-ir.json');
    const src = path.join(tmp, 'a11y.opu');
    writeFileSync(src, source(pin));
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `a11y compile failed: ${c.stderr}`);
    const irText = readFileSync(ir, 'utf8');
    assert.match(irText, /"duration":\s*200/, 'the 200 ms expansion token must reach the IR');
    for (const tick of meta.ticks) {
      const { tree } = run(tmp, `a-${tick}`, source(pin), tick, true);
      assert.ok(Array.isArray(tree), `${tick} must produce a data-only a11y tree`);
      assert.ok(tree.some((n) => n.label === 'expansion tile' && n.role === 'button' && !n.hidden), `${tick} must keep the expansion role and label`);
      assert.ok(tree.some((n) => n.label === 'Details default' && !n.hidden), `${tick} must keep the title label`);
      assert.ok(tree.some((n) => n.label === 'Body content' && !n.hidden), `${tick} must keep the body label`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('heightFactor and ClipRect stay registered kernel gaps, not silently faked', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-expansion-gap-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [label, body, pattern] of [
      ['heightFactor', `Column { Container(heightFactor: 0.5) { Text("x") } }`, /unknown prop 'heightFactor' on Container/],
      ['ClipRect', `Column { ClipRect { Text("x") } }`, /unknown node kind 'ClipRect'/],
    ]) {
      const src = path.join(tmp, `${label}.opu`);
      const ir = path.join(tmp, `${label}.json`);
      writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${body}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${label} must stay rejected until the kernel gap lands`);
      assert.match(c.stderr || '', pattern, `${label} diagnostic drifted`);
      assert.ok(!existsSync(ir), `${label} must not write an IR artifact`);
    }
    // `reverseCurve` is accepted by the compiler but has no render consumer:
    // it is carried into the IR verbatim and never drives a heightFactor.
    const src = path.join(tmp, 'reverse-curve.opu');
    const ir = path.join(tmp, 'reverse-curve.json');
    writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  Container(width: 80, height: 40, curve: "easeIn", reverseCurve: "easeOut") { Text("x") }
}
`);
    const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
    assert.equal(c.status, 0, `reverseCurve must compile as a carried prop: ${c.stderr}`);
    assert.match(readFileSync(ir, 'utf8'), /"reverseCurve":\s*"easeOut"/, 'reverseCurve must reach the IR unchanged');
    const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, 'reverse-curve.ppm'), '--tick', '100'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `reverseCurve must render without a panic: ${r.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
