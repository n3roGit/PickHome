/** Regenerate docs/browser-tests/* from a monolithic MCP_BROWSER_TEST_CHECKLIST.md (if merged back). */
import fs from "fs";
import path from "path";

const root = path.resolve("docs");
const src = fs.readFileSync(path.join(root, "MCP_BROWSER_TEST_CHECKLIST.md"), "utf8");
const lines = src.split(/\r?\n/);

const preamble = (title) =>
  `# ${title}\n\nPart of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).\n\nApply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.\n\n---\n\n`;

const slices = [
  {
    file: "browser-tests/01-auth-admin-dashboard.md",
    title: "Auth, account, admin, dashboard",
    start: 247,
    end: 365,
  },
  {
    file: "browser-tests/02-project-tabs.md",
    title: "Project shell and tabs",
    start: 367,
    end: 664,
  },
  {
    file: "browser-tests/03-apartment-checklist.md",
    title: "Apartment detail and checklist fill",
    start: 665,
    end: 779,
  },
  {
    file: "browser-tests/04-listing-llm.md",
    title: "Listing import and KI assistant",
    start: 781,
    end: 923,
  },
  {
    file: "browser-tests/05-backup-mobile.md",
    title: "Backup and mobile viewport",
    start: 925,
    end: 983,
  },
  {
    file: "browser-tests/regression-library.md",
    title: "Regression case library",
    start: 1026,
    end: 1056,
  },
];

const outDir = path.join(root, "browser-tests");
fs.mkdirSync(outDir, { recursive: true });

for (const slice of slices) {
  const body = lines.slice(slice.start - 1, slice.end).join("\n");
  fs.writeFileSync(
    path.join(root, slice.file),
    preamble(slice.title) + body + "\n",
    "utf8"
  );
}

const masterHead = lines.slice(0, 242).join("\n");
const masterTail = lines.slice(984).join("\n");

const section12 = `## 12. Feature contracts

Stable per-area contracts. UI labels may change; user outcomes must not break. Shared rules: **§2**, **§7**.

| Area | Contract |
|------|----------|
| Authentication, account, admin, dashboard | [01-auth-admin-dashboard.md](browser-tests/01-auth-admin-dashboard.md) |
| Project shell, Immobilien, Archiv, team, settings, criteria, checklist config, compare, map, calendar | [02-project-tabs.md](browser-tests/02-project-tabs.md) |
| Apartment detail, checklist fill page | [03-apartment-checklist.md](browser-tests/03-apartment-checklist.md) |
| Listing import, Auto-Fill, Immobilien-Assistent (KI chat) | [04-listing-llm.md](browser-tests/04-listing-llm.md) |
| Backup export/restore, mobile viewport | [05-backup-mobile.md](browser-tests/05-backup-mobile.md) |
| Regression case library (reference table) | [regression-library.md](browser-tests/regression-library.md) |

New features: add or extend the matching contract file and register it in this table. Template: **§17**.

`;

const master = `${masterHead}\n${section12}\n${masterTail}`;
fs.writeFileSync(path.join(root, "MCP_BROWSER_TEST_CHECKLIST.md"), master, "utf8");

const readme = `# Browser test contracts

Sub-documents for [MCP_BROWSER_TEST_CHECKLIST.md](../MCP_BROWSER_TEST_CHECKLIST.md) (master: setup, rules, run order, release checklist).

| File | Sections |
|------|----------|
| [01-auth-admin-dashboard.md](01-auth-admin-dashboard.md) | §12.1–12.4 |
| [02-project-tabs.md](02-project-tabs.md) | §12.5–12.14 |
| [03-apartment-checklist.md](03-apartment-checklist.md) | §12.15–12.16 |
| [04-listing-llm.md](04-listing-llm.md) | §12.17–12.18 |
| [05-backup-mobile.md](05-backup-mobile.md) | §12.19–12.20 |
| [regression-library.md](regression-library.md) | §15 |
`;

fs.writeFileSync(path.join(outDir, "README.md"), readme, "utf8");
console.log("Split complete.");
