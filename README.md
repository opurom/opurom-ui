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

A component takes positional literal arguments only (an `int`, `bool` or `string`), and its
body is fixed at compile time. Interactive primitives that need a state binding (`Input`,
`Switch`, `Slider`) or a tap handler (`Button { ... }`) are used directly at the call site,
because a binding is a state name and a handler is a statement, neither of which a component
argument can carry.

## Verify

```sh
node test/check.mjs
```

The check validates the manifest against the real files, requires both theme modules to declare every supported token, and confirms every component module carries a component declaration.
