#!/usr/bin/env node
// Component digest regression lock: every component renders in a minimal host
// and the frame digest must equal the pinned value in digests.json. A digest
// drift means a component changed its pixels; refresh pins only when the change
// is intentional and note it in the commit ("digest refreshed intentionally").
// Skips honestly when the sibling toolchain binaries are not built.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const pins = JSON.parse(readFileSync(path.join(root, 'test/digests.json'), 'utf8'));

function siblingBinary(repo, names) {
  for (const profile of ['debug', 'release']) {
    for (const name of names) {
      const candidate = path.resolve(root, '..', repo, 'target', profile, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const compiler = siblingBinary('opurom-lang', ['opuromc']);
const renderer = siblingBinary('opurom-render', ['opurom-render', 'opurom_render']);

function run(tool, args) {
  return spawnSync(tool, args, { encoding: 'utf8' });
}

test('every pinned component digest still matches its render', { skip: !compiler || !renderer }, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'opurom-ui-digests-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [name, pin] of Object.entries(pins)) {
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
