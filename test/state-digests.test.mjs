#!/usr/bin/env node
// Independent non-default state pin gate. These are internal consistency pins
// for the signed state-transition renderer, not Flutter pixel parity: no Flutter
// oracle, font file, 2%/12% diff threshold, or comparison to WidgetState is used.
// loading/success/error are business states (NO_FLUTTER_EQUIVALENT).
// The pinned default-state gate in digests.json is untouched by this file.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8'));
const { meta, pins } = doc;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);
const renderer = requireNative(root, 'opurom-render-statedigests', ['opurom-render', 'opurom_render'], meta.profile);
const [width, height] = meta.viewport;

function source(pin) {
  return `import "${pin.module}";
app One {
  quality { msaa: 4 }
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${pin.use}
}
`;
}

test('state digests pin settled frames under the signed toolchain', () => {
  assert.equal(meta.purpose, 'internal consistency pins, not Flutter parity');
  assert.equal(meta.render, '7ec55e0d6098dda2fff1e1c4150c5189f59d6bb2');
  assert.equal(meta.lang, 'd1a0418179fd20c58a899d012dffb82ac5f7d8a1');
  assert.equal(meta.tick, 4000);
  assert.equal(pins.length, 764, '10 components x 6 states plus 88 eight-state components');
  assert.equal(meta.states.length, 8, 'the eight state keywords must be declared');
  const byComponent = new Map();
  const expected = new Map();
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-state-digests-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const pin of pins) {
      assert.ok(meta.states.includes(pin.state), `${pin.name} has an unknown state`);
      const src = path.join(tmp, `${pin.name}.opu`);
      const ir = path.join(tmp, `${pin.name}.json`);
      writeFileSync(src, source(pin));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${pin.name} compile failed: ${c.stderr}`);
      const r = spawnSync(renderer, [ir, String(width), String(height), path.join(tmp, `${pin.name}.ppm`), '--tick', String(meta.tick)], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${pin.name} render failed: ${r.stderr}`);
      const got = (r.stdout || '').match(/digest=([0-9a-f]+)/i)?.[1];
      assert.ok(got, `${pin.name} produced no digest`);
      assert.equal(got, pin.digest, `${pin.name} state digest drifted: got ${got}, pinned ${pin.digest}`);
      const component = pin.name.slice(0, pin.name.lastIndexOf('-'));
      expected.set(component, (expected.get(component) ?? 0) + 1);
      if (!byComponent.has(component)) byComponent.set(component, new Set());
      byComponent.get(component).add(got);
    }
    assert.equal(byComponent.size, 98, '98 core components must be covered');
    for (const [component, digests] of byComponent) {
      assert.equal(digests.size, expected.get(component), `${component} state frames must stay distinct`);
    }
    console.log('state digests OK', `${byComponent.size} components, ${pins.length} pins, settle tick ${meta.tick}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
