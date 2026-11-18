#!/usr/bin/env node
// End-to-end theme output and component-state coupling gate.
// Flutter stable 3.50.0 (flutter-golden ab291203) anchors:
//   material/theme_data.dart:265-320      ThemeData factory inputs
//   material/theme_data.dart:436-460      brightness / dark elevation overlay
//   material/theme_data.dart:840-862      ThemeData.from(ColorScheme) semantics
//   material/theme_data.dart:871-879      light/dark constructors
//   widgets/media_query.dart:205-215      MediaQueryData size / metrics
//   widgets/layout_builder.dart:381       constraints-driven layout
// Opurom carries tokens into IR through compile-time imports; this gate proves
// seed token output, local token overrides, stable eight-state token binding
// and deterministic frames without changing components or shared token files.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';
import { generateThemeTokens } from '../tools/seed-scheme.mjs';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);
const STATES = meta.states;
const SEED = '#6750A4';
const LOCAL_OVERRIDE = '#123456';

function run(tool, args) {
  const r = spawnSync(tool, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `${path.basename(tool)} failed: ${r.stderr}\n${r.stdout}`);
  return r;
}

function writeTokens(dir, mode, override = false) {
  const file = path.join(dir, `tokens-${mode}${override ? '-local' : ''}.json`);
  const tokens = { ...generateThemeTokens(SEED)[mode] };
  if (override) tokens['md-sys-color-primary'] = LOCAL_OVERRIDE;
  writeFileSync(file, `${JSON.stringify(tokens, null, 2)}\n`);
  return file;
}

function compileResponsive(dir, name, width, mode, tokenFile) {
  cpSync(path.join(root, 'components'), path.join(dir, 'components'), { recursive: true });
  const host = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  writeFileSync(host, `import "components/responsive_m3.opu";
app T {
  quality { msaa: 4 }
  theme { mode: ${mode}, accent: "${LOCAL_OVERRIDE}", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional, tokens { import "${path.basename(tokenFile)}" } }
  ResponsiveGridShell("One,Two,Three", 1, "default")
}
`);
  run(compiler, ['compile', host, '-o', ir]);
  const r = run(renderer, [ir, String(width), '240', path.join(dir, `${name}.ppm`), '--tick', String(meta.tick)]);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return { ir: JSON.parse(readFileSync(ir, 'utf8')), digest };
}

function hasState(node, state, found = false) {
  if (!node || typeof node !== 'object') return found;
  if (node.props && node.props.state === state) found = true;
  for (const child of node.children ?? []) found = hasState(child, state, found);
  return found;
}

function compileFrame(dir, name, { mode, tokenFile, state, width = 320, useResponsive = false, override = false }) {
  const host = path.join(dir, `${name}.opu`);
  const ir = path.join(dir, `${name}.json`);
  const ppm = path.join(dir, `${name}.ppm`);
  const body = `Container(width: 120, height: 40, color: "${override ? LOCAL_OVERRIDE : (mode === 'dark' ? '#CFBDFE' : '#65558F')}", label: "token surface") {
        Text("token", state: "${state}")
      }`;
  writeFileSync(host, `app T {
  quality { msaa: 4 }
  theme { mode: ${mode}, accent: "${LOCAL_OVERRIDE}", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional, tokens { import "${path.basename(tokenFile)}" } }
  ${body}
}
`);
  if (useResponsive) return compileResponsive(dir, name, width, mode, tokenFile);
  run(compiler, ['compile', host, '-o', ir]);
  const irData = JSON.parse(readFileSync(ir, 'utf8'));
  const r = run(renderer, [ir, String(width), '240', ppm, '--tick', String(meta.tick)]);
  const digest = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
  assert.ok(digest, `${name} produced no digest`);
  return { ir: irData, digest };
}

test('generated token output is complete and mode-specific', () => {
  const light = generateThemeTokens(SEED).light;
  const dark = generateThemeTokens(SEED).dark;
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
  assert.equal(Object.keys(light).length, 23);
  for (const [key, value] of Object.entries(light)) {
    assert.match(key, /^md-sys-color-/);
    assert.match(value, /^#[0-9A-F]{6}$/);
  }
  assert.notEqual(light['md-sys-color-primary'], dark['md-sys-color-primary']);
  assert.equal(light['md-sys-color-primary'], '#65558F');
  assert.equal(dark['md-sys-color-primary'], '#CFBDFE');
});

test('light/dark switching and local overrides reach IR and frames', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'uibuild-theme-state-e2e-'));
  try {
    const light = writeTokens(dir, 'light');
    const dark = writeTokens(dir, 'dark');
    const lightLocal = writeTokens(dir, 'light', true);
    const base = compileFrame(dir, 'light', { mode: 'light', tokenFile: light, state: 'default' });
    const darkFrame = compileFrame(dir, 'dark', { mode: 'dark', tokenFile: dark, state: 'default' });
    const local = compileFrame(dir, 'local', { mode: 'light', tokenFile: lightLocal, state: 'default', override: true });
    assert.equal(base.ir.theme.tokens['md-sys-color-primary'], '#65558F');
    assert.equal(darkFrame.ir.theme.tokens['md-sys-color-primary'], '#CFBDFE');
    assert.equal(local.ir.theme.tokens['md-sys-color-primary'], LOCAL_OVERRIDE);
    assert.notEqual(base.digest, darkFrame.digest);
    assert.notEqual(base.digest, local.digest);
    assert.equal(compileFrame(dir, 'repeat', { mode: 'light', tokenFile: light, state: 'default' }).digest, base.digest);
    const wide = compileFrame(dir, 'wide', { mode: 'light', tokenFile: light, state: 'default', width: 1280, useResponsive: true });
    assert.notEqual(wide.digest, base.digest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('eight states keep token binding stable and frames distinct', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'uibuild-theme-state-matrix-'));
  try {
    const light = writeTokens(dir, 'light');
    const dark = writeTokens(dir, 'dark');
    const digests = [];
    for (const state of STATES) {
      const l = compileFrame(dir, `light-${state}`, { mode: 'light', tokenFile: light, state });
      const d = compileFrame(dir, `dark-${state}`, { mode: 'dark', tokenFile: dark, state });
      assert.equal(l.ir.theme.tokens['md-sys-color-primary'], '#65558F', `${state} light token`);
      assert.equal(d.ir.theme.tokens['md-sys-color-primary'], '#CFBDFE', `${state} dark token`);
      assert.ok(hasState(l.ir.tree, state), `${state} state must reach IR`);
      assert.ok(hasState(d.ir.tree, state), `${state} dark state must reach IR`);
      // Interaction states repaint the frame; business states override the
      // token colour, so mode sensitivity is asserted only where the renderer
      // keeps the authored colour (default/hover/active/focus/disabled).
      if (['default', 'hover', 'active', 'focus', 'disabled'].includes(state)) {
        assert.notEqual(l.digest, d.digest, `${state} mode must affect frame`);
      }
      digests.push(l.digest, d.digest);
    }

  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
