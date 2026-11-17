#!/usr/bin/env node
// Gallery structural parity: Material 3 AppBar and NavigationBar metrics plus a
// rendered-frame pin for each. Flutter authority (revision ab2912035e):
// app_bar.dart:2526 toolbarHeight 64.0 (kToolbarHeight 56 is the M2 constant),
// :2546 leading icon 24, :2560 title titleLarge 22/400;
// navigation_bar.dart:1430 height 80.0, :1431 elevation 3.0, label labelMedium 12.
// Pins live in their own file: uibuild's digests.json / state-digests.json are
// owned by the base-component line and are not touched here.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/gallery-structure.pins.json'), 'utf8'));
const compiler = requireNative(root, 'opurom-lang', ['opuromc']);
const renderer = requireNative(root, 'opurom-render', ['opurom-render', 'opurom_render']);

function run(tool, args) {
  const r = spawnSync(tool, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `${path.basename(tool)} failed: ${r.stderr}`);
  return r;
}

function render(name, module, call) {
  const tmp = mkdtempSync(path.join(tmpdir(), `gallery-${name}-`));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const host = path.join(tmp, 'host.opu');
    writeFileSync(
      host,
      `import "${module}";\napp One {\n  quality { msaa: 4 }\n  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }\n  Column(p: 0) {\n    ${call}\n  }\n}\n`,
    );
    const ir = path.join(tmp, 'host.json');
    run(compiler, ['compile', host, '-o', ir]);
    const out = run(renderer, [ir, String(doc.viewport[0]), String(doc.viewport[1]), path.join(tmp, 'host.ppm')]);
    const digest = (out.stdout || '').match(/digest=([0-9a-f]+)/i);
    assert.ok(digest, `${name} produced no render digest`);
    return { node: JSON.parse(readFileSync(ir, 'utf8')).tree.children[0], digest: digest[1] };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('AppBarShell matches the M3 AppBar metrics', () => {
  const { node, digest } = render(
    'appbar',
    'components/app_bar.opu',
    'AppBarShell("Title", "arrow_back", "More", "default")',
  );
  assert.equal(node.props.height, 64, 'app_bar.dart:2526 toolbarHeight');
  const row = node.children[0];
  assert.equal(row.props.gap, 16, 'app_bar.dart:2543 titleSpacing');
  const [icon, title, , action] = row.children.map((c) => c.props);
  assert.equal(icon.width, 24, 'app_bar.dart:2546 leading icon size');
  assert.equal(icon.height, 24);
  assert.equal(title.size, 22, 'app_bar.dart:2560 titleTextStyle titleLarge');
  assert.equal(action.size, 14, 'M3 action labelLarge');
  assert.equal(digest, doc.pins.AppBarShell.digest);
});

test('BottomNav matches the M3 NavigationBar metrics', () => {
  const { node, digest } = render(
    'navbar',
    'components/bottom_navigation_bar.opu',
    'BottomNav("Home,Search,Profile", 0, 3, "default", "tap")',
  );
  assert.equal(node.props.height, 80, 'navigation_bar.dart:1430 height');
  assert.equal(node.props.shadow, 3, 'navigation_bar.dart:1431 elevation');
  assert.equal(digest, doc.pins.BottomNav.digest);
});