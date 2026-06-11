# cairn-ui task runner — MINIMAL subset.
#
# Session 90 (audit/devops.md G1) owns the FULL canonical justfile
# (fmt/lint/test/deny/ci/heavy/fix fanning out to pnpm AND cargo). That
# work is not yet in main. This file carries ONLY the verbs the T1 gate
# hardening (session 91) introduces, so CI routes the new supply-chain
# and build checks through `just` rather than inlining them (local ≡ CI,
# Diagram 3). When session 90 lands, the aggregate `deny` verb is shared
# and the per-stack sub-verbs are additive.

# Supply-chain audit across BOTH stacks (Diagram 3: just deny → pnpm audit + cargo deny check).
deny: deny-web deny-rust

# Web dependency audit (npm advisories).
deny-web:
    pnpm -C web audit --audit-level=high

# Rust advisories + licenses + bans + sources.
deny-rust:
    cargo deny --manifest-path src-tauri/Cargo.toml check

# Compile the Tauri shell with a locked lockfile (T1 link/bundle check).
build-rust:
    cargo build --locked --manifest-path src-tauri/Cargo.toml
