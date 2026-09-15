---
name: WhatsApp session runtime
description: Runtime constraints discovered while integrating the per-tenant Baileys worker.
---

The Baileys worker bundle needs its runtime peer packages installed explicitly; bundling can succeed while the server still fails at boot if packages such as protobufjs are only optional/transitive.

**Why:** The first API restart produced a runtime module-not-found error even though TypeScript and the esbuild bundle completed successfully.

**How to apply:** When changing the WhatsApp transport or Baileys version, verify the built server starts, not only that the package typechecks.