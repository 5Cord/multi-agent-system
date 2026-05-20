import { Router, Request, Response } from 'express';
import { runAllScrapers } from '../scheduler/cron';
import { getPostsCount } from '../db/database';

export const scrapeRouter = Router();

// Если последний скрап нашёл 0 постов — ждём дольше (новости не обновляются часто)
// Если нашёл новые — даём короткое окно (могут ещё появиться)
const COOLDOWN_EMPTY_MS = 30 * 60 * 1000;  // 30 мин — ничего нового
const COOLDOWN_UPDATED_MS = 5 * 60 * 1000; // 5 мин — были новые посты

interface ScrapeCache {
  lastScrapedAt: number | null;
  lastNewPosts: number;
}

const cache: ScrapeCache = {
  lastScrapedAt: null,
  lastNewPosts: 0,
};

let isScraping = false;

function getCooldownMs(): number {
  return cache.lastNewPosts > 0 ? COOLDOWN_UPDATED_MS : COOLDOWN_EMPTY_MS;
}

function isCached(): boolean {
  if (cache.lastScrapedAt === null) return false;
  return Date.now() - cache.lastScrapedAt < getCooldownMs();
}

// POST /api/scrape — запускает парсинг или возвращает кэш
scrapeRouter.post('/', async (_req: Request, res: Response) => {
  if (isScraping) {
    res.json({ success: false, error: 'Парсинг уже выполняется' });
    return;
  }

  const dbCount = await getPostsCount();
  if (isCached() && dbCount > 0) {
    const remainingSec = Math.ceil(
      (getCooldownMs() - (Date.now() - cache.lastScrapedAt!)) / 1000
    );
    console.log(`[Scrape] Кэш актуален, следующий скрап через ${remainingSec}с`);
    res.json({ success: true, newPosts: 0, cached: true, nextAllowedIn: remainingSec });
    return;
  }

  isScraping = true;
  try {
    const newPosts = await Promise.race([
      runAllScrapers(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scrape timeout: превышено 3 минуты')), 3 * 60 * 1000)
      ),
    ]);
    cache.lastScrapedAt = Date.now();
    cache.lastNewPosts = newPosts;
    res.json({ success: true, newPosts, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Scrape] Ошибка:', msg);
    res.json({ success: false, error: msg });
  } finally {
    isScraping = false;
  }
});

// GET /api/scrape — текущий статус кэша
scrapeRouter.get('/', (_req: Request, res: Response) => {
  const cached = isCached();
  const remainingSec = cached && cache.lastScrapedAt !== null
    ? Math.ceil((getCooldownMs() - (Date.now() - cache.lastScrapedAt)) / 1000)
    : 0;

  res.json({ isScraping, cached, nextAllowedIn: remainingSec });
});
