# Auth, account, admin, dashboard

Part of the [PickHome Browser Regression Guide](../MCP_BROWSER_TEST_CHECKLIST.md).

Apply shared rules from the master guide: **§2 Hard rules**, **§7 Evidence requirements**, **§8 Severity rules**.

---

### 12.1 Authentication and global navigation

#### Must always hold

- `/login` shows username, password, remember-login option, and submit action.
- Invalid credentials show a controlled error message.
- Valid admin login redirects to the admin landing area or admin dashboard path.
- Valid regular user login redirects to `/dashboard`.
- Admin navigation exposes project and administration areas.
- Regular user navigation does not expose administration.
- Logout returns to `/login` and invalidates the authenticated UI state.
- Footer shows installed version information and optional update information without crashing.

#### Negative cases

- Wrong password
- Empty username or password
- Direct `/admin` access as regular user
- Direct protected route access while logged out
- Expired or deleted session cookie

#### Evidence

- Snapshot after login form
- Snapshot after bad password
- Snapshot after admin login
- Snapshot after user login
- Console check after each redirect

### 12.2 Account settings

#### Must always hold

- Admin back navigation returns to an admin-appropriate route.
- Regular user back navigation returns to a user-appropriate route.
- Standard travel mode can be changed and saved.
- Company car settings can be saved without breaking commute calculations.
- Workplace address can be stored and used by commute and company car calculations.
- Pendlerpauschale or commuter allowance fields are visible where supported.
- Additional addresses can be created, edited, or deleted on disposable data.
- Password change form is present and validates input.
- TOTP setup can start, show QR or secret text, show confirmation step, and cancel without enabling 2FA.

#### Negative cases

- Missing current password
- Password mismatch
- Invalid TOTP code
- Cancel TOTP setup after QR generation
- Company car enabled without required price field
- Workplace address not saved before commute calculation

#### Evidence

- Saved success state or controlled validation error
- Reload confirms persisted settings when a value was changed
- Console check

### 12.3 Admin area

Admin tabs currently expected:

- Users
- Backup
- Timezone
- LLM or KI settings

#### Must always hold

- Users tab lists users with role and project count.
- New user form is visible and validates input.
- The last admin cannot be deleted.
- Backup tab loads without being stuck in a loading state.
- Manual backup download action is visible.
- Backup import requires explicit confirmation.
- Scheduled backup settings load and can be saved on disposable data.
- Saved backup list shows available actions if backups exist.
- Timezone selection shows a valid IANA timezone value.
- LLM settings show base URL, model, system prompt, masked token handling, save action, restore default prompt action, and connection test where configured.
- Web-Recherche section states **DuckDuckGo** as default (no API key required); optional Tavily/Brave API key field; current provider label visible (`duckduckgo`, `tavily`, or `brave` from env).

#### Negative cases

- Non-admin opens `/admin`
- Create user with duplicate username
- Import invalid ZIP
- Import without confirmation checkbox
- LLM test without required settings
- LLM API unavailable

#### Evidence

- Tab snapshots
- Save or validation result
- Network status for LLM save and test actions where available
- Console check

### 12.4 Dashboard

#### Must always hold

- Admin sees all projects or an equivalent global project view.
- Regular user sees only own/member projects.
- Project cards open the matching project route.
- New project creation is available where permitted.
- Empty states are clear and do not crash.

#### Negative cases

- Regular user attempts to open a project where the user is not a member.
- Project was deleted or archived in another session.
- Project list is empty.

#### Evidence

- Snapshot as admin
- Snapshot as regular user
- Direct route access result
- Console check
