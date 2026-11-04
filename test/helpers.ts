import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db/index.js';

export const TOKEN = 'test-token';
export const auth = { Authorization: `Bearer ${TOKEN}` };

/** Connects to a private database on the shared in-memory server. */
export async function setupDb() {
  await connectDb(`${process.env.TEST_MONGO_URI}test_${randomUUID().replaceAll('-', '')}`);
}

export async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

export const api = () => request(createApp());

/** Creates a post through the CMS API and returns its JSON. */
export async function createPost(
  body: Record<string, unknown> = {},
): Promise<{ id: string; [key: string]: unknown }> {
  const res = await api()
    .post('/api/v1/cms/posts')
    .set(auth)
    .send({ title: 'Title', body: 'Body', ...body });
  return res.body.data;
}
