# Regression case library

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

## 15. Regression case library

Keep these regression cases active. They are derived from previously observed issues and common PickHome risk areas.

| Regression | Required check |
|---|---|
| Dev server runs on non-3000 port | Calendar iCal URL must not point to stale `localhost:3000` when app runs on another port and env is configured |
| Calendar timezone prop missing | Calendar tab must not crash and must show viewings |
| Checklist count query unstable | Checklist tab label count must remain stable across criteria, map, compare, and calendar navigation |
| Checklist affects score incorrectly | Changing checklist status must not change apartment score |
| Area mode mutation affects shared data | Wunschgebiet and NoGo mode changes must be reverted or performed only on disposable projects |
| LLM not configured | LLM chat and extract actions must show controlled not-configured state |
| LLM configured | Save, connection test, chat, and extraction must complete or fail with controlled UI feedback |
| KI chat inline web_search JSON | Model must not leave `{"type":"web_search",…}` in the chat bubble; server parses and runs DuckDuckGo; user sees **tippt…** then prose |
| Listing provider blocked | UI must show controlled provider failure, not crash |
| Unsaved price or address edits | Navigation must warn about unsaved changes where implemented |
| Prisma schema changed | `npx prisma generate`, `npm run db:push`, `npm test`, and browser apartment page must pass |
| Backup panel loading | Auto-backup settings must resolve from loading state |
| Street View links | Map popup and apartment detail links must use coordinates where available |
| Public transit provider unavailable | Commute UI must degrade gracefully and avoid runtime crash |
| Auto-Fill toolbar layout shift | Toolbar button must keep min width while showing „wird verarbeitet“ |
| Auto-Fill overwrites filled fields | Must not change non-empty inputs (`onlyEmpty`) |
| Auto-Fill without save | Reload must not show new values after Auto-Fill alone |
| IS24 / Kleinanzeigen fetch | Controlled `fetch_failed`; no crash; existing apartment data intact |
| PDF-only extract | Apartment with PDF, empty URL: extract succeeds or controlled `no_fields` |
| PDF address regex weak | Incomplete address still editable; save persists corrected address |
| Viewing conflict on past tab | Past calendar/viewing sections show no schedule warnings |
| Project quick-add import | „Daten automatisch füllen“ fills add form; create still requires submit |
| Session draft stale fields | After Auto-Fill + save + reload, no flicker; non-pending keys must not overwrite DB display |
| KI-Vorschlag Übernehmen | Single-field apply only; other inputs unchanged |
| Second Auto-Fill after partial save | Saved basics stay; suggestions only on still-differing filled fields |
