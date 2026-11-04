import { z } from 'zod';
import { isValidHashtag, MAX_HASHTAGS, normalizeHashtags } from './hashtags.js';
import { POST_STATUSES } from './post.model.js';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;

/** A list of hashtags in any input form, normalized, validated and de-duplicated. */
function hashtagList(items: string[], ctx: z.RefinementCtx): string[] {
  const tags = normalizeHashtags(items);
  if (tags.length > MAX_HASHTAGS) {
    ctx.addIssue({ code: 'custom', message: `At most ${MAX_HASHTAGS} hashtags are allowed` });
    return z.NEVER;
  }
  const invalid = tags.filter((tag) => !isValidHashtag(tag));
  if (invalid.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid hashtag(s): ${invalid.map((t) => JSON.stringify(t)).join(', ')}. Use 1-50 letters, numbers or underscores`,
    });
    return z.NEVER;
  }
  return tags;
}

const hashtagsBody = z.array(z.string()).transform(hashtagList);

const title = z.string().trim().min(1, 'Title is required').max(200);
const body = z
  .string()
  .max(100_000)
  .refine((value) => value.trim().length > 0, 'Body is required');

/**
 * POST body. Unknown keys (notably `author`) are stripped: the author is always set
 * by the server, so a client-supplied value is ignored rather than rejected.
 */
export const createPostBody = z.object({
  title,
  body,
  hashtags: hashtagsBody.default([]),
  status: z.enum(POST_STATUSES).default('draft'),
});

/**
 * PATCH body. Strict: `status` (use the publish/unpublish endpoints), `author` and any
 * other field are rejected with a 400 instead of being silently ignored.
 */
export const updatePostBody = z
  .strictObject({
    title: title.optional(),
    body: body.optional(),
    hashtags: hashtagsBody.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one of: title, body, hashtags',
  );

// Deliberately no ObjectId check here: a zod failure would produce a 400, whereas a malformed
// id is reported as 404 ("no such post"). That check lives in the service (assertValidId).
export const postIdParams = z.object({ id: z.string() });

/** `?hashtags=a,b` or repeated `?hashtags=a&hashtags=b`. */
const hashtagsQuery = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    const parts = (Array.isArray(value) ? value : [value])
      .flatMap((v) => v.split(','))
      .filter((v) => v.trim() !== '');
    return parts.length === 0 ? undefined : hashtagList(parts, ctx);
  });

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  // Values above the maximum are capped rather than rejected.
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_PAGE_SIZE)
    .transform((n) => Math.min(n, MAX_PAGE_SIZE)),
};

export const listPublicPostsQuery = z.object({
  hashtags: hashtagsQuery,
  match: z.enum(['any', 'all']).default('any'),
  ...pagination,
});

export const listCmsPostsQuery = listPublicPostsQuery.extend({
  status: z.enum(POST_STATUSES).optional(),
});

export type CreatePostInput = z.output<typeof createPostBody>;
export type UpdatePostInput = z.output<typeof updatePostBody>;
export type PostIdParams = z.output<typeof postIdParams>;
export type ListPostsQuery = z.output<typeof listCmsPostsQuery>;
