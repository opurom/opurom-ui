# opurom-ui

The Opurom default UI system shipped as an importable theme package. It defines the framework's default light and dark themes with the Liquid Glass token baseline, so an application can adopt the exact default look by importing one module.

## Install

The package follows the `opurom-pkg` standard format: a manifest `opurom-pkg.json` with `name`, `version`, `kind`, `entry`, `license` and the exact `files` list, and `.opu` module content that is hashed as bytes at publish time.

```sh
node ../opurom-pkg/bin/opurom-pkg.mjs add opurom-ui@0.1.0
```

Applications declare the dependency in `opurom.json`; the compiler resolves package modules through `moduleRoots`:

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "moduleRoots": ["registry"],
  "dependencies": {
    "opurom-ui": "0.1.0"
  }
}
```

Import the theme once at the top of the entry file:

```opu
import "theme/default.opu";
```

## Tokens

| Token | Light | Dark |
|---|---|---|
| accent | `#006EFF` | `#006EFF` |
| radius | `12` | `12` |
| fontScale | `1.0` | `1.0` |
| surface | `#FFFFFF` | `#1E1E1E` |
| onSurface | `#111827` | `#E5E7EB` |
| stage | `#F9FAFB` | `#121212` |

The values are the built-in defaults. Programs that declare their own `theme` keep it: a program admits at most one theme declaration, so importing the package is optional per application.

### Material 3 token baseline

`theme/material-tokens.json` is an independent `md-` namespace extracted from the Flutter Material 3 source (flutter-golden `ab291203`, stable 3.50.0). Every value carries a `file:line` source or an explicit `spec:` marker. Groups: color (light/dark, 30 keys each), shape (6 levels), elevation (6 levels plus 3 shadow colours), typography (15 styles), spacing (9 keys). It does not override any Liquid Glass default and no component consumes it yet; this is the storage layer that precedes component migration.

The compiler's `theme { tokens { ... } }` block currently accepts only six fixed semantic names and `#RRGGBB` strings, so these `md-` tokens and their multi-field entries are kept in the data file rather than in the compiled theme. Squircle corners (kernel gap M1) and dual-layer shadow rendering (kernel gap M2) are stored as values only, pending kernel support. `node test/material-tokens.test.mjs` validates structure, source coverage and light/dark parity.

## Components

The package ships a set of `.opu` component modules under `components/`. A component
expands at compile time into primitive nodes, so one definition renders identically on
every target. Import the module you need after the theme:

```opu
import "theme/default.opu";
import "components/button.opu";
import "components/card.opu";
import "components/text.opu";
```

| Module | Components | Notes |
|---|---|---|
| `components/button.opu` | `ActionButton(label, variant)` | `variant` is `primary`, `secondary` or `ghost` |
| `components/buttons_m3.opu` | `ElevatedActionButton`, `FilledActionButton`, `OutlinedActionButton`, `TextActionButton`, `DangerActionButton` (label, state, animate) | M3 button family; eight states, 40dp stadium (radius 20), implicit `animate` transition; 24dp horizontal inset reserved (uniform padding), exact state-layer alpha reserved (A3/M4) |
| `components/card.opu` | `SurfaceCard(title)` | token radius and soft elevation; pinned legacy, do not edit |
| `components/card_m3.opu` | `ElevatedCardM3`, `OutlinedCardM3` (title, subtitle, state, animate) | M3 cards; eight states, radius 12 / padding 16, elevation 1; content slots (M7), three-layer shadow (M2) reserved |
| `components/text.opu` | `TitleHeading`, `BodyText`, `CaptionText` | one pinned type scale per level |
| `components/list.opu` | `ListPanel(title)` | titled list surface |
| `components/list_tile_m3.opu` | `ListTileM3(title, subtitle, state, animate)` | two-line M3 tile; eight states; selected overlay (A3), slots (M7), exact tile metrics (B12) reserved |
| `components/navbar.opu` | `NavBar(title, action)` | leading title, trailing action |
| `components/dialog.opu` | `DialogPanel(title)` | titled modal |
| `components/toast.opu` | `ToastNote(message)` | success-toned strip |
| `components/badge.opu` | `BadgePill(count)` | count pill |
| `components/avatar.opu` | `AvatarDisc(initials)` | initials disc |
| `components/data_table.opu` | `DataTable(title, headers, rowA, rowB, rowC, selected)` | header, zebra rows, highlighted current row |
| `components/tabs.opu` | `TabsBar(selected, segments)` | segmented strip; `selected` is a zero-based index |
| `components/sidebar.opu` | `SidebarNav(title, active, itemA, itemB, itemC)` | navigation panel with the active row highlighted |
| `components/stat_card.opu` | `MetricCard(label, value, trend, tone)` | statistic card; `tone` colours the trend line |
| `components/form_field.opu` | `FormField(label, placeholder)` | label above a field; bind at the call site |
| `components/search.opu` | `SearchField(placeholder)` | search box with a leading glyph |
| `components/chip.opu` | `FilterChip(label, variant)` | pass `primary` when active, `ghost` when idle |
| `components/chips_m3.opu` | `AssistChipM3`, `SelectedChipM3` (label, state, animate) | static M3 chip appearances; eight states, radius 8 / 195 ms motion; runtime selection and delete affordance (A3/M4) reserved |
| `components/progress.opu` | `ProgressTrack(percent)` | determinate bar in the theme accent |
| `components/confirm_dialog.opu` | `ConfirmDialog(title, body, confirm)` | dialog with a primary confirm action |
| `components/section_header.opu` | `SectionHeader(title)` | heading with a trailing action affordance |
| `components/tooltip.opu` | `TipCallout(text, placement)` | hint bubble; reveal it with an `if` at the call site |
| `components/drawer.opu` | `Drawer(title, itemA, itemB, itemC)` | side panel; toggle it with an `if` at the call site |
| `components/stepper.opu` | `StepBar(steps, current)` | step progress strip; `current` is zero-based |
| `components/breadcrumb.opu` | `Breadcrumb(root, section, page)` | chevron-separated path trail |
| `components/empty_state.opu` | `EmptyState(icon, title, body)` | empty-view placeholder; `icon` is a built-in name |
| `components/skeleton.opu` | `Skeleton(width, height)` | dimmed loading block in logical pixels |
| `components/pagination.opu` | `PaginationBar(page, total)` | static page readout with chevrons |
| `components/segmented.opu` | `SegmentedControl(first, second, third, selected)` | three-way segment picker; `selected` is zero-based |
| `components/banner.opu` | `Banner(title, body, tone)` | persistent inline notice with a semantic border |
| `components/timeline.opu` | `Timeline(title, first, second, third)` | event trail with a marker dot per entry |
| `components/filetree.opu` | `FileTree(root, childA, childB, childC)` | indented listing under one folder root |
| `components/chart_card.opu` | `ChartCard(title, kind)` | titled card wrapping the chart primitive |
| `components/avatar_group.opu` | `AvatarGroup(first, second, third)` | row of three member avatars |
| `components/number_flow.opu` | `NumberFlow(value, unit)` | large numeric readout without card chrome |
| `components/rating.opu` | `StarRating(label, value, stars)` | rating readout; `value` is the fill percent |
| `components/code_block.opu` | `CodeSnippet(title, lineA, lineB, lineC)` | preformatted snippet block |
| `components/hero_header.opu` | `HeroHeader(title, subtitle)` | solid-accent hero panel |
| `components/profile_header.opu` | `ProfileHeader(initials, name, meta)` | avatar identity row |
| `components/detail_row.opu` | `DetailRow(icon, title, value)` | settings row with leading icon and trailing value |
| `components/toolbar.opu` | `Toolbar(confirm, cancel)` | action bar chrome; handlers at the call site |
| `components/secure_field.opu` | `SecureField(placeholder)` | masked input; bind at the call site |
| `components/status_pill.opu` | `StatusPill(label, tone)` | semantic status badge |
| `components/grid_tile.opu` | `GridTile(src, title)` | media tile with a caption |
| `components/glass_primary_button.opu` | `GlassPrimaryButton(label, state)` | T2 primary: 180deg brand gradient, glass, shadow |
| `components/glass_secondary_button.opu` | `GlassSecondaryButton(label, state)` | T2 outlined glass button |
| `components/glass_ghost_button.opu` | `GlassGhostButton(label, state)` | T3 flat glass button |
| `components/glass_fab.opu` | `GlassFab(label, state)` | circular 56x56 primary FAB, radius 28 |
| `components/glass_card.opu` | `GlassCard(title, state)` | T2 glass card with soft shadow |
| `components/glass_switch_off.opu` | `GlassSwitchOff(state)` | 48x24 track, 20x20 thumb at x=2 |
| `components/glass_switch_on.opu` | `GlassSwitchOn(state)` | 48x24 track, 20x20 thumb at x=26 |
| `components/glass_input.opu` | `GlassInput(placeholder, state)` | T2 glass text field; bind at the call site |
| `components/gallery_app_bar.opu` | `GalleryAppBar(title, bg, textColor, radius, height, state)` | M3 Gallery detail title band; 996px wide, colour/radius/height params, bold title (top-only corner clip reserved M1) |
| `components/stack.opu` | `OverlayStack(state)` | SKELETON: Stack shape; overlay/children reserved (gap L1, NOT IN PLAN) |
| `components/expanded.opu` | `FlexCell(width, state)` | SKELETON: fixed-width stand-in; flex weight reserved (gap L2, NOT IN PLAN) |
| `components/icon_button.opu` | `IconAction(icon, state, gesture)` | SKELETON: Container+Icon; press feedback reserved (gap A3) |
| `components/app_bar.opu` | `AppBarShell(title, leading, action, state)` | SKELETON: static band; route contract reserved (gap A4, NOT IN PLAN) |
| `components/bottom_navigation_bar.opu` | `BottomNav(labels, selected, segments, state, gesture)` | SKELETON: static TabStrip; per-segment routing reserved (gaps B3, A3) |
| `components/scaffold.opu` | `RouteShell(title, body, bottom, state)` | SKELETON: three-band shape; route shell reserved (gap A4, NOT IN PLAN) |
| `components/positioned.opu` | `OffsetBox(offset, state)` | SKELETON: fixed Spacer offset; edge insets reserved (gap L1) |
| `components/wrap.opu` | `FlowWrap(gap, state)` | SKELETON: fixed-width row; flow/run controls reserved (gap L3) |
| `components/aspect_ratio.opu` | `RatioBox(width, height, state)` | SKELETON: fixed width+height; aspectRatio reserved (gap L4) |
| `components/flex.opu` | `FlexRun(gap, align, state)` | SKELETON: Row/Column base; direction/fit/spaceBetween reserved (no kernel gap) |
| `components/sliver_list.opu` | `SliverListShell(height, state)` | SKELETON: List in Scroll; sliver protocol reserved (gaps B2, B3) |
| `components/sliver_grid.opu` | `SliverGridShell(height, columns, state)` | SKELETON: Grid in Scroll, fixed height; sliver geometry reserved (gaps B2, B3) |
| `components/dropdown.opu` | `DropdownField(value, width, state)` | SKELETON: closed field; popup/selection reserved (gaps B3, A4) |
| `components/form.opu` | `FormShell(title, label, placeholder, required, state)` | SKELETON: form_field shell; FormState/save/validate reserved (gap B4) |

The fourteen SKELETON modules above are API-complete placeholders: required,
optional and reserved props are marked in each file header, the five interaction
states (normal/default, pressed/active, focus, disabled, hover) have token-driven
style placement, gesture callbacks are defined as no-op fallbacks, and each
carries a minimal usage example. They keep the single-source IR, no-runtime-interpreter
and no-mutable-object-model rules. Kernel-dependent behaviour stays `reserved`
and is tracked in `opurom-spec/FLUTTER_REPLICA_KERNEL_PLAN.md` (gaps L1, L2, L3,
L4, A3, A4, B2, B3, B4, M2, M4, M7, B12); all listed gaps are numbered in that plan.

Component modules never import anything: the application owns the theme, and components take
every colour from design props (`variant`, `tone`) or the theme defaults; no module may
hardcode a hex value except the two documented legacy files (`card.opu`, `text.opu`) and the
exact brand gradient literal `#2DD8FF,#006EFF` the premium glass slice authors explicitly.
The self-check enforces all rules. Components set `state` from a literal parameter so all eight
design keywords can be authored: default, hover, active, focus, disabled, loading, success and
error. The last three are business states with no Flutter `WidgetState` equivalent
(`NO_FLUTTER_EQUIVALENT`, see `COMPONENT_STATE_PROPOSAL.md` and
`ANIMATION_DURATION_ADJUDICATION.md`); they are not presented as framework states. Transitions,
alpha fills, inside borders, focus glow and subpixel edges are kernel capabilities, not component
syntax.

A component takes positional literal arguments only (an `int`, `bool` or `string`), and its
body is fixed at compile time. Interactive primitives that need a state binding (`Input`,
`Switch`, `Slider`) or a tap handler (`Button { ... }`) are used directly at the call site,
because a binding is a state name and a handler is a statement, neither of which a component
argument can carry. For the same reason a `bool` parameter cannot drive an `if`; select a
visual state by passing a `variant` (see `FilterChip`).

## Verify

```sh
node test/check.mjs
```

The check validates the manifest against the real files, requires both theme modules to declare every supported token, and confirms every component module carries a component declaration.
