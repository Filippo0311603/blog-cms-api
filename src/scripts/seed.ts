import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db/index.js';
import { Post, POST_AUTHOR } from '../modules/posts/post.model.js';
import { logger } from '../utils/logger.js';

const samples = [
  {
    title: 'Welcome to the blog',
    body: 'First published post. Hello world!',
    hashtags: ['welcome', 'news'],
    published: true,
  },
  {
    title: 'Getting started with Node.js',
    body: 'Node.js lets you run JavaScript on the server.',
    hashtags: ['nodejs', 'javascript'],
    published: true,
  },
  {
    title: 'TypeScript tips',
    body: 'Prefer strict mode and let the compiler help you.',
    hashtags: ['typescript', 'javascript'],
    published: true,
  },
  {
    title: 'Work in progress',
    body: 'This draft is only visible through the CMS endpoints.',
    hashtags: ['draft', 'nodejs'],
    published: false,
  },
];

/**
 * Replaces ALL posts in the database at MONGODB_URI with a few samples. Run with `npm run seed`.
 */
async function main() {
  if (env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
    throw new Error(
      'Refusing to seed with NODE_ENV=production: it deletes ALL posts. Set SEED_FORCE=1 to override.',
    );
  }
  if (!env.MONGODB_URI) {
    throw new Error(
      'Set MONGODB_URI to seed a real database (the in-memory one is not persisted).',
    );
  }
  await connectDb(env.MONGODB_URI);
  const now = Date.now();
  const docs = samples.map(({ published, ...post }, index) => ({
    ...post,
    author: POST_AUTHOR,
    status: published ? ('published' as const) : ('draft' as const),
    publishedAt: published ? new Date(now - index * 3_600_000) : null,
  }));
  // Idempotent: running the seed twice leaves exactly the sample posts.
  await Post.deleteMany({});
  await Post.insertMany(docs);
  logger.info(`Replaced all posts with ${docs.length} sample posts`);
  await disconnectDb();
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
