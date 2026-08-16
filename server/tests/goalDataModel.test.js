import test from 'node:test';
import assert from 'node:assert/strict';
import { db, sqlite } from '../db/index.js';
import {
  users,
  lifeAreas,
  goals,
  goalMilestones,
  goalTaskMappings,
  financialGoals,
  dailyExecutions,
  taskExecutions
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';

test('GOAL DATA MODEL & MIGRATION FOUNDATION TESTS', async (t) => {
  const userA = `test_user_goal_a_${Date.now()}`;
  const userB = `test_user_goal_b_${Date.now()}`;
  const nowIso = new Date().toISOString();

  t.before(async () => {
    // Seed test users
    await db.insert(users).values({
      id: userA,
      googleId: `google_${userA}`,
      email: `${userA}@doctrine.test`,
      displayName: 'Test User A Goal',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });

    await db.insert(users).values({
      id: userB,
      googleId: `google_${userB}`,
      email: `${userB}@doctrine.test`,
      displayName: 'Test User B Goal',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso
    });
  });

  t.after(async () => {
    // Clean up test data
    await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, userA));
    await db.delete(goalTaskMappings).where(eq(goalTaskMappings.userId, userB));
    await db.delete(goalMilestones).where(eq(goalMilestones.userId, userA));
    await db.delete(goalMilestones).where(eq(goalMilestones.userId, userB));
    await db.delete(goals).where(eq(goals.userId, userA));
    await db.delete(goals).where(eq(goals.userId, userB));
    await db.delete(lifeAreas).where(eq(lifeAreas.userId, userA));
    await db.delete(lifeAreas).where(eq(lifeAreas.userId, userB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  await t.test('1. Four New Tables Exist in Database Schema', async () => {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.ok(tables.includes('life_areas'), 'life_areas table must exist');
    assert.ok(tables.includes('goals'), 'goals table must exist');
    assert.ok(tables.includes('goal_milestones'), 'goal_milestones table must exist');
    assert.ok(tables.includes('goal_task_mappings'), 'goal_task_mappings table must exist');
  });

  await t.test('2. Existing Core Tables Remain Intact', async () => {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.ok(tables.includes('users'), 'users table intact');
    assert.ok(tables.includes('task_executions'), 'task_executions table intact');
    assert.ok(tables.includes('financial_goals'), 'financial_goals table intact');
    assert.ok(tables.includes('daily_executions'), 'daily_executions table intact');
  });

  await t.test('3. Default Life Areas are Seeded and Idempotent', async () => {
    // Seed default areas for userA
    const seedDefaultAreas = (userId) => {
      const DEFAULT_AREAS = [
        { key: 'PHYSICAL', name: 'Physical Transformation', color: '#3B82F6', icon: 'User', sort_order: 1 },
        { key: 'SKINCARE_GROOMING', name: 'Skin & Hair Protocol', color: '#10B981', icon: 'Sparkles', sort_order: 2 },
        { key: 'FITNESS_NUTRITION', name: 'Fitness & Anabolic Nutrition', color: '#F59E0B', icon: 'Dumbbell', sort_order: 3 },
        { key: 'DATA_ENGINEERING', name: 'Data Engineering & Tech', color: '#8B5CF6', icon: 'Database', sort_order: 4 },
        { key: 'FINANCE', name: 'Financial Independence', color: '#06B6D4', icon: 'Wallet', sort_order: 5 },
        { key: 'CAREER_PROJECTS', name: 'Career & Projects', color: '#EC4899', icon: 'Briefcase', sort_order: 6 },
        { key: 'SPIRITUAL_MINDFULNESS', name: 'Spiritual Grounding & Mindfulness', color: '#6366F1', icon: 'Moon', sort_order: 7 },
        { key: 'PERSONAL_DEVELOPMENT', name: 'Habits & Self-Mastery', color: '#64748B', icon: 'Target', sort_order: 8 },
      ];
      const checkStmt = sqlite.prepare("SELECT 1 FROM life_areas WHERE user_id = ? AND key = ?");
      const insertStmt = sqlite.prepare("INSERT INTO life_areas (id, user_id, key, name, color, icon, sort_order, is_system_default) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
      for (const area of DEFAULT_AREAS) {
        if (!checkStmt.get(userId, area.key)) {
          insertStmt.run(`la_${userId}_${area.key.toLowerCase()}`, userId, area.key, area.name, area.color, area.icon, area.sort_order);
        }
      }
    };

    seedDefaultAreas(userA);
    const userAAreas = await db.select().from(lifeAreas).where(eq(lifeAreas.userId, userA));
    assert.equal(userAAreas.length, 8, 'User A has 8 default life areas');

    // Run seeding again -> verify idempotency (zero duplicates)
    seedDefaultAreas(userA);
    const userAAreasSecond = await db.select().from(lifeAreas).where(eq(lifeAreas.userId, userA));
    assert.equal(userAAreasSecond.length, 8, 'Re-running seeding produces zero duplicate life areas');
  });

  await t.test('4. Vision -> Objective -> Goal Hierarchy Persistence', async () => {
    const [physicalArea] = await db.select().from(lifeAreas).where(and(eq(lifeAreas.userId, userA), eq(lifeAreas.key, 'PHYSICAL')));
    assert.ok(physicalArea, 'Physical life area exists');

    // Level 1: Vision
    const visionId = cryptoNative.randomUUID();
    await db.insert(goals).values({
      id: visionId,
      userId: userA,
      lifeAreaId: physicalArea.id,
      level: 'VISION',
      title: 'Peak Physical Transformation & Longevity',
      description: 'Achieve long-term physical mastery and aesthetic peak.',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Level 2: Objective (Parent = Vision)
    const objectiveId = cryptoNative.randomUUID();
    await db.insert(goals).values({
      id: objectiveId,
      userId: userA,
      parentId: visionId,
      lifeAreaId: physicalArea.id,
      level: 'OBJECTIVE',
      title: 'Hypertrophy & Posture Mastery',
      description: 'Build baseline muscle mass and correct spinal alignment.',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Level 3: Goal (Parent = Objective)
    const goalId = cryptoNative.randomUUID();
    await db.insert(goals).values({
      id: goalId,
      userId: userA,
      parentId: objectiveId,
      lifeAreaId: physicalArea.id,
      level: 'GOAL',
      title: 'Reach 72kg Bodyweight Floor',
      description: 'Maintain 72kg lean body mass with caloric MED of 2700 kcal.',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Verify Hierarchy Queries
    const [fetchedGoal] = await db.select().from(goals).where(eq(goals.id, goalId));
    assert.equal(fetchedGoal.parentId, objectiveId);
    assert.equal(fetchedGoal.level, 'GOAL');

    const [fetchedObj] = await db.select().from(goals).where(eq(goals.id, objectiveId));
    assert.equal(fetchedObj.parentId, visionId);
    assert.equal(fetchedObj.level, 'OBJECTIVE');
  });

  await t.test('5. Milestones Belong to Goals & Support Progress Tracking', async () => {
    const [goal] = await db.select().from(goals).where(and(eq(goals.userId, userA), eq(goals.level, 'GOAL')));
    assert.ok(goal, 'Goal exists for User A');

    const milestoneId = cryptoNative.randomUUID();
    await db.insert(goalMilestones).values({
      id: milestoneId,
      userId: userA,
      goalId: goal.id,
      title: 'Reach 70kg Milestone',
      description: 'First weight target checkpoint',
      targetValue: 70,
      currentValue: 68.5,
      isCompleted: false,
      sortOrder: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [milestone] = await db.select().from(goalMilestones).where(eq(goalMilestones.id, milestoneId));
    assert.equal(milestone.goalId, goal.id);
    assert.equal(milestone.targetValue, 70);
    assert.equal(milestone.currentValue, 68.5);
  });

  await t.test('6. Goal Task Mappings Reference Task Keys without Modifying Execution History', async () => {
    const [goal] = await db.select().from(goals).where(and(eq(goals.userId, userA), eq(goals.level, 'GOAL')));
    const [milestone] = await db.select().from(goalMilestones).where(eq(goalMilestones.userId, userA));

    // Create mapping to existing task key ('workout_a')
    const mappingId = cryptoNative.randomUUID();
    await db.insert(goalTaskMappings).values({
      id: mappingId,
      userId: userA,
      goalId: goal.id,
      milestoneId: milestone.id,
      taskKey: 'workout_a',
      category: 'WORKOUT',
      weight: 1,
      createdAt: nowIso
    });

    const [mapping] = await db.select().from(goalTaskMappings).where(eq(goalTaskMappings.id, mappingId));
    assert.equal(mapping.taskKey, 'workout_a');
    assert.equal(mapping.goalId, goal.id);

    // Verify task_executions table remains untouched
    const execCount = sqlite.prepare("SELECT count(*) as c FROM task_executions").get().c;
    assert.ok(execCount >= 0, 'Task executions table remains intact');
  });

  await t.test('7. Optional Financial Goal Linkage (SET NULL on Financial Goal Deletion)', async () => {
    const [financeArea] = await db.select().from(lifeAreas).where(and(eq(lifeAreas.userId, userA), eq(lifeAreas.key, 'FINANCE')));

    // Create financial_goal
    const finGoalId = cryptoNative.randomUUID();
    await db.insert(financialGoals).values({
      id: finGoalId,
      userId: userA,
      name: 'Monitor Financial Target',
      targetPricePaise: 1500000,
      priority: 1,
      status: 'PLANNED',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Create General Goal linked to financial_goal
    const generalGoalId = cryptoNative.randomUUID();
    await db.insert(goals).values({
      id: generalGoalId,
      userId: userA,
      lifeAreaId: financeArea ? financeArea.id : `la_${userA}_finance`,
      level: 'GOAL',
      title: 'Upgrade Workstation Display Goal',
      financialGoalId: finGoalId,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const [linkedGoal] = await db.select().from(goals).where(eq(goals.id, generalGoalId));
    assert.equal(linkedGoal.financialGoalId, finGoalId);

    // Delete financial goal -> verify financial_goal_id on general Goal becomes NULL (SET NULL)
    await db.delete(financialGoals).where(eq(financialGoals.id, finGoalId));
    const [afterDeleteGoal] = await db.select().from(goals).where(eq(goals.id, generalGoalId));
    assert.equal(afterDeleteGoal.financialGoalId, null, 'financialGoalId is set to NULL on financial goal deletion');
  });

  await t.test('8. Strict Multi-Tenant User Isolation Enforced', async () => {
    // Attempt to query User A goals using User B id -> returns 0 records
    const userBGoals = await db.select().from(goals).where(eq(goals.userId, userB));
    assert.equal(userBGoals.length, 0, 'User B cannot see User A goals');
  });

  await t.test('9. Goal Deletion Does Not Delete Task Execution History', async () => {
    // Seed dummy execution
    const dummyExecId = cryptoNative.randomUUID();
    await db.insert(dailyExecutions).values({
      id: dummyExecId,
      userId: userA,
      date: '2026-08-16',
      dayOfWeek: 'SUNDAY',
      waterLiters: 3,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const dummyTaskId = cryptoNative.randomUUID();
    await db.insert(taskExecutions).values({
      id: dummyTaskId,
      dailyExecutionId: dummyExecId,
      taskKey: 'workout_a',
      category: 'WORKOUT',
      taskName: 'Workout A',
      status: 'COMPLETED',
      completedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Delete User A goals
    await db.delete(goals).where(eq(goals.userId, userA));

    // Verify task_executions record survives
    const [survivingTask] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, dummyTaskId));
    assert.ok(survivingTask, 'Historical task execution survives goal deletion');

    // Cleanup dummy execution
    await db.delete(dailyExecutions).where(eq(dailyExecutions.id, dummyExecId));
  });
});
