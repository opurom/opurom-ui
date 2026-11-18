// Flutter Material 3 theme and responsive breakpoint rules for Opurom UI
// tooling. Flutter stable 3.50.0 (flutter-golden ab291203) source anchors:
//   material/theme_data.dart:265-320       ThemeData factory parameters
//   material/theme_data.dart:416-420       M3 splash factory selection
//   material/theme_data.dart:458-460       dark elevation overlay default
//   material/theme_data.dart:491-522       ColorScheme-driven typography
//   material/theme_data.dart:840-862       ThemeData.from(colorScheme)
//   widgets/media_query.dart:205           viewport size source
//   widgets/layout_builder.dart:381        constraints-driven layout
//   material/constants.dart:30             56dp toolbar baseline
//   material/navigation_rail.dart:1236-1244 M3 80dp / 256dp rail widths
// Opurom's deterministic renderer maps width to the same five tiers in
// opurom-render/src/layout.rs:50-74 with a 120px minimum column and clamp
// 1..12 at :76-109. These are data-only rules; no runtime interpretation and
// no change to shared theme/material-tokens.json.

export const BREAKPOINTS = Object.freeze([
  { name: 'compact', min: 0, max: 599, maxColumns: 4 },
  { name: 'medium', min: 600, max: 899, maxColumns: 8 },
  { name: 'expanded', min: 900, max: 1199, maxColumns: 12 },
  { name: 'wide', min: 1200, max: 1599, maxColumns: 12 },
  { name: 'ultra', min: 1600, max: Number.MAX_SAFE_INTEGER, maxColumns: 12 },
]);

export const MIN_COLUMN_WIDTH = 120; // render/src/layout.rs:78
export const MAX_COLUMNS = 12; // render/src/layout.rs:79

export function breakpointFor(width) {
  if (!Number.isInteger(width) || width < 0) {
    throw new RangeError(`width must be a non-negative integer, found ${width}`);
  }
  return BREAKPOINTS.find((b) => width >= b.min && width <= b.max)?.name
    ?? BREAKPOINTS[BREAKPOINTS.length - 1].name;
}

export function fluidColumns(width, requested) {
  if (!Number.isInteger(requested) || requested < 1) {
    throw new RangeError(`requested columns must be >= 1, found ${requested}`);
  }
  const tier = BREAKPOINTS.find((b) => b.name === breakpointFor(width));
  const byWidth = Math.floor(width / MIN_COLUMN_WIDTH);
  return Math.max(1, Math.min(MAX_COLUMNS, tier.maxColumns, requested, byWidth));
}

export function themeRules(mode, seedScheme) {
  if (mode !== 'light' && mode !== 'dark') {
    throw new RangeError(`theme mode must be light or dark, found ${mode}`);
  }
  const isDark = mode === 'dark';
  return Object.freeze({
    mode,
    useMaterial3: true,
    colorScheme: Object.freeze({ ...seedScheme }),
    applyElevationOverlayColor: isDark,
    splashFactory: 'inkSparkle',
    typography: 'material2021',
    textTheme: 'colorSchemeDriven',
    toolbarBaseline: 56,
    railCompactWidth: 80,
    railExtendedWidth: 256,
    source: [
      'theme_data.dart:265-320,416-420,458-460,491-522,840-862',
      'constants.dart:30',
      'navigation_rail.dart:1236-1244',
    ],
  });
}
