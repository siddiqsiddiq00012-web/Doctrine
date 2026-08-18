import { pgTable, varchar, text, integer, bigint, doublePrecision, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Users Table (Google OAuth Identity)
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  emailIdx: index('users_email_idx').on(table.email),
}));

// User Preferences Table (Application Level Customizations & Personal Profile Data)
export const userPreferences = pgTable('user_preferences', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  customDisplayName: text('custom_display_name'),
  bio: text('bio').default(''),
  customAvatarUrl: text('custom_avatar_url'),
  theme: text('theme').default('light').notNull(), // 'light' | 'dark' | 'system'
  timeFormat: text('time_format').default('12h').notNull(), // Standardized on '12h'
  weekStart: text('week_start').default('MONDAY').notNull(), // 'MONDAY' | 'SUNDAY'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sessions Table
export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'cascade' }),
  sess: text('sess'),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

// Doctrine Versions Foundation (Allows immutable past schedule reconstruction)
export const doctrineVersions = pgTable('doctrine_versions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').default(1).notNull(),
  title: text('title').default('Doctrine v1').notNull(),
  payload: text('payload').notNull(), // JSON string snapshot of weekly schedules & rules
  activeFrom: timestamp('active_from', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userVersionIdx: index('doctrine_versions_user_idx').on(table.userId),
}));

// Daily Executions Table (One execution record per date per user)
export const dailyExecutions = pgTable('daily_executions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Format YYYY-MM-DD
  doctrineVersionId: varchar('doctrine_version_id', { length: 255 }).references(() => doctrineVersions.id, { onDelete: 'set null' }),
  dayOfWeek: text('day_of_week'),
  waterLiters: doublePrecision('water_liters').default(0).notNull(),
  tahajjud: boolean('tahajjud').default(false).notNull(),
  notes: text('notes').default('').notNull(),
  currentCapacityMode: text('current_capacity_mode').default('NORMAL').notNull(), // 'NORMAL' | 'MINIMUM_VIABLE' | 'EXAM_COMPRESSED' | 'REST_RECOVERY'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: uniqueIndex('daily_executions_user_date_idx').on(table.userId, table.date),
  userLookupIdx: index('daily_executions_user_idx').on(table.userId),
  dateLookupIdx: index('daily_executions_date_idx').on(table.date),
}));

// Tasks Table (Reusable Task Definitions)
export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  category: text('category').notNull(),
  defaultPriority: integer('default_priority').notNull(),
  defaultDurationMinutes: integer('default_duration_minutes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTaskKeyIdx: uniqueIndex('tasks_user_task_key_idx').on(table.userId, table.taskKey),
  userIdx: index('tasks_user_idx').on(table.userId),
}));

// Schedules Table (Configurable Weekly & Date-Range Schedules)
export const schedules = pgTable('schedules', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  activeFromDate: text('active_from_date'), // YYYY-MM-DD
  activeToDate: text('active_to_date'), // YYYY-MM-DD
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('schedules_user_idx').on(table.userId),
}));

// Schedule Entries Table (Individual Task Schedule Mappings)
export const scheduleEntries = pgTable('schedule_entries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  scheduleId: varchar('schedule_id', { length: 255 }).notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  taskId: varchar('task_id', { length: 255 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  timingType: text('timing_type').notNull(), // 'FIXED' | 'FLEXIBLE'
  recurrencePattern: text('recurrence_pattern').notNull(), // 'DAILY' | 'WEEKLY' | 'DATE_RANGE'
  dayOfWeek: text('day_of_week'), // 'MONDAY'..'SUNDAY'
  activeDate: text('active_date'), // YYYY-MM-DD
  startMinutes: integer('start_minutes'),
  endMinutes: integer('end_minutes'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  schedDayIdx: index('schedule_entries_sched_day_idx').on(table.scheduleId, table.dayOfWeek),
  taskIdx: index('schedule_entries_task_idx').on(table.taskId),
}));

// Task Executions Table
export const taskExecutions = pgTable('task_executions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  dailyExecutionId: varchar('daily_execution_id', { length: 255 }).notNull().references(() => dailyExecutions.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  category: text('category').notNull(), // DOCTRINE | NAMAZ | ANCHOR | PREPARATION
  taskName: text('task_name'),
  status: text('status').default('SCHEDULED').notNull(), // SCHEDULED | COMPLETED | SKIPPED | MISSED
  completedAt: text('completed_at'),
  deferredToDate: text('deferred_to_date'), // YYYY-MM-DD target date for task carryover/rescheduling
  sourceTaskExecutionId: varchar('source_task_execution_id', { length: 255 }).references(() => taskExecutions.id, { onDelete: 'set null' }),
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id, { onDelete: 'set null' }),
  scheduleEntryId: varchar('schedule_entry_id', { length: 255 }).references(() => scheduleEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dailyExecIdx: index('task_executions_daily_exec_idx').on(table.dailyExecutionId),
  taskKeyIdx: uniqueIndex('task_executions_key_idx').on(table.dailyExecutionId, table.taskKey),
  sourceTaskIdx: index('task_executions_source_task_idx').on(table.sourceTaskExecutionId),
  taskIdIdx: index('task_executions_task_id_idx').on(table.taskId),
  schedEntryIdx: index('task_executions_sched_entry_idx').on(table.scheduleEntryId),
}));

// Daily Adaptations Table (Audit Log of Intra-Day Capacity Adaptations)
export const dailyAdaptations = pgTable('daily_adaptations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  dailyExecutionId: varchar('daily_execution_id', { length: 255 }).notNull().references(() => dailyExecutions.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  capacityMode: text('capacity_mode').notNull(), // 'NORMAL' | 'MINIMUM_VIABLE' | 'EXAM_COMPRESSED' | 'REST_RECOVERY'
  availableMinutes: integer('available_minutes'),
  reason: text('reason').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('daily_adaptations_user_date_idx').on(table.userId, table.date),
  dailyExecIdx: index('daily_adaptations_daily_exec_idx').on(table.dailyExecutionId),
}));

// Daily Summaries Table (10:00 PM AI Daily Summary Persistence)
export const dailySummaries = pgTable('daily_summaries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Format YYYY-MM-DD
  summary: text('summary').notNull(), // Markdown formatted AI analysis
  completionPercentage: doublePrecision('completion_percentage').default(0).notNull(),
  completedCount: integer('completed_count').default(0).notNull(),
  totalTasksCount: integer('total_tasks_count').default(0).notNull(),
  provider: text('provider').default('gemini').notNull(),
  model: text('model').default('gemini-2.5-flash').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateSummaryIdx: uniqueIndex('daily_summaries_user_date_idx').on(table.userId, table.date),
  userSummaryLookupIdx: index('daily_summaries_user_idx').on(table.userId),
}));

// Weekly Reviews Table (Sunday Weekly Review & Progress Tracking)
export const weeklyReviews = pgTable('weekly_reviews', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(), // Format YYYY-MM-DD
  weekEndDate: text('week_end_date').notNull(), // Format YYYY-MM-DD
  bodyWeightKg: doublePrecision('body_weight_kg'),
  flexedBicepCm: doublePrecision('flexed_bicep_cm'),
  chestCm: doublePrecision('chest_cm'),
  thighCm: doublePrecision('thigh_cm'),
  morningHeightCm: doublePrecision('morning_height_cm'),
  workoutPerformance: text('workout_performance').default('STRONGER'),
  complexion: text('complexion').default('BRIGHTER'),
  activeBreakouts: integer('active_breakouts').default(0),
  hairShedding: text('hair_shedding').default('LESS'),
  newBabyHairs: boolean('new_baby_hairs').default(true),
  sleepQuality: text('sleep_quality').default('BETTER'),
  digestion: text('digestion').default('BETTER'),
  energyLevels: text('energy_levels').default('HIGHER'),
  protocolCompliancePct: doublePrecision('protocol_compliance_pct').default(100),
  verdict: text('verdict').default('ON_TRACK'),
  refinementNotes: text('refinement_notes').default(''),
  financesSaved: doublePrecision('finances_saved').default(0),
  financesSpent: doublePrecision('finances_spent').default(0),
  financesWhatOn: text('finances_what_on').default(''),
  financesWhy: text('finances_why').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userWeekIdx: uniqueIndex('weekly_reviews_user_week_idx').on(table.userId, table.weekStartDate),
  userReviewLookupIdx: index('weekly_reviews_user_idx').on(table.userId),
}));

// Progress Photos Table (Private Historical Transformation Photos)
export const progressPhotos = pgTable('progress_photos', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyReviewId: varchar('weekly_review_id', { length: 255 }).notNull().references(() => weeklyReviews.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(),
  category: text('category').notNull(), // 'physique' | 'face' | 'hair'
  photoUrl: text('photo_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  reviewCategoryIdx: uniqueIndex('progress_photos_review_cat_idx').on(table.weeklyReviewId, table.category),
  userPhotoLookupIdx: index('progress_photos_user_idx').on(table.userId),
}));

// Weekly AI Summaries Table (Sunday Night AI Weekly Summary)
export const weeklySummaries = pgTable('weekly_summaries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyReviewId: varchar('weekly_review_id', { length: 255 }).notNull().references(() => weeklyReviews.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(),
  summary: text('summary').notNull(),
  completionPercentage: doublePrecision('completion_percentage').default(0).notNull(),
  provider: text('provider').default('gemini').notNull(),
  model: text('model').default('gemini-2.5-flash').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userWeekSummaryIdx: uniqueIndex('weekly_summaries_user_week_idx').on(table.userId, table.weekStartDate),
}));

// Data Engineering Learning Sessions Table (Active Learning Tracker)
export const deLearningSessions = pgTable('de_learning_sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  moduleName: text('module_name').notNull(),
  topicName: text('topic_name').notNull(),
  subtopicName: text('subtopic_name').notNull(),
  plannedMinutes: integer('planned_minutes').default(60).notNull(),
  actualMinutes: integer('actual_minutes').default(0).notNull(),
  learningResource: text('learning_resource').default('').notNull(),
  whatILearned: text('what_i_learned').notNull(),
  confidenceRating: integer('confidence_rating').default(3).notNull(), // 1 to 5
  status: text('status').default('COMPLETED').notNull(),
  activeRecallText: text('active_recall_text').default(''),
  codeEvidence: text('code_evidence').default(''),
  aiEvaluationText: text('ai_evaluation_text').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userSubtopicIdx: index('de_learning_sessions_user_subtopic_idx').on(table.userId, table.subtopicName),
  userDateLookupIdx: index('de_learning_sessions_date_idx').on(table.userId, table.date),
}));

// Resource Stock Table (Resource Intelligence & Stock Persistence)
export const resourceStock = pgTable('resource_stock', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull(),
  currentQty: doublePrecision('current_qty').notNull(),
  inCart: boolean('in_cart').default(false).notNull(),
  lastPurchased: text('last_purchased'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userResourceStockIdx: uniqueIndex('resource_stock_user_res_idx').on(table.userId, table.resourceId),
}));

// Resource Events Table (Resource Event History)
export const resourceEvents = pgTable('resource_events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull(),
  resourceName: text('resource_name').notNull(),
  eventType: text('event_type').notNull(), // 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT'
  amount: doublePrecision('amount').notNull(),
  unit: text('unit').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  notes: text('notes').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userResourceIdx: index('resource_events_user_res_idx').on(table.userId, table.resourceId),
  userDateIdx: index('resource_events_user_date_idx').on(table.userId, table.date),
}));

// Task Failure Reasons Table (Personal Failure Pattern Log)
export const taskFailureReasons = pgTable('task_failure_reasons', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskExecutionId: varchar('task_execution_id', { length: 255 }).references(() => taskExecutions.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  taskKey: text('task_key').notNull(),
  taskName: text('task_name'),
  category: text('category'),
  reason: text('reason').notNull(),
  userNote: text('user_note').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('task_failure_reasons_user_date_idx').on(table.userId, table.date),
  userTaskIdx: index('task_failure_reasons_user_task_idx').on(table.userId, table.taskKey),
}));

// Financial Transactions / Ledger Table (Actual Financial Events)
export const financialTransactions = pgTable('financial_transactions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(), // Amount in integer Paise (₹1.00 = 100 Paise)
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull(), // 'INCOME' | 'EXPENSE' | 'RESERVE' | 'ALLOCATION'
  category: text('category').notNull(),
  description: text('description').default('').notNull(),
  source: text('source').default('MANUAL').notNull(),
  financialGoalId: varchar('financial_goal_id', { length: 255 }).references(() => financialGoals.id, { onDelete: 'set null' }),
  cartItemId: varchar('cart_item_id', { length: 255 }).references(() => cartItems.id, { onDelete: 'set null' }),
  purchaseRecordId: varchar('purchase_record_id', { length: 255 }).references(() => purchaseRecords.id, { onDelete: 'set null' }),
  resourceId: text('resource_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('financial_transactions_user_date_idx').on(table.userId, table.date),
  userCategoryIdx: index('financial_transactions_user_cat_idx').on(table.userId, table.category),
  userGoalIdx: index('financial_transactions_user_goal_idx').on(table.userId, table.financialGoalId),
}));

// Financial Goals / Wishes Table
export const financialGoals = pgTable('financial_goals', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetPricePaise: bigint('target_price_paise', { mode: 'number' }).notNull(),
  priority: integer('priority').default(1).notNull(),
  urgency: text('urgency').default('MEDIUM').notNull(),
  deadlineDate: text('deadline_date'),
  desiredPurchaseDate: text('desired_purchase_date'),
  allocatedAmountPaise: bigint('allocated_amount_paise', { mode: 'number' }).default(0).notNull(),
  status: text('status').default('PLANNED').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('financial_goals_user_status_idx').on(table.userId, table.status),
  userPriorityIdx: index('financial_goals_user_priority_idx').on(table.userId, table.priority),
}));

// Cart Items Table
export const cartItems = pgTable('cart_items', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  resourceId: text('resource_id'),
  quantity: doublePrecision('quantity').default(1).notNull(),
  estimatedPricePaise: bigint('estimated_price_paise', { mode: 'number' }).notNull(),
  targetPurchaseDate: text('target_purchase_date'),
  financialGoalId: varchar('financial_goal_id', { length: 255 }).references(() => financialGoals.id, { onDelete: 'set null' }),
  priority: integer('priority').default(1).notNull(),
  status: text('status').default('PENDING').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('cart_items_user_status_idx').on(table.userId, table.status),
  userResourceIdx: index('cart_items_user_resource_idx').on(table.userId, table.resourceId),
  userGoalIdx: index('cart_items_user_goal_idx').on(table.userId, table.financialGoalId),
}));

// Purchase Records Table
export const purchaseRecords = pgTable('purchase_records', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  cartItemId: varchar('cart_item_id', { length: 255 }).references(() => cartItems.id, { onDelete: 'set null' }),
  financialTransactionId: varchar('financial_transaction_id', { length: 255 }).references(() => financialTransactions.id, { onDelete: 'set null' }),
  resourceId: text('resource_id'),
  itemName: text('item_name').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  actualPricePaise: bigint('actual_price_paise', { mode: 'number' }).notNull(),
  purchaseDate: text('purchase_date').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userPurchaseDateIdx: index('purchase_records_user_date_idx').on(table.userId, table.purchaseDate),
  userResourceIdx: index('purchase_records_user_resource_idx').on(table.userId, table.resourceId),
}));

// Financial Decisions Table
export const financialDecisions = pgTable('financial_decisions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  recommendationType: text('recommendation_type').notNull(),
  payload: text('payload').notNull(),
  date: text('date').notNull(),
  userDecision: text('user_decision').default('PENDING').notNull(),
  cartItemId: varchar('cart_item_id', { length: 255 }).references(() => cartItems.id, { onDelete: 'set null' }),
  financialGoalId: varchar('financial_goal_id', { length: 255 }).references(() => financialGoals.id, { onDelete: 'set null' }),
  purchaseRecordId: varchar('purchase_record_id', { length: 255 }).references(() => purchaseRecords.id, { onDelete: 'set null' }),
  outcome: text('outcome').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDecisionDateIdx: index('financial_decisions_user_date_idx').on(table.userId, table.date),
  userDecisionIdx: index('financial_decisions_user_decision_idx').on(table.userId, table.userDecision),
}));

// Financial Preferences Table
export const financialPreferences = pgTable('financial_preferences', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dailyWorkdayIncomePaise: bigint('daily_workday_income_paise', { mode: 'number' }).default(22000).notNull(),
  transportDailyCostPaise: bigint('transport_daily_cost_paise', { mode: 'number' }).default(5000).notNull(),
  transportReserveDay: text('transport_reserve_day').default('THURSDAY').notNull(),
  transportReserveAmountPaise: bigint('transport_reserve_amount_paise', { mode: 'number' }).default(10000).notNull(),
  workdaysJson: text('workdays_json').default('["MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]').notNull(),
  weeklyBudgetLimitPaise: bigint('weekly_budget_limit_paise', { mode: 'number' }).default(0).notNull(),
  autoApproveThresholdPaise: bigint('auto_approve_threshold_paise', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Life Areas Table
export const lifeAreas = pgTable('life_areas', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').default(1).notNull(),
  isSystemDefault: boolean('is_system_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userKeyIdx: uniqueIndex('life_areas_user_key_idx').on(table.userId, table.key),
}));

// Goals Table
export const goals = pgTable('goals', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: varchar('parent_id', { length: 255 }).references(() => goals.id, { onDelete: 'set null' }),
  lifeAreaId: varchar('life_area_id', { length: 255 }).references(() => lifeAreas.id, { onDelete: 'set null' }),
  level: text('level').default('GOAL').notNull(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  status: text('status').default('PLANNED').notNull(),
  priority: integer('priority').default(1).notNull(),
  targetDate: text('target_date'),
  financialGoalId: varchar('financial_goal_id', { length: 255 }).references(() => financialGoals.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('goals_user_status_idx').on(table.userId, table.status),
  userAreaIdx: index('goals_user_area_idx').on(table.userId, table.lifeAreaId),
  parentIdx: index('goals_parent_idx').on(table.parentId),
}));

// Goal Milestones Table
export const goalMilestones = pgTable('goal_milestones', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalId: varchar('goal_id', { length: 255 }).notNull().references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  targetValue: doublePrecision('target_value').default(1).notNull(),
  currentValue: doublePrecision('current_value').default(0).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedAt: text('completed_at'),
  dueDate: text('due_date'),
  sortOrder: integer('sort_order').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  goalIdx: index('goal_milestones_goal_idx').on(table.goalId),
  userIdx: index('goal_milestones_user_idx').on(table.userId),
}));

// Goal Task Mappings Table
export const goalTaskMappings = pgTable('goal_task_mappings', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalId: varchar('goal_id', { length: 255 }).notNull().references(() => goals.id, { onDelete: 'cascade' }),
  milestoneId: varchar('milestone_id', { length: 255 }).references(() => goalMilestones.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  category: text('category'),
  weight: integer('weight').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  goalTaskIdx: index('goal_task_mappings_goal_task_idx').on(table.goalId, table.taskKey),
  milestoneIdx: index('goal_task_mappings_milestone_idx').on(table.milestoneId),
  userTaskIdx: index('goal_task_mappings_user_task_idx').on(table.userId, table.taskKey),
}));

// Task Resource Requirements Table
export const taskResourceRequirements = pgTable('task_resource_requirements', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskKey: text('task_key').notNull(),
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id, { onDelete: 'set null' }),
  resourceId: text('resource_id').notNull(),
  quantityConsumed: doublePrecision('quantity_consumed').notNull(),
  unit: text('unit').notNull(),
  isOptional: boolean('is_optional').default(false).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTaskResIdx: uniqueIndex('task_res_req_user_task_res_idx').on(table.userId, table.taskKey, table.resourceId),
  userTaskIdx: index('task_res_req_user_task_idx').on(table.userId, table.taskKey),
  userResourceIdx: index('task_res_req_user_resource_idx').on(table.userId, table.resourceId),
}));

// Domain Events Table
export const domainEvents = pgTable('domain_events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  payload: text('payload').notNull(),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  schemaVersion: integer('schema_version').default(1).notNull(),
  status: text('status').default('PUBLISHED').notNull(),
  occurredAt: text('occurred_at').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTypeIdx: index('domain_events_user_type_idx').on(table.userId, table.eventType),
  userCorrelationIdx: index('domain_events_user_corr_idx').on(table.userId, table.correlationId),
  userOccurredIdx: index('domain_events_user_occ_idx').on(table.userId, table.occurredAt),
}));

// Automation Processing Logs Table
export const automationProcessingLogs = pgTable('automation_processing_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: varchar('event_id', { length: 255 }).notNull().references(() => domainEvents.id, { onDelete: 'cascade' }),
  handlerId: text('handler_id').notNull(),
  status: text('status').notNull(),
  errorDetails: text('error_details'),
  executionDurationMs: integer('execution_duration_ms').default(0).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdempotencyIdx: uniqueIndex('auto_logs_user_evt_handler_idx').on(table.userId, table.eventId, table.handlerId),
  userEventIdx: index('auto_logs_user_event_idx').on(table.userId, table.eventId),
}));
