import cron from 'node-cron';
import { RbcScraper } from '../scrapers';
import { insertPosts } from '../db/database';
import { IRawScrapedPost } from '../types';

const DEFAULT_SCHEDULE = '0 */2 * * *'; // каждые 2 часа

const scrapers = [
  new RbcScraper(), // https://realty.rbc.ru/housing/
];

export async function runAllScrapers(): Promise<number> {
  console.log('[Scheduler] Запуск всех скраперов...');
  const startTime = Date.now();

  const results = await Promise.allSettled(
    scrapers.map((scraper) => scraper.scrape())
  );

  let totalInserted = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const posts: IRawScrapedPost[] = result.value;
      if (posts.length > 0) {
        const inserted = await insertPosts(posts);
        totalInserted += inserted;
      }
    } else {
      console.error('[Scheduler] Скрапер завершился с ошибкой:', result.reason);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Scheduler] Готово за ${elapsed}с. Новых постов в БД: ${totalInserted}`
  );

  return totalInserted;
}

export function startScheduler(): void {
  const schedule = process.env.CRON_SCHEDULE ?? DEFAULT_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Некорректное cron-выражение: "${schedule}"`);
    process.exit(1);
  }

  console.log(`[Scheduler] Расписание: "${schedule}"`);

  cron.schedule(schedule, () => {
    runAllScrapers().catch((err) => {
      console.error('[Scheduler] Необработанная ошибка:', err);
    });
  });
}
