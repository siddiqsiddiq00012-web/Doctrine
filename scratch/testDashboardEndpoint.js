import { db } from '../server/db/index.js';
import { users } from '../server/db/schema.js';
import { eq } from 'drizzle-orm';
import dashboardRouter from '../server/routes/dashboard.js';

async function run() {
  const [user] = await db.select().from(users).limit(1);
  console.log('Testing with DB User:', user ? user.email : 'NO USER FOUND');

  if (!user) {
    console.log('No user in database. Creating test user...');
    process.exit(0);
  }

  // Create mock req and res
  const req = {
    user,
    session: { userId: user.id },
    query: { date: '2026-08-14' }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('API Response Code:', this.statusCode);
      console.log('API Response Body Keys:', Object.keys(data));
      if (data.error) {
        console.error('API Error Payload:', data);
      } else {
        console.log('Today Completion %:', data.today?.completionPercentage);
        console.log('Primary Action:', data.primaryAction);
      }
    }
  };

  // Find the GET handler in dashboardRouter stack
  const routeLayer = dashboardRouter.stack.find(s => s.route && s.route.path === '/');
  if (routeLayer) {
    const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
    await handler(req, res);
  } else {
    console.error('Route layer not found in router stack');
  }
}

run().catch(err => {
  console.error('Execution Exception:', err);
});
