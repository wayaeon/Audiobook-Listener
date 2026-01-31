/** Strip trailing bracketed ID (e.g. [B09BK5G9MV]) for cleaner display. */
export function displayTitle(title: string): string {
  const cleaned = title.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  return cleaned || title;
}
