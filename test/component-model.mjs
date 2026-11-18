// Shared component model for the opurom-ui gates.
// The gates parse the component modules themselves instead of hard-coding a
// component list, so a newly added module is covered automatically.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const componentsDir = path.resolve(import.meta.dirname, '..', 'components');

// Props whose values are validated against a closed vocabulary. The compiler
// rejects a wrong keyword before the component is lowered, so a generated
// program must pass a legal keyword for every forwarded prop.
//   opurom-lang/src/lower.rs:333-349  state/variant/tone design vocabularies
//   opurom-lang/src/lower.rs:248-265  animate vocabulary
//   opurom-lang/src/lower.rs:266-313  curve vocabulary
//   opurom-lang/src/lower.rs:314      gesture vocabulary
//   opurom-lang/src/lower.rs:319-332  iconStyle/role vocabularies
//   opurom-lang/src/lower.rs:1366-1400 color/border/textColor colour strings
//   opurom-lang/src/lower.rs:1507-1571 gradient and gradientDirection
//   opurom-lang/src/lower.rs:1622-1644 animationBehavior vocabulary
//   opurom-lang/src/lower.rs:1218-1234 Icon name vocabulary
export const PROP_LITERAL = {
  state: '"default"',
  variant: '"primary"',
  tone: '"info"',
  animate: '"none"',
  curve: '"linear"',
  reverseCurve: '"linear"',
  gesture: '"tap"',
  role: '"button"',
  iconStyle: '"outlined"',
  gradientDirection: '"vertical"',
  animationBehavior: '"normal"',
  color: '"#6200EE"',
  border: '"#6200EE"',
  textColor: '"#6200EE"',
  gradient: '"#6200EE,#006EFF"',
  name: '"home"',
};
export const PROP_PRIORITY = ['state', 'variant', 'tone', 'animate', 'curve', 'reverseCurve', 'gesture', 'role', 'iconStyle', 'animationBehavior', 'gradient', 'gradientDirection', 'color', 'border', 'textColor', 'name'];
export const TYPE_LITERAL = { string: '"x"', int: '1', bool: 'true' };
export const TYPE_NAME = { string: 'string', int: 'int', bool: 'bool' };
export const WRONG_LITERAL = { string: '1', int: '"x"', bool: '"x"' };
export const WRONG_NAME = { string: 'int', int: 'string', bool: 'string' };

export function stripComments(text) {
  return text
    .split('\n')
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

function bodyOf(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return '';
}

export function parseComponents(dir = componentsDir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.opu')).sort();
  const parsed = [];
  for (const file of files) {
    const raw = readFileSync(path.join(dir, file), 'utf8');
    const text = stripComments(raw);
    for (const m of text.matchAll(/^component\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/gm)) {
      const decl = m[0];
      const params = m[2].trim() === ''
        ? []
        : m[2].split(',').map((p) => p.trim()).map((p) => {
          const [name, type] = p.split(':').map((x) => x.trim());
          return { name, type };
        });
      const body = bodyOf(text, text.indexOf(decl) + decl.length - 1);
      parsed.push({ name: m[1], file: `components/${file}`, params, body });
    }
  }
  return parsed;
}

export function componentIndex(components) {
  return new Map(components.map((c) => [c.name, c]));
}

// A parameter may be forwarded to a prop as an interpolation ("{param}") or as
// a direct reference (param). Only identifiers that are declared parameters of
// the component are recorded, so a literal keyword never shadows a parameter.
export function forwardedProps(component) {
  const declared = new Set(component.params.map((p) => p.name));
  const map = new Map();
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:"\{([A-Za-z_][A-Za-z0-9_]*)\}"|([A-Za-z_][A-Za-z0-9_]*))/g;
  for (const m of component.body.matchAll(pattern)) {
    const param = m[2] ?? m[3];
    if (!declared.has(param)) continue;
    if (!map.has(param)) map.set(param, new Set());
    map.get(param).add(m[1]);
  }
  return map;
}

// Positional calls to other components, with their raw argument texts.
export function componentCalls(component) {
  const calls = [];
  for (const m of component.body.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\(([^()]*)\)/g)) {
    const args = m[2].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    calls.push({ name: m[1], args });
  }
  return calls;
}

// The props a parameter reaches, following positional forwarding into other
// components: a wrapper that forwards its third argument to a gesture
// parameter of a callee inherits the callee's gesture vocabulary.
export function effectiveProps(components) {
  const byName = componentIndex(components);
  const cache = new Map();
  const visiting = new Set();
  function resolve(component) {
    if (cache.has(component.name)) return cache.get(component.name);
    if (visiting.has(component.name)) return new Map();
    visiting.add(component.name);
    const declared = new Set(component.params.map((p) => p.name));
    const map = new Map();
    const add = (param, prop) => {
      if (!map.has(param)) map.set(param, new Set());
      map.get(param).add(prop);
    };
    const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:"\{([A-Za-z_][A-Za-z0-9_]*)\}"|([A-Za-z_][A-Za-z0-9_]*))/g;
    for (const m of component.body.matchAll(pattern)) {
      const param = m[2] ?? m[3];
      if (!declared.has(param)) continue;
      add(param, m[1]);
    }
    for (const call of componentCalls(component)) {
      const callee = byName.get(call.name);
      if (!callee) continue;
      const calleeProps = resolve(callee);
      call.args.forEach((arg, index) => {
        const m = arg.match(/^"\{([A-Za-z_][A-Za-z0-9_]*)\}"$/);
        if (!m || !declared.has(m[1])) return;
        const target = callee.params[index];
        if (!target) return;
        for (const prop of calleeProps.get(target.name) ?? []) add(m[1], prop);
      });
    }
    visiting.delete(component.name);
    cache.set(component.name, map);
    return map;
  }
  for (const component of components) resolve(component);
  return cache;
}

export function literalFor(component, param, props) {
  if (param.type === 'int') return TYPE_LITERAL.int;
  if (param.type === 'bool') return TYPE_LITERAL.bool;
  const forwarded = props.get(param.name) ?? new Set();
  for (const prop of PROP_PRIORITY) {
    if (forwarded.has(prop)) return PROP_LITERAL[prop];
  }
  if (param.name === 'state') return '"default"';
  if (param.name === 'animate') return '"none"';
  return TYPE_LITERAL.string;
}

export function literalsFor(component, effective) {
  const props = effective?.get(component.name) ?? forwardedProps(component);
  return component.params.map((param) => literalFor(component, param, props));
}

export function forwardedParam(component, prop) {
  const m = component.body.match(new RegExp(`\\b${prop}:\\s*"\\{([A-Za-z_][A-Za-z0-9_]*)\\}"`));
  return m ? m[1] : null;
}

// A parameter is free-form when it reaches no validated prop, so an empty or
// very long string is a legal value for it.
export function isFreeString(component, param, effective) {
  const props = effective?.get(component.name) ?? forwardedProps(component);
  const forwarded = props.get(param.name) ?? new Set();
  for (const prop of PROP_PRIORITY) {
    if (forwarded.has(prop)) return false;
  }
  return true;
}

// The compiler resolves every component of an imported module, not only the
// one the program calls, so a module must be imported together with the
// modules that provide the components it references.
export function moduleEdges(components) {
  const byName = componentIndex(components);
  const edges = new Map();
  for (const component of components) {
    const set = edges.get(component.file) ?? new Set();
    for (const other of components) {
      if (other.name === component.name || other.file === component.file) continue;
      if (new RegExp(`\\b${other.name}\\b`).test(component.body)) set.add(other.file);
    }
    edges.set(component.file, set);
  }
  return edges;
}

export function modulesFor(component, edges) {
  const modules = new Set([component.file]);
  const queue = [component.file];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of edges.get(current) ?? []) {
      if (modules.has(next)) continue;
      modules.add(next);
      queue.push(next);
    }
  }
  return [...modules].sort();
}

export function program(modules, use) {
  const imports = modules.map((m) => `import "${m}";`).join('\n');
  return `${imports}
app One {
  theme { mode: light, accent: "#6200EE", radius: 12, fontScale: 1.0, surface: "#FFFFFF", onSurface: "#000000", stage: "#FFFFFF", fontMetrics: proportional }
  ${use}
}
`;
}
