import type { Request, Response } from 'express';
import { getValidated } from '../../middlewares/validate.js';
import type {
  CreatePostInput,
  ListPostsQuery,
  PostIdParams,
  UpdatePostInput,
} from './post.schema.js';
import * as postService from './post.service.js';

// Controllers only translate HTTP <-> service calls. Express 5 forwards rejected promises
// from async handlers to the error middleware, so no try/catch or wrapper is needed.

const idOf = (res: Response) => getValidated<{ params: PostIdParams }>(res).params.id;

export async function listPublicPosts(_req: Request, res: Response) {
  const { query } = getValidated<{ query: ListPostsQuery }>(res);
  res.json(await postService.listPublished(query));
}

export async function getPublicPost(_req: Request, res: Response) {
  res.json({ data: await postService.getPublishedById(idOf(res)) });
}

export async function listCmsPosts(_req: Request, res: Response) {
  const { query } = getValidated<{ query: ListPostsQuery }>(res);
  res.json(await postService.listAll(query));
}

export async function getCmsPost(_req: Request, res: Response) {
  res.json({ data: await postService.getById(idOf(res)) });
}

export async function createPost(req: Request, res: Response) {
  const { body } = getValidated<{ body: CreatePostInput }>(res);
  const post = await postService.create(body);
  // req.baseUrl is the mount path of the CMS posts router.
  res.status(201).location(`${req.baseUrl}/${post.id}`).json({ data: post });
}

export async function updatePost(_req: Request, res: Response) {
  const { body } = getValidated<{ body: UpdatePostInput }>(res);
  res.json({ data: await postService.update(idOf(res), body) });
}

export async function publishPost(_req: Request, res: Response) {
  res.json({ data: await postService.publish(idOf(res)) });
}

export async function unpublishPost(_req: Request, res: Response) {
  res.json({ data: await postService.unpublish(idOf(res)) });
}

export async function deletePost(_req: Request, res: Response) {
  await postService.remove(idOf(res));
  res.status(204).end();
}
