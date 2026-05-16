Check Phase B completion status by inspecting the filesystem. Report each item as ✅ done, 🔶 partial, or ❌ not started. Check actual files — don't assume.

Phase B per `docs/progress.md` is **agent infrastructure with no dependency on entity data or surface UI** — 7 items. The four remaining agents (extraction, onboarding, insight generator, auto-titling) live in **Phase E**, not Phase B; do not flag their absence here.

Phase B checklist:

1. **Vault context builder** — `lib/agents/_shared/vault-context.ts` exists. Default-true `excludeBriefs` flag, `includeInsights` mode (`"full" | "deduplication-only" | "none"`), optional `surfaceContext`, third `now: Date = new Date()` param for per-request determinism.

2. **Per-entity serializers** — `lib/agents/_shared/serializers/` directory with one file per entity (14 files) + `format.ts` util + `index.ts` barrel. Each file exports a `serializeXxx` function and an `xxxSlug` function.

3. **Agent error types** — `lib/agents/_shared/errors.ts`. `AgentError` class with discriminated `code: "timeout" | "rate_limit" | "parse_failure" | "context_overflow" | "unknown"`.

4. **Zod output schemas** — `lib/agents/_shared/schemas.ts`. Schemas for router output (3-bucket confidence), extraction output, insight generation output, onboarding output. Match design.md 10.3 + 5.5.

5. **Synthesis agent** — `lib/agents/synthesis.ts` (Opus 4.7, streaming via Vercel AI SDK) + `app/api/chat/route.ts` (auth-derived `patientId` via `getCurrentPatient()`, Zod-validated body, errors via `apiError()`) + `scripts/check-synthesis.ts` (env-gated smoke runner). Handles default chat / full health scan / investigate / doctor brief variants from a single prompt.

6. **Router agent** — `lib/agents/router.ts` exists. Haiku 4.5, non-streaming via direct `@anthropic-ai/sdk`, no vault context. Returns `routerOutputSchema`-validated JSON with 3-bucket confidence (`"high" | "medium" | "low"`).

7. **Citation parser** — `components/ai-message.tsx` exists. Markdown post-processor that renders `§ entity-type:slug` as clickable pills (with popover on click) and `↗ source-name` as external links. Pure rendering layer; no agent calls.

For each item found, also check:
- Correct model assigned where applicable (Opus 4.7 / Haiku 4.5 / Sonnet 4.6 per design.md 9.3:2436)
- Streaming flag matches spec (synthesis = streaming, router = non-streaming)
- No `any` types, `@ts-ignore`, or `@ts-expect-error`
- Imports from `lib/agents/_shared/` rather than duplicating shared logic inline
- For `app/api/*/route.ts`: auth via `getCurrentPatient()` (not request body), errors via `apiError()`, Zod-validated body

After the checklist, give a single clear next action: what to build in this session.

Note: `prompt-fragments.ts` was deferred to be extracted when synthesis + insight-gen actually share text (per `decisions.md` 2026-05-13 entry). Insight gen is Phase E, so prompt-fragments lands then; its absence in Phase B is expected, not a gap.
