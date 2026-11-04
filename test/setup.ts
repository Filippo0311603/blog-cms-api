// Runs before each test file, i.e. before src/config/env.ts is first imported.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.CMS_API_TOKEN = 'test-token';
// Make sure a developer .env cannot point the tests at a real database.
process.env.MONGODB_URI = '';
