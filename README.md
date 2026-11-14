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

## Verify

```sh
node test/check.mjs
```

The check validates the manifest against the real files, requires both theme modules to declare every supported token, and prints one line per assertion.
