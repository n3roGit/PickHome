# Backup and mobile viewport

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

### 12.19 Backup export and restore

#### Must always hold

- Backup UI loads without endless loading state.
- Manual download action is visible.
- Scheduled backup settings can be loaded and saved on disposable data.
- Saved backup list is visible when backups exist.
- Restore requires explicit confirmation.
- Invalid restore ZIP is rejected safely.
- Valid synthetic restore preserves database and uploaded files.

#### Negative cases

- Invalid ZIP
- Missing confirmation checkbox
- Backup with missing upload files
- Restore while app is running if unsupported
- Permission error on `data/backups/`

#### Evidence

- Snapshot of backup panel
- Download file start if tested
- Restore result on synthetic backup only
- Console check

### 12.20 Mobile viewport

Recommended viewport:

```text
390 x 844
```

#### Must always hold

- Login is usable.
- Main navigation is reachable.
- Project tabs are reachable.
- Apartment list is usable.
- Apartment detail can be opened and saved where tested.
- Map tab does not make the page unusable.
- No main navigation horizontal overflow blocks use.

#### Negative cases

- Long project names
- Long apartment titles
- Many tabs
- Map and overlay panel on narrow viewport
- Admin tabs on narrow viewport

#### Evidence

- Snapshot of navigation
- Snapshot of project tab
- Snapshot of apartment detail
- Console check
