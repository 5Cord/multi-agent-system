import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { postsRouter } from './api/postsRouter';
import { generateRouter } from './api/generateRouter';
import { summarizeRouter } from './api/summarizeRouter';
import { textRouter } from './api/textRouter';
import { feedbackRouter } from './api/feedbackRouter';
import { scrapeRouter } from './api/scrapeRouter';
import { startScheduler, runAllScrapers } from './scheduler/cron';
import { getPostsCount, prisma } from './db/database';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/posts', postsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/text', textRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/scrape', scrapeRouter);

app.get('/health', async (_, res) => {
  const posts = await getPostsCount();
  res.json({ status: 'ok', posts });
});

async function shutdown(signal: string) {
  console.log(`[Server] ${signal} получен — завершаю работу...`);
  await prisma.$disconnect();
  console.log('[Server] Prisma отключена. Выход.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', async (err) => {
  console.error('[Server] Необработанное исключение:', err);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[Server] Необработанный rejection:', reason);
  await prisma.$disconnect();
  process.exit(1);
});

app.listen(PORT, async () => {
  console.log(`[Server] Запущен на http://localhost:${PORT}`);

  const count = await getPostsCount();
  console.log(`[Server] Постов в БД: ${count}`);

  if (count === 0) {
    console.log('[Server] БД пустая — запускаю первоначальный парсинг...');
    await runAllScrapers();
  }

  startScheduler();
});
