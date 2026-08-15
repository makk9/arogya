# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: **Phases A–E ✓ ALL COMPLETE (2026-08-15) — v1 functionally done.** NEXT: citation-tokenizer bug fix, then Phase F polish + deployment track.

### Phases A–D ✓ (committed; see git history + decisions.md)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth) · **B** Agent infra (`vault-context.ts` excludeBriefs/includeInsights modes · serializers · `AgentError` · Zod `_shared/schemas.ts` · synthesis/router · citation parser → `CitationPill`/`AiMessage`) · **C** Medication vertical = reference impl · **D** All 13 surfaces + wiki rail + shared infra (`lib/api/route-helpers.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`).

### Phase E ✓ COMPLETE
- E0a dashboard+vitals · E0b full-screen chat + `chat_sessions` · E1 extraction+router · E2 upload pipeline · E3 confirmation surface · E4 onboarding · E5 insight generator (seed insights retired) · E6 auto-titling — all committed earlier (detail: decisions.md 2026-06→08).
- **E7 doctor brief (2026-08-15):** brief format LOCKED in synthesis prompt (first-line marker `<!-- arogya:brief:delta|handoff -->`, exact `##` sections, "None recorded.", human dates, measurement-date attribution — all prompt edits user-signed) · `lib/pdf/` (`brief-parse` strip+structure, `brief-stats` footer N/range from citations, `brief-document` @react-pdf/renderer template) · `GET /api/chat/sessions/:id/brief-pdf?index=N` regenerates from the persisted message (briefs addressed by POSITION among marker messages — fresh streams have no DB id client-side) · `Download PDF` under brief messages in full-screen chat; marker display-stripped in `AiMessage` (react-markdown renders comments literally — incl. partial-prefix hiding mid-stream) · **one-click `DoctorBriefButton`** on doctor pages → `POST /api/doctors/[id]/brief`: headless synthesis (delta if completed visits else handoff, no clarifying Qs), persists titled session, cancellable (client abort + server skips persist on `req.signal.aborted` — no orphan sessions). Logged §5.7 deviation, user-directed.
- Validated claim-by-claim against the real vault (2 live Opus runs) + /check'd, all concerns closed. `/*.pdf` gitignored — exported briefs in repo root carry real PHI.

**Carryover audits queued (decisions.md):** **citation tokenizer multi-colon/underscore slugs** — chat pills render `§ vital:blood` + literal `_pressure:2026-07-22` on every vital/lab-result citation (visible on real data; load-bearing parser + smoke round-trip contract; when fixed, consolidate the two deliberate PDF-side workarounds in `lib/pdf/brief-parse.ts` + `brief-stats.ts`); broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; CONTACT/primary-language cols; rail RECENT group; rail-expansion enhancement; drawer `stone-*` literals → tokens.

### Phase F — Polish (queue)
- Activation-banner logic: `setup · N of 4`, hide once core-4 covered + adaptive empty-state chips (§6.1; shell shipped in E4).
- Patient-profile vertical → click-to-edit adoption (own `use-inline-commit` hook, Edit-gated; measurement fields write vitals). Optional: styled tooltip primitive.
- §6.3:1262 `follow-up` tag on onboarding cards · §10.1 mobile "best on desktop" guidance · clickable external `↗` citations (leaning web-search-grounded) · optional brief mode-choice toggle in the one-click dialog (delta vs full-snapshot; chat path already handles both).

### Deployment track (unscheduled, high leverage for the portfolio goal)
- Phase 9.5 deploy + **seeded fictional demo vault** — dev DB currently holds the user's father's REAL medical data; a shareable demo needs the Ramesh persona populated via onboarding instead. Note: one-click brief route awaits a ~60s Opus call — check serverless duration limits at deploy time.

---

### Last Session (2026-08-15: E7 shipped end-to-end + hardened — Phase E milestone complete)
- Built the full E7 PDF leg + one-click brief path (see Phase E block above). Three user sign-offs: locked-format prompt edit; @react-pdf/renderer; footer N = distinct cited entities.
- **First real Opus brief validated against the vault:** content accurate; found+fixed 5 rendering bugs across two rounds — `_pressure:…` dangling slug tails (tokenizer charset has no `_`/second `:`), footer undercount (BP readings collapsed to one key), split bullet at page break (`wrap={false}` + `minPresenceAhead`), `(,,, )` separator litter from multi-citation parens, react-pdf `render`-prop page number never renders (dropped it — spec doesn't ask).
- **Gotchas:** Next.js rejects sibling dynamic segments with different names (`api/doctors/[doctorId]` 500'd the whole tree — moved under `[id]`); `server-only` blocks tsx scripts unless `--conditions react-server` (project convention, breaks react-pdf though — test PDFs via the route); machine restart mid-session wiped /tmp/arogya-verify + dev server — harness rebuilt (`verify-brief-pdf/button/cancel.mjs`), server restarted on :3000.
- /check: spec-compliant; concerns closed same session (cancellable dialog + no-orphan guard, assertion/cast cleanup, `dateInTimezone` filename fix, PHI gitignore blocker). decisions.md has 6 entries for 2026-08-15.
- User is actively generating briefs through the button (real session for Dr. Kavita Menon exists beyond my test ones).

### Next Steps
1. **Citation-pill tokenizer fix** (own session): multi-colon/underscore slugs in `lib/citations/parse.ts` + smoke round-trip contract; then collapse the PDF-side workarounds.
2. **Phase F** starting with activation-banner logic (see queue above).
3. **Deployment + demo-vault track** — turns "v1 done" into "showable portfolio piece."

- **Open data calls (user, unchanged):** diet restrictions + tobacco (live interview answers stand); Aspirin purpose/prescriber never captured.
- **Pending design.md doc-fixes:** **NEW —** §5.7/§6.5:1188 briefs now also generable one-click from the doctor page (user-directed deviation 2026-08-15); §10.3:3155 brief addendum superseded by the locked-format version in `synthesis.ts` (marker, exact headers, human dates, measurement-date attribution). **Carried:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.8) "WATCH" isn't a status; §6.1/§3 "chat centerpiece" wording vs :1147; §3/§6.1:1146 "nine category items" → twelve; §6.10:1694 `history →` pattern retired; §6.5:1390 values self-activate on click + change-logged values as preselected entry points; §9.3:2375 `surfaceContext` → typed `SurfaceRef`. **Phase D carryovers:** list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*

Full decision log: docs/decisions.md
