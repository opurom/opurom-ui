#!/usr/bin/env node
// Text truncation and information-hierarchy gate. It pins deterministic
// maxLines clipping for long/CJK/RTL/emoji text in card, list and header shells
// and records the renderer's glyph-level gap instead of faking Flutter output.
// Flutter 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) sources:
//   painting/text_painter.dart:48-56       TextOverflow.clip/ellipsis contract
//   painting/text_painter.dart:620-660     TextPainter(maxLines, ellipsis) and
//     `maxLines == null || maxLines > 0` assertion
//   rendering/paragraph.dart:336-376       RenderParagraph overflow/maxLines
//     forwards `ellipsis` to TextPainter
//   rendering/paragraph.dart:626-634,695-704 overflow/maxLines setters mark
//     layout dirty
// Opurom IR accepts `maxLines` (`FLUTTER_COMPONENT_MATRIX.md` Text row), but
// the pinned raster truncates with an ASCII `...` (`opurom-render/src/font.rs`
// wrap_width_limited; `raster.rs` max_lines test), not Flutter's glyph ellipsis
// and bidi-aware line breaker. This gate (a) replays 480 deterministic frames
// across 3 shells x 4 text classes x 8 states x 2 viewports x 2 ticks, (b)
// checks the a11y label survives clipping, (c) asserts the RTL directionality
// reaches IR and changes card/tile frames, and (d) records that glyph-level
// ellipsis/RTL shaping stays a render-kernel gap rather than claiming parity.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/text-truncation-digests.json'), 'utf8'));
const { toolchain, meta, pins } = doc;
const { profile } = toolchain;
const compiler = requireNative(root, 'opurom-lang-gal', ['opuromc'], profile);
const renderer = requireNative(root, 'opurom-render-gal', ['opurom-render', 'opurom_render'], profile);

assert.equal(toolchain.render, 'f3a8bcaeb88b82068beb8c9cc10353a300aca5f8', 'the pinned render commit must be unchanged');
assert.equal(toolchain.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1', 'the pinned lang commit must be unchanged');
assert.deepEqual(meta.kinds, ['card', 'tile', 'header'], 'the three information-hierarchy shells');
assert.deepEqual(meta.texts, ['long', 'cjk', 'rtl', 'emoji'], 'the four text classes');
assert.equal(pins.length, 480, 'three shells times four text classes times eight states times two viewports times two ticks times the RTL extra pass');

const DIGEST_RE = /^[0-9a-f]{16}$/;

function source(pin) {
  return `import "${pin.module}";
app One {
  ${pin.dir === 'rtl' ? 'directionality: rtl;\n  ' : ''}quality { msaa: 4 }
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
  return { digest, tree: a11y ? JSON.parse(readFileSync(treePath, 'utf8')) : null, irText: readFileSync(ir, 'utf8') };
}

test('every card/list/header text truncation frame replays its pin', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-trunc-pins-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      const name = `p-${pin.name}`;
      const { digest } = run(tmp, name, source(pin), pin.viewport, pin.tick);
      assert.equal(digest, pin.digest, `${pin.name} frame drifted`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('truncation frames are deterministic across repeated runs', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-trunc-determ-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const pin of pins) {
      const name = `d-${pin.name}`;
      const a = run(tmp, `${name}-1`, source(pin), pin.viewport, pin.tick).digest;
      const b = run(tmp, `${name}-2`, source(pin), pin.viewport, pin.tick).digest;
      assert.equal(a, b, `${pin.name} must render deterministically`);
      audited += 1;
    }
    assert.equal(audited, 480, 'every pin must be replayed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('maxLines reaches the IR and the a11y label survives clipping in every state', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-trunc-a11y-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    let audited = 0;
    for (const state of meta.states) {
      const pin = pins.find((p) => p.kind === 'card' && p.text === 'long' && p.dir === 'ltr' && p.state === state && p.tick === 0 && String(p.viewport) === '320,240');
      assert.ok(pin, `card long ${state} must own an a11y pin`);
      const result = run(tmp, `a-${state}`, source(pin), pin.viewport, 0, true);
      assert.match(result.irText, /"maxLines":\s*[12]/, `${state} must carry maxLines into the IR`);
      assert.ok(Array.isArray(result.tree), `${state} must produce a data-only a11y tree`);
      // The ElevatedCardM3 label node has role `none` (card surface), the
      // title/body carry the text role with the clipped label.
      assert.ok(result.tree.some((n) => n.label === 'elevated card' && !n.hidden), `${state} must keep the card label`);
      assert.ok(result.tree.some((n) => n.role === 'text' && n.label.startsWith('TTTT') && !n.hidden), `${state} must keep the clipped title in the a11y tree`);
      audited += 1;
    }
    assert.equal(audited, 8, 'every state must be audited');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('RTL directionality reaches the IR and changes the card/list frames', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-trunc-rtl-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const kind of ['card', 'tile']) {
      const rtlPin = pins.find((p) => p.kind === kind && p.text === 'rtl' && p.dir === 'rtl' && p.state === 'default' && p.tick === 200 && String(p.viewport) === '320,240');
      const ltrPin = pins.find((p) => p.kind === kind && p.text === 'rtl' && p.dir === 'ltr' && p.state === 'default' && p.tick === 200 && String(p.viewport) === '320,240');
      assert.ok(rtlPin && ltrPin, `${kind} must own both RTL and LTR pins`);
      const rtl = run(tmp, `rtl-${kind}`, source(rtlPin), rtlPin.viewport, 200);
      const ltr = run(tmp, `ltr-${kind}`, source(ltrPin), ltrPin.viewport, 200);
      assert.ok(rtl.irText.includes('"directionality": "rtl"'), `${kind} RTL must reach the IR`);
      assert.equal(rtl.digest, rtlPin.digest, `${kind} RTL frame drifted`);
      assert.equal(ltr.digest, ltrPin.digest, `${kind} LTR frame drifted`);
      assert.notEqual(rtl.digest, ltr.digest, `${kind} directionality must affect the frame`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('glyph-level ellipsis and bidi shaping stay registered render gaps', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-trunc-gap-'));
  try {
    for (const [label, body, pattern] of [
      ['ellipsis', 'Text("x", ellipsis: "…")', /unknown prop 'ellipsis' on Text/],
      ['overflow', 'Text("x", overflow: "ellipsis")', /unknown prop 'overflow' on Text/],
      ['textDirection', 'Text("x", textDirection: "rtl")', /unknown prop 'textDirection' on Text/],
      ['strutStyle', 'Text("x", strutStyle: "x")', /unknown prop 'strutStyle' on Text/],
    ]) {
      const src = path.join(tmp, `${label}.opu`);
      const ir = path.join(tmp, `${label}.json`);
      writeFileSync(src, `app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${body}
}
`);
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${label} must stay rejected until the render gap lands`);
      assert.match(c.stderr || '', pattern, `${label} diagnostic drifted`);
      assert.ok(!existsSync(ir), `${label} must not write an IR artifact`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
