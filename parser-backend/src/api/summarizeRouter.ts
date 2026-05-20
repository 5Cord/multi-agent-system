import { Router, Request, Response } from 'express';
import axios from 'axios';
import { sleep, withRetry } from '../utils/retry';

export const summarizeRouter = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = [
  'openai/gpt-4o-mini',
  'anthropic/claude-3-haiku',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free'
] as const;

const buildPrompt = (title: string, text: string) =>
  `Ты — ассистент для краткого пересказа новостей о недвижимости.\n` +
  `Правила:\n` +
  `1. Используй ТОЛЬКО информацию из текста ниже.\n` +
  `2. Перескажи суть в 3-4 предложениях на русском языке.\n` +
  `3. Без разметки, хэштегов и лишних слов.\n` +
  `Заголовок: ${title}\n` +
  `Текст: ${text}`;

// POST /api/summarize
// Body: { title: string, text: string }
// Response: { summary: string }
summarizeRouter.post('/', async (req: Request, res: Response) => {
  const { title, text } = req.body as { title?: string; text?: string };

  if (!title || !text || text.trim().length < 100) {
    res.status(400).json({ error: 'text is too short to summarize' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
    return;
  }

  const prompt = buildPrompt(title, text).slice(0, 3000);

  for (const model of MODELS) {
    try {
      const response = await withRetry(() =>
        axios.post(
          OPENROUTER_URL,
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 256
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const summary: string = response.data?.choices?.[0]?.message?.content?.trim() ?? '';
      if (!summary) throw new Error(`${model} вернула пустой ответ`);

      console.log(`[Summarize] Использована модель: ${model}`);
      res.json({ summary });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Summarize] Модель ${model} недоступна:`, msg);
      await sleep(500);
    }
  }

  res.status(502).json({ error: 'Все модели недоступны' });
});
