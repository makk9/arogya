# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E0a+E0b+E1+E2+E3+E5+E6+**E4 onboarding (2026-07-22→29)** ✓. **NEXT: E7 (PDF leg)** — then Phase E milestone complete.

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
- [x] **E4. Onboarding (§5.8/6.3)** — ✓ built + browser-verified + /check'd + stress-hardened through real-user rehearsals (decisions.md 2026-07-22 → 2026-08-12; ~8 distinct failure modes found+fixed — see Last Session). `lib/agents/onboarding.ts` (Sonnet, streamed prose + ```entity/```phase fences; §6.3/§10.3 phase list — §5.8 variant superseded, user-approved) · `onboarding_sessions` infra table (migration 0005, sign-off; transcript jsonb, NOT chat_sessions) · server transform `lib/onboarding/stream.ts` FenceParser → ndjson · live-transparency writes reuse E3 `commitCard` (reportId now nullable) + onboarding-only mappers (patient/family-history/lifestyle/journal, update-intent honored) · surface `app/onboarding` (rail-free 50/50 takeover; STEP N OF 8 strip, escape chips, live panel w/ highlight + inline primary-field edit) · `Upload instead` → E2 pipeline → E3 confirmation in new tab (logged deviation — tripwire-conservative) · completion → chips → `/chat?run=scan` autorun · dashboard `ActivationBanner` shell (sole launcher; shows until completed) · §5.8:1043 7-day resume offer · completion insight trigger via handler-scope `after()` + `latestClinicalRef` fallback (live-verified: run row `succeeded · 0 generated`).
- [ ] **E7. Doctor brief (§5.7) — PDF leg only.** Brief modes already in synthesis prompt. Missing: `Download PDF` action → PDF gen (citation-strip, clean clinical B/W, "Generated from N data points…" footer). Lives in chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; `surfaceContext` server-side resolution (E3 prompt-injection — still client-asserted free text); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; CONTACT/primary-language cols; rail RECENT group (needs recency tracking); rail-expansion enhancement (2026-06-24, not built); drawer `stone-*` literals → tokens (pre-existing debt, flagged 2026-07-22).

### Phase F — Polish
- Activation-banner logic: `setup · N of 4` counter, hide once core-4 phases covered (shell shipped in E4; currently shows until interview completed) + adaptive empty-state chips/placeholder (§6.1).
- §6.3:1262 `follow-up` tag on onboarding entity cards (deferred 2026-07-29).
- §10.1 mobile "best on desktop" guidance — app-wide gap, worst on the onboarding 50/50 (deferred 2026-07-29).
- Clickable external `↗` citations (decisions.md 2026-07-19; leaning web-search-grounded).

---

### Last Session (2026-07-29 → 08-12: stress pass, user rehearsals, IA polish — commits 53fa0c8…f07b827)
- **E4 stress suite (07-30):** 17/18 API + 9/9 UI. New failure mode: "Noted —" with NO emission (silent data loss) → update worked-example + same-turn-emission rule. Test hygiene: agent refuses test-framed data/fake drug names — use real meds, tracked-by-ID cleanup; backups must NOT live in /tmp (purge ate one; all recovered from session output).
- **User rehearsals surfaced the context-blindness class, now CLOSED** — agent context carries: family-history/journal ids (dup fix), lifestyle values, identity extras, med purpose/prescriber resolved to names (shared dictionary — extraction benefits too), condition severity, allergy reaction. Plus **(relative, condition) identity rule** (father's diabetes ≠ note on his colon-cancer row — repaired live).
- **Panel visibility class closed:** fresh cards scroll-into-view + flash; UPDATED cards flash via event-ids; singletons (lifestyle box, identity header) flash; stress context renders. Post-completion additions work.
- **IA polish (08-12, user-driven):** field labels 10px→11px medium app-wide · MEDICAL PROFILE facts-only, vitals nav → AT A GLANCE row after 3 rejected placements ("nav has no fact to state") · **rail = complete wiki: 12 items, PROFILE/TIMELINE groups (§3 nine superseded, signed off)** · /check fixes: single-query `wikiCounts`, `vitalQueries.typeCounts`, a11y groups.
- **Gotchas:** completed interview hides the banner — delete the `onboarding_sessions` row to reset (no UI); `?run=scan` chat sessions + insight runs are live side effects of completing; Playwright `response.finished()` stalls on ndjson — wait on UI state.
- **Open data calls (user):** diet restrictions (old `vegetarian` vs live omelette answer) + tobacco (`former` vs `never`) — live answers currently stand. Aspirin purpose/prescriber never captured.

### Next Steps
1. **E7 PDF leg** — `Download PDF` action → PDF gen (citation-strip, clean clinical B/W, "Generated from N data points…" footer). Phase E milestone complete after this.
2. **Phase F**, starting with activation-banner logic (counter + core-4 hide rule); queue also gained the `follow-up` tag, mobile guidance, drawer token debt.
3. **Resolve the diet/tobacco data calls** (user decision, 30 seconds).

- **Pending design.md doc-fixes:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.8) "WATCH" isn't a status; §6.1/§3 "chat centerpiece" wording vs :1147's locked reversal; §3/§6.1:1146 "nine category items" → twelve (2026-08-12); §6.10:1694 "`history →` inline next to time-series values" pattern retired (misleads when the destination is broader than the value). **Phase D carryovers:** inline-field Selects miss `items`; list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
