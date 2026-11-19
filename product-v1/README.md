# OPUROM Product UI Standard v1

This directory is the product visual source of truth. Tokens and recipes are
compiled into primitive IR; examples must consume recipes rather than hand
written primitive stacks.

## Files

- `product-v1.tokens.json`: colour, spacing, radius, typography, elevation,
  motion, touch and stroke tokens.
- `recipes.json`: recipe contract for the first twelve components and their
  required states.
- `components.opu`: product components implemented with the available IR
  primitives. Each recipe exposes the five required states through a `state`
  parameter.

## Lowering

A product component is an Opurom component whose body resolves to deterministic
primitive IR at compile time. State, variant and token references are compile
time data; rendering stays deterministic and runs no interpreter.

## Defaults

Product quality is the default for build, dev, serve and export. Degraded paths
require explicit flags: `--quality compat`, `--low-power` or `--no-motion`.
