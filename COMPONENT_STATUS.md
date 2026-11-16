# A-line SKELETON component status

Fourteen SKELETON modules are in place: six P0 skeletons (batch 1), four P1 layout skeletons (batch 2), and four P1 scroll/selection skeletons (batch 3). These modules are deliverable 2. This list is deliverable 3. The minimal usage example in each skeleton file header is deliverable 4.

The gap identifiers referenced below are registered in `opurom-spec/FLUTTER_REPLICA_KERNEL_PLAN.md`: L1, L2, L3, L4, A3, A4, B2, B3, B4.

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
