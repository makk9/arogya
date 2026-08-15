# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: **Phases A–E ✓ ALL COMPLETE (2026-08-15) — v1 functionally done; tokenizer bug closed.** NEXT: Phase F polish, then deployment track.

### Phases A–D ✓ (committed; see git history + decisions.md)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth) · **B** Agent infra (`vault-context.ts` excludeBriefs/includeInsights modes · serializers · `AgentError` · Zod `_shared/schemas.ts` · synthesis/router · citation parser → `CitationPill`/`AiMessage`) · **C** Medication vertical = reference impl · **D** All 13 surfaces + wiki rail + shared infra (`lib/api/route-helpers.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`).

### Phase E ✓ COMPLETE
- E0a dashboard+vitals · E0b full-screen chat + `chat_sessions` · E1 extraction+router · E2 upload pipeline · E3 confirmation surface · E4 onboarding · E5 insight generator (seed insights retired) · E6 auto-titling — all committed earlier (detail: decisions.md 2026-06→08).
- **E7 doctor brief (2026-08-15):** brief format LOCKED in synthesis prompt (first-line marker `<!-- arogya:brief:delta|handoff -->`, exact `##` sections, "None recorded.", human dates, measurement-date attribution — all prompt edits user-signed) · `lib/pdf/` (`brief-parse` strip+structure, `brief-stats` footer N/range from citations, `brief-document` @react-pdf/renderer template) · `GET /api/chat/sessions/:id/brief-pdf?index=N` regenerates from the persisted message (briefs addressed by POSITION among marker messages — fresh streams have no DB id client-side) · `Download PDF` under brief messages in full-screen chat; marker display-stripped in `AiMessage` (react-markdown renders comments literally — incl. partial-prefix hiding mid-stream) · **one-click `DoctorBriefButton`** on doctor pages → `POST /api/doctors/[id]/brief`: headless synthesis (delta if completed visits else handoff, no clarifying Qs), persists titled session, cancellable (client abort + server skips persist on `req.signal.aborted` — no orphan sessions). Logged §5.7 deviation, user-directed.
- Validated claim-by-claim against the real vault (2 live Opus runs) + /check'd, all concerns closed. `/*.pdf` gitignored — exported briefs in repo root carry real PHI.

**Carryover audits queued (decisions.md):** ~~citation tokenizer~~ ✓ CLOSED 2026-08-15 (compound slugs parse whole; PDF workarounds consolidated); broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; CONTACT/primary-language cols; rail RECENT group; rail-expansion enhancement; drawer `stone-*` literals → tokens.

### Phase F — Polish (queue)
- Activation-banner logic: `setup · N of 4`, hide once core-4 covered + adaptive empty-state chips (§6.1; shell shipped in E4).
- Patient-profile vertical → click-to-edit adoption (own `use-inline-commit` hook, Edit-gated; measurement fields write vitals). Optional: styled tooltip primitive.
- §6.3:1262 `follow-up` tag on onboarding cards · §10.1 mobile "best on desktop" guidance · clickable external `↗` citations (leaning web-search-grounded) · optional brief mode-choice toggle in the one-click dialog (delta vs full-snapshot; chat path already handles both).

### Deployment track (unscheduled, high leverage for the portfolio goal)
- Phase 9.5 deploy + **seeded fictional demo vault** — dev DB currently holds the user's father's REAL medical data; a shareable demo needs the Ramesh persona populated via onboarding instead. Note: one-click brief route awaits a ~60s Opus call — check serverless duration limits at deploy time.

---

### Last Session (2026-08-15 pt 2: citation-tokenizer fix — the top carryover, closed same day E7 shipped)
- **Compound slugs now tokenize whole** (`lib/citations/parse.ts`): slug = `[a-z0-9_/-]+(?::[a-z0-9_/-]+)*` — `§ vital:blood_pressure:2026-07-22` / `§ lab-result:<marker>:<date>` are one pill each; a sentence colon after a citation is never captured. Render-time-only bug → all existing chat history + insight-card previews healed retroactively, no migration.
- **Contract locked:** `scripts/check-citation-parser.ts` 9 → 18 assertions (compound/trailing-colon/adjacent-comma fixtures + round-trips for the 3 compound serializer shapes — the bug shipped because none was asserted).
- **Lab-result pills got date-precise:** `by-marker/[slug]` accepts `<marker>[:date]`, `byMarkerSlug` takes optional `resultDate` — popover resolves the exact cited measurement (bare-marker legacy → latest-match as before). The route comment had falsely claimed the parser stripped the date.
- **PDF workarounds consolidated:** `brief-parse.ts` dangling-tail swallow deleted; `brief-stats.ts` rewritten on `tokenizeCitations` — one citation grammar again. Brief PDF regression byte-identical (footer still 26 / Jan 10 – Jul 22).
- Verified: parser 18/18 · pill-resolve 6/6 · Playwright real-session 7/7 (screenshot: whole pills + resolving popover) · tsc/eslint clean. Driver gotcha: body-clone innerText includes `<script>` RSC flight payload — exclude script/style before asserting text absence.
- Earlier same day (pt 1, committed dd22973): E7 PDF leg + one-click brief + /check closure — see decisions.md 2026-08-15 (×7 entries total).

### Next Steps
1. **Phase F** starting with activation-banner logic (see queue above).
2. **Deployment + demo-vault track** — turns "v1 done" into "showable portfolio piece."
3. Optional small: interactive `vital` pill config (type+date → vitals-page row anchor; needs a by-slug endpoint — pointer in citation-pill.tsx header).

- **Open data calls (user, unchanged):** diet restrictions + tobacco (live interview answers stand); Aspirin purpose/prescriber never captured.
- **Pending design.md doc-fixes:** **NEW —** §5.7/§6.5:1188 briefs now also generable one-click from the doctor page (user-directed deviation 2026-08-15); §10.3:3155 brief addendum superseded by the locked-format version in `synthesis.ts` (marker, exact headers, human dates, measurement-date attribution). **Carried:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.8) "WATCH" isn't a status; §6.1/§3 "chat centerpiece" wording vs :1147; §3/§6.1:1146 "nine category items" → twelve; §6.10:1694 `history →` pattern retired; §6.5:1390 values self-activate on click + change-logged values as preselected entry points; §9.3:2375 `surfaceContext` → typed `SurfaceRef`. **Phase D carryovers:** list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*

Full decision log: docs/decisions.md
