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
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  dailyExecIdx: index('task_executions_daily_exec_idx').on(table.dailyExecutionId),
  taskKeyIdx: uniqueIndex('task_executions_key_idx').on(table.dailyExecutionId, table.taskKey),
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

