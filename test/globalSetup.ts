import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

/** One in-memory MongoDB shared by all test files (each file uses its own database). */
export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.TEST_MONGO_URI = mongod.getUri();
}

export async function teardown() {
  await mongod?.stop();
}
