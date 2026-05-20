/**
 * API Benchmark — замер производительности и корректности всех эндпоинтов бэкенда.
 *
 * Запуск (при запущенном сервере):
 *   npx ts-node benchmark.ts
 *   TEST_API_URL=http://my-server:3001 npx ts-node benchmark.ts
 */

import { performance } from 'perf_hooks';

const BASE_URL = process.env.TEST_API_URL ?? 'http://localhost:3001';
const ITERATIONS = 5;

// ─── Типы ────────────────────────────────────────────────────────────────────

interface Timing {
  min: number;
  avg: number;
  max: number;
}

interface TestResult {
  name: string;
  passed: boolean;
  timing: Timing | null;
  error?: string;
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

async function request(
  url: string,
  options?: RequestInit
): Promise<{ status: number; time: number; body: unknown }> {
  const start = performance.now();
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, time: performance.now() - start, body };
}

function calcTiming(times: number[]): Timing {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    min: sorted[0],
    avg: times.reduce((s, t) => s + t, 0) / times.length,
    max: sorted[sorted.length - 1],
  };
}

async function runTest(
  name: string,
  fn: () => Promise<void>
): Promise<TestResult> {
  try {
    await fn();
    return { name, passed: true, timing: null };
  } catch (e) {
    return { name, passed: false, timing: null, error: (e as Error).message };
  }
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

const suite: Array<() => Promise<TestResult>> = [

  // 1. Health check — сервер живой, база подключена
  async () => {
    const times: number[] = [];
    return runTest('GET /health — сервер доступен, posts: число', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time, body } = await request(`${BASE_URL}/health`);
        times.push(time);
        if (status !== 200) throw new Error(`Ожидался 200, получен ${status}`);
        if ((body as any)?.status !== 'ok') throw new Error('Поле status !== "ok"');
        if (typeof (body as any)?.posts !== 'number') throw new Error('Поле posts не является числом');
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 2. Список постов — структура и пагинация
  async () => {
    const times: number[] = [];
    return runTest('GET /posts?page=1 — массив постов и totalPages', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time, body } = await request(`${BASE_URL}/posts?page=1`);
        times.push(time);
        if (status !== 200) throw new Error(`Ожидался 200, получен ${status}`);
        const data = body as any;
        if (!Array.isArray(data?.data)) throw new Error('data не является массивом');
        if (typeof data?.totalPages !== 'number') throw new Error('totalPages отсутствует');
        if (data.data.length > 0) {
          const post = data.data[0];
          for (const field of ['id', 'title', 'date', 'image_link', 'origin_link']) {
            if (!(field in post)) throw new Error(`Поле ${field} отсутствует в элементе`);
          }
        }
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 3. Пагинация — page=2 существует или totalPages=1
  async () => {
    const times: number[] = [];
    return runTest('GET /posts?page=2 — вторая страница или пустой массив', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time, body } = await request(`${BASE_URL}/posts?page=2`);
        times.push(time);
        if (status !== 200) throw new Error(`Ожидался 200, получен ${status}`);
        if (!Array.isArray((body as any)?.data)) throw new Error('data не является массивом');
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 4. Пост по ID — все обязательные поля
  async () => {
    const times: number[] = [];
    return runTest('GET /posts/1 — полный объект поста', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time, body } = await request(`${BASE_URL}/posts/1`);
        times.push(time);
        if (status !== 200) throw new Error(`Ожидался 200, получен ${status}`);
        const post = body as any;
        for (const field of ['id', 'title', 'date', 'text', 'image_link', 'origin_link']) {
          if (!(field in post)) throw new Error(`Обязательное поле "${field}" отсутствует`);
        }
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 5. Несуществующий пост → 404
  async () => {
    const times: number[] = [];
    return runTest('GET /posts/999999 — ожидается 404', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time } = await request(`${BASE_URL}/posts/999999`);
        times.push(time);
        if (status !== 404) throw new Error(`Ожидался 404, получен ${status}`);
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 6. Невалидный ID → 400
  async () => {
    const times: number[] = [];
    return runTest('GET /posts/abc — ожидается 400', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time } = await request(`${BASE_URL}/posts/abc`);
        times.push(time);
        if (status !== 400) throw new Error(`Ожидался 400, получен ${status}`);
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 7. Статус парсинга
  async () => {
    const times: number[] = [];
    return runTest('GET /api/scrape — статус кэша (isScraping, cached)', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { status, time, body } = await request(`${BASE_URL}/api/scrape`);
        times.push(time);
        if (status !== 200) throw new Error(`Ожидался 200, получен ${status}`);
        const data = body as any;
        if (typeof data?.isScraping !== 'boolean') throw new Error('isScraping не boolean');
        if (typeof data?.cached !== 'boolean') throw new Error('cached не boolean');
        if (typeof data?.nextAllowedIn !== 'number') throw new Error('nextAllowedIn не number');
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },

  // 8. Защита от параллельных запросов на генерацию (пустой промпт → ошибка)
  async () => {
    const times: number[] = [];
    return runTest('POST /api/generate/image — пустой промпт отклоняется', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const { time, body } = await request(`${BASE_URL}/api/generate/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '' }),
        });
        times.push(time);
        if ((body as any)?.success !== false) throw new Error('Ожидался success: false');
        if (!(body as any)?.error) throw new Error('Ожидалось поле error');
      }
    }).then(r => ({ ...r, timing: calcTiming(times) }));
  },
];

// ─── Вывод результатов ────────────────────────────────────────────────────────

function fmt(ms: number): string {
  return `${ms.toFixed(0)} мс`.padStart(8);
}

async function main() {
  console.log('\n' + '═'.repeat(72));
  console.log(`  Benchmark  |  ${BASE_URL}  |  ${ITERATIONS} итерации на тест`);
  console.log('═'.repeat(72));

  const results = await Promise.all(suite.map(t => t()));

  const col = 46;
  console.log(`\n  ${'Тест'.padEnd(col)} ${'Мин'.padStart(8)} ${'Ср'.padStart(8)} ${'Макс'.padStart(8)}`);
  console.log('  ' + '─'.repeat(col + 26));

  for (const r of results) {
    const mark = r.passed ? '✓' : '✗';
    const t = r.timing;
    const times = t ? `${fmt(t.min)} ${fmt(t.avg)} ${fmt(t.max)}` : ' '.repeat(26);
    console.log(`  ${mark} ${r.name.padEnd(col)} ${times}`);
    if (!r.passed) console.log(`      └─ ${r.error}`);
  }

  const passed = results.filter(r => r.passed).length;
  console.log('\n  ' + '─'.repeat(col + 26));
  console.log(`  Итого: ${passed}/${results.length} тестов пройдено`);

  const avgAll = results
    .flatMap(r => (r.timing ? [r.timing.avg] : []))
    .reduce((s, t, _, a) => s + t / a.length, 0);
  if (avgAll > 0) console.log(`  Среднее по всем эндпоинтам: ${avgAll.toFixed(0)} мс`);

  console.log('═'.repeat(72) + '\n');
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(err => {
  console.error('Критическая ошибка:', err.message);
  process.exit(1);
});
