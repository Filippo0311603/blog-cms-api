/** Maximum number of hashtags on one post (and in one reader filter). */
export const MAX_HASHTAGS = 20;
export const MAX_HASHTAG_LENGTH = 50;

/** Letters (any language), digits and underscore. */
export const HASHTAG_PATTERN = /^[\p{L}\p{N}_]+$/u;

/**
 * Canonical form of a single hashtag: Unicode NFC, trimmed, leading '#' removed, lowercase.
 * Used for stored hashtags and for reader filters, so `#NodeJS` and `nodejs` match
 * (and a decomposed "città" equals the precomposed one).
 */
export function normalizeHashtag(raw: string): string {
  return raw.normalize('NFC').trim().replace(/^#+/, '').toLowerCase();
}

export function isValidHashtag(tag: string): boolean {
  return tag.length > 0 && tag.length <= MAX_HASHTAG_LENGTH && HASHTAG_PATTERN.test(tag);
}

/** Normalizes a list and removes duplicates, keeping first-seen order. */
export function normalizeHashtags(raw: readonly string[]): string[] {
  return [...new Set(raw.map(normalizeHashtag))];
}
