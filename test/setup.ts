// Runs before each test file, i.e. before src/config/env.ts is first imported.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.CMS_API_TOKEN = 'test-token';
// Make sure a developer .env cannot point the tests at a real database.
process.env.MONGODB_URI = '';
// Rate limiting must not interfere with tests; the 429 test builds its own app with a low limit.
process.env.RATE_LIMIT_PUBLIC_MAX = '1000000';
process.env.RATE_LIMIT_CMS_MAX = '1000000';
