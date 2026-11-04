import { describe, expect, it } from 'vitest';
import {
  isValidHashtag,
  normalizeHashtag,
  normalizeHashtags,
} from '../../src/modules/posts/hashtags.js';

describe('normalizeHashtag', () => {
  it('trims, strips the leading # and lowercases', () => {
    expect(normalizeHashtag('  #NodeJS ')).toBe('nodejs');
    expect(normalizeHashtag('##Tag')).toBe('tag');
    expect(normalizeHashtag('plain')).toBe('plain');
  });
});

describe('normalizeHashtags', () => {
  it('de-duplicates after normalization, keeping order', () => {
    expect(normalizeHashtags(['#A', 'a', ' b ', '#B', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('Unicode normalization', () => {
  it('treats decomposed (NFD) and precomposed (NFC) forms as the same hashtag', () => {
    const nfd = 'città'; // "citta" + combining grave accent
    const nfc = 'città';
    expect(nfd).not.toBe(nfc);
    expect(normalizeHashtag(`#${nfd}`)).toBe(nfc);
    expect(normalizeHashtags([nfd, nfc])).toEqual([nfc]);
    expect(isValidHashtag(normalizeHashtag(nfd))).toBe(true);
  });
});

describe('isValidHashtag', () => {
  it.each(['node_js', 'abc123', 'città'])('accepts %s', (tag) => {
    expect(isValidHashtag(tag)).toBe(true);
  });

  it.each(['', 'has space', 'a-b', 'a#b', 'x'.repeat(51)])('rejects %j', (tag) => {
    expect(isValidHashtag(tag)).toBe(false);
  });
});
