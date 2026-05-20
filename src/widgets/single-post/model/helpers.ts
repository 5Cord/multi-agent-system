const EXCERPT_MAX_LENGTH = 300;

// Берёт первые N символов до конца ближайшего предложения, не обрывая на середине.
export function getExcerpt(text: string, maxLength = EXCERPT_MAX_LENGTH): string {
  if (!text || text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
  );

  const cutAt = lastSentenceEnd > 0 ? lastSentenceEnd + 1 : maxLength;
  return text.slice(0, cutAt).trim() + '…';
}
