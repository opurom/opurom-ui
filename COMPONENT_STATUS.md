# A-line SKELETON component status

Fourteen SKELETON modules are in place: six P0 skeletons (batch 1), four P1 layout skeletons (batch 2), and four P1 scroll/selection skeletons (batch 3). These modules are deliverable 2. This list is deliverable 3. The minimal usage example in each skeleton file header is deliverable 4.

The gap identifiers referenced below are registered in `opurom-spec/FLUTTER_REPLICA_KERNEL_PLAN.md`: L1, L2, L3, L4, A3, A4, B2, B3, B4.

## State vocabulary

All component APIs accept eight `state` keywords: default, hover, active, focus, disabled, loading, success and error. The first five are interaction states; loading, success and error are business states with no Flutter `WidgetState` member and are marked `NO_FLUTTER_EQUIVALENT` in `opurom-spec/COMPONENT_STATE_PROPOSAL.md`. Duration values follow `opurom-spec/ANIMATION_DURATION_ADJUDICATION.md`; no component claims a Flutter-owned business-state duration. The 14 skeleton rows below remain SKELETON: their headers describe the interaction states used by the current golden pins; business-state visual pins await the renderer state-transition work and are not claimed here.

### Non-default state pins

`test/state-digests.json` pins settled frames (tick 4000, viewport 320x240) for ten M3 components across loading, success, error, focus, hover and disabled under render `7ec55e0d6098dda2fff1e1c4150c5189f59d6bb2` and lang `d1a0418179fd20c58a899d012dffb82ac5f7d8a1`. These are **internal consistency pins, not Flutter parity**: CI has no Flutter oracle or font file, and no 2%/12% threshold is applied. The pin set uses its own sibling toolchain and does not touch the 52 default-state pins signed at render `8a76e1d` / lang `6d5cb74`.

The selection batch adds `components/selection_m3.opu`: `CheckboxM3`, `RadioM3`, `SwitchOnM3`, `SwitchOffM3`, `SliderM3` and `SegmentedM3`, each pinned in all eight states (48 further pins, 108 total). Checkbox, radio, switch and slider primitives require an app-state `bind`; component arguments are literals, so those shells carry the visual state and leave `bind`/value/drag at the call site. `SegmentedM3` passes state directly to `SegmentedInput`. Durations are Opurom selections among Flutter `Durations` tokens (200 ms short4, 300 ms medium2 for the switch per `switch.dart:2387`); the glass "ease" curve family is `NO_FLUTTER_EQUIVALENT`.

The input batch adds `components/input_m3.opu`: `TextFieldM3`, `SearchBarM3` and `PasswordFieldM3`, each pinned in all eight states (24 further pins, 132 total). `Input` has no required `bind`, so these emit real `Input` nodes with state passthrough; caret, selection, keyboard focus and validators remain reserved (kernel gap B4). The 150 ms state duration is an Opurom selection among Flutter `Durations` tokens (`motion.dart:44`); Flutter's own 167 ms decorator transition is recorded at `input_decorator.dart:40` and is not presented as a component-owned value. Source anchors: `input_decorator.dart:63,205,819-825,2104-2138,2212`, `text_field.dart:335-346,1157-1191`, `search_anchor.dart:1543,1896,1900`. No theme is owned by these modules; paint comes only from `variant`/`tone` tokens.

The feedback batch adds `components/feedback_m3.opu`: `DialogM3`, `ToastM3`, `LoadingM3`, `ProgressM3`, `EmptyStateM3` and `ErrorViewM3`, each pinned in all eight states (48 further pins, 180 total). Source anchors: `dialog.dart:74-101`, `dialog_theme.dart:246`, `snack_bar.dart:271-285`, `progress_indicator.dart:68,283`. Empty and error views have no Flutter framework widget and are marked `NO_FLUTTER_EQUIVALENT`, not presented as Flutter parity. Tap handlers, route presentation, auto-dismiss and cancellation stay reserved, and the 150 ms state duration follows the same adjudicated token selection.

R = required, O = optional, X = reserved / not expressive in the current IR. Every row is transcribed from the corresponding component file header and the README component table.

| Module | API | R | O | X (reserved) | Gaps | Stage |
| --- | --- | --- | --- | --- | --- | --- |
| `components/stack.opu` | `OverlayStack(state)` | none | state | alignment, fit, clipBehavior, children | L1 | SKELETON |
| `components/expanded.opu` | `FlexCell(width, state)` | none | width, state | flex, fit (reserved, L2); child sizing | L2 | SKELETON |
| `components/icon_button.opu` | `IconAction(icon, state, gesture)` | icon (built-in icon name) | state, gesture | style, tooltip, mouseCursor, raw color | A3, A4 | SKELETON |
| `components/app_bar.opu` | `AppBarShell(title, leading, action, state)` | none | title, leading (icon name), action, state | PreferredSize, bottom, elevation, route actions | A4 | SKELETON |
| `components/bottom_navigation_bar.opu` | `BottomNav(labels, selected, segments, state, gesture)` | labels (comma-separated) | selected (zero-based), segments, state, gesture | items objects, selectedItemColor, badges, bind | B3, A3 | SKELETON |
| `components/scaffold.opu` | `RouteShell(title, body, bottom, state)` | none | title, body, bottom, state | drawer, floatingActionButton, resizeToAvoidBottomInset, route transitions | A4 | SKELETON |
| `components/positioned.opu` | `OffsetBox(offset, state)` | none | offset (fixed offset stand-in), state | left, top, right, bottom, width, height | L1 | SKELETON |
| `components/wrap.opu` | `FlowWrap(gap, state)` | none | gap (fixed gap stand-in), state | direction, alignment, spacing, runSpacing | L3 | SKELETON |
| `components/aspect_ratio.opu` | `RatioBox(width, height, state)` | none | width, height (fixed size stand-ins), state | aspectRatio | L4 | SKELETON |
| `components/flex.opu` | `FlexRun(gap, align, state)` | none | gap, align (Row align keyword), state | direction, fit, spaceBetween | none (no kernel gap, Row/Column cover core) | SKELETON |
| `components/sliver_list.opu` | `SliverListShell(height, state)` | none (delegate is a builder, reserved) | height, state | delegate, addRepaintBoundaries, viewport/sliver constraints | B2, B3 | SKELETON |
| `components/sliver_grid.opu` | `SliverGridShell(height, columns, state)` | none (gridDelegate/delegate are builders, reserved) | height, columns, state | gridDelegate, delegate, sliver geometry, cache flags | B2, B3 | SKELETON |
| `components/dropdown.opu` | `DropdownField(value, width, state)` | none | value (current label), width, state | items widget builder, onChanged, labels list, isExpanded | B3, A4 | SKELETON |
| `components/form.opu` | `FormShell(title, label, placeholder, required, state)` | none | title, label, placeholder, required (bool), minLength, maxLength, pattern (applied at the call site on Input), state | FormState, save, validate, autovalidate | B4 | SKELETON |

## Material 3 Card standard

This section records the Material 3 Card surface and text-role standard for the Cards page remediation. Values are drawn from `theme/material-tokens.json` (extracted from flutter-golden `ab291203`, stable 3.50.0); each row names its token. This is documentation only: no component code is changed by this section.

### Card surface

| Property | Value | Token | Source |
| --- | --- | --- | --- |
| Corner radius | 12 dp | `md-shape-medium` | `card.dart:322` |
| Outer padding | 16 dp | `md-space-16` | `constants.dart:54` |
| Background | light `#FFFFFF` / dark `#121212` | `md-sys-color-surface-container-low` | `color_scheme.dart:1049` |
| Elevation | level 1, three-layer shadow | `md-elev-1` | `shadows.dart:50-59` |
| Vertical rhythm | 16 / 8 / 16 dp (top / gap / bottom) | `md-space-16`, `md-space-8` | `constants.dart:54`, `constants.dart:57` |
| Image corner clip | matches card radius (12 dp) | `md-shape-medium` | `card.dart:322` |

`md-elev-1` layer values (token source `shadows.dart:50-59`, opacity constants at `shadows.dart:43-45`):

| Layer | Alpha | Colour | Offset | Blur | Spread |
| --- | --- | --- | --- | --- | --- |
| umbra | 0.20 | `#33000000` | (0, 2) | 1 | -1 |
| penumbra | 0.14 | `#24000000` | (0, 1) | 1 | 0 |
| ambient | 0.12 | `#1F000000` | (0, 1) | 3 | 0 |

### Text roles

Line height is recorded as the token's multiplier; the point size in parentheses is the computed value at the role's font size.

| Role | Size | Weight | Line height | Letter spacing | Colour | Max lines | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| body-large | 16 sp | 400 | 1.50 (24 sp) | 0.5 | on-surface | 1, ellipsis | `md-type-body-large`, `md-sys-color-on-surface` |
| body-medium | 14 sp | 400 | 1.43 (20 sp) | 0.25 | on-surface-variant | 2, ellipsis | `md-type-body-medium`, `md-sys-color-on-surface-variant` |
| label-large | 14 sp | 500 | 1.43 (20 sp) | 0.1 | primary | 1 | `md-type-label-large`, `md-sys-color-primary` |

Typography sources: `md-type-body-large` `typography.dart:2109`, `md-type-body-medium` `typography.dart:2110`, `md-type-label-large` `typography.dart:2106`. Colour sources: `md-sys-color-on-surface` `color_scheme.dart:478`, `md-sys-color-on-surface-variant` `color_scheme.dart:1083`, `md-sys-color-primary` `color_scheme.dart:449`.

### Reconciliation note

Two values stated in the Card remediation brief differed from the token source of truth recorded in `theme/material-tokens.json`. Both are now resolved in favour of the audited Flutter source; the tables above already carry the winning values. The resolutions are recorded here for traceability.

| Item | Brief value | Token value (source) | Status |
| --- | --- | --- | --- |
| body-large weight | 500 | 400 (`typography.dart:2109`) | RESOLVED: source wins — englishLike 2021 is w400 at `typography.dart:2109`; the brief's 500 was an unchecked value. |
| elevation-1 shadow | umbra alpha 0.05 / blur 1 / offset (0,1); penumbra alpha 0.08 / blur 2 / offset (0,1); two layers only | umbra alpha 0.20 / blur 1 / offset (0,2) / spread -1; penumbra alpha 0.14 / blur 1 / offset (0,1); plus ambient alpha 0.12 / blur 3 (`shadows.dart:50-59`) | RESOLVED: kElevationToShadow wins — the brief value is M3 spec prose, not the render constants Flutter actually draws (`shadows.dart:50-59`). |

The brief's elevation figure matches the Material 3 tonal-shadow guidance; the token figure matches the Flutter `kElevationToShadow` constants actually present in the audited source. They are two different shadow definitions, not a rounding difference.

### Kernel gap blockers

These entries of the standard cannot be realised by current components or the renderer. They are recorded, not implemented. Gap identifiers are registered in `opurom-spec/FLUTTER_REPLICA_KERNEL_PLAN.md`.

| Entry | Gap | Reason |
| --- | --- | --- |
| Elevation-1 dual-layer shadow rendering | M2 | Token stores the layers; the renderer cannot draw umbra + penumbra compositing. |
| Card press feedback | A3, M4 | Gesture-to-state press feedback and the card press transition are kernel work. |
| Text line height and maxLines ellipsis | B12 | Renderer lacks line-height control and max-line truncation with ellipsis. |
| Image and text content inside a card | M7 | Components take literal arguments only; `SurfaceCard` cannot host image + text content. No partial children implementation until M7 lands. |


## M3 component extension batch (ui-dev, 2026-11-18)

Source baseline: Flutter stable 3.50.0 in `flutter-golden` (`ab291203`), the
same commit pinned by `theme/material-tokens.json`. This batch adds five module
families to the package: `actions_m3.opu` (four FAB appearances),
`rating_m3.opu`, `lists_m3.opu` (refresh/grouped/load-more), `forms_m3.opu`
(two form shells), `pickers_m3.opu` (date/time/colour/region). All 14 new
components emit the eight design states; 112 new settled-frame digests bring
`test/state-digests.json` to 292 pins over 39 components. The digests are
internal consistency pins under the signed toolchain, not Flutter pixel parity.

| Component | Flutter source anchor | Opurom adaptation / reserved gap |
| --- | --- | --- |
| `FabM3` 56dp circle | `floating_action_button.dart:86-104`, `:404-405`, `:730-731`, `:756` | Container+Icon; theme resolver and location reserved (A4/M4) |
| `SmallFabM3` 40dp circle | `floating_action_button.dart:405`, `:730`, `:817` | same |
| `LargeFabM3` 96dp | `floating_action_button.dart:731`, `:819`, `:827` | same |
| `ExtendedFabM3` 48dp stadium | `floating_action_button.dart:732`, `:733`, `:820`, `:825` | Row gap stands in for 8dp icon-label spacing |
| `RatingM3` | `segmented_button.dart:88-92`, `:363-381`, `motion.dart:52` | `NO_FLUTTER_EQUIVALENT`: no Flutter Rating widget; tap-to-rate reserved (A3/B4) |
| `RefreshListShell` | `refresh_indicator.dart:149-160`, `:645-676` | 40dp band stands in for displacement; `onRefresh` reserved (A3/B3) |
| `GroupedListShell` | `sliver_persistent_header.dart:125-158` | pinned header shell; delegate/floating snap reserved (B2/B3) |
| `LoadMoreListShell` | `list_tile.dart:1079-1084`, `constants.dart:57` | 56dp trailing band; scroll-end callback reserved (A3/B3) |
| `FormFieldM3`, `FormSectionM3` | `form.dart:78-79`, `:318`, `:360`, `input_decorator.dart:40` | literal validators only; `FormState`/submit reserved (B4) |
| `DatePickerM3`, `TimePickerM3` | `date_picker.dart:196-215`, `cupertino/date_picker.dart:299-312` | integer slot values; `DateTime` routes and wheel physics reserved (B3) |
| `ColorPickerM3` | `color_scheme.dart:449-477` | palette slot; colour value/callback reserved (A4/B4) |
| `RegionPickerM3` | `dropdown.dart:566-570`, `dropdown_menu.dart:305-320` | zero-based option slot; options builder reserved (B3/A4) |

Gates: `test/eight-state-compile.test.mjs` compiles all 29 eight-state cases
and checks default IR byte identity against the pinned compiler;
`test/state-digests.test.mjs` pins 292 settled frames;
`test/extension-boundaries.test.mjs` renders empty, overlong and extreme inputs
and asserts the typed `maxLength < minLength` diagnostic. All tests are in the
`npm test` script and the UI CI job.

Parity honest statement: these are declarative presentation shells with
Flutter-sourced geometry, state machine and duration anchors. Callback-based
interaction, real picker routes, sliver scroll physics, theme-resolved colours
and font-metric-dependent truncation remain kernel gaps; they are not claimed
as pixel-complete Flutter parity.

## M3 input/feedback extension batch (ui-dev, 2026-11-18, part 2)

`components/inputs_ext_m3.opu` adds five shells: `AutocompleteM3`,
`MultilineFieldM3`, `NumberFieldM3`, `BottomSheetM3` and `TooltipM3`. Flutter
stable 3.50.0 anchors are `autocomplete.dart:61-67` (optionsBuilder,
displayStringForOption, onSelected), `text_field.dart:363-366` (maxLines),
`input_decorator.dart:228-234` (error text), `bottom_sheet.dart:97-103` and
`material/tooltip.dart:96-104`. The 150ms state transition uses the audited
`motion.dart:44` short3 token; loading/success/error remain
`NO_FLUTTER_EQUIVALENT`. Options builders, keyboard focus, route presentation
and semantic actions stay reserved (A3/A4/B4, A11Y_PARITY_GAP layer 3).

State pins now total 332 over 44 components (40 new pins in this batch).
`test/extension-a11y.test.mjs` reads the deterministic renderer accessibility
tree with `--a11y` and asserts accessible names for eight representative
shells; it does not claim checked/expanded/liveRegion or keyboard semantics,
which the IR does not carry. Full `npm test` is 13/13 green.

## Design token audit (uibuild, 2026-11-18)

`theme/material-tokens.json` now carries the complete Flutter 3.50.0 motion
surface: 17 `Durations` values (`motion.dart:28-148`) and 9 `Easing` curves
(`motion.dart:168-232`), plus the four button state-layer alphas at
`text_button.dart:230-232` and `:387`. `test/material-tokens.test.mjs` checks
every value, source and the light/dark colour key parity.

A source-level audit of `components/*.opu` finds no hex literals outside the
two pinned legacy modules and the documented two-stop brand gradient. The
remaining numeric literals are either token-backed values, Flutter component
constants, or reserved component geometry that the current IR cannot express
as a token reference. The audit is recorded as a baseline, not presented as
zero-hardcode parity.

Open gaps: shape, elevation, typography and state-layer values still have no
typed token reference in `.opu` props; the compiler's token importer accepts
flat `md-*` colour constants only. Numeric geometry therefore remains literal
until a typed token contract is approved. Real `md-sys-color-*` role reference
is available for colour props through compile-time lower/IR resolution.

## Seed theme generator (ui-dev, 2026-11-18, part 3)

`tools/seed-scheme.mjs` ports the numeric kernel of Flutter stable 3.50.0
`ColorScheme.fromSeed(tonalSpot)` from material_color_utilities 0.13.0:
`utils/color_utils.dart:15-254`, `utils/math_utils.dart:15-124`,
`hct/cam16.dart:96-381`, `hct/hct.dart:30-45`,
`hct/viewing_conditions.dart:51-190`, `hct/src/hct_solver.dart:18-520`,
`palettes/tonal_palette.dart:35-255` and `scheme/scheme_tonal_spot.dart:20-38`.
The generator emits 23 light/dark `md-sys-color-*` roles as compile-time data;
no runtime interpretation is introduced. `test/seed-scheme.test.mjs` asserts
the four pinned primary values from Flutter's own
`packages/flutter/test/material/color_scheme_test.dart:945-973` and the HCT
intermediates of `#00FF00` against the vendored material_color_utilities.

Seed generation is a theme-authoring tool, not a component: it writes token
data for the existing compiler token-import path, and does not change
`theme/material-tokens.json` (owned by another in-flight batch).

## Popup menu shell (ui-dev, 2026-11-18, part 4)

`components/menu_m3.opu` adds `PopupMenuM3` over the Opurom `Menu` primitive.
Flutter stable 3.50.0 anchors: `popup_menu.dart:1176-1218` and `:1424-1427`
(route/theme parameters), `:1837-1872` (M3 elevation 3, vertical padding 8dp),
`:47` (56dp width step) and `motion.dart:52` (200ms short4). Elevation 3 is
expressed through the `shadow` design prop; items are literal labels and the
semantic role is `button`. Route anchoring, `onSelected` and keyboard
navigation remain reserved (A3/A4/B3).

New gates: eight-state compile case, 8 settled-frame pins (452 total over 59
components), one accessibility-tree case checking name plus role, and two
boundary renders (empty label and overlong label at extreme width).

## Navigation rail shell (ui-dev, 2026-11-18, part 5)

`components/nav_rail_m3.opu` adds `NavigationRailM3` over the Opurom `NavRail`
primitive. Flutter stable 3.50.0 anchors: `navigation_rail.dart:91-116`
(extended, destinations, selectedIndex, labelType, indicatorShape),
`:1236-1244` (M3 minWidth 80, extended 256, useIndicator, groupAlignment -1),
`:1272-1274` (secondaryContainer indicator and StadiumBorder), and
`motion.dart:52` (200ms short4). Extended mode, selection callbacks and route
changes are reserved (A3/A4/B3). New gates: eight-state compile case, 8 state
pins (460 total over 60 components), one a11y name/role case, and two boundary
renders (empty/overlong labels with out-of-range selections).
