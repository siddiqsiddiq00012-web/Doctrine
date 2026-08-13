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
  timeFormat: text('time_format').default('12h').notNull(), // '12h' | '24h'
  weekStart: text('week_start').default('MONDAY').notNull(), // 'MONDAY' | 'SUNDAY'
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// Sessions Table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  taskKeyIdx: index('task_executions_key_idx').on(table.dailyExecutionId, table.taskKey),
}));
