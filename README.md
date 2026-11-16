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
| accent | `#007AFF` | `#0A84FF` |
| radius | `12` | `12` |
| fontScale | `1.0` | `1.0` |
| surface | `#FFFFFF` | `#1E1E1E` |
| onSurface | `#111827` | `#E5E7EB` |
| stage | `#F9FAFB` | `#121212` |

The values are the built-in defaults. Programs that declare their own `theme` keep it: a program admits at most one theme declaration, so importing the package is optional per application.

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
| `components/card.opu` | `SurfaceCard(title)` | token radius and soft elevation |
| `components/text.opu` | `TitleHeading`, `BodyText`, `CaptionText` | one pinned type scale per level |
| `components/list.opu` | `ListPanel(title)` | titled list surface |
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

Component modules never import anything: the application owns the theme, and components take
every colour from design props (`variant`, `tone`) or the theme defaults; no module may
hardcode a hex value except the two documented legacy files (`card.opu`, `text.opu`) whose
expansion is pinned by a checked-in golden. The self-check enforces all three rules (usage
comment, no imports, no hex).

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
