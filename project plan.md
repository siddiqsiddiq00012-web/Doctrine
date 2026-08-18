Below is the finalized blueprint. It is intentionally written as a **product + architecture contract**, not merely a feature wishlist.

You can save it as:

```text
blueprint.md
```

# DOCTRINE — FINAL PRODUCT & ENGINEERING BLUEPRINT

**Version:** 1.0  
**Status:** Final architectural direction  
**Development mode:** Localhost-first  
**Production deployment:** Deferred until the product is complete and production-audited  
**Primary objective:** Build Doctrine as an automated personal operating system that minimizes manual tracking while maximizing useful understanding, consistency, resource management, and decision support.

---

# 1. PRODUCT DEFINITION

Doctrine is a **personal operating system and intelligent assistant** designed to solve four fundamental problems:

1. Inconsistency.
2. Lack of reliable progress tracking.
3. Poor resource management.
4. Excessive mental effort required to organize and monitor personal goals.

Doctrine must not become another productivity application that requires the user to spend significant time maintaining it.

The central principle is:

> **Doctrine should automatically convert actions into traceable information and use that information to determine what matters next.**

The user should primarily:

- define goals,
- establish important routines/plans,
- perform actions,
- confirm completion,
- correct exceptions,
- review important information.

Doctrine should automatically handle the majority of:

- tracking,
- calculations,
- resource consumption,
- financial state updates,
- progress calculations,
- forecasting,
- historical records,
- consistency analysis,
- decision preparation,
- recommendations.

---

# 2. CORE PRODUCT PHILOSOPHY

## 2.1 Automation over manual entry

Doctrine must never ask the user to manually enter information that can be reliably inferred from an action already performed.

Example:

The user completes:

> Morning Routine

Doctrine should automatically record the known resource consumption associated with that routine.

It should **not** subsequently ask:

- Facewash used?
- Banana consumed?
- Milk consumed?
- Oats consumed?

unless the user indicates that actual consumption differed from the normal definition.

---

# 3. THE FUNDAMENTAL DOCTRINE LOOP

The entire system revolves around:

```text
PLAN
  ↓
ACT
  ↓
AUTOMATICALLY RECORD
  ↓
MEASURE
  ↓
UNDERSTAND
  ↓
DECIDE
  ↓
ADJUST
  ↓
PLAN AGAIN
```

More technically:

```text
User Action
    ↓
Execution Event
    ↓
Automatic Side Effects
    ├── Progress update
    ├── Resource consumption
    ├── Financial update
    ├── Goal progress
    ├── Historical record
    └── Forecast recalculation
    ↓
Current State
    ↓
Analysis
    ↓
Decision Engine
    ↓
Recommendation
    ↓
User Action
```

This loop is the heart of Doctrine.

---

# 4. DESIGN PRINCIPLE: DEEP SYSTEM, SIMPLE INTERFACE

Doctrine may contain sophisticated backend systems, but the user interface must remain simple.

The user should not need to understand:

- event processors,
- database transactions,
- resource ledgers,
- forecasting algorithms,
- financial calculations,
- machine-learning models,
- AI context construction,
- background jobs.

The interface should communicate:

- what is happening,
- what matters,
- what changed,
- what needs attention,
- what should happen next.

---

# 5. PRIMARY USER EXPERIENCE

Doctrine should have a small number of primary experiences.

## 5.1 Home / Today

The primary screen.

It should answer:

> **What matters today?**

It should show:

- current date,
- current priority,
- today's important actions,
- completion status,
- critical alerts,
- financial summary,
- resource alerts,
- goal status,
- consistency status.

It should not display every available database field.

---

# 6. "WHAT NOW?" ENGINE

This is one of the most important systems in Doctrine.

The user should be able to ask:

> **What now?**

Doctrine evaluates:

```text
Current time
+
Day
+
Schedule
+
Goals
+
Priority
+
Deadlines
+
Incomplete actions
+
Historical adherence
+
Financial state
+
Resource state
+
Upcoming obligations
+
Current constraints
```

It then determines the highest-value feasible next action.

Example:

```text
WHAT NOW

Data Engineering
45 minutes

Reason:
Priority-1 milestone is incomplete and
your historical completion rate drops
after 9 PM.
```

The engine should prioritize actions rather than merely display them.

---

# 7. GOAL SYSTEM

Goals represent desired outcomes.

A goal should contain:

- name,
- description,
- priority,
- target date,
- optional measurable target,
- status,
- milestones,
- associated plans,
- associated actions,
- progress evidence,
- dependencies,
- financial requirements where applicable.

Example:

```text
Goal
└── Become employable as a Data Engineer
    ├── Python
    ├── SQL
    ├── Data modeling
    ├── ETL
    ├── Spark
    ├── Airflow
    └── Portfolio
```

Goals must not require manual percentage updates.

Progress should be derived from evidence whenever possible.

---

# 8. PRIORITY SYSTEM

User-defined priorities are authoritative.

Doctrine must not silently reorder the user's goals because an algorithm thinks another goal is more important.

The system may calculate:

- urgency,
- risk,
- deadline pressure,
- likelihood of failure,

but it must preserve explicit user priority.

Priority should therefore be represented separately from calculated urgency.

Example:

```text
Priority: 1
Urgency: HIGH
Risk: MEDIUM
```

These are different concepts.

---

# 9. PLAN SYSTEM

Plans connect goals to actual execution.

A plan should define:

- objective,
- expected duration,
- frequency,
- actions,
- dependencies,
- associated resources,
- expected outcomes,
- optional financial requirements.

Plans should generate actionable work rather than becoming static documents.

---

# 10. ACTIVITY / ROUTINE SYSTEM

Activities represent repeatable actions.

Examples:

- Morning Routine
- Morning Skincare
- Mass Shake
- Workout
- Data Engineering Session
- Weekly Review

Each activity may contain:

```text
Activity
├── Tasks
├── Duration
├── Schedule
├── Goal relationship
├── Resource consumption definitions
├── Expected outcomes
└── Optional financial/resource effects
```

---

# 11. AUTOMATIC RESOURCE CONSUMPTION

This is a critical requirement.

Activities must be able to declare expected resource consumption.

Example:

```text
Morning Mass Shake

Consumes:
- Banana: 1 unit
- Milk: 300 ml
- Oats: 50 g
- Peanut Butter: 30 g
```

Another:

```text
Morning Skincare

Consumes:
- Facewash: 2 ml
- Moisturizer: 1 ml
- Sunscreen: 2 ml
```

When the user completes the activity:

```text
Activity Completed
       ↓
Execution Event
       ↓
Consumption Events
       ↓
Resource Stock Updated
       ↓
Forecast Recalculated
```

No additional manual resource entry should be required.

---

# 12. EXPECTED VS ACTUAL CONSUMPTION

Doctrine must distinguish:

### Expected consumption

Defined by an activity.

### Actual consumption

What really happened.

Normal case:

```text
Activity completed
→ expected consumption automatically recorded
```

Exception:

```text
Actual consumption differed
→ user can correct it
```

Doctrine should not force users to enter consumption every time.

---

# 13. RESOURCE SYSTEM

Resources represent physical or otherwise consumable assets.

A resource should support:

- name,
- category,
- quantity,
- unit,
- minimum stock,
- maximum/target stock where useful,
- consumption history,
- purchase history,
- expected consumption,
- forecast,
- replenishment status.

Examples:

- Facewash
- Bananas
- Milk
- Oats
- Supplements
- Skincare products
- Household resources.

---

# 14. RESOURCE EVENT MODEL

Resource changes should be event-based.

Examples:

```text
PURCHASE
CONSUMPTION
ADJUSTMENT
CORRECTION
TRANSFER
INITIAL_STOCK
```

A resource quantity should not simply be manually overwritten without recording why it changed.

Example:

```text
Banana

Opening stock: 10
Consumption: -1
Consumption: -1
Purchase: +12
Consumption: -2
Correction: -1
```

This provides historical traceability.

---

# 15. RESOURCE FORECASTING

Doctrine should calculate expected depletion using:

```text
Current stock
+
Historical consumption
+
Expected activity consumption
+
Scheduled activities
+
Future plans
```

Possible output:

```text
Bananas
Current: 3
Expected daily usage: 1.2
Estimated depletion: 2.5 days
```

The forecast should not create purchases automatically unless explicitly permitted by a future user-defined automation rule.

It should create a recommendation or purchase candidate.

---

# 16. RESOURCE → CART → PURCHASE PIPELINE

The intended lifecycle is:

```text
Resource shortage detected
        ↓
Purchase recommendation
        ↓
Cart
        ↓
User decision
        ↓
Purchase
        ↓
Purchase record
        ↓
Resource stock increase
        ↓
Financial expense
        ↓
Forecast recalculation
```

This must be traceable.

---

# 17. CART SYSTEM

The Cart represents **purchase intent**, not spending.

Cart items may contain:

- item name,
- quantity,
- estimated price,
- priority,
- target purchase date,
- status,
- optional goal,
- optional resource,
- notes.

Cart statuses may include:

```text
PENDING
APPROVED
DEFERRED
REJECTED
PURCHASED
```

Cart creation must not create:

- an expense,
- a purchase record,
- resource consumption,
- a cash deduction.

---

# 18. PURCHASE SYSTEM

An actual purchase represents a real-world transaction.

A purchase may automatically create:

```text
Purchase Event
+
Financial Expense
+
Resource Stock Increase
+
Historical Record
+
Forecast Recalculation
```

The user should not have to manually repeat the same information across multiple systems.

---

# 19. FINANCIAL SYSTEM

Financial management is a major Doctrine subsystem.

It must be powerful but understandable.

The system must distinguish:

### Income

Actual money entering available cash.

### Expense

Actual money leaving available cash.

### Reserve

Money earmarked for mandatory future obligations.

### Allocation

Money earmarked toward a financial goal.

### Cart commitment

Purchase intention.

Cart commitments must not automatically reduce actual cash.

---

# 20. MONEY REPRESENTATION

All financial values must use integer smallest units.

For INR:

```text
₹1.00 = 100 Paise
```

Database values:

```text
₹220.00 → 22000
₹185.50 → 18550
```

No floating-point monetary storage.

---

# 21. FINANCIAL LEDGER

The financial ledger is authoritative for actual financial events.

It must record:

- amount,
- type,
- date,
- user,
- source,
- relationships,
- metadata.

Relevant transaction types:

```text
INCOME
EXPENSE
RESERVE
ALLOCATION
```

The ledger must remain historically trustworthy.

---

# 22. FINANCIAL STATE ENGINE

Doctrine should calculate:

```text
Net Cash
Spendable Cash
Reserved Funds
Allocated Funds
Discretionary Funds
Financial Deficit
Upcoming Obligations
```

Important distinction:

```text
netCash = income - expenses
```

Net cash may be negative.

But:

```text
spendableCash = max(0, netCash)
```

Therefore Doctrine can represent a deficit without recommending negative spending.

---

# 23. FINANCIAL DECISION ENGINE

The financial system should answer practical questions.

Example:

> Can I buy this?

Doctrine considers:

```text
Current net cash
+
Spendable cash
+
Reserves
+
Goal allocations
+
Upcoming obligations
+
Purchase price
+
Priority
```

Possible result:

```text
BUY
DEFER
REJECT
```

with a reason.

Example:

> Defer this purchase. It is affordable in isolation, but purchasing it would reduce discretionary funds below your upcoming transport obligation.

---

# 24. FINANCIAL GOALS

Financial goals answer:

> What am I saving toward?

Example:

```text
Goal:
PC Upgrade

Target:
₹35,000

Priority:
1

Allocated:
₹8,000

Remaining:
₹27,000
```

The authoritative allocation source is the financial ledger.

The goal allocation amount may be maintained as a synchronized read cache.

---

# 25. FINANCIAL SOURCE-OF-TRUTH RULE

Doctrine must maintain clear authority:

```text
Financial ledger
    ↓
authoritative financial history

Financial goal allocation cache
    ↓
derived/synchronized representation
```

A cache mismatch must never be repaired by modifying historical ledger transactions.

---

# 26. FINANCIAL ↔ RESOURCE INTEGRATION

Financial and resource systems must communicate automatically.

Example:

```text
Resource:
Bananas likely run out in 3 days
        ↓
Purchase candidate:
Bananas
        ↓
Estimated cost:
₹120
        ↓
Financial engine
        ↓
Affordable?
        ↓
Recommendation
```

---

# 27. PROGRESS TRACKING

Progress must be **evidence-driven**.

Doctrine should derive progress from:

- completed actions,
- completed milestones,
- execution consistency,
- measurable outputs,
- recorded results,
- historical comparisons,
- goal-specific metrics.

The user should not have to manually enter:

> "Progress = 73%"

unless a goal genuinely requires manual assessment.

---

# 28. EXECUTION TRACKING

Every important action should produce an execution record.

Possible states:

```text
PLANNED
COMPLETED
PARTIAL
SKIPPED
CANCELLED
```

The system should preserve:

- planned date,
- actual completion date,
- duration where available,
- associated goal,
- associated activity,
- reason for correction where applicable.

---

# 29. CONSISTENCY ENGINE

Consistency should not be reduced to a meaningless streak.

Doctrine should calculate:

- completion rate,
- planned vs actual,
- recent trend,
- recurring failure points,
- task-type adherence,
- time-of-day adherence,
- weekly consistency,
- long-term consistency.

Example:

```text
Last 14 days

Overall: 76%
Morning: 91%
Evening: 58%
Priority-1 tasks: 83%
```

This provides actionable information.

---

# 30. PATTERN DETECTION

Doctrine should identify patterns such as:

```text
"Completion drops after 9 PM."

"Resource consumption is consistently higher on weekends."

"Financial spending increases after payday."

"Goal X repeatedly gets postponed when Goal Y workload increases."
```

These are derived insights, not manually entered facts.

---

# 31. WEEKLY REVIEW

The weekly review should be largely generated automatically.

It should summarize:

- execution,
- goals,
- resources,
- finances,
- consistency,
- major changes,
- failures,
- successes,
- detected patterns,
- risks,
- recommendations.

The user should primarily review and correct the interpretation.

---

# 32. PROGRESS PHOTOS

Existing progress-photo functionality should remain part of Doctrine.

It supports:

- historical photos,
- categories,
- weekly comparison,
- strict user isolation,
- deterministic deltas,
- optional AI-assisted visual comparison.

Photos are evidence, not the sole source of progress.

---

# 33. AI SYSTEM

AI must be an **advisor and reasoning layer**, not the source of truth.

Architecture:

```text
Database
   ↓
Deterministic engines
   ↓
Structured state
   ↓
Relevant historical evidence
   ↓
AI context
   ↓
AI reasoning
   ↓
Human-readable recommendation
```

The AI must not independently invent:

- financial balances,
- resource quantities,
- completion history,
- goal progress,
- database facts.

---

# 34. AI RESPONSIBILITIES

AI may be used for:

- explanations,
- summaries,
- pattern interpretation,
- planning assistance,
- natural-language interaction,
- recommendation explanations,
- weekly review interpretation,
- contextual coaching.

Deterministic code should handle:

- money,
- stock,
- dates,
- calculations,
- permissions,
- state transitions,
- ownership,
- source-of-truth rules.

---

# 35. MACHINE LEARNING

ML should **not** be introduced simply because Doctrine is an AI project.

ML becomes useful when enough historical data exists.

Potential future models:

### Consistency prediction

Predict probability of completing an action.

### Resource consumption prediction

Predict actual usage beyond simple averages.

### Financial forecasting

Predict future financial pressure.

### Goal-risk prediction

Estimate probability of missing a goal.

### Behavioral pattern detection

Identify recurring conditions associated with success/failure.

ML outputs must remain advisory and explainable where possible.

---

# 36. AI VS ML

Doctrine must maintain this distinction.

### Deterministic engine

"What is my financial balance?"

### ML

"What is likely to happen?"

### AI reasoning

"What does this mean, and how should I explain it?"

### Decision engine

"What action should be prioritized?"

These systems complement one another.

---

# 37. AUTOMATION ENGINE

Doctrine should eventually support event-driven automation.

Example:

```text
WHEN
Morning Routine = COMPLETED

THEN
Record routine execution
Record expected resource consumption
Update resource stock
Update progress
Recalculate forecast
Update current state
```

Another:

```text
WHEN
Resource forecast < threshold

THEN
Create purchase candidate
```

Another:

```text
WHEN
Financial purchase would threaten mandatory obligation

THEN
Flag purchase as financially unsafe
```

Automations must be deterministic and auditable.

---

# 38. EVENT ARCHITECTURE

Doctrine should increasingly treat meaningful actions as events.

Examples:

```text
TASK_COMPLETED
TASK_SKIPPED
ROUTINE_COMPLETED
RESOURCE_CONSUMED
RESOURCE_PURCHASED
RESOURCE_ADJUSTED
PURCHASE_CREATED
PURCHASE_COMPLETED
INCOME_RECORDED
EXPENSE_RECORDED
RESERVE_CREATED
GOAL_ALLOCATION_CREATED
GOAL_MILESTONE_COMPLETED
WEEKLY_REVIEW_COMPLETED
```

Events provide historical traceability and enable automation.

---

# 39. DATABASE ARCHITECTURE

## Target database

**PostgreSQL**

PostgreSQL should become the long-term system of record.

The database should store structured Doctrine data rather than relying on scattered local files.

Potential logical areas:

```text
users
goals
goal_milestones
plans
activities
tasks
executions
execution_events
resources
resource_events
resource_consumption_rules
resource_forecasts
financial_transactions
financial_goals
financial_preferences
cart_items
purchase_records
weekly_reviews
progress_photos
derived_metrics
insights
automation_rules
```

Exact schema must be determined after auditing the current project ZIP.

Do not blindly recreate tables that already exist.

---

# 40. DATABASE REQUIREMENTS

Production-grade database design should include:

- foreign keys,
- indexes,
- constraints,
- transactions,
- ownership enforcement,
- timestamps,
- appropriate numeric types,
- explicit nullability,
- unique constraints,
- migration versioning,
- auditability.

Every user-owned table must have reliable ownership boundaries.

---

# 41. MULTI-TENANT SECURITY

Every user-owned query must be scoped to the authenticated user.

Never trust:

```text
?userId=
```

from the client.

Identity must originate from the authoritative server-side authentication/session layer when authentication is eventually enabled.

Until then, development mode may use a controlled local identity mechanism.

---

# 42. LOGIN IS NOT PART OF THE CURRENT PRODUCT BUILD

Authentication must be explicitly excluded from the current implementation phase.

Do not allow login work to block Doctrine development.

Later, authentication can be evaluated separately as a production concern.

Current priority:

```text
DOCTRINE FUNCTIONALITY
>
AUTHENTICATION
```

---

# 43. LOCALHOST-FIRST DEVELOPMENT

During product development:

```text
localhost
   ↓
primary development environment
```

Vercel should not be used as the daily development environment.

Production deployment happens only after:

1. Features are complete.
2. Local tests pass.
3. Architecture is audited.
4. Database migration is verified.
5. Production environment is configured.
6. Production smoke tests pass.

---

# 44. VERCEL / PRODUCTION

Production deployment is a separate phase.

Expected architecture:

```text
Frontend
   ↓
Vercel

Backend/serverless
   ↓
Vercel

Persistent database
   ↓
PostgreSQL
```

No critical application state should depend on ephemeral Vercel filesystem storage.

---

# 45. FILE STORAGE

Structured data belongs in PostgreSQL.

Large binary assets such as progress photos should eventually use appropriate persistent object/blob storage.

The application should not assume that a serverless filesystem is permanent.

Existing fallback behavior should remain safe until a final object-storage architecture is selected.

---

# 46. API DESIGN

APIs should be:

- authenticated where required,
- user-scoped,
- validated,
- deterministic,
- versionable where necessary,
- safe against malformed input,
- free of stack-trace leakage.

API responsibilities should remain separate from business logic.

Example:

```text
Route
 ↓
Validation
 ↓
Service
 ↓
Engine
 ↓
Database
```

Do not place complex business logic directly inside route handlers.

---

# 47. SERVICE ARCHITECTURE

Major business systems should have dedicated services.

Examples:

```text
financialEngine
financialSyncService
resourceService
resourceForecastService
executionService
goalService
progressService
decisionEngine
automationEngine
```

Services should be testable independently.

---

# 48. DETERMINISTIC ENGINES

The following should remain deterministic:

- financial calculations,
- resource quantities,
- goal allocations,
- date calculations,
- priority ordering,
- task states,
- ownership checks,
- forecast baseline calculations,
- purchase state transitions.

Given identical inputs, they should produce identical outputs.

---

# 49. OBSERVABILITY

Doctrine should eventually have:

- structured server logs,
- error tracking,
- health checks,
- database diagnostics,
- performance monitoring,
- background-job monitoring,
- audit logs for critical state changes.

However, observability must not clutter the user interface.

---

# 50. ERROR HANDLING

Errors should fail safely.

Never:

```text
catch (error) {}
```

for critical operations.

Critical failures must:

1. Preserve data integrity.
2. Log useful diagnostic information server-side.
3. Return safe user-facing errors.
4. Avoid leaking secrets or stack traces.
5. Prevent partial financial/resource state corruption.

---

# 51. TRANSACTIONAL INTEGRITY

Operations involving multiple related systems should use database transactions where appropriate.

Example:

```text
Purchase
 ↓
Financial expense
 ↓
Resource stock increase
 ↓
Purchase record
```

These should not leave Doctrine in an inconsistent half-completed state.

---

# 52. IDEMPOTENCY

Automatic operations must avoid duplicate effects.

Example:

If a routine-completion request is accidentally sent twice, Doctrine must not automatically consume:

```text
2 bananas
```

when only one routine was actually completed.

The system needs unique execution/event identities or equivalent safeguards.

---

# 53. AUDITABILITY

Important state changes should be explainable.

Doctrine should be able to answer:

> Why did my resource decrease?

Example:

```text
Bananas -1

Reason:
Morning Mass Shake completed
2026-08-17 07:20
```

Financial:

```text
₹350 expense

Reason:
Purchase #P-104
```

Goal:

```text
₹500 allocation

Source:
Financial transaction #TX-204
```

This is essential for trust.

---

# 54. AUTOMATIC TRACEABILITY REQUIREMENT

Every significant action should have a causal chain.

Example:

```text
Morning Routine
      ↓
Execution
      ↓
Resource Consumption
      ↓
Stock Change
      ↓
Forecast Change
      ↓
Purchase Recommendation
      ↓
Cart
```

Doctrine should not contain disconnected modules where the same real-world event must be manually entered multiple times.

---

# 55. MONITORING WITHOUT OVERLOAD

The user must be able to monitor Doctrine without monitoring its internal machinery.

The interface should surface:

### Today

- important actions,
- execution progress,
- immediate problems.

### Resources

- low stock,
- upcoming depletion,
- important purchase recommendations.

### Finance

- available money,
- obligations,
- discretionary amount,
- important financial warnings.

### Goals

- progress,
- risk,
- deadlines.

### Intelligence

- important patterns,
- recommended changes.

Everything else should remain accessible but secondary.

---

# 56. DASHBOARD DESIGN PRINCIPLE

The dashboard should answer:

> **"How am I doing?"**

not:

> "Here are all 147 things Doctrine knows about you."

Information should be prioritized.

Use:

```text
Critical
↓
Important
↓
Useful
↓
Historical
↓
Technical
```

rather than presenting everything equally.

---

# 57. DAILY INTERACTION BUDGET

Doctrine should aim for extremely low manual tracking overhead.

Typical daily interaction should be measured in **minutes**, not hours.

The user should primarily:

```text
Complete
Skip
Correct
Confirm
Ask
```

not:

```text
Create
Enter
Calculate
Update
Recalculate
Synchronize
```

---

# 58. MANUAL OVERRIDES

Automation must never become a prison.

The user must be able to correct:

- resource consumption,
- task completion,
- financial records,
- forecasts,
- goal state,
- routine definitions.

But corrections should be treated as explicit exceptions, not the normal workflow.

---

# 59. PERSONALIZATION

Doctrine should gradually learn:

- preferred work times,
- common failure periods,
- realistic task duration,
- resource consumption patterns,
- spending patterns,
- goal priorities,
- scheduling constraints,
- successful routines.

Personalization must come from evidence.

It must never silently redefine user priorities.

---

# 60. SECURITY

Production-grade security requirements include:

- secure authentication when implemented,
- HTTP-only cookies where appropriate,
- secure session handling,
- CSRF protection where applicable,
- input validation,
- authorization checks,
- user isolation,
- secret management,
- no secrets in Git,
- no stack traces in production responses,
- rate limiting where appropriate,
- secure headers,
- database least-privilege access.

---

# 61. TESTING STRATEGY

Doctrine must maintain multiple testing levels.

### Unit tests

For:

- money,
- calculations,
- forecasts,
- decision logic,
- parsers,
- validation.

### Integration tests

For:

- database interactions,
- services,
- event processing,
- resource updates,
- financial workflows.

### API tests

For:

- authentication,
- authorization,
- validation,
- ownership,
- response contracts.

### End-to-end tests

For critical user flows:

```text
Complete routine
→ resource automatically decreases
→ progress updates
→ forecast changes
```

and:

```text
Purchase item
→ expense recorded
→ stock updated
→ financial state updated
```

---

# 62. CURRENT TESTING STANDARD

Existing Doctrine development already has a substantial automated test foundation.

Recent checkpoints have reached:

```text
209 / 209 tests passing
```

and later broader verification reached:

```text
210 / 210 tests passing
```

The project should preserve this discipline.

No major feature should be considered complete merely because the UI appears to work.

---

# 63. BUILD REQUIREMENT

Every meaningful implementation checkpoint should verify:

```text
npm run test
npm run build
git diff --check
```

Where relevant, perform targeted integration/API tests as well.

---

# 64. DEVELOPMENT BRANCH POLICY

All active development occurs on:

```text
test
```

The `main` branch must remain untouched unless explicitly authorized.

Do not:

- merge,
- reset,
- deploy,
- push,
- rewrite history,

without explicit authorization.

---

# 65. FEATURE ACCEPTANCE STANDARD

A feature is not complete when:

> "The button works."

It is complete when:

```text
UI
+
API
+
Database
+
Business logic
+
Automatic side effects
+
Security
+
Error handling
+
Tests
+
Build
+
Traceability
```

are all coherent.

---

# 66. WHAT NOT TO BUILD

Doctrine should explicitly avoid feature bloat.

Do not add features merely because they are common in productivity applications.

Avoid unnecessary:

- gamification,
- badges,
- excessive streak mechanics,
- social systems,
- feeds,
- unnecessary calendars,
- complicated journaling,
- redundant dashboards,
- excessive tags,
- duplicate task systems,
- manual analytics entry,
- decorative AI features,
- meaningless productivity scores.

Every feature must contribute to the Doctrine operating loop.

---

# 67. FEATURE EVALUATION RULE

Before implementing a feature, ask:

### Question 1

Does it help Doctrine observe reality?

### Question 2

Does it help Doctrine understand reality?

### Question 3

Does it help Doctrine make a better decision?

### Question 4

Does it reduce manual work?

### Question 5

Does it improve consistency or resource management?

If the answer to all five is no, the feature should probably not exist.

---

# 68. DATA PIPELINE

The long-term data pipeline is:

```text
USER ACTIONS
     ↓
EVENTS
     ↓
POSTGRESQL
     ↓
CURRENT STATE
     ↓
DETERMINISTIC ANALYTICS
     ↓
HISTORICAL PATTERNS
     ↓
ML / AI
     ↓
DECISION ENGINE
     ↓
RECOMMENDATION
```

---

# 69. LONG-TERM INTELLIGENCE STACK

The mature Doctrine architecture should look like:

```text
                ┌───────────────────┐
                │   USER INTERFACE  │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ EXECUTION SYSTEM  │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │    EVENT LAYER    │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │    POSTGRESQL     │
                └─────────┬─────────┘
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
        STATE ENGINE   ANALYTICS    HISTORY
             │            │            │
             └────────────┼────────────┘
                          ▼
                ┌───────────────────┐
                │ FORECASTING / ML  │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ DECISION ENGINE   │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │    AI ADVISOR     │
                └─────────┬─────────┘
                          │
                          ▼
                      WHAT NOW?
```

---

# 70. TECHNOLOGY DIRECTION

The exact versions should be verified against the project before migration.

Current architectural direction:

### Frontend

- JavaScript
- React
- Vite
- CSS/component architecture already present

### Backend

- JavaScript
- Node.js
- Express
- service-oriented backend

### Database

**Target: PostgreSQL**

### ORM / database layer

Existing Drizzle architecture should be evaluated and retained where appropriate.

### AI

Gemini integration where appropriate.

### ML

Python is preferred for future ML experimentation/training if ML complexity justifies a separate service.

### Production

- Vercel for application/serverless deployment where appropriate
- PostgreSQL for persistent structured data
- Persistent object storage for large binary assets when required

---

# 71. LANGUAGE STRATEGY

Do not rewrite the project simply because another language is theoretically better.

Current JavaScript codebase remains the primary application language.

Use:

```text
JavaScript
→ application

SQL
→ database

Python
→ future ML/data science workloads when justified
```

A language change must solve a real engineering problem.

---

# 72. DATA SCIENCE / ML FUTURE

If ML becomes substantial, the architecture may become:

```text
JavaScript Application
        ↓
PostgreSQL
        ↓
Python ML Service
        ↓
Predictions
        ↓
PostgreSQL
        ↓
Doctrine Decision Engine
```

Do not introduce this separation until the data volume and problem justify it.

---

# 73. THE AUTOMATIC ROUTINE EXAMPLE

This is the reference implementation pattern.

User:

```text
✓ Morning Routine
```

Doctrine:

```text
1. Create execution record

2. Generate expected resource events:
   Facewash -2 ml
   Banana -1
   Milk -300 ml

3. Update resource state

4. Update progress

5. Update consistency

6. Update historical events

7. Recalculate resource forecasts

8. Recalculate relevant financial/resource implications

9. Update current state

10. Make new recommendations available
```

User sees:

> Morning Routine completed.

Optionally:

> Resources automatically updated.

That's it.

---

# 74. EXCEPTION EXAMPLE

If the user used two bananas instead of one:

```text
Morning Routine
✓ completed
```

Doctrine assumes normal consumption.

Only if necessary:

> Consumption differed?

User:

> Yes — 2 bananas.

Doctrine creates:

```text
Expected: -1
Actual correction: -1
Net actual consumption: -2
```

The system remains accurate without making every day cumbersome.

---

# 75. FINANCIAL PURCHASE EXAMPLE

User purchases a planned item.

Doctrine should perform:

```text
Cart item
      ↓
Purchase confirmation
      ↓
Purchase record
      ↓
Financial EXPENSE
      ↓
Resource stock update if applicable
      ↓
Goal status update if applicable
      ↓
Financial state recalculation
      ↓
Cart status = PURCHASED
      ↓
Historical record
```

No duplicate manual entry.

---

# 76. RESOURCE REPLENISHMENT EXAMPLE

Doctrine detects:

```text
Milk:
Current stock = 500 ml
Expected consumption = 300 ml/day
```

It predicts depletion.

Then:

```text
Forecast
 ↓
Purchase candidate
 ↓
Cart suggestion
 ↓
Financial affordability check
```

The user receives:

> Milk is likely to run out tomorrow. Estimated replenishment: ₹X. You can afford it without affecting your current Priority-1 goal.

That is the intended Doctrine experience.

---

# 77. FINANCIAL INTELLIGENCE EXAMPLE

User considers a ₹5,000 purchase.

Doctrine knows:

```text
Net cash
Reserved money
Goal allocations
Upcoming obligations
Expected income
Existing commitments
```

Instead of merely saying:

> Balance: ₹8,000

it can say:

> You technically have ₹8,000 cash, but only ₹3,200 is discretionary after existing commitments. This purchase should be deferred.

That is much more useful.

---

# 78. CONSISTENCY INTELLIGENCE EXAMPLE

Doctrine detects:

```text
Priority-1 tasks:
82% completion

Tasks scheduled after 9 PM:
46%

Tasks scheduled before 7 PM:
88%
```

It can infer:

> Your execution reliability drops sharply late at night. Doctrine recommends moving high-cognitive-load work earlier.

The system doesn't merely count missed tasks.

It learns from them.

---

# 79. THE FINAL USER EXPERIENCE

The mature product should feel like:

```text
                 DOCTRINE

        "How are things going?"

Execution        78%
Goals            4 / 5 on track
Finance          ₹X discretionary
Resources        2 alerts
Consistency      Improving

────────────────────────────

WHAT NOW?

Data Engineering
45 minutes

Reason:
Priority-1 milestone is behind
schedule and your historical
completion rate is strongest
during this time.

────────────────────────────

ATTENTION

• Milk likely runs out tomorrow
• Financial goal remains on track
• Weekly review due Sunday
```

The user can inspect deeper information whenever desired.

But they are never forced to manage the machinery.

---

# 80. FINAL DOCTRINE PRINCIPLE

The project should always optimize for:

> **Maximum useful understanding with minimum required user maintenance.**

Not:

> Maximum number of features.

Not:

> Maximum number of dashboards.

Not:

> Maximum amount of AI.

Not:

> Maximum amount of data entry.

The objective is:

```text
          LESS MANUAL TRACKING
                  ↓
          MORE AUTOMATIC DATA
                  ↓
          BETTER UNDERSTANDING
                  ↓
          BETTER DECISIONS
                  ↓
          BETTER CONSISTENCY
                  ↓
          BETTER RESOURCE USE
                  ↓
          BETTER LIFE MANAGEMENT
```

---

# 81. IMPLEMENTATION ORDER

The project should proceed in this order.

## Phase 0 — Project audit

Before further implementation:

- inspect current project ZIP,
- map every existing feature,
- map current database schema,
- map APIs,
- map frontend routes/components,
- identify duplicated systems,
- identify dead code,
- identify current authentication dependencies,
- identify SQLite dependencies,
- identify filesystem dependencies.

**No unnecessary rewrites.**

---

## Phase 1 — Data architecture

- finalize PostgreSQL schema,
- migrate existing structured data architecture,
- establish migrations,
- establish indexes,
- preserve ownership constraints,
- preserve existing financial semantics,
- preserve existing resource semantics.

---

## Phase 2 — Event / execution architecture

Build the foundation for:

```text
Activity
→ Execution
→ Event
→ Automatic side effects
```

This is the most important automation layer.

---

## Phase 3 — Automatic resource consumption

Implement:

```text
Activity
→ Resource consumption rules
→ Consumption events
→ Stock update
→ Forecast update
```

This should eliminate the current manual resource bookkeeping problem.

---

## Phase 4 — Complete financial lifecycle

Finish:

```text
Income
→ Ledger
→ Reserve
→ Allocation
→ Cart
→ Purchase
→ Expense
→ Financial state
```

and integrate it with resources.

---

## Phase 5 — Progress intelligence

Connect:

```text
Executions
+
Goals
+
Milestones
+
Results
```

into automatically derived progress.

---

## Phase 6 — Decision engine

Build:

```text
Current state
+
Priorities
+
Constraints
+
History
+
Forecasts
```

into:

> **What Now?**

---

## Phase 7 — Monitoring UI

Create the small number of views necessary to monitor:

- Today,
- Goals,
- Resources,
- Finance,
- Progress,
- Intelligence.

No unnecessary dashboards.

---

## Phase 8 — Historical analytics

Build:

- consistency trends,
- goal trends,
- financial trends,
- resource trends,
- behavioral patterns.

---

## Phase 9 — AI advisor

Connect AI to structured Doctrine state.

AI should explain and reason over reliable data.

---

## Phase 10 — ML

Only after sufficient historical data exists.

Implement only models with demonstrable value.

---

## Phase 11 — Production

Only after local completion:

- authentication,
- production security,
- PostgreSQL production configuration,
- persistent storage,
- Vercel configuration,
- environment variables,
- monitoring,
- deployment,
- production smoke tests,
- final audit.

---

# 82. DEFINITION OF DONE FOR DOCTRINE

Doctrine is not "finished" when all screens exist.

It is approaching completion when the following statement is true:

> **I can live my normal life, perform my planned activities, make purchases, consume resources, pursue goals, and execute my routines without constantly maintaining Doctrine manually—and Doctrine can reliably understand what happened, update the relevant state, identify problems, and tell me what matters next.**

That is the actual product.

**Doctrine is therefore not a tracker.**

It is an **automated personal management and decision system whose complexity exists underneath the interface so that the user's life becomes simpler, not more complicated.**