// Метрики оценки качества генерируемого текста (BLEU, ROUGE)

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\wа-яёА-ЯЁ\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
}

function getNgrams(tokens: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

function countClipped(candidate: Map<string, number>, reference: Map<string, number>): number {
  let total = 0;
  for (const [gram, count] of candidate) {
    total += Math.min(count, reference.get(gram) ?? 0);
  }
  return total;
}

/**
 * BLEU-N: точность n-граммного совпадения с штрафом за краткость.
 * Возвращает значение от 0 до 1.
 */
export function bleu(candidate: string, reference: string, maxN = 4): number {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);

  if (candTokens.length === 0) return 0;

  // Brevity penalty
  const bp = candTokens.length >= refTokens.length
    ? 1
    : Math.exp(1 - refTokens.length / candTokens.length);

  let logSum = 0;
  const n = Math.min(maxN, candTokens.length, refTokens.length);
  if (n === 0) return 0;

  for (let i = 1; i <= n; i++) {
    const candGrams = getNgrams(candTokens, i);
    const refGrams = getNgrams(refTokens, i);
    const clipped = countClipped(candGrams, refGrams);
    const total = candTokens.length - i + 1;
    if (clipped === 0 || total === 0) return 0;
    logSum += Math.log(clipped / total);
  }

  return bp * Math.exp(logSum / n);
}

export interface RougeScore {
  precision: number;
  recall: number;
  f1: number;
}

function rougeNgram(candidate: string, reference: string, n: number): RougeScore {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);

  const candGrams = getNgrams(candTokens, n);
  const refGrams = getNgrams(refTokens, n);

  const overlap = countClipped(candGrams, refGrams);
  const candTotal = Math.max(candTokens.length - n + 1, 0);
  const refTotal = Math.max(refTokens.length - n + 1, 0);

  const precision = candTotal > 0 ? overlap / candTotal : 0;
  const recall = refTotal > 0 ? overlap / refTotal : 0;
  const f1 = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  return { precision, recall, f1 };
}

/** ROUGE-1: перекрытие унiграмм */
export function rouge1(candidate: string, reference: string): RougeScore {
  return rougeNgram(candidate, reference, 1);
}

/** ROUGE-2: перекрытие биграмм */
export function rouge2(candidate: string, reference: string): RougeScore {
  return rougeNgram(candidate, reference, 2);
}

function lcsLength(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** ROUGE-L: наидлиннейшая общая подпоследовательность (LCS) */
export function rougeL(candidate: string, reference: string): RougeScore {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);

  if (candTokens.length === 0 || refTokens.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const lcs = lcsLength(candTokens, refTokens);
  const precision = lcs / candTokens.length;
  const recall = lcs / refTokens.length;
  const f1 = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  return { precision, recall, f1 };
}
