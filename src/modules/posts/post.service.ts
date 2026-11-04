import type { QueryFilter } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from './post.schema.js';
import { Post } from './post.model.js';
import type { IPost, PostDocument } from './post.model.js';

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** A malformed id can never match a post, so it is reported as "not found" (404). */
function notFound(): ApiError {
  return ApiError.notFound('Post not found');
}

function assertValidId(id: string): void {
  if (!OBJECT_ID.test(id)) throw notFound();
}

async function paginate(
  filter: QueryFilter<IPost>,
  query: Pick<ListPostsQuery, 'page' | 'limit'>,
  sort: Record<string, 1 | -1>,
): Promise<Page<PostDocument>> {
  const { page, limit } = query;
  const [data, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function hashtagFilter(query: Pick<ListPostsQuery, 'hashtags' | 'match'>): QueryFilter<IPost> {
  if (!query.hashtags) return {};
  return { hashtags: query.match === 'all' ? { $all: query.hashtags } : { $in: query.hashtags } };
}

/** Reader listing: only published posts, newest first. `_id` breaks ties deterministically. */
export function listPublished(query: ListPostsQuery): Promise<Page<PostDocument>> {
  return paginate({ status: 'published', ...hashtagFilter(query) }, query, {
    publishedAt: -1,
    _id: -1,
  });
}

/** CMS listing: every post, drafts included, optionally filtered by status. */
export function listAll(query: ListPostsQuery): Promise<Page<PostDocument>> {
  const filter: QueryFilter<IPost> = { ...hashtagFilter(query) };
  if (query.status) filter.status = query.status;
  return paginate(filter, query, { createdAt: -1, _id: -1 });
}

/** Drafts are reported as missing so their existence is never leaked to readers. */
export async function getPublishedById(id: string): Promise<PostDocument> {
  assertValidId(id);
  const post = await Post.findOne({ _id: id, status: 'published' });
  if (!post) throw notFound();
  return post;
}

export async function getById(id: string): Promise<PostDocument> {
  assertValidId(id);
  const post = await Post.findById(id);
  if (!post) throw notFound();
  return post;
}

export function create(input: CreatePostInput): Promise<PostDocument> {
  return Post.create({
    ...input,
    publishedAt: input.status === 'published' ? new Date() : null,
  });
}

export async function update(id: string, input: UpdatePostInput): Promise<PostDocument> {
  assertValidId(id);
  const post = await Post.findByIdAndUpdate(
    id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );
  if (!post) throw notFound();
  return post;
}

/**
 * Publishes a draft. Idempotent: an already published post is returned untouched, so its
 * original publishedAt is kept. The conditional update makes this safe under concurrency.
 */
export async function publish(id: string): Promise<PostDocument> {
  assertValidId(id);
  const published = await Post.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { $set: { status: 'published', publishedAt: new Date() } },
    { returnDocument: 'after' },
  );
  return published ?? getById(id);
}

/** Moves a post back to draft. Idempotent: an existing draft is returned untouched. */
export async function unpublish(id: string): Promise<PostDocument> {
  assertValidId(id);
  const draft = await Post.findOneAndUpdate(
    { _id: id, status: 'published' },
    { $set: { status: 'draft', publishedAt: null } },
    { returnDocument: 'after' },
  );
  return draft ?? getById(id);
}

export async function remove(id: string): Promise<void> {
  assertValidId(id);
  const deleted = await Post.findByIdAndDelete(id);
  if (!deleted) throw notFound();
}
