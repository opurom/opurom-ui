#!/usr/bin/env node
// Emit compile-time Material 3 colour tokens from one seed colour.
// Flutter stable 3.50.0 source is recorded in seed-scheme.mjs; this CLI only
// writes a flat md-* colour object in the compiler's import grammar.
// The generated file is inert data: no runtime interpretation is introduced.
import { writeFileSync } from 'node:fs';
import { generateThemeTokens } from './seed-scheme.mjs';

const [seed, output, mode = 'light'] = process.argv.slice(2);
if (!seed || !output) {
  process.stderr.write('usage: node tools/emit-theme.mjs <#RRGGBB> <output.json> [light|dark]\n');
  process.exit(64);
}
if (!/^#[0-9A-Fa-f]{6}$/.test(seed)) {
  process.stderr.write(`invalid seed ${seed}: expected #RRGGBB\n`);
  process.exit(65);
}
if (mode !== 'light' && mode !== 'dark') {
  process.stderr.write(`invalid mode ${mode}: expected light or dark\n`);
  process.exit(66);
}
const tokens = generateThemeTokens(seed)[mode];
writeFileSync(output, `${JSON.stringify(tokens, null, 2)}\n`);
process.stdout.write(`wrote ${Object.keys(tokens).length} ${mode} md-sys-color tokens to ${output}\n`);
