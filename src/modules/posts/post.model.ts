import { model, Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Every post is authored by this person; the value is never taken from the client. */
export const POST_AUTHOR = 'Brian Fox';

export interface IPost {
  title: string;
  body: string;
  hashtags: string[];
  status: PostStatus;
  author: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<IPost>;

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    body: { type: String, required: true, minlength: 1 },
    hashtags: { type: [String], default: [] },
    status: { type: String, enum: POST_STATUSES, default: 'draft', required: true },
    author: { type: String, default: POST_AUTHOR, immutable: true },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        return ret;
      },
    },
  },
);

// Reader listing: filter on status, sort { publishedAt: -1, _id: -1 } (matches the service).
postSchema.index({ status: 1, publishedAt: -1, _id: -1 });
// CMS listing: sort { createdAt: -1, _id: -1 } (matches the service).
postSchema.index({ createdAt: -1, _id: -1 });
// Hashtag filtering (multikey index).
postSchema.index({ hashtags: 1 });

export const Post = model<IPost>('Post', postSchema);
