import { Router, Request, Response } from 'express';
import axios from 'axios';
import { GigaChatService } from '../services/GigaChatService';
import { StableCogService } from '../services/StableCogService';
import { HuggingFaceService } from '../services/HuggingFaceService';
import { TogetherAIService } from '../services/TogetherAIService';

export const generateRouter = Router();

let isGenerating = false;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Базовый антипромпт — всегда подмешивается к пользовательскому
const BASE_NEGATIVE_PROMPT =
  'text, letters, words, typography, infographic, diagram, chart, graph, ' +
  'arrows, numbers, digits, labels, captions, watermark, logo, symbols, ' +
  'data visualization, table, statistics, annotations';

async function callOpenRouter(systemPrompt: string, userContent: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    return response.data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

const STYLE_MODIFIERS: Record<string, string> = {
  DEFAULT: 'photorealistic, professional photography, natural lighting, high detail',
  KANDINSKY: 'abstract expressionist painting, bold brushstrokes, vibrant colors, artistic, painterly',
  ANIME: 'anime style, cel-shaded illustration, vibrant anime art, manga illustration',
  REALISTIC: 'photorealistic, hyperrealistic, RAW photo, DSLR, 8k, sharp focus, cinematic lighting, ultra detailed'
};

// Генерирует детальный промпт на английском по тексту статьи с учётом стиля
async function buildVisualPrompt(articlePrompt: string, style: string, negativePrompt?: string): Promise<string> {
  const styleModifier = STYLE_MODIFIERS[style] ?? STYLE_MODIFIERS.DEFAULT;
  const negativeInstruction = negativePrompt?.trim()
    ? `\nCRITICAL: The image MUST NOT contain: ${negativePrompt}. This is a hard requirement — never include these elements under any circumstances.`
    : '';

  const result = await callOpenRouter(
    `You are an expert at writing prompts for AI image generation.
Your task: read the Russian real estate news article and create a detailed English prompt for an illustration.

CONTEXT: This is news about real estate in Saint Petersburg or Moscow, Russia.
The scene must match the article text precisely:
- If the article mentions new construction (новостройки) — show modern Russian residential towers, glass facades, construction cranes
- If the article mentions Soviet-era housing (советская застройка, хрущёвки, панельные дома) — show grey Soviet panel buildings, courtyards
- If the article mentions suburbs or outskirts (окраина, пригород) — show suburban Russian residential areas
- If the article mentions city center or historic buildings — show classic Saint Petersburg or Moscow architecture, ornate facades
- Always reflect the actual location, era, and type of buildings described in the article

Style to apply: ${styleModifier}
Rules:
- The prompt MUST start with the style keywords: "${styleModifier}"
- Be specific about Russian urban architecture and environment from the article
- Include season/weather/time of day if it adds realism
- NO text, NO logos, NO people unless the article specifically focuses on residents${negativeInstruction}
- Output ONLY the prompt, no explanations, max 200 words`,
    articlePrompt
  );

  if (result) {
    console.log('[Generate] AI-промпт:', result.slice(0, 120) + '...');
    return result;
  }

  // Fallback: берём заголовок и переводим
  const titleMatch = articlePrompt.match(/Название статьи:\s*([^\n.]+)/);
  const title = titleMatch?.[1]?.trim() ?? articlePrompt.slice(0, 100);
  const translated = await callOpenRouter(
    'Translate to English. Return ONLY the translation.',
    title
  );
  return `${styleModifier}, Saint Petersburg Russia real estate: ${translated ?? title}, high detail`;
}

async function translateToEnglish(text: string): Promise<string> {
  return (await callOpenRouter('Translate to English. Return ONLY the translation.', text)) ?? text;
}

// Для GigaChat нужен короткий русский промпт — извлекаем заголовок статьи или обрезаем текст
function buildGigaChatPrompt(articleText: string): string {
  const titleMatch = articleText.match(/Название статьи:\s*([^\n.]{5,150})/);
  if (titleMatch?.[1]) return titleMatch[1].trim();
  // Берём первое осмысленное предложение
  const firstSentence = articleText.replace(/\s+/g, ' ').trim().slice(0, 150);
  return firstSentence;
}

async function generateImageWithFallback(
  visualPrompt: string,
  russianPrompt: string,
  negativePrompt?: string
): Promise<{ base64: string; provider: string }> {
  // Шаг 1 — GigaChat: русский промпт (модель не понимает английский в команде "Нарисуй")
  const gigachatKey = process.env.GIGACHAT_API_KEY;
  if (gigachatKey) {
    try {
      const gigaPrompt = `${russianPrompt}. Не добавляй на изображение текст, цифры, стрелки, инфографику, диаграммы и любые символы.`;
      const base64 = await new GigaChatService(gigachatKey).generateImage(gigaPrompt);
      return { base64, provider: 'GigaChat' };
    } catch (err) {
      console.warn('[Generate] GigaChat недоступен, пробую StableCog:', (err as Error).message);
    }
  } else {
    console.warn('[Generate] GIGACHAT_API_KEY не задан, пропускаю GigaChat');
  }

  // Шаг 2 — StableCog (с ключом) → Pollinations (без ключа): английский визуальный промпт
  try {
    const base64 = await new StableCogService().generateImage(visualPrompt, negativePrompt);
    const provider = process.env.STABLECOG_SECRET_KEY ? 'StableCog' : 'Pollinations';
    return { base64, provider };
  } catch (err) {
    console.warn('[Generate] StableCog/Pollinations недоступны, пробую HuggingFace:', (err as Error).message);
  }

  // Шаг 3 — HuggingFace Inference API (нужен HUGGINGFACE_API_KEY)
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (hfKey) {
    try {
      const base64 = await new HuggingFaceService(hfKey).generateImage(visualPrompt, negativePrompt);
      return { base64, provider: 'HuggingFace' };
    } catch (err) {
      console.warn('[Generate] HuggingFace недоступен, пробую TogetherAI:', (err as Error).message);
    }
  } else {
    console.warn('[Generate] HUGGINGFACE_API_KEY не задан, пропускаю HuggingFace');
  }

  // Шаг 4 — Together AI (нужен TOGETHER_API_KEY, есть бесплатный FLUX)
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    try {
      const base64 = await new TogetherAIService(togetherKey).generateImage(visualPrompt);
      return { base64, provider: 'TogetherAI' };
    } catch (err) {
      console.warn('[Generate] TogetherAI недоступен:', (err as Error).message);
    }
  } else {
    console.warn('[Generate] TOGETHER_API_KEY не задан, пропускаю TogetherAI');
  }

  throw new Error('Все сервисы генерации изображений недоступны');
}

// POST /api/generate/image
// Body: { prompt: string, negativePrompt?: string }
// Response: { success: boolean, data: { imageBase64: string, provider: string } | null, error: string | null }
generateRouter.post('/image', async (req: Request, res: Response) => {
  const { prompt, negativePrompt, style } = req.body as { prompt?: string; negativePrompt?: string; style?: string };

  if (!prompt?.trim()) {
    res.json({ success: false, data: null, error: 'prompt is required' });
    return;
  }

  if (isGenerating) {
    res.json({ success: false, data: null, error: 'Генерация уже выполняется, подождите' });
    return;
  }

  const resolvedStyle = style ?? 'DEFAULT';

  isGenerating = true;
  try {
    // Переводим пользовательский антипромпт в English и добавляем базовый
    const userNegativeEn = negativePrompt?.trim()
      ? await translateToEnglish(negativePrompt.trim())
      : null;
    const negativeEn = userNegativeEn
      ? `${BASE_NEGATIVE_PROMPT}, ${userNegativeEn}`
      : BASE_NEGATIVE_PROMPT;

    console.log('[Generate] Негативный промпт (EN):', negativeEn.slice(0, 120));

    // Строим visual prompt с учётом стиля и негативного промпта
    const visualPrompt = await buildVisualPrompt(prompt.trim(), resolvedStyle, negativeEn);

    console.log('[Generate] Стиль:', resolvedStyle);

    const gigachatPrompt = buildGigaChatPrompt(prompt.trim());
    console.log('[Generate] GigaChat промпт:', gigachatPrompt);
    const imageBase64 = await generateImageWithFallback(visualPrompt, gigachatPrompt, negativeEn);
    res.json({ success: true, data: { imageBase64: imageBase64.base64, provider: imageBase64.provider }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Generate] Ошибка:', msg);
    res.json({ success: false, data: null, error: msg });
  } finally {
    isGenerating = false;
  }
});
