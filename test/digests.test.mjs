#!/usr/bin/env node
// Component digest regression lock: every component renders in a minimal host
// and the frame digest must equal the pinned value in digests.json. A digest
// drift means a component changed its pixels; refresh pins only when the change
// is intentional and note the provenance in the pin file.
// Native binaries are required; a missing binary fails, it never skips.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
// Signed against render 8a76e1d and lang 6d5cb74; every pin carries its own
// attribution. The old pin era (0e7d01b) was reproduced byte-for-byte before
// re-signing, and the default-path digest 8d45f412996a99c6 stayed green.
const doc = JSON.parse(readFileSync(path.join(root, 'test/digests.json'), 'utf8'));
const { toolchain, pins } = doc;
const compiler = requireNative(root, 'opurom-lang', ['opuromc'], toolchain.profile);
const renderer = requireNative(root, 'opurom-render', ['opurom-render', 'opurom_render'], toolchain.profile);

function run(tool, args) {
  return spawnSync(tool, args, { encoding: 'utf8' });
}

test('every pinned component digest still matches its render', () => {
  assert.equal(toolchain.render, '8a76e1dfdddc8b82ed5284cabd2921f17cd73571');
  assert.equal(toolchain.lang, '6d5cb7454d904a7a62af5aef3cf6672e892d9013');
  assert.equal(toolchain.defaultPathDigest, '8d45f412996a99c6');
  assert.ok(Object.keys(pins).length === 52, 'all 52 pins must be present');
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-digests-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [name, pin] of Object.entries(pins)) {
      assert.ok(pin.attribution?.renderCommit, `${name} needs a render-commit attribution`);
      assert.ok(pin.attribution?.reason, `${name} needs a drift classification`);
      const host = path.join(tmp, `one_${name}.opu`);
      writeFileSync(host, `import "${pin.module}";\napp One { Column(p: 16) { ${pin.use} } }\n`);
      const compiled = run(compiler, ['compile', host, '-o', path.join(tmp, `one_${name}.json`)]);
      assert.equal(compiled.status, 0, `${name} failed to compile: ${compiled.stderr}`);
      const rendered = run(renderer, [path.join(tmp, `one_${name}.json`), '320', '240', path.join(tmp, `${name}.ppm`)]);
      assert.equal(rendered.status, 0, `${name} failed to render: ${rendered.stderr}`);
      const match = (rendered.stdout || '').match(/digest=([0-9a-f]+)/i);
      assert.ok(match, `${name} produced no digest`);
      assert.equal(match[1], pin.digest, `${name} digest drifted: got ${match[1]}, pinned ${pin.digest}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
