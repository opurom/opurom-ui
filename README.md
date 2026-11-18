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

`theme/material-tokens.json` is an independent `md-` namespace extracted from the Flutter Material 3 source (flutter-golden `ab291203`, stable 3.50.0). Every value carries a `file:line` source or an explicit `spec:` marker. Groups: color (light/dark, 49 keys each), shape (6 levels), elevation (10 levels plus 3 shadow colours), typography (15 styles), spacing (14 keys), motion (17 duration constants and 9 easing constants), state (4 button state-layer alphas). It does not override any Liquid Glass default.

The compiler's `theme { tokens { import "..." } }` branch flattens `md-*` data into compile-time string constants; the renderer resolves all 49 colour roles from those constants or its pinned Flutter fallback table. Color-capable props accept flattened role names such as `md-sys-color-primary` through compile-time import and rendering resolution; semantic `variant`/`tone` props remain the component-level route. Shape, elevation and typography values remain storage-layer references until their kernel gaps M1/M2 and typed-token import are authorised. `node test/material-tokens.test.mjs` validates structure, source coverage and light/dark parity.

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
| `components/input_m3.opu` | `TextFieldM3`, `PasswordFieldM3` (label, placeholder, state, animate), `SearchBarM3` (placeholder, state, animate) | eight-state Input shells; caret/selection/keyboard focus reserved (B4); 150 ms short3 border state, glass curve `NO_FLUTTER_EQUIVALENT`; Flutter `input_decorator.dart:40,63,205,819,2104,2212`, `text_field.dart:335-346`, `search_anchor.dart:1543,1896` |
| `components/search.opu` | `SearchField(placeholder)` | search box with a leading glyph |
| `components/chip.opu` | `FilterChip(label, variant)` | pass `primary` when active, `ghost` when idle |
| `components/chips_m3.opu` | `AssistChipM3`, `SelectedChipM3` (label, state, animate) | static M3 chip appearances; eight states, radius 8 / 195 ms motion; runtime selection and delete affordance (A3/M4) reserved |
| `components/selection_m3.opu` | `CheckboxM3`, `RadioM3`, `SwitchOnM3`, `SwitchOffM3`, `SliderM3` (state, animate), `SegmentedM3` (first, second, third, selected, state, animate) | eight-state selection shells; `bind` stays at the call site (component args are literals), value/checkmark/drag reserved; M3 token durations 200/300 ms, segment state via `SegmentedInput` |
| `components/progress.opu` | `ProgressTrack(percent)` | determinate bar in the theme accent |
| `components/confirm_dialog.opu` | `ConfirmDialog(title, body, confirm)` | dialog with a primary confirm action |
| `components/feedback_m3.opu` | `DialogM3`, `ToastM3`, `LoadingM3`, `ProgressM3` (state, animate), `EmptyStateM3`, `ErrorViewM3` (title, body, state, animate) | eight-state feedback shells; 150 ms short3 state transition, glass curve `NO_FLUTTER_EQUIVALENT`; anchors `dialog.dart:74-101`, `dialog_theme.dart:246`, `snack_bar.dart:271-285`, `progress_indicator.dart:68,283`; empty/error views `NO_FLUTTER_EQUIVALENT` |
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
| `components/actions_m3.opu` | `FabM3`, `SmallFabM3`, `ExtendedFabM3`, `LargeFabM3` (icon/label, state, animate) | M3 FAB family; 56/40/96dp circles and 48dp stadium, eight states, 200ms short4; anchors `floating_action_button.dart:86-104,404-405,730-731,756,816-820`; theme colour resolver, heroTag/location reserved (A4/M4) |
| `components/rating_m3.opu` | `RatingM3(label, value, stars, state, animate)` | rating readout shell; `NO_FLUTTER_EQUIVALENT` (Flutter has no Rating widget); eight states on the value primitive; anchors `segmented_button.dart:88-92,363-381`, `motion.dart:52`; tap-to-rate/bind reserved (A3/B4) |
| `components/lists_m3.opu` | `RefreshListShell`, `GroupedListShell`, `LoadMoreListShell` (height/title, state, animate) | long/grouped list presentation; 40dp refresh band and 56dp pinned/load bands; eight states; anchors `refresh_indicator.dart:149-160,645-676`, `sliver_persistent_header.dart:125-158`, `list_tile.dart:1079-1084`; callbacks/sliver protocol reserved (A3/B2/B3) |
| `components/forms_m3.opu` | `FormFieldM3`, `FormSectionM3` (labels, validation literals, state, animate) | declarative form shells; eight states, literal required/minLength/maxLength; anchors `form.dart:78-79,318,360`, `motion.dart:44`; bind/FormState/submit reserved (B4) |
| `components/pickers_m3.opu` | `DatePickerM3`, `TimePickerM3`, `ColorPickerM3`, `RegionPickerM3` (label, value, state, animate) | closed picker presentation over DateField/TimeField/ColorWell/SelectBox; eight states; anchors `date_picker.dart:196-215`, `cupertino/date_picker.dart:299-312`, `dropdown.dart:566-570`, `color_scheme.dart:449-477`; routes/wheel physics/bindings reserved (A3/B3/B4) |
| `components/inputs_ext_m3.opu` | `AutocompleteM3`, `MultilineFieldM3`, `NumberFieldM3`, `BottomSheetM3`, `TooltipM3` (label/text, value, state, animate) | remaining basic input/feedback shells; eight states, 150ms short3; anchors `autocomplete.dart:61-67`, `text_field.dart:363-366`, `bottom_sheet.dart:97-103`, `material/tooltip.dart:96-104`; callbacks/routes/keyboard reserved (A3/A4/B4) |
| `components/menu_m3.opu` | `PopupMenuM3(items, width, state, animate)` | M3 popup-menu shell with semantic button role; eight states, elevation 3 and 8dp vertical padding; anchors `popup_menu.dart:47,1176-1218,1424-1427,1837-1872`, `motion.dart:52`; route/keyboard/callback reserved (A3/A4/B3) |
| `components/nav_rail_m3.opu` | `NavigationRailM3(labels, selected, state, animate)` | M3 rail shell at 80dp width, eight states; anchors `navigation_rail.dart:91-116,1236-1244,1272-1274`, `motion.dart:52`; extended mode/routing reserved (A3/A4/B3) |
| `components/date_range_m3.opu` | `DateRangePickerM3(label, start, end, state, animate)` | M3 date-range shell with two ordered DateFields and a divider; eight states; anchors `date_picker.dart:1167-1243,1074-1083,130-131,791-801`, `motion.dart:52`; DateTime/routes/predicate reserved (A3/A4/B3/B4) |

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
