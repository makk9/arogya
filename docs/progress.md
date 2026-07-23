# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E1+E2+E3+E5+**E0a dashboard (2026-07-22)** ✓. **NEXT: E4 onboarding.** E7 (PDF leg) remains.

### Phases A–D ✓ COMPLETE (committed)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth, seed). decisions.md 2026-05-11/12.
- **B** Agent infra — `vault-context.ts` (excludeBriefs default-true, includeInsights modes, surfaceContext, deterministic now) · 14 serializers + `format.ts` · `AgentError` · Zod `_shared/schemas.ts` · synthesis (Opus, streaming, verbatim 10.3 prompt, brief-mode addendum) · router (Haiku, 3-bucket) · citation parser → `CitationPill`/`AiMessage`.
- **C** Medication vertical = reference impl (API path-less/auth-derived · RHF+Zod form · 6.4 list · 6.5 detail · inline-edit · `+Log a change` · by-slug citation pill).
- **D** All 13 surfaces + Health Wiki rail + seed §1.3 demo mini-vault. Shared infra: `lib/api/route-helpers.ts`, `db/queries/_shared.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`.

### Phase E — AI-Driven Flows (§10.2 step E)
Tripwires: extraction NEVER auto-writes (§5.4); insights dedup-only on priors (§5.6); insight gen debounced fire-and-forget (§9.3).

- [x] **E0b + E6** Full-screen chat + `chat_sessions`/`chat_messages` + auto-titling — ✓ committed.
- [x] **E1** Extraction agent + router→chat wiring (both surfaces, shared `useQuickLog`) — ✓ committed.
- [x] **E2** File upload pipeline (§9.4) — ✓ committed.
- [x] **E3** Confirmation surface (§6.11) + commit engine + amendment + synthesis log-ack — ✓ committed.
- [x] **E5** Insight generator (§5.6/9.3) — Opus, `insight_runs` debounce, 13 triggers, seed insights retired — ✓ committed.
- [x] **E0a. Dashboard (§6.1) + vitals home** — ✓ THIS SESSION (decisions.md 2026-07-22 ×2). `app/patient/[id]/dashboard/` (header card · key-markers stat tiles w/ sparklines+neutral arrows · meds w/ doctor pills · tinted top-insight · recent-timeline w/ future-event cutoff · chat bar at bottom) + `app/patient/[id]/vitals/` per-type history (trend chart + anchored table rows, AskAiButton + `VITALS_HISTORY_SURFACE`) + entity-links `vital` case (**insight cited-source/triggered-by vitals now clickable**; episode Captured rows link; profile weight `history →`) + rail Dashboard item + `/` → dashboard redirect + §4:583 seen-transition on dashboard for the displayed insight. Shared trend math `lib/vitals.ts` `groupReadingsByType`; labels canonical in lib (vital-options re-exports). **Chat bar → DRAWER** via `openWithMessage` (typed input classifies, chips skip router, `DASHBOARD_SURFACE`); drawer gained **"Open full screen ↗"** (disabled mid-stream; relinquishes convo on pop-out). `?draft=` handoff built then superseded same-day — plumbing removed.
- [ ] **E4. Onboarding (§5.8/6.3).** UNBLOCKED. `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output (streamed reply + structured JSON), live-transparency NO confirm gate, escape chips, interruptible/resumable, completion→offer health scan (full-screen chat) else dashboard. Surface: chat left + live patient page right (§6.2 visuals). Activation-banner *logic* stays Phase F; §6.3:1246 banner is its only launcher — banner shell needed with it.
- [ ] **E7. Doctor brief (§5.7) — PDF leg only.** Brief modes already in synthesis prompt. Missing: `Download PDF` action → PDF gen (citation-strip, clean clinical B/W, "Generated from N data points…" footer). Lives in chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; `surfaceContext` server-side resolution (E3 prompt-injection — still client-asserted free text); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; CONTACT/primary-language cols; rail RECENT group (needs recency tracking); rail-expansion enhancement (2026-06-24, not built); drawer `stone-*` literals → tokens (pre-existing debt, flagged 2026-07-22).

### Phase F — Polish
- Dashboard activation banner + `setup · N of 4` counter + adaptive empty-state chips/placeholder (§6.1 empty pattern, deferred from E0a).
- Clickable external `↗` citations (decisions.md 2026-07-19; leaning web-search-grounded).

---

### Last Session (2026-07-22)
- **E0a BUILT + verified** — see checklist line. Playwright 15✅ + 8✅ runs against the real manually-entered vault (patient is now Relangi, not seed-Ramesh — reseed would restore Ramesh); screenshots in `~/Desktop/arogya-verify-shots/`.
- **Verification caught a real bug:** future-dated scheduled visit led the recent timeline ("last activity in 2 months") → `recentActivity` now cuts off at patient-timezone today.
- **Chat-entry pivot mid-session (user):** full-screen `?draft=` handoff shipped first, then replaced with the drawer entry + pop-out (both decisions.md 2026-07-22). Chat-file diffs netted to zero.
- **/check pass:** 5 concerns found + fixed same pass (shared `groupReadingsByType`, DashboardCard reuse, shared `previewContext`, import placement, vitals AskAiButton). Zero blockers. Deviations all logged.
- **Gotchas:** insight-detail's inert-vital fallback DELETED (resolver owns it now); episode-card `●` pills deliberately inert (nested-`<a>`); pop-out vs `after()` persist has a sub-second benign race (reload self-heals).

### Next Steps
1. **E4 onboarding** (§5.8 agent + §6.3 surface) — the last unbuilt agent. Read §5.8/§6.3/§10.3 end-to-end first; 8 phases, dual-output turns, live-populating patient page, NO confirmation gate.
2. **E7 PDF leg** — Download-PDF + citation-strip + footer. Phase E milestone complete after this.
3. Then Phase F, starting with the activation banner + counter (completes §6.1's empty state).

- **Pending design.md doc-fixes:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.8) "WATCH" isn't a status; §6.1/§3 "chat centerpiece" wording vs :1147's locked reversal. **Phase D carryovers:** inline-field Selects miss `items`; list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
