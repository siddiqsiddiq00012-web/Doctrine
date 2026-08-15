# DOCTRINE — DEVELOPMENT & ENGINEERING OPERATING PROTOCOL

This document establishes HOW all future tasks on Doctrine OS must be executed.

---

## 1. CORE PRINCIPLE
Doctrine must be treated as a production software system, not as a disposable prototype.
Every change must prioritize:
1. Data safety
2. Production stability
3. Existing functionality
4. Correct architecture
5. Minimal changes
6. Testing
7. UX improvements

Never sacrifice existing working functionality merely to make a new feature easier to implement.
When uncertain, investigate first. Do not guess.

---

## 2. NEVER MODIFY FIRST — AUDIT FIRST
Whenever a new task is given:
DO NOT immediately edit files.

First:
1. Understand the requested behavior.
2. Identify the relevant components/files.
3. Trace the existing data flow.
4. Identify dependencies.
5. Determine whether the issue is frontend, backend, database, authentication, deployment, or configuration related.
6. Identify existing tests protecting the affected functionality.
7. Determine the smallest safe change.

Then provide a READ-ONLY implementation plan.
STOP and wait for authorization before modifying files when the task requires architectural or potentially risky changes.
For simple, explicitly authorized changes, still inspect the relevant code before editing.

---

## 3. MINIMAL CHANGE PRINCIPLE
Fix the smallest layer responsible for the problem.
- UI problem → Prefer `src/components/`
- React state problem → Prefer `src/context/`
- API problem → Prefer `server/routes/`
- Business logic problem → Prefer `server/services/`
- Database problem → Prefer `server/db/`
- Deployment problem → Prefer Vercel/configuration

Do NOT modify unrelated layers simply because they are available.
If fixing HistoryView UI, DO NOT modify Turso, authentication, OAuth, database schema, or session handling unless investigation proves direct responsibility.

---

## 4. NEVER MIX UNRELATED CHANGES
One task should have one clear responsibility.
Do not combine unrelated architectural changes into a single implementation.

---

## 5. PROTECT PRODUCTION
Production (https://doctrine-pi.vercel.app) must be treated as the stable environment.
Never use production as the development environment. Do not directly experiment against production.
Never intentionally introduce:
- temporary databases
- debug routes
- test accounts
- test data
- destructive migrations
- temporary authentication bypasses
- development fallbacks
into production.

---

## 6. DEVELOPMENT → PREVIEW → PRODUCTION
Use this progression:
LOCAL DEVELOPMENT → TESTS → BUILD → GIT REVIEW → VERCEL PREVIEW → MANUAL VERIFICATION → PRODUCTION

Do not immediately deploy experimental changes to production.

---

## 7. GIT IS A SAFETY SYSTEM
Before significant changes check `git status` and `git log -5 --oneline`.
After changes check `git diff` and `git status`.
Never blindly overwrite existing work, reset/delete commits without explicit authorization, or force-push without authorization.
Use descriptive commit messages (`fix: ...`, `feat: ...`).

---

## 8. DATABASE SAFETY
Doctrine contains persistent user data.
NEVER:
- reset the production database
- drop production tables
- truncate tables
- delete users automatically
- recreate production databases
- replace production data with defaults
- silently switch production databases
- silently fall back to temporary SQLite
unless explicitly authorized and after a documented backup/safety plan.

Production database: Turso
Local development database: SQLite / `doctrine.db`
These environments must remain clearly separated. Production must never silently fall back to `/tmp/doctrine.db`.

---

## 9. USER DATA IS SACRED
Profile (Bio, Display Name, Avatar, Theme, Preferences), History, Tasks, Nutrition, Data Engineering records, Resources, AI summaries, Progress photos must never be overwritten merely because frontend initialized with default values.
If a change could overwrite existing user data: STOP, explain risk, propose safe implementation.

---

## 10. AUTHENTICATION SAFETY
Never modify authentication casually.
Google OAuth, sessions, cookies, user identity mapping, and auth middleware are foundational infrastructure. If a task does not require authentication changes: DO NOT TOUCH AUTHENTICATION.
Never introduce dev-logins, fallback users, automatic first-user selection, fake authenticated users, or auth bypasses.

---

## 11. FRONTEND STATE VS DATABASE STATE
DATABASE/API = SOURCE OF TRUTH.
Frontend state = representation/cache.
localStorage = optional cache only.
Never allow stale localStorage or default React state to overwrite newer authoritative database data.

---

## 12. SERVERLESS AWARENESS
Doctrine runs on Vercel.
Never assume server memory persists, local filesystem persists, single server instance, permanent module state, or persistent `/tmp`.
Persistent info must live in database or persistent service.

---

## 13. API CONTRACT PRESERVATION
Before changing an API endpoint, inspect route, callers, request/response formats, auth, and tests.
Do not silently change response structures used by the frontend.

---

## 14. DATABASE SCHEMA CHANGES
Database schema changes are HIGH RISK.
Inspect existing schema, migrations, consumers before proposing the smallest safe migration. Never use destructive migrations without explicit authorization.

---

## 15. TESTING REQUIREMENT
After modifying code, run `npm run test` and `npm run build`.
Never claim 100% without running tests. Report actual passed/failed metrics.

---

## 16. REGRESSION TESTING
Add or update regression tests when fixing bugs to prevent regression.

---

## 17. BUILD ≠ RUNTIME VERIFICATION
A successful build/test run does not automatically prove runtime behavior on Vercel preview/production. Test actual environments when production-specific issues occur.

---

## 18. WHEN A PRODUCTION ERROR OCCURS
Find ROOT CAUSE first: exact URL, status code, Vercel runtime logs, server exception, file/line, environment config, DB connection, recent Git commit. Never patch speculatively.

---

## 19. STOP CONDITIONS
STOP and ask for clarification/authorization if high risk, schema changes, auth changes, data overwrite risks, or architectural conflicts are present.

---

## 20. DO NOT "IMPROVE" UNREQUESTED CODE
Fix only the requested issue. Do not touch unrelated components, variable names, styles, or dependencies unless explicitly requested.

---

## 21. PRESERVE WORKING FEATURES
Maintain all interconnected components (Auth, Dashboard, Today, History, Nutrition, Skincare, Training, Data Engineering, Resources, Profile, Settings, AI summaries, Weekly reviews, Progress tracking).

---

## 22. PROFILE / DATA PERSISTENCE SPECIAL RULE
Flow for persistent user data:
USER ACTION → API → DATABASE WRITE → AWAIT WRITE → READ-BACK → RETURN PERSISTED RECORD → FRONTEND STATE UPDATE.

---

## 23. DEPLOYMENT CHECKLIST
Follow code inspection, minimal scope, test/build pass, git review, preview verification before production deployment.

---

## 24. ROLLBACK PRINCIPLE
If serious regression occurs on deployment, stop speculative fixes and rollback to last known-good commit before investigating.

---

## 25. COMMUNICATION STYLE
For implementation tasks, follow:
1. UNDERSTANDING
2. IMPACT
3. PLAN
4. RISKS
5. IMPLEMENTATION (after authorization)
6. VERIFICATION
7. DEPLOYMENT
8. RESULT

Never say "fixed" without empirical verification.

---

## 26. GOLDEN RULE
Make requested changes while ensuring everything that already works continues working cleanly. Increase system reliability, maintainability, and correctness over time.

---

## 27. STRICT BRANCH & GIT SAFETY PROTOCOL
1. **NEVER TOUCH MAIN**: Main is protected. Never work, commit, push, merge, rebase, or reset on `main`.
2. **TEST BRANCH ONLY**: All development, fixes, and experiments must happen on the `test` branch.
3. **NO AUTOMATIC COMMITS**: Never commit automatically. Always wait for explicit user command ("commit").
4. **NO AUTOMATIC PUSH**: Never push to GitHub without explicit authorization.
5. **NO AUTOMATIC MERGE**: Never merge `test` into `main` automatically.
6. **NO AUTOMATIC DEPLOYMENT**: Never deploy to Vercel production automatically.
7. **PRE-SESSION CHECK**: Before every dev session, verify branch is `test` using `git branch --show-current`.
8. **PRE-COMMIT REVIEW**: Always inspect `git diff` and report changed files, test results, and build results before seeking commit approval.
9. **NO DANGEROUS GIT OPERATIONS**: Never use `reset --hard`, `clean -fd`, or `push --force`.
10. **USER IS THE RELEASE AUTHORITY**: The user explicitly decides each stage (commit, push, merge, deploy).

