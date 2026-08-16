import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users Table (Google OAuth Identity)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  lastLoginAt: text('last_login_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  emailIdx: index('users_email_idx').on(table.email),
}));

// User Preferences Table (Application Level Customizations & Personal Profile Data)
export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  customDisplayName: text('custom_display_name'),
  bio: text('bio').default(''),
  customAvatarUrl: text('custom_avatar_url'),
  theme: text('theme').default('light').notNull(), // 'light' | 'dark' | 'system'
  timeFormat: text('time_format').default('12h').notNull(), // Standardized on '12h'
  weekStart: text('week_start').default('MONDAY').notNull(), // 'MONDAY' | 'SUNDAY'
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// Sessions Table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sess: text('sess'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

// Doctrine Versions Foundation (Allows immutable past schedule reconstruction)
export const doctrineVersions = sqliteTable('doctrine_versions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').default(1).notNull(),
  title: text('title').default('Doctrine v1').notNull(),
  payload: text('payload').notNull(), // JSON string snapshot of weekly schedules & rules
  activeFrom: text('active_from').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userVersionIdx: index('doctrine_versions_user_idx').on(table.userId),
}));

// Daily Executions Table (One execution record per date per user)
export const dailyExecutions = sqliteTable('daily_executions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Format YYYY-MM-DD
  doctrineVersionId: text('doctrine_version_id').references(() => doctrineVersions.id, { onDelete: 'set null' }),
  dayOfWeek: text('day_of_week'),
  waterLiters: real('water_liters').default(0).notNull(),
  tahajjud: integer('tahajjud', { mode: 'boolean' }).default(false).notNull(),
  notes: text('notes').default('').notNull(),
  currentCapacityMode: text('current_capacity_mode').default('NORMAL').notNull(), // 'NORMAL' | 'MINIMUM_VIABLE' | 'EXAM_COMPRESSED' | 'REST_RECOVERY'
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDateIdx: uniqueIndex('daily_executions_user_date_idx').on(table.userId, table.date),
  userLookupIdx: index('daily_executions_user_idx').on(table.userId),
  dateLookupIdx: index('daily_executions_date_idx').on(table.date),
}));

// Task Executions Table
export const taskExecutions = sqliteTable('task_executions', {
  id: text('id').primaryKey(),
  dailyExecutionId: text('daily_execution_id').notNull().references(() => dailyExecutions.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  category: text('category').notNull(), // DOCTRINE | NAMAZ | ANCHOR | PREPARATION
  taskName: text('task_name'),
  status: text('status').default('SCHEDULED').notNull(), // SCHEDULED | COMPLETED | SKIPPED | MISSED
  completedAt: text('completed_at'),
  deferredToDate: text('deferred_to_date'), // YYYY-MM-DD target date for task carryover/rescheduling
  sourceTaskExecutionId: text('source_task_execution_id').references(() => taskExecutions.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  dailyExecIdx: index('task_executions_daily_exec_idx').on(table.dailyExecutionId),
  taskKeyIdx: uniqueIndex('task_executions_key_idx').on(table.dailyExecutionId, table.taskKey),
  sourceTaskIdx: index('task_executions_source_task_idx').on(table.sourceTaskExecutionId),
}));

// Daily Adaptations Table (Section 3: Audit Log of Intra-Day Capacity Adaptations)
export const dailyAdaptations = sqliteTable('daily_adaptations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dailyExecutionId: text('daily_execution_id').notNull().references(() => dailyExecutions.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  capacityMode: text('capacity_mode').notNull(), // 'NORMAL' | 'MINIMUM_VIABLE' | 'EXAM_COMPRESSED' | 'REST_RECOVERY'
  availableMinutes: integer('available_minutes'),
  reason: text('reason').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDateIdx: index('daily_adaptations_user_date_idx').on(table.userId, table.date),
  dailyExecIdx: index('daily_adaptations_daily_exec_idx').on(table.dailyExecutionId),
}));

// Daily Summaries Table (Feature 2: 10:00 PM AI Daily Summary Persistence)
export const dailySummaries = sqliteTable('daily_summaries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Format YYYY-MM-DD
  summary: text('summary').notNull(), // Markdown formatted AI analysis
  completionPercentage: real('completion_percentage').default(0).notNull(), // Deterministic percentage calculated backend-side
  completedCount: integer('completed_count').default(0).notNull(),
  totalTasksCount: integer('total_tasks_count').default(0).notNull(),
  provider: text('provider').default('gemini').notNull(),
  model: text('model').default('gemini-2.5-flash').notNull(),
  generatedAt: text('generated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDateSummaryIdx: uniqueIndex('daily_summaries_user_date_idx').on(table.userId, table.date),
  userSummaryLookupIdx: index('daily_summaries_user_idx').on(table.userId),
}));

// Weekly Reviews Table (Feature 4: Sunday Weekly Review & Progress Tracking)
export const weeklyReviews = sqliteTable('weekly_reviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(), // Format YYYY-MM-DD
  weekEndDate: text('week_end_date').notNull(), // Format YYYY-MM-DD
  bodyWeightKg: real('body_weight_kg'),
  flexedBicepCm: real('flexed_bicep_cm'),
  chestCm: real('chest_cm'),
  thighCm: real('thigh_cm'),
  morningHeightCm: real('morning_height_cm'),
  workoutPerformance: text('workout_performance').default('STRONGER'),
  complexion: text('complexion').default('BRIGHTER'),
  activeBreakouts: integer('active_breakouts').default(0),
  hairShedding: text('hair_shedding').default('LESS'),
  newBabyHairs: integer('new_baby_hairs', { mode: 'boolean' }).default(true),
  sleepQuality: text('sleep_quality').default('BETTER'),
  digestion: text('digestion').default('BETTER'),
  energyLevels: text('energy_levels').default('HIGHER'),
  protocolCompliancePct: real('protocol_compliance_pct').default(100),
  verdict: text('verdict').default('ON_TRACK'),
  refinementNotes: text('refinement_notes').default(''),
  financesSaved: real('finances_saved').default(0),
  financesSpent: real('finances_spent').default(0),
  financesWhatOn: text('finances_what_on').default(''),
  financesWhy: text('finances_why').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userWeekIdx: uniqueIndex('weekly_reviews_user_week_idx').on(table.userId, table.weekStartDate),
  userReviewLookupIdx: index('weekly_reviews_user_idx').on(table.userId),
}));

// Progress Photos Table (Feature 4: Private Historical Transformation Photos)
export const progressPhotos = sqliteTable('progress_photos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyReviewId: text('weekly_review_id').notNull().references(() => weeklyReviews.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(),
  category: text('category').notNull(), // 'physique' | 'face' | 'hair'
  photoUrl: text('photo_url').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  reviewCategoryIdx: uniqueIndex('progress_photos_review_cat_idx').on(table.weeklyReviewId, table.category),
  userPhotoLookupIdx: index('progress_photos_user_idx').on(table.userId),
}));

// Weekly AI Summaries Table (Feature 4: Sunday Night AI Weekly Summary)
export const weeklySummaries = sqliteTable('weekly_summaries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyReviewId: text('weekly_review_id').notNull().references(() => weeklyReviews.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(),
  summary: text('summary').notNull(),
  completionPercentage: real('completion_percentage').default(0).notNull(),
  provider: text('provider').default('gemini').notNull(),
  model: text('model').default('gemini-2.5-flash').notNull(),
  generatedAt: text('generated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userWeekSummaryIdx: uniqueIndex('weekly_summaries_user_week_idx').on(table.userId, table.weekStartDate),
}));

// Data Engineering Learning Sessions Table (Feature 5: Active Learning Tracker)
export const deLearningSessions = sqliteTable('de_learning_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  moduleName: text('module_name').notNull(),
  topicName: text('topic_name').notNull(),
  subtopicName: text('subtopic_name').notNull(),
  plannedMinutes: integer('planned_minutes').default(60).notNull(),
  actualMinutes: integer('actual_minutes').default(0).notNull(),
  learningResource: text('learning_resource').default('').notNull(), // Video URL / Document / Course
  whatILearned: text('what_i_learned').notNull(), // Mandatory explanation of learning evidence
  confidenceRating: integer('confidence_rating').default(3).notNull(), // 1 to 5
  status: text('status').default('COMPLETED').notNull(), // 'COMPLETED' | 'IN_PROGRESS' | 'REVIEW_REQUIRED' | 'DEFERRED'
  activeRecallText: text('active_recall_text').default(''),
  codeEvidence: text('code_evidence').default(''),
  aiEvaluationText: text('ai_evaluation_text').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userSubtopicIdx: index('de_learning_sessions_user_subtopic_idx').on(table.userId, table.subtopicName),
  userDateLookupIdx: index('de_learning_sessions_date_idx').on(table.userId, table.date),
}));

// Resource Stock Table (Feature 8: Resource Intelligence & Stock Persistence)
export const resourceStock = sqliteTable('resource_stock', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull(),
  currentQty: real('current_qty').notNull(),
  inCart: integer('in_cart', { mode: 'boolean' }).default(false).notNull(),
  lastPurchased: text('last_purchased'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userResourceStockIdx: uniqueIndex('resource_stock_user_res_idx').on(table.userId, table.resourceId),
}));

// Resource Events Table (Feature 8: Resource Event History)
export const resourceEvents = sqliteTable('resource_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull(),
  resourceName: text('resource_name').notNull(),
  eventType: text('event_type').notNull(), // 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT'
  amount: real('amount').notNull(),
  unit: text('unit').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  notes: text('notes').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userResourceIdx: index('resource_events_user_res_idx').on(table.userId, table.resourceId),
  userDateIdx: index('resource_events_user_date_idx').on(table.userId, table.date),
}));

// Task Failure Reasons Table (Feature 14: Personal Failure Pattern Log)
export const taskFailureReasons = sqliteTable('task_failure_reasons', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskExecutionId: text('task_execution_id').references(() => taskExecutions.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  taskKey: text('task_key').notNull(),
  taskName: text('task_name'),
  category: text('category'),
  reason: text('reason').notNull(), // 'Lack of time' | 'Forgot' | 'No resources' | 'Too tired' | 'Work/college conflict' | 'Started too late' | 'Screen distraction' | 'Meal preparation failure' | 'Other'
  userNote: text('user_note').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDateIdx: index('task_failure_reasons_user_date_idx').on(table.userId, table.date),
  userTaskIdx: index('task_failure_reasons_user_task_idx').on(table.userId, table.taskKey),
}));

// Financial Transactions / Ledger Table (Actual Financial Events)
export const financialTransactions = sqliteTable('financial_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amountPaise: integer('amount_paise').notNull(), // Amount in integer Paise (₹1.00 = 100 Paise)
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull(), // 'INCOME' | 'EXPENSE' | 'RESERVE' | 'ALLOCATION'
  category: text('category').notNull(), // e.g. 'WORKDAY_INCOME', 'RESOURCE_PURCHASE', 'GOAL_SAVING', 'TRANSPORT', 'FEES', 'OTHER'
  description: text('description').default('').notNull(),
  source: text('source').default('MANUAL').notNull(), // 'MANUAL' | 'WORKDAY' | 'PURCHASE' | 'GOAL' | 'WEEKLY_REVIEW'
  financialGoalId: text('financial_goal_id').references(() => financialGoals.id, { onDelete: 'set null' }),
  cartItemId: text('cart_item_id').references(() => cartItems.id, { onDelete: 'set null' }),
  purchaseRecordId: text('purchase_record_id').references(() => purchaseRecords.id, { onDelete: 'set null' }),
  resourceId: text('resource_id'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDateIdx: index('financial_transactions_user_date_idx').on(table.userId, table.date),
  userCategoryIdx: index('financial_transactions_user_cat_idx').on(table.userId, table.category),
  userGoalIdx: index('financial_transactions_user_goal_idx').on(table.userId, table.financialGoalId),
}));

// Financial Goals / Wishes Table (Future Financial Expenses & Saving Targets)
export const financialGoals = sqliteTable('financial_goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 'speaker', 'PC table', 'monitor', 'college fees', 'exam fees', etc.
  targetPricePaise: integer('target_price_paise').notNull(), // Target price in integer Paise
  priority: integer('priority').default(1).notNull(), // User-controlled ranking: 1 = highest
  urgency: text('urgency').default('MEDIUM').notNull(), // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  deadlineDate: text('deadline_date'), // YYYY-MM-DD (optional)
  desiredPurchaseDate: text('desired_purchase_date'), // YYYY-MM-DD (optional)
  allocatedAmountPaise: integer('allocated_amount_paise').default(0).notNull(), // Synchronized allocation cache in integer Paise
  status: text('status').default('PLANNED').notNull(), // 'PLANNED' | 'SAVING' | 'READY' | 'PURCHASED' | 'CANCELLED'
  notes: text('notes').default('').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userStatusIdx: index('financial_goals_user_status_idx').on(table.userId, table.status),
  userPriorityIdx: index('financial_goals_user_priority_idx').on(table.userId, table.priority),
}));

// Cart Items Table (Independent Purchase Intent Cart)
export const cartItems = sqliteTable('cart_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  resourceId: text('resource_id'), // Optional reference to resources (e.g. 'eggs', 'milk')
  quantity: real('quantity').default(1).notNull(),
  estimatedPricePaise: integer('estimated_price_paise').notNull(), // Estimated unit price in integer Paise
  targetPurchaseDate: text('target_purchase_date'), // YYYY-MM-DD (optional)
  financialGoalId: text('financial_goal_id').references(() => financialGoals.id, { onDelete: 'set null' }),
  priority: integer('priority').default(1).notNull(),
  status: text('status').default('PENDING').notNull(), // 'PENDING' | 'APPROVED' | 'PURCHASED' | 'DEFERRED' | 'REJECTED'
  notes: text('notes').default('').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userStatusIdx: index('cart_items_user_status_idx').on(table.userId, table.status),
  userResourceIdx: index('cart_items_user_resource_idx').on(table.userId, table.resourceId),
  userGoalIdx: index('cart_items_user_goal_idx').on(table.userId, table.financialGoalId),
}));

// Purchase Records Table (Historical Authoritative Purchases)
export const purchaseRecords = sqliteTable('purchase_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cartItemId: text('cart_item_id').references(() => cartItems.id, { onDelete: 'set null' }),
  financialTransactionId: text('financial_transaction_id').references(() => financialTransactions.id, { onDelete: 'set null' }),
  resourceId: text('resource_id'), // Optional reference to resources
  itemName: text('item_name').notNull(),
  quantity: real('quantity').notNull(),
  actualPricePaise: integer('actual_price_paise').notNull(), // Authoritative historical purchase price in integer Paise
  purchaseDate: text('purchase_date').notNull(), // YYYY-MM-DD
  notes: text('notes').default('').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userPurchaseDateIdx: index('purchase_records_user_date_idx').on(table.userId, table.purchaseDate),
  userResourceIdx: index('purchase_records_user_resource_idx').on(table.userId, table.resourceId),
}));

// Financial Decisions Table (AI/System Recommendation & User Choice History)
export const financialDecisions = sqliteTable('financial_decisions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recommendationType: text('recommendation_type').notNull(), // 'CART_APPROVAL' | 'GOAL_ALLOCATION' | 'PURCHASE_DEFERRAL' | 'BUDGET_RESERVE'
  payload: text('payload').notNull(), // Structured JSON metadata string
  date: text('date').notNull(), // YYYY-MM-DD
  userDecision: text('user_decision').default('PENDING').notNull(), // 'ACCEPTED' | 'REJECTED' | 'DEFERRED' | 'MODIFIED' | 'PENDING'
  cartItemId: text('cart_item_id').references(() => cartItems.id, { onDelete: 'set null' }),
  financialGoalId: text('financial_goal_id').references(() => financialGoals.id, { onDelete: 'set null' }),
  purchaseRecordId: text('purchase_record_id').references(() => purchaseRecords.id, { onDelete: 'set null' }),
  outcome: text('outcome').default('').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userDecisionDateIdx: index('financial_decisions_user_date_idx').on(table.userId, table.date),
  userDecisionIdx: index('financial_decisions_user_decision_idx').on(table.userId, table.userDecision),
}));

// Financial Preferences Table (Configurable User Financial Rules)
export const financialPreferences = sqliteTable('financial_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dailyWorkdayIncomePaise: integer('daily_workday_income_paise').default(22000).notNull(), // ₹220.00
  transportDailyCostPaise: integer('transport_daily_cost_paise').default(5000).notNull(), // ₹50.00
  transportReserveDay: text('transport_reserve_day').default('THURSDAY').notNull(),
  transportReserveAmountPaise: integer('transport_reserve_amount_paise').default(10000).notNull(), // ₹100.00
  workdaysJson: text('workdays_json').default('["MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]').notNull(),
  weeklyBudgetLimitPaise: integer('weekly_budget_limit_paise').default(0).notNull(),
  autoApproveThresholdPaise: integer('auto_approve_threshold_paise').default(0).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// Life Areas Table (Configurable & User-Scoped Life Categories)
export const lifeAreas = sqliteTable('life_areas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').default(1).notNull(),
  isSystemDefault: integer('is_system_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userKeyIdx: uniqueIndex('life_areas_user_key_idx').on(table.userId, table.key),
}));

// Goals Table (Unified Vision -> Objective -> Goal Hierarchy)
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => goals.id, { onDelete: 'set null' }),
  lifeAreaId: text('life_area_id').references(() => lifeAreas.id, { onDelete: 'set null' }),
  level: text('level').default('GOAL').notNull(), // 'VISION' | 'OBJECTIVE' | 'GOAL'
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  status: text('status').default('PLANNED').notNull(), // 'PLANNED' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED' | 'ABANDONED'
  priority: integer('priority').default(1).notNull(),
  targetDate: text('target_date'), // YYYY-MM-DD
  financialGoalId: text('financial_goal_id').references(() => financialGoals.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  userStatusIdx: index('goals_user_status_idx').on(table.userId, table.status),
  userAreaIdx: index('goals_user_area_idx').on(table.userId, table.lifeAreaId),
  parentIdx: index('goals_parent_idx').on(table.parentId),
}));

// Goal Milestones Table (Progress Checkpoints)
export const goalMilestones = sqliteTable('goal_milestones', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  targetValue: real('target_value').default(1).notNull(),
  currentValue: real('current_value').default(0).notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false).notNull(),
  completedAt: text('completed_at'),
  dueDate: text('due_date'), // YYYY-MM-DD
  sortOrder: integer('sort_order').default(1).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  goalIdx: index('goal_milestones_goal_idx').on(table.goalId),
  userIdx: index('goal_milestones_user_idx').on(table.userId),
}));

// Goal Task Mappings Table (Task Intent/Linkage to Existing Task Executions)
export const goalTaskMappings = sqliteTable('goal_task_mappings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  milestoneId: text('milestone_id').references(() => goalMilestones.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  category: text('category'),
  weight: integer('weight').default(1).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  goalTaskIdx: index('goal_task_mappings_goal_task_idx').on(table.goalId, table.taskKey),
  milestoneIdx: index('goal_task_mappings_milestone_idx').on(table.milestoneId),
  userTaskIdx: index('goal_task_mappings_user_task_idx').on(table.userId, table.taskKey),
}));
