---
name: Next.js package firewall
description: Environment-specific package and framework compatibility constraints discovered while setting up this project.
---

The Replit package firewall blocks the imported Next.js 14 release because of a critical CVE. The latest safe Next.js release installs successfully, but may introduce framework migration warnings such as the `middleware` to `proxy` convention change.

**Why:** Reinstalling the pinned Next.js 14 version cannot succeed in this environment, while bypassing the package firewall would weaken the project’s security posture.

**How to apply:** Prefer the latest safe Next.js package when the firewall blocks the pinned version. Treat deprecation warnings as a follow-up migration rather than bypassing the security policy.