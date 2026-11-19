// Native sibling binaries are the only source of truth for the frame digests.
// Locally they may be absent; in CI they are provisioned by ci.yml. A missing
// binary must fail the test, never turn it into a silent skip.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function findNative(root, repo, names, profile = 'debug') {
  // Signed golden pins are release-calibrated: CI builds the pinned toolchain
  // with `cargo build` (debug) but the committed frames were measured from
  // release binaries. Prefer release when both exist, so local and CI runs
  // agree with the signed pin instead of drifting on debug-only output.
  for (const dir of ['release', 'debug']) {
    for (const name of names) {
      const candidate = path.resolve(root, '..', repo, 'target', dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function requireNative(root, repo, names, profile = 'debug') {
  const binary = findNative(root, repo, names, profile);
  assert.ok(binary, `${repo} native binary not found; CI must provision it at the signed commit`);
  return binary;
}
