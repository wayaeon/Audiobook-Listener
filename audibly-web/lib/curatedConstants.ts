/** Canonical section IDs and their display titles for curated Browse carousels. Editorial, not taxonomic. */
export const CURATED_SECTION_ORDER = [
  'recommended-starting-points',
  'entry-points',
  'foundational-works',
  'if-you-only-read-one',
  'epic-escapism',
  'big-picture-thinking',
  'fiction-that-changes-you',
  'personal-favorites',
] as const;

export const CURATED_SECTION_TITLES: Record<string, string> = {
  'recommended-starting-points': 'Recommended starting points',
  'entry-points': 'Entry points',
  'foundational-works': 'Foundational works',
  'if-you-only-read-one': 'If you only read one book on X',
  'epic-escapism': 'Epic escapism',
  'big-picture-thinking': 'Big picture thinking',
  'fiction-that-changes-you': 'Fiction that changes you',
  'personal-favorites': 'Personal favorites',
};

/** Canonical tag IDs and their display titles for "Ways of thinking" filters. */
export const CURATED_TAG_ORDER = [
  'big-ideas',
  'contrarian',
  'practical',
  'historical',
  'speculative',
  'systems-level',
] as const;

export const CURATED_TAG_TITLES: Record<string, string> = {
  'big-ideas': 'Big ideas',
  'contrarian': 'Contrarian',
  'practical': 'Practical',
  'historical': 'Historical',
  'speculative': 'Speculative',
  'systems-level': 'Systems-level',
};

export const PILLS_VISIBLE_LIMIT = 7;

/** Macro genres for filter – broad categories (at least 8). */
export const MACRO_GENRE_ORDER = [
  'fiction',
  'science-fiction-fantasy',
  'mystery-thriller',
  'romance',
  'business-self-help',
  'history-biography',
  'memoir-biography',
  'nonfiction',
  'philosophy-ideas',
  'other',
] as const;

export const MACRO_GENRE_TITLES: Record<string, string> = {
  fiction: 'Fiction',
  'science-fiction-fantasy': 'Science Fiction & Fantasy',
  'mystery-thriller': 'Mystery & Thriller',
  romance: 'Romance',
  'business-self-help': 'Business & Self-Help',
  'history-biography': 'History & Biography',
  'memoir-biography': 'Memoir & Biography',
  nonfiction: 'Nonfiction',
  'philosophy-ideas': 'Philosophy & Ideas',
  other: 'Other',
};

/** Explicit raw → macro lookup for common catalog values (Audible, ffprobe, etc.). */
const GENRE_TO_MACRO_LOOKUP: Array<{ pattern: RegExp | string; macro: string }> = [
  { pattern: /personal success|marketing|sales|business|self-?help|entrepreneur|management|leadership|productivity/i, macro: 'business-self-help' },
  { pattern: /science fiction|sci-?fi|fantasy|space opera|speculative|dystopian|paranormal|sword.*sorcery|sorcery/i, macro: 'science-fiction-fantasy' },
  { pattern: /mystery|thriller|suspense|crime|noir|detective/i, macro: 'mystery-thriller' },
  { pattern: /romance|romantic|love story/i, macro: 'romance' },
  { pattern: /memoir|autobiography|biography(?!.*history)/i, macro: 'memoir-biography' },
  { pattern: /history|historical|anthropology|ancient|world.*economics/i, macro: 'history-biography' },
  { pattern: /philosophy|ethics|political theory|big ideas/i, macro: 'philosophy-ideas' },
  { pattern: /non.?fiction|nonfiction|reference|essay|journalism|economics/i, macro: 'nonfiction' },
  { pattern: /fiction|novel|literary|adventure|drama|comedy|action|horror|western|superhero|short stories|antholog/i, macro: 'fiction' },
];

/** Map raw genre string (e.g. "Adventure, Hard Science Fiction, Space Opera") to macro. Splits by comma and matches any segment. */
export function genreToMacro(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return 'other';
  const segments = s.split(',').map((seg) => seg.trim().toLowerCase()).filter(Boolean);
  const toMatch = segments.length > 0 ? segments : [s.toLowerCase()];
  for (const segment of toMatch) {
    for (const { pattern, macro } of GENRE_TO_MACRO_LOOKUP) {
      const ok = typeof pattern === 'string' ? segment.includes(pattern.toLowerCase()) : pattern.test(segment);
      if (ok) return macro;
    }
  }
  const full = s.toLowerCase();
  for (const { pattern, macro } of GENRE_TO_MACRO_LOOKUP) {
    if (typeof pattern !== 'string' && pattern.test(full)) return macro;
  }
  return 'other';
}
