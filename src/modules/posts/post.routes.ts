import { Router } from 'express';
import { requireJson } from '../../middlewares/requireJson.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './post.controller.js';
import {
  createPostBody,
  listCmsPostsQuery,
  listPublicPostsQuery,
  postIdParams,
  updatePostBody,
} from './post.schema.js';

/** Reader endpoints, mounted at /api/v1/posts. Public; only published posts. */
export const publicPostsRouter = Router();
publicPostsRouter.get('/', validate({ query: listPublicPostsQuery }), controller.listPublicPosts);
publicPostsRouter.get('/:id', validate({ params: postIdParams }), controller.getPublicPost);

/** CMS endpoints, mounted at /api/v1/cms/posts behind the bearer-token middleware. */
export const cmsPostsRouter = Router();
const withId = validate({ params: postIdParams });
cmsPostsRouter.get('/', validate({ query: listCmsPostsQuery }), controller.listCmsPosts);
cmsPostsRouter.post('/', requireJson, validate({ body: createPostBody }), controller.createPost);
cmsPostsRouter.get('/:id', withId, controller.getCmsPost);
cmsPostsRouter.patch(
  '/:id',
  requireJson,
  validate({ params: postIdParams, body: updatePostBody }),
  controller.updatePost,
);
cmsPostsRouter.post('/:id/publish', withId, controller.publishPost);
cmsPostsRouter.post('/:id/unpublish', withId, controller.unpublishPost);
cmsPostsRouter.delete('/:id', withId, controller.deletePost);
