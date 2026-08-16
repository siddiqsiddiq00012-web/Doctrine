Yes. We should freeze the **Doctrine product blueprint first**, then use the existing ZIP as the implementation baseline and work through the blueprint **one feature at a time**.

The key principle is:

> **Doctrine is the product. Code is only the implementation mechanism. We do not allow the existing codebase to dictate what Doctrine becomes.**

Below is the finalized master blueprint. **Authentication/login is intentionally excluded.**

# DOCTRINE — MASTER PRODUCT BLUEPRINT

## 0. Product Definition

| Area | Final Direction |
|---|---|
| Product | Personal operating system for executing the user's Doctrine of Self-Mastery |
| Primary purpose | Convert long-term goals and personal doctrine into daily executable actions, track execution, measure progress, and intelligently adapt the plan |
| Philosophy | Doctrine → Plan → Action → Execution → Measurement → Review → Adaptation |
| Primary environment during development | Localhost |
| Production | Vercel + Turso |
| Authentication | **EXCLUDED ENTIRELY FOR NOW** |
| Primary frontend | React + JavaScript |
| Primary backend | Node.js + Express |
| Database | SQLite locally / Turso production |
| ORM | Drizzle ORM |
| Styling | Existing Doctrine UI system; preserve aesthetic consistency |
| AI | Gemini-based intelligence layer |
| ML | Primarily intelligent inference/recommendation systems rather than training a large custom model |
| Architecture | Modular feature-oriented full-stack application |
| Security principle | User-scoped data, validation, least privilege, server-authoritative decisions |
| Financial precision | Integer Paise |
| Production philosophy | Fail closed, persistent storage, deterministic business logic |

---

# 1. CORE DOCTRINE ENGINE

This is the heart of the application.

### 1.1 Doctrine Definition

The system must represent:

- Life principles
- Long-term vision
- Major goals
- Sub-goals
- Areas of life
- Priorities
- Constraints
- Rules
- Non-negotiables
- Habits
- Daily responsibilities
- Projects
- Deadlines
- Milestones

### 1.2 Life Areas

The architecture should support areas such as:

- Physical transformation
- Skin & grooming
- Hair care
- Fitness
- Nutrition
- Education
- Career
- Data Engineering
- Programming
- Blockchain
- Projects
- Finance
- Trading
- Relationships
- Personal development
- Recreation
- Other user-defined areas

The system should **not hard-code the user's entire life into application logic**.

Life areas should be configurable.

---

# 2. GOAL MANAGEMENT SYSTEM

Doctrine needs a serious goal engine rather than a simple checklist.

### Goal hierarchy

```text
Vision
 └── Objective
      └── Goal
           └── Milestone
                └── Task
                     └── Execution
```

Each goal should support:

- Name
- Description
- Area
- Priority
- Status
- Start date
- Target date
- Desired outcome
- Progress
- Milestones
- Dependencies
- Related projects
- Related habits
- Related financial goals
- Notes
- Evidence
- Review history

### Goal states

```text
PLANNED
ACTIVE
PAUSED
AT_RISK
COMPLETED
ABANDONED
```

---

# 3. DAILY EXECUTION ENGINE

The application must answer:

> **"What should I do now?"**

This is one of Doctrine's most important features.

The engine considers:

- Current time
- Current day
- User schedule
- Active goals
- Priority
- Deadlines
- Missed tasks
- Dependencies
- Available time
- Previous execution
- Recovery requirements
- Doctrine rules
- Current financial constraints

Then produces the appropriate execution queue.

### Example

```text
CURRENT TIME
     ↓
DAY CONTEXT
     ↓
ACTIVE DOCTRINE
     ↓
PRIORITIES
     ↓
DEADLINES
     ↓
PREVIOUS EXECUTION
     ↓
AVAILABLE TIME
     ↓
CURRENT STATE
     ↓
TODAY'S EXECUTION PLAN
```

---

# 4. TIME / SCHEDULE ENGINE

Support:

- Daily schedules
- Weekly schedules
- Time blocks
- Recurring tasks
- Flexible tasks
- Fixed tasks
- College/work schedules
- Travel blocks
- Workout blocks
- Study blocks
- Project blocks
- Recovery blocks

### Important distinction

A **schedule** says:

> when something should happen.

A **task** says:

> what must happen.

An **execution record** says:

> whether it actually happened.

These must remain separate.

---

# 5. TASK ENGINE

Tasks should support:

- One-time tasks
- Recurring tasks
- Scheduled tasks
- Flexible tasks
- Priority
- Deadline
- Estimated duration
- Actual duration
- Dependencies
- Goal association
- Project association
- Area association
- Completion
- Skipping
- Deferral
- Failure reason
- Notes
- Execution history

### Task states

```text
PENDING
ACTIVE
COMPLETED
SKIPPED
DEFERRED
BLOCKED
CANCELLED
```

---

# 6. HABIT SYSTEM

Doctrine should distinguish habits from ordinary tasks.

Track:

- Daily habits
- Weekly habits
- Frequency
- Streak
- Adherence
- Missed days
- Recovery
- Historical performance
- Habit difficulty
- Goal relationship

### Habit intelligence

Eventually calculate:

```text
Adherence %
Consistency
Best streak
Current streak
Failure frequency
Recovery time
Time-of-day performance
```

---

# 7. PHYSICAL TRANSFORMATION SYSTEM

This is a major Doctrine module.

## Fitness

Support:

- Workout plans
- Workout sessions
- Exercises
- Sets
- Repetitions
- Weight
- Duration
- Rest
- Workout completion
- Progressive overload
- Historical performance

## Body metrics

Track:

- Weight
- Height
- Measurements
- Transformation milestones
- Historical records

## Progress photos

Support:

- Physique
- Face
- Hair
- Weekly comparison
- Side-by-side comparison
- Historical storage
- Week-over-week deltas

Existing Smart Sunday architecture should remain compatible.

---

# 8. SKINCARE & GROOMING ENGINE

Support:

- Skincare routines
- Morning routines
- Evening routines
- Product usage
- Grooming tasks
- Hair-care routines
- Execution tracking
- Historical adherence

Important architectural rule:

> Doctrine tracks and executes the user's predefined routine; it does not become a medical diagnosis system.

The existing constraint excluding medical diagnosis should remain.

---

# 9. NUTRITION SYSTEM

Support:

- Daily calorie target
- Protein target
- Carbohydrate target
- Fat target
- Meals
- Food items
- Quantity
- Nutritional values
- Daily totals
- Target comparison
- Meal history
- Nutrition adherence

Eventually:

```text
Target
vs
Actual
vs
Historical trend
```

---

# 10. RESOURCE INTELLIGENCE SYSTEM

This is already one of the stronger existing modules.

Doctrine should track physical resources such as:

- Food
- Skincare products
- Hair products
- Supplements if applicable
- Household items
- College supplies
- Other consumables

Track:

- Current quantity
- Minimum stock
- Usage rate
- Consumption events
- Purchase events
- Forecast
- Expected depletion
- Surplus
- Purchase recommendation

### Forecast pipeline

```text
Historical Consumption
        ↓
Usage Rate
        ↓
Current Stock
        ↓
Projected Depletion
        ↓
Required Quantity
        ↓
Purchase Recommendation
```

---

# 11. PURCHASE PLANNING / CART SYSTEM

Cart is explicitly separate from Resources.

### Resources

> What I physically have.

### Cart

> What I intend to purchase.

### Purchases

> What I actually purchased.

### Financial ledger

> What money actually moved.

These must never become one entity.

---

# 12. CART MANAGEMENT

Support:

- Add item
- Edit item
- Delete
- Defer
- Priority
- Quantity
- Estimated price
- Target purchase date
- Goal association
- Resource association
- Notes
- Status

Statuses:

```text
PENDING
APPROVED
DEFERRED
REJECTED
PURCHASED
```

But **PURCHASED should only be created through an actual purchase workflow**, not arbitrary client-side modification.

---

# 13. FINANCIAL MANAGEMENT ENGINE

This is now a dedicated subsystem.

### Core financial entities

```text
Income
Expense
Reserve
Allocation
Goal
Cart
Purchase
Budget
Preference
```

### Money representation

**Integer Paise only.**

```text
₹1.00 = 100
₹220.00 = 22000
```

Never use floating-point money for authoritative financial calculations.

---

# 14. FINANCIAL LEDGER

The ledger is authoritative.

Transaction types:

```text
INCOME
EXPENSE
RESERVE
ALLOCATION
```

### Fundamental rule

```text
Ledger = Financial truth
Goal cache = Derived/cache representation
Cart = Intent
Purchase = Historical event
```

---

# 15. FINANCIAL ENGINE

Calculate:

### Cash

```text
Net Cash
Spendable Cash
Reserved Cash
Allocated Cash
Discretionary Cash
```

### Decision state

```text
Can Spend
Can Allocate
Must Reserve
Blocked By Obligations
Highest Priority Goal
```

### Important semantic distinction

A negative financial position must remain visible.

```text
netCashPaise = -5000
spendableCashPaise = 0
```

Never hide a deficit by simply converting it to zero.

---

# 16. FINANCIAL GOALS

Support:

- Goal name
- Target amount
- Priority
- Allocation
- Remaining amount
- Deadline
- Desired purchase date
- Status
- Progress

Priority is explicitly **user-controlled**.

The system must not silently reorder goals because its own algorithm considers another goal more urgent.

---

# 17. BUDGET ENGINE

Support:

- Weekly budget
- Daily budget
- Workday income
- Transport costs
- Reserves
- Discretionary spending
- Auto-approval threshold
- Upcoming obligations
- Financial pressure

The engine must load financial preferences dynamically.

No personal financial values should be hardcoded.

---

# 18. FINANCIAL DECISION INTELLIGENCE

Eventually Doctrine should answer things like:

> Can I afford this?

> Should I buy this now?

> What happens if I buy this?

> Which goal should receive the next allocation?

> How much can I safely spend?

> What obligation is approaching?

The system should explain **why**, not simply return a number.

Example:

```text
BUY BLOCKED

Available discretionary funds: ₹350
Item cost: ₹800

Reason:
The purchase would exceed the current discretionary budget
and interfere with the upcoming transport reserve.
```

---

# 19. WEEKLY REVIEW SYSTEM

Sunday becomes a major review cycle.

Review:

- Goal progress
- Task adherence
- Habit adherence
- Physical progress
- Financial progress
- Resource consumption
- Missed commitments
- Projects
- Weekly achievements
- Problems
- Next-week priorities

---

# 20. PROGRESS TRACKING

Doctrine should maintain historical records rather than overwriting state.

Track:

- Daily execution
- Weekly execution
- Monthly progress
- Goal progress
- Fitness progress
- Financial progress
- Habit adherence
- Project progress

This creates a longitudinal personal dataset.

---

# 21. SMART SUNDAY

Automate the weekly analysis pipeline:

```text
Weekly Data
    ↓
Execution Analysis
    ↓
Goal Progress
    ↓
Physical Progress
    ↓
Financial Analysis
    ↓
Resource Analysis
    ↓
Weakness Detection
    ↓
Weekly Review
    ↓
Next Week Plan
```

---

# 22. AI INTELLIGENCE LAYER

AI should **not replace the deterministic Doctrine engine**.

Instead:

```text
Doctrine Rules
      ↓
Deterministic State
      ↓
AI Interpretation
      ↓
Recommendation
      ↓
User Decision
```

The AI should never override authoritative financial or safety rules.

---

# 23. AI CAPABILITIES

Planned AI features:

### Personal planning

- Explain today's priorities
- Explain why a task matters
- Suggest task ordering
- Identify conflicts
- Summarize progress

### Weekly intelligence

- Weekly summary
- Weakness detection
- Progress interpretation
- Pattern recognition
- Next-week suggestions

### Project intelligence

- Project planning
- Milestone decomposition
- Risk identification
- Progress summaries

### Financial intelligence

- Explain financial state
- Explain purchase decisions
- Explain budget pressure
- Explain goal tradeoffs

### Resource intelligence

- Explain depletion forecasts
- Explain purchase recommendations

---

# 24. MACHINE LEARNING / PERSONALIZATION

We should **not begin by training a custom ML model**.

First build the data foundation.

Doctrine will gradually collect:

```text
Task
↓
Scheduled Time
↓
Execution
↓
Completion / Failure
↓
Duration
↓
Context
↓
Outcome
```

Then we can derive personalized models.

### Future ML capabilities

#### Task completion prediction

```text
P(task completed | time, duration, priority, history, context)
```

#### Optimal scheduling

Learn:

- Best time for studying
- Best workout time
- Most productive hours
- Failure periods
- Recovery periods

#### Habit adherence prediction

Predict:

```text
Likely completion
Likely failure
Risk of breaking streak
```

#### Goal risk prediction

```text
Goal
↓
Current velocity
↓
Deadline
↓
Historical adherence
↓
Risk score
```

#### Personalized recommendations

Eventually:

> "You historically complete programming tasks 31% more often between 9–11 PM than between 6–8 PM."

This should come from **the user's own historical data**, not generic assumptions.

---

# 25. COMPUTER VISION / AI PHOTO ANALYSIS

For progress photos:

- Compare historical photos
- Detect visible change
- Calculate structured deltas where technically reliable
- Provide constrained observations
- Preserve historical photos
- Maintain privacy
- Include appropriate disclaimers

AI must not turn this into medical diagnosis.

---

# 26. PROJECT MANAGEMENT SYSTEM

Doctrine itself needs project tracking.

Projects support:

- Project name
- Description
- Objective
- Priority
- Status
- Milestones
- Tasks
- Technology stack
- Deadlines
- Progress
- Notes
- Risks
- Dependencies

This allows projects such as:

```text
Scriptloom
Doctrine
Horizon Intelligence
Blockchain projects
Data Engineering portfolio
```

to exist inside the operating system without hardcoding those names.

---

# 27. KNOWLEDGE SYSTEM

Eventually Doctrine should have a personal knowledge layer.

Support:

- Notes
- Documents
- References
- Project knowledge
- Lessons learned
- Decisions
- Reviews
- Links
- Tags
- Search

Potential future architecture:

```text
Knowledge
   ↓
Embeddings
   ↓
Vector Search
   ↓
Context Retrieval
   ↓
AI Reasoning
```

---

# 28. AI MEMORY / PERSONAL CONTEXT

Long-term intelligence should be based on structured data.

Examples:

```text
Goals
Preferences
Schedules
Historical execution
Projects
Financial state
Habit history
Weekly reviews
Knowledge
```

The AI should retrieve relevant information rather than dumping the entire database into every prompt.

---

# 29. SEARCH SYSTEM

Eventually provide global search across:

- Tasks
- Goals
- Projects
- Resources
- Cart
- Financial records
- Reviews
- Notes
- Knowledge

Potential future stack:

```text
SQLite/Turso search
+
Full-text indexing
+
Embedding search where justified
```

---

# 30. DASHBOARD

The dashboard should answer five questions immediately:

### 1. What should I do now?

### 2. What matters today?

### 3. Am I on track?

### 4. What is going wrong?

### 5. What should I prepare for?

Possible sections:

```text
Current Action
Today's Plan
Doctrine Priorities
Progress
Financial State
Upcoming Obligations
Resources
Projects
Weekly Progress
```

---

# 31. NOTIFICATION / ALERT ENGINE

Eventually support:

- Upcoming task
- Missed task
- Financial warning
- Resource depletion
- Goal deadline
- Weekly review
- Habit risk
- Project deadline

Notifications must be meaningful.

No notification spam.

---

# 32. ANALYTICS ENGINE

Provide:

### Execution analytics

- Completion %
- Failure %
- Deferral %
- Average completion time
- Adherence

### Goal analytics

- Progress velocity
- Deadline risk
- Completion probability

### Financial analytics

- Income
- Expenses
- Savings
- Allocations
- Spending trends
- Budget utilization

### Physical analytics

- Weight trend
- Workout progression
- Habit adherence
- Photo progression

---

# 33. DATA ARCHITECTURE

Target conceptual architecture:

```text
                    DOCTRINE
                       │
          ┌────────────┴────────────┐
          │                         │
     React Frontend             Express API
          │                         │
          │                  Service Layer
          │                         │
          │        ┌────────────────┼────────────────┐
          │        │                │                │
          │   Doctrine Engine  Financial Engine  AI Engine
          │        │                │                │
          └────────┴────────────────┴────────────────┘
                           │
                     Drizzle ORM
                           │
                 ┌─────────┴─────────┐
                 │                   │
            Local SQLite          Turso
```

---

# 34. DATABASE PRINCIPLES

Every major subsystem gets explicit entities.

Core groups:

```text
Users
Preferences
Doctrine
Goals
Milestones
Tasks
Task Executions
Habits
Habit Executions
Schedules
Projects
Resources
Consumption Events
Purchase Events
Cart Items
Financial Transactions
Financial Goals
Financial Preferences
Weekly Reviews
Progress Photos
Knowledge
AI Analysis
```

No giant "everything table."

---

# 35. DATABASE INTEGRITY

Production-grade requirements:

- Foreign keys
- Cascades where appropriate
- `SET NULL` for historical relationships
- Unique constraints
- Check constraints where appropriate
- Indexed lookup fields
- User ownership enforcement
- Transaction boundaries
- Migration safety
- Idempotent migrations
- No silent migration failures
- No destructive migrations without explicit strategy

---

# 36. API ARCHITECTURE

Organize APIs by domain:

```text
/api/doctrine
/api/goals
/api/tasks
/api/habits
/api/schedule
/api/projects
/api/resources
/api/financial
/api/cart
/api/purchases
/api/reviews
/api/progress
/api/skincare
/api/fitness
/api/nutrition
/api/ai
/api/knowledge
/api/analytics
/api/health
```

No giant monolithic route file.

---

# 37. API PRINCIPLES

Every API must have:

- Input validation
- Output contract
- Error handling
- User ownership
- Authorization where required
- Deterministic behavior where possible
- Sanitized errors
- Consistent HTTP status codes
- No sensitive stack traces
- No client-controlled ownership
- No arbitrary `userId` overrides

---

# 38. FRONTEND ARCHITECTURE

React components should be modular.

Conceptually:

```text
App
├── Dashboard
├── Doctrine
├── Tasks
├── Goals
├── Projects
├── Fitness
├── Skincare
├── Nutrition
├── Resources
├── Cart
├── Budget
├── Reviews
├── Progress
├── Knowledge
└── Settings
```

Avoid putting business logic directly inside UI components.

---

# 39. SERVICE LAYER

Business logic belongs in services.

Examples:

```text
financialEngine.js
financialSyncService.js
goalService.js
taskService.js
resourceService.js
forecastService.js
reviewService.js
aiService.js
analyticsService.js
```

Frontend should consume APIs rather than recreate authoritative business calculations.

---

# 40. VALIDATION

Use a proper schema validation layer.

Validate:

- Dates
- IDs
- Quantities
- Money
- Enum values
- Strings
- Arrays
- Request bodies
- Query parameters

Invalid data should fail immediately.

---

# 41. SECURITY

Even without implementing login now, the architecture must be **authentication-ready**.

Security requirements:

- No hardcoded secrets
- Environment variables
- Secure session architecture later
- User-scoped database queries
- IDOR protection
- Input validation
- Output sanitization
- No stack trace exposure
- Safe error messages
- Rate limiting where appropriate
- CORS policy
- CSRF consideration
- Secure cookies when auth is eventually enabled
- Dependency auditing

**But: no login UI or login implementation work now.**

---

# 42. PRODUCTION PERSISTENCE

### Localhost

```text
SQLite
```

### Production

```text
Turso
```

The application must never silently fall back from production Turso to ephemeral SQLite.

If production persistence is unavailable:

```text
FAIL CLOSED
```

not:

```text
silently create temporary database
```

---

# 43. SERVERLESS COMPATIBILITY

Because production is planned for Vercel:

Avoid relying on:

- Permanent local filesystem
- Long-running processes
- In-memory persistence
- Local process state
- Hardcoded ports
- Development-only environment assumptions

For files:

```text
Database/Data URI/Object Storage
```

rather than assuming serverless disk persistence.

---

# 44. TESTING STRATEGY

Every major feature should have:

### Unit tests

Test individual functions.

### Integration tests

Test service + database.

### API tests

Test HTTP contracts.

### Security tests

Test ownership/isolation.

### Regression tests

Ensure existing features don't break.

### UI foundation tests

Verify critical UI contracts.

### Production compatibility tests

Verify serverless behavior.

Target:

```text
npm test
      ↓
All tests pass
      ↓
npm run build
      ↓
Build passes
      ↓
localhost verification
      ↓
Feature complete
```

---

# 45. CI/CD

Eventually:

```text
Git push
   ↓
CI
   ↓
Lint
   ↓
Unit tests
   ↓
Integration tests
   ↓
Build
   ↓
Preview deployment
   ↓
Smoke tests
   ↓
Production promotion
```

Production should never depend on blindly deploying untested code.

---

# 46. OBSERVABILITY

Production should eventually have:

- Health endpoint
- Database diagnostics
- Structured server logs
- Error tracking
- Request tracing where useful
- Deployment logs
- Performance monitoring
- Database monitoring

Never expose diagnostic secrets publicly.

---

# 47. PERFORMANCE

Target:

- Lazy-loaded pages
- Code splitting
- Efficient DB queries
- Appropriate indexes
- Pagination for historical datasets
- Cached derived calculations
- Avoid unnecessary AI calls
- Avoid loading entire datasets into frontend
- Optimized images
- Compressed assets

---

# 48. AI COST CONTROL

AI calls should be deliberate.

Use deterministic calculations first.

For example:

```text
"Can I afford ₹500?"
        ↓
Financial Engine
        ↓
Deterministic answer
```

Only then:

```text
AI
↓
Explain reasoning / provide contextual advice
```

Don't waste an LLM call on arithmetic.

---

# 49. ERROR PHILOSOPHY

Doctrine should distinguish:

```text
USER ERROR
SYSTEM ERROR
DATABASE ERROR
NETWORK ERROR
AI ERROR
CONFIGURATION ERROR
```

Each gets an appropriate response.

Example:

```text
Invalid quantity
→ 400

Unauthorised resource
→ 404/403 depending on contract

Database unavailable
→ 500 + safe message

AI unavailable
→ deterministic fallback where possible
```

---

# 50. DATA HISTORY PRINCIPLE

Doctrine should generally **append historical truth rather than overwrite it**.

Examples:

Bad:

```text
Weight = 48kg
```

Better:

```text
Weight history:
Aug 1 → 47kg
Aug 8 → 47.6kg
Aug 15 → 48kg
```

Same principle for:

- Financial transactions
- Purchases
- Task executions
- Progress photos
- Weekly reviews
- Habit execution

This is essential for future analytics and ML.

---

# 51. DETERMINISM PRINCIPLE

Whenever a decision can be deterministic, make it deterministic.

```text
Financial calculations → deterministic
Stock calculations → deterministic
Goal priority → deterministic
Task state → deterministic
Calendar calculations → deterministic
AI interpretation → probabilistic
```

AI should sit **above** the authoritative system, not underneath it.

---

# 52. TECHNOLOGY STACK

## Frontend

| Technology | Purpose |
|---|---|
| JavaScript | Primary language |
| React | UI |
| Vite | Build tooling |
| CSS / existing styling system | UI |
| Lucide or existing icon system | Icons |

## Backend

| Technology | Purpose |
|---|---|
| JavaScript | Primary backend language |
| Node.js | Runtime |
| Express | API |
| Drizzle ORM | Database access |
| SQLite | Local development |
| Turso | Production database |

## AI

| Technology | Purpose |
|---|---|
| Gemini API | AI reasoning |
| Embeddings | Future semantic search |
| Vector storage/search | Future knowledge retrieval |
| Computer vision capabilities | Progress-photo analysis |

## Production

| Technology | Purpose |
|---|---|
| Vercel | Hosting/serverless |
| Turso | Persistent production DB |
| Git | Version control |
| CI/CD | Automated verification |

---

# 53. LANGUAGES

Primary:

```text
JavaScript
```

Supporting:

```text
SQL
HTML
CSS
```

Potential later:

```text
Python
```

only if a genuinely valuable ML/data-processing subsystem justifies it.

**Do not introduce Python merely because "ML" exists in the roadmap.**

The first version of Doctrine's intelligence can remain entirely JavaScript-based.

---

# 54. WHAT WE WILL NOT BUILD

These are explicit exclusions from the current blueprint.

### Not now:

- Login UI
- Authentication implementation
- Auth0
- User registration
- Google login interface
- Social login
- Complex account management

### Also avoid unnecessary complexity:

- Custom ML model training
- Microservices
- Kubernetes
- Blockchain integration into Doctrine
- Over-engineered event buses
- Premature vector databases
- Premature distributed architecture

Doctrine is a **single serious product**, not a technology demonstration.

---

# 55. DEVELOPMENT ORDER

This is the most important part.

We should **not randomly pick features**.

### Layer 1 — Foundation

```text
Database
Schema
Migrations
Validation
Core services
API conventions
Error handling
Testing
```

### Layer 2 — Doctrine Core

```text
Doctrine
Areas
Goals
Milestones
Tasks
Schedules
Execution
Habits
```

### Layer 3 — Personal Systems

```text
Fitness
Skincare
Grooming
Nutrition
Progress
Weekly Review
```

### Layer 4 — Physical/Financial Systems

```text
Resources
Consumption
Forecast
Cart
Purchases
Financial Ledger
Budget
Financial Goals
```

### Layer 5 — Intelligence

```text
Financial intelligence
Resource intelligence
Goal intelligence
Execution intelligence
Weekly intelligence
AI assistant
```

### Layer 6 — ML / Personalization

```text
Historical dataset
Feature extraction
Prediction
Personal scheduling
Adherence prediction
Goal risk prediction
```

### Layer 7 — Production

```text
Security audit
Performance
Observability
Vercel
Turso
CI/CD
Production smoke tests
```

---

# 56. MASTER IMPLEMENTATION RULE

Every feature must go through this pipeline:

```text
BLUEPRINT
   ↓
DATABASE MODEL
   ↓
BUSINESS RULES
   ↓
SERVICE
   ↓
API
   ↓
UI
   ↓
TESTS
   ↓
SECURITY TESTS
   ↓
LOCALHOST VERIFICATION
   ↓
CHECKPOINT COMMIT
```

Only then move to the next feature.

---

# 57. THE MASTER AI PROMPT

When we start analyzing the ZIP, this is the instruction I recommend giving the coding AI:

```text
You are the principal engineer responsible for implementing DOCTRINE.

DOCTRINE is a personal operating system whose purpose is:

Doctrine → Plan → Action → Execution → Measurement → Review → Adaptation.

The product blueprint is authoritative. The existing codebase is NOT authoritative.

IMPORTANT:
Do not redesign the product based on what the existing implementation happens to support.
Do not remove planned capabilities simply because the current code lacks them.
Do not introduce features that are not part of the Doctrine blueprint without explicit approval.

AUTHENTICATION:
Completely skip login/authentication UI and authentication implementation work for now.
Do NOT build Auth0.
Do NOT build Google Login.
Do NOT build registration.
Do NOT spend development time on authentication.
The application must remain usable on localhost without requiring a login screen.
Authentication can be analyzed and implemented later as a separate production concern.

DEVELOPMENT ENVIRONMENT:
localhost is the primary development environment.
Do not make Vercel deployment the blocker for feature development.
Vercel/Turso production hardening will be handled after the product implementation is substantially complete.

TECHNOLOGY PRINCIPLES:
- JavaScript is the primary language.
- React + Vite for frontend.
- Node.js + Express for backend.
- Drizzle ORM.
- SQLite for localhost.
- Turso for production.
- Gemini for AI capabilities.
- Do not introduce Python unless a future ML/data-processing requirement genuinely justifies it.
- Do not introduce microservices or unnecessary infrastructure.

ARCHITECTURAL PRINCIPLES:
1. Deterministic business logic must remain deterministic.
2. AI must interpret and assist; it must not replace authoritative business rules.
3. Financial calculations must use integer Paise.
4. Ledger transactions are authoritative financial truth.
5. Historical records must not be destroyed merely to update current state.
6. User ownership must be enforced server-side.
7. No client-supplied userId may override authoritative identity.
8. Database migrations must preserve existing data.
9. Migration failures must fail closed rather than silently continue.
10. Production persistence must never silently fall back to ephemeral storage.
11. Business logic belongs in services, not React components.
12. APIs must have explicit validation and response contracts.
13. Every significant feature requires automated regression tests.
14. Do not modify main unless explicitly instructed.
15. Work incrementally and preserve existing working features.

CORE SYSTEMS TO IMPLEMENT:

1. Doctrine Engine
- Doctrine principles
- Life areas
- Vision
- Objectives
- Goals
- Milestones
- Priorities
- Constraints
- Non-negotiables

2. Goal Engine
- Goal hierarchy
- Goal states
- Deadlines
- Progress
- Dependencies
- Goal history

3. Task Engine
- One-time tasks
- Recurring tasks
- Flexible tasks
- Scheduled tasks
- Priorities
- Dependencies
- Execution history
- Deferral
- Skipping
- Failure tracking

4. Schedule Engine
- Time blocks
- Daily schedules
- Weekly schedules
- Work/college schedules
- Travel
- Flexible availability

5. Habit Engine
- Recurring habits
- Streaks
- Adherence
- Historical execution
- Failure/recovery analysis

6. Fitness System
- Workouts
- Exercises
- Sets/reps/weight
- Progressive overload
- Sessions
- Body measurements
- Historical progress

7. Skincare/Grooming System
- Morning routines
- Evening routines
- Grooming tasks
- Hair-care routines
- Execution history
- No medical diagnosis system

8. Nutrition System
- Calorie targets
- Macro targets
- Meals
- Food quantities
- Daily totals
- Historical adherence

9. Resource Intelligence
- Inventory
- Minimum stock
- Consumption events
- Purchase events
- Usage rates
- Depletion forecasts
- Purchase recommendations

10. Cart
- Independent purchase intent
- Priority
- Quantity
- Estimated price
- Purchase date
- Goal/resource relationships
- Defer/delete/edit
- Cart must NOT alter financial cash

11. Purchase System
- Actual purchase events
- Historical records
- Purchase-to-expense linkage

12. Financial System
- Income
- Expense
- Reserve
- Allocation
- Financial goals
- Budget
- Financial preferences
- Financial decision state

13. Financial Engine
- Net cash
- Spendable cash
- Reserves
- Allocations
- Discretionary funds
- Obligations
- Deficit preservation
- Goal priority
- Deterministic decision state

14. Weekly Review
- Weekly execution
- Goal progress
- Physical progress
- Financial progress
- Resource analysis
- Missed commitments
- Next-week plan

15. Progress Photos
- Physique
- Face
- Hair
- Historical comparison
- Side-by-side comparison
- AI-assisted constrained visual analysis
- Privacy-safe persistence

16. Project Management
- Projects
- Milestones
- Tasks
- Dependencies
- Progress
- Risks
- Technology stack

17. Knowledge System
- Notes
- Documents
- References
- Project knowledge
- Decisions
- Lessons
- Search
- Future semantic retrieval

18. Analytics
- Execution analytics
- Goal analytics
- Habit analytics
- Financial analytics
- Resource analytics
- Physical progress analytics

19. AI Intelligence
- Daily planning assistance
- Weekly summaries
- Pattern interpretation
- Goal-risk explanations
- Financial explanations
- Resource explanations
- Project planning
- Personal context retrieval

20. Future ML
Do not train a custom ML model prematurely.
First collect structured historical data.
Later support:
- Task completion prediction
- Habit adherence prediction
- Optimal scheduling
- Goal risk prediction
- Personalized recommendations

QUALITY REQUIREMENTS:

Every feature must include:
- Database schema
- Migration
- Service layer
- API
- UI
- Validation
- Unit tests
- Integration tests
- Security/isolation tests
- Regression tests
- Localhost verification

Before declaring a task complete:
1. Run the relevant tests.
2. Run the full test suite.
3. Run the production build.
4. Run git diff --check.
5. Verify the feature manually on localhost.
6. Confirm existing features remain functional.
7. Report exactly what changed.
8. Do not proceed to the next task until the current task is stable.

WORKFLOW:
First analyze the supplied Doctrine ZIP.
Do NOT immediately modify code.

Produce:
1. Current architecture map.
2. Existing feature inventory.
3. Database/schema inventory.
4. API inventory.
5. Frontend component inventory.
6. Existing AI/ML capabilities.
7. Existing production infrastructure.
8. Completed blueprint items.
9. Partially completed blueprint items.
10. Missing blueprint items.
11. Conflicting implementations.
12. Technical debt.
13. Security risks.
14. Recommended implementation order.

Then propose exactly ONE next implementation task.

Do not implement multiple major features simultaneously.

The Doctrine blueprint is the destination.
The existing ZIP is simply the current starting point.
```

## Final development philosophy

The most important thing is that **we don't let "finishing the code" become the goal**.

The goal is:

> **Build Doctrine exactly as a coherent personal operating system.**
