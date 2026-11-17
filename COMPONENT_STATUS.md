# A-line SKELETON component status

Fourteen SKELETON modules are in place: six P0 skeletons (batch 1), four P1 layout skeletons (batch 2), and four P1 scroll/selection skeletons (batch 3). These modules are deliverable 2. This list is deliverable 3. The minimal usage example in each skeleton file header is deliverable 4.

The gap identifiers referenced below are registered in `opurom-spec/FLUTTER_REPLICA_KERNEL_PLAN.md`: L1, L2, L3, L4, A3, A4, B2, B3, B4.

## State vocabulary

All component APIs accept eight `state` keywords: default, hover, active, focus, disabled, loading, success and error. The first five are interaction states; loading, success and error are business states with no Flutter `WidgetState` member and are marked `NO_FLUTTER_EQUIVALENT` in `opurom-spec/COMPONENT_STATE_PROPOSAL.md`. Duration values follow `opurom-spec/ANIMATION_DURATION_ADJUDICATION.md`; no component claims a Flutter-owned business-state duration. The 14 skeleton rows below remain SKELETON: their headers describe the interaction states used by the current golden pins; business-state visual pins await the renderer state-transition work and are not claimed here.

### Non-default state pins

`test/state-digests.json` pins settled frames (tick 4000, viewport 320x240) for ten M3 components across loading, success, error, focus, hover and disabled under render `7ec55e0d6098dda2fff1e1c4150c5189f59d6bb2` and lang `d1a0418179fd20c58a899d012dffb82ac5f7d8a1`. These are **internal consistency pins, not Flutter parity**: CI has no Flutter oracle or font file, and no 2%/12% threshold is applied. The pin set uses its own sibling toolchain and does not touch the 52 default-state pins signed at render `8a76e1d` / lang `6d5cb74`.

The selection batch adds `components/selection_m3.opu`: `CheckboxM3`, `RadioM3`, `SwitchOnM3`, `SwitchOffM3`, `SliderM3` and `SegmentedM3`, each pinned in all eight states (48 further pins, 108 total). Checkbox, radio, switch and slider primitives require an app-state `bind`; component arguments are literals, so those shells carry the visual state and leave `bind`/value/drag at the call site. `SegmentedM3` passes state directly to `SegmentedInput`. Durations are Opurom selections among Flutter `Durations` tokens (200 ms short4, 300 ms medium2 for the switch per `switch.dart:2387`); the glass "ease" curve family is `NO_FLUTTER_EQUIVALENT`.

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

