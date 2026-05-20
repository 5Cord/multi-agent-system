import { Router, Request, Response } from 'express';
import axios from 'axios';
import { sleep, withRetry } from '../utils/retry';

export const textRouter = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

// Бесплатные модели — первыми (не зависят от кредитов). Платные — резерв.
const MODELS = [
  'qwen/qwen3-235b-a22b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'openai/gpt-4o-mini',
  'anthropic/claude-3-haiku'
] as const;

async function tryOllama(prompt: string): Promise<string | null> {
  try {
    const response = await axios.post(
      `${OLLAMA_URL}/v1/chat/completions`,
      {
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8_000
      }
    );
    const text: string = response.data?.choices?.[0]?.message?.content ?? '';
    return text || null;
  } catch {
    return null;
  }
}

// POST /api/text/generate
// Body: { prompt: string }
// Response: { success: boolean, data: { text: string, model: string } | null, error: string | null }
textRouter.post('/generate', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    res.json({ success: false, data: null, error: 'prompt is required' });
    return;
  }

  // Сначала пробуем локальную Ollama
  const ollamaText = await tryOllama(prompt.trim());
  if (ollamaText) {
    console.log(`[Text] Использована локальная модель: ${OLLAMA_MODEL}`);
    res.json({ success: true, data: { text: ollamaText, model: `ollama/${OLLAMA_MODEL}` }, error: null });
    return;
  }

  console.log('[Text] Ollama недоступна, переключаемся на OpenRouter');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.json({ success: false, data: null, error: 'OPENROUTER_API_KEY не настроен' });
    return;
  }

  for (const model of MODELS) {
    try {
      const response = await withRetry(() =>
        axios.post(
          OPENROUTER_URL,
          {
            model,
            messages: [{ role: 'user', content: prompt.trim() }]
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const text: string = response.data?.choices?.[0]?.message?.content ?? '';
      if (!text) throw new Error(`${model} вернула пустой ответ`);

      console.log(`[Text] Использована модель: ${model}`);
      res.json({ success: true, data: { text, model }, error: null });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Text] Модель ${model} недоступна:`, msg);
      await sleep(500);
    }
  }

  res.json({ success: false, data: null, error: 'Все текстовые модели недоступны' });
});
