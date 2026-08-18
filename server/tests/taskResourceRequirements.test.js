import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/index.js';
import { users, tasks, taskResourceRequirements } from '../db/schema.js';
import {
  getTaskResourceRequirements,
  getAllTaskResourceRequirementsForUser,
  addTaskResourceRequirement,
  updateTaskResourceRequirement,
  deleteTaskResourceRequirement,
  seedDefaultTaskResourceRequirements,
  DEFAULT_DOCTRINE_RESOURCE_MAPPINGS
} from '../services/taskResourceService.js';
import { eq, and } from 'drizzle-orm';
import cryptoNative from 'node:crypto';

test('STEP 2 — TASK TO RESOURCE REQUIREMENT DATA MODEL & SERVICE TESTS', async (t) => {
  const u1Id = cryptoNative.randomUUID();
  const u2Id = cryptoNative.randomUUID();

  t.before(async () => {
    await db.insert(users).values({
      id: u1Id,
      googleId: `g-trr-1-${u1Id}`,
      email: `trr1_${u1Id}@example.com`,
      displayName: 'TRR Test User 1'
    });
    await db.insert(users).values({
      id: u2Id,
      googleId: `g-trr-2-${u2Id}`,
      email: `trr2_${u2Id}@example.com`,
      displayName: 'TRR Test User 2'
    });
  });

  t.after(async () => {
    await db.delete(users).where(eq(users.id, u1Id));
    await db.delete(users).where(eq(users.id, u2Id));
  });

  await t.test('1. Table Creation Verification (task_resource_requirements exists)', async () => {
    const records = await db.select().from(taskResourceRequirements).limit(1);
    assert.ok(Array.isArray(records), 'task_resource_requirements table must exist');
  });

  await t.test('2. Add Task Resource Requirement via Service Layer', async () => {
    const result = await addTaskResourceRequirement(u1Id, {
      taskKey: 'mass_shake',
      resourceId: 'inv-5',
      quantityConsumed: 1,
      unit: 'pcs',
      notes: '1 unit banana'
    });

    assert.equal(result.created, true);
    assert.ok(result.record.id);
    assert.equal(result.record.userId, u1Id);
    assert.equal(result.record.taskKey, 'mass_shake');
    assert.equal(result.record.resourceId, 'inv-5');
    assert.equal(result.record.quantityConsumed, 1);
    assert.equal(result.record.unit, 'pcs');
  });

  await t.test('3. Retrieve Task Resource Requirements for Specific Task Key', async () => {
    // Add second ingredient to mass_shake
    await addTaskResourceRequirement(u1Id, {
      taskKey: 'mass_shake',
      resourceId: 'inv-2',
      quantityConsumed: 0.3,
      unit: 'liters',
      notes: '300 ml milk'
    });

    const reqs = await getTaskResourceRequirements(u1Id, 'mass_shake');
    assert.equal(reqs.length, 2);
    
    const resourceIds = reqs.map(r => r.resourceId).sort();
    assert.deepEqual(resourceIds, ['inv-2', 'inv-5']);
  });

  await t.test('4. Uniqueness Enforcement: Duplicate (userId, taskKey, resourceId) Updates Existing Record', async () => {
    const initialReqs = await getTaskResourceRequirements(u1Id, 'mass_shake');
    assert.equal(initialReqs.length, 2);

    // Attempting to add inv-5 again with updated quantity
    const upsertRes = await addTaskResourceRequirement(u1Id, {
      taskKey: 'mass_shake',
      resourceId: 'inv-5',
      quantityConsumed: 2,
      unit: 'pcs',
      notes: 'Updated 2 bananas'
    });

    assert.equal(upsertRes.created, false);
    assert.equal(upsertRes.record.quantityConsumed, 2);
    assert.equal(upsertRes.record.notes, 'Updated 2 bananas');

    const updatedReqs = await getTaskResourceRequirements(u1Id, 'mass_shake');
    assert.equal(updatedReqs.length, 2, 'Total record count must remain 2 (no duplicates)');
  });

  await t.test('5. Update Existing Task Resource Requirement', async () => {
    const reqs = await getTaskResourceRequirements(u1Id, 'mass_shake');
    const target = reqs.find(r => r.resourceId === 'inv-2');

    const updated = await updateTaskResourceRequirement(u1Id, target.id, {
      quantityConsumed: 0.35,
      notes: '350 ml milk updated'
    });

    assert.equal(updated.quantityConsumed, 0.35);
    assert.equal(updated.notes, '350 ml milk updated');
  });

  await t.test('6. Input Validation: Invalid/Negative Quantities Throw Errors', async () => {
    await assert.rejects(async () => {
      await addTaskResourceRequirement(u1Id, {
        taskKey: 'test_task',
        resourceId: 'inv-1',
        quantityConsumed: -1,
        unit: 'pcs'
      });
    }, /quantityConsumed must be a positive number/i);
  });

  await t.test('7. Delete Task Resource Requirement', async () => {
    const reqs = await getTaskResourceRequirements(u1Id, 'mass_shake');
    const target = reqs.find(r => r.resourceId === 'inv-2');

    const delRes = await deleteTaskResourceRequirement(u1Id, target.id);
    assert.equal(delRes.deleted, true);

    const remaining = await getTaskResourceRequirements(u1Id, 'mass_shake');
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].resourceId, 'inv-5');
  });

  await t.test('8. Idempotent Baseline Seeding (seedDefaultTaskResourceRequirements)', async () => {
    const seedRes1 = await seedDefaultTaskResourceRequirements(u1Id);
    assert.equal(seedRes1.seeded, true);
    assert.ok(seedRes1.addedCount > 0, 'Must seed default routine mappings');

    const totalBefore = await getAllTaskResourceRequirementsForUser(u1Id);

    // Second seed run (Idempotency Check)
    const seedRes2 = await seedDefaultTaskResourceRequirements(u1Id);
    assert.equal(seedRes2.seeded, true);
    assert.equal(seedRes2.addedCount, 0, 'No duplicate mappings added on 2nd seed');

    const totalAfter = await getAllTaskResourceRequirementsForUser(u1Id);
    assert.equal(totalBefore.length, totalAfter.length);
  });

  await t.test('9. Strict Multi-Tenant User Data Isolation', async () => {
    // User 1 requirements
    const u1Reqs = await getAllTaskResourceRequirementsForUser(u1Id);
    assert.ok(u1Reqs.length > 0);

    // User 2 has not seeded or created requirements
    const u2Reqs = await getAllTaskResourceRequirementsForUser(u2Id);
    assert.equal(u2Reqs.length, 0);

    // User 2 cannot access or delete User 1 requirements
    const target = u1Reqs[0];
    await assert.rejects(async () => {
      await updateTaskResourceRequirement(u2Id, target.id, { quantityConsumed: 99 });
    }, /Requirement mapping not found/i);

    const delRes = await deleteTaskResourceRequirement(u2Id, target.id);
    assert.equal(delRes.deleted, false);

    // Verify User 1 requirement remains untouched
    const freshU1 = await db.select()
      .from(taskResourceRequirements)
      .where(eq(taskResourceRequirements.id, target.id));
    assert.equal(freshU1.length, 1);
    assert.equal(freshU1[0].quantityConsumed, target.quantityConsumed);
  });

  await t.test('10. Foreign Key Cascade Deletion on User Removal', async () => {
    const tempUserId = cryptoNative.randomUUID();
    await db.insert(users).values({
      id: tempUserId,
      googleId: `g-temp-${tempUserId}`,
      email: `temp_${tempUserId}@example.com`
    });

    await seedDefaultTaskResourceRequirements(tempUserId);
    const tempReqs = await getAllTaskResourceRequirementsForUser(tempUserId);
    assert.ok(tempReqs.length > 0);

    // Delete user
    await db.delete(users).where(eq(users.id, tempUserId));

    // Verify cascade deletion of requirements
    const orphanedReqs = await getAllTaskResourceRequirementsForUser(tempUserId);
    assert.equal(orphanedReqs.length, 0, 'Resource requirements must be deleted when user is removed');
  });
});
