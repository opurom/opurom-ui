#!/usr/bin/env node
// Component API parameter-boundary and diagnostic-consistency gate.
// Flutter stable 3.50.0 (ab2912035e160d9cad6306df307576da6128ebdb) source anchors:
//   card.dart:80-89               Card constructor contract
//   list_tile.dart:391-430        ListTile constructor contract
//   date_picker.dart:196-215      showDatePicker required parameters
//   time_picker.dart:3246-3290    showTimePicker required initialTime
//   autocomplete.dart:61-68       Autocomplete required optionsBuilder
// Opurom's compiler rejects parameter mismatches with typed, source-positioned
// diagnostics (opurom-lang/src/lower.rs:1097,1166,2094 and the component
// parameter checker). This gate asserts four diagnostic classes stay stable
// across M3 modules: wrong type, unknown prop, invalid state keyword, and
// missing/extra arguments. Each invalid program must fail closed with a
// message naming the component and the expectation, never panic and never
// write an artifact.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requireNative } from './native-tools.mjs';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(readFileSync(path.join(root, 'test/state-digests.json'), 'utf8')).meta;
const compiler = requireNative(root, 'opurom-lang-statedigests', ['opuromc'], meta.profile);

const CASES = [
  // [name, source, expected pattern]
  ['wrong-type-int', 'components/pickers_m3.opu', 'DatePickerM3(1, 2, "x", "y")', /parameter 'label' of component 'DatePickerM3' expects string/],
  ['missing-arg', 'components/pickers_m3.opu', 'DatePickerM3("Date", 18, "default")', /expects 4 arguments, found 3/],
  ['extra-arg', 'components/pickers_m3.opu', 'DatePickerM3("Date", 18, "default", "ease", 1)', /expects 4 arguments, found 5/],
  ['unknown-prop', 'components/menu_m3.opu', 'Text("x", bogus: 1)', /unknown prop 'bogus' on Text/],
  ['invalid-state', 'components/actions_m3.opu', 'FabM3("plus", "nope", "ease")', /unknown state value 'nope'/],
  ['invalid-state-menu', 'components/menu_m3.opu', 'PopupMenuM3("Open,Copy,Close", 160, "bogus", "ease")', /unknown state value 'bogus'/],
  ['wrong-prop-type', 'components/actions_m3.opu', 'FabM3("plus", "default", 1)', /parameter 'animate' of component 'FabM3' expects string/],
  ['missing-required', 'components/forms_m3.opu', 'FormFieldM3("Email")', /expects 7 arguments, found 1/],
];

function source(mod, use) {
  return `import "${mod}";
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}

test('invalid component parameters fail closed with typed diagnostics', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-param-diagnostics-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    for (const [name, mod, use, pattern] of CASES) {
      const src = path.join(tmp, `${name}.opu`);
      const ir = path.join(tmp, `${name}.json`);
      writeFileSync(src, source(mod, use));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.notEqual(c.status, 0, `${name} must fail compilation`);
      const output = `${c.stderr}\n${c.stdout}`;
      assert.match(output, pattern, `${name} diagnostic drifted: ${output}`);
      assert.match(output, /error:/, `${name} diagnostic must be typed as an error`);
      assert.match(output, /help:/, `${name} diagnostic must carry help text`);
      assert.ok(!existsSync(ir), `${name} must not write an IR artifact on failure`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('valid components still compile after diagnostic boundaries', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'uibuild-param-valid-'));
  try {
    cpSync(path.join(root, 'components'), path.join(tmp, 'components'), { recursive: true });
    const valid = [
      ['components/pickers_m3.opu', 'DatePickerM3("Date", 18, "default", "ease")'],
      ['components/actions_m3.opu', 'FabM3("plus", "default", "ease")'],
      ['components/menu_m3.opu', 'PopupMenuM3("Open,Copy,Close", 160, "default", "ease")'],
      ['components/forms_m3.opu', 'FormFieldM3("Email", "you@example.com", true, 3, 60, "default", "ease")'],
    ];
    for (const [index, [mod, use]] of valid.entries()) {
      const src = path.join(tmp, `v${index}.opu`);
      const ir = path.join(tmp, `v${index}.json`);
      writeFileSync(src, source(mod, use));
      const c = spawnSync(compiler, ['compile', src, '-o', ir], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${use} must compile: ${c.stderr}`);
      assert.ok(existsSync(ir), `${use} must write its IR artifact`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
