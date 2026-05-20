interface IGenerateImageResponse {
  success: boolean;
  data: { imageBase64: string; provider: string } | null;
  error: string | null;
}

interface IGenerateTextResponse {
  success: boolean;
  data: { text: string; model: string } | null;
  error: string | null;
}

// Модульный уровень — переживает StrictMode ремаунты
let _imageInProgress = false;
let _textInProgress = false;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_FALLBACK_MODELS = [
  'qwen/qwen3-235b-a22b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free'
] as const;

async function callOpenRouterDirect(prompt: string): Promise<string | null> {
  const apiKey =
    (import.meta.env.VITE_OPENROUTER_AUTH_KEY_MAIN as string | undefined) ||
    (import.meta.env.VITE_OPENROUTER_AUTH_KEY_FALLBACK as string | undefined);
  if (!apiKey) return null;

  for (const model of OPENROUTER_FALLBACK_MODELS) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(60_000)
      });

      if (!response.ok) continue;

      const json = await response.json() as { choices?: { message?: { content?: string } }[] };
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (text) {
        console.log(`[Text] Прямой OpenRouter fallback, модель: ${model}`);
        return text;
      }
    } catch {
      // продолжаем к следующей модели
    }
  }

  return null;
}

export class BackendGenerationService {
  private readonly backendUrl: string;

  constructor() {
    this.backendUrl = import.meta.env.VITE_POSTS_API_URL ?? 'http://localhost:3001';
  }

  public async generateImage(prompt: string, negativePrompt?: string | null, style?: string | null): Promise<string | null> {
    if (_imageInProgress) return null;
    _imageInProgress = true;
    try {
      const response = await fetch(`${this.backendUrl}/api/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negativePrompt: negativePrompt ?? '', style: style ?? 'DEFAULT' }),
        signal: AbortSignal.timeout(60_000)
      });

      const json: IGenerateImageResponse = await response.json();

      if (!json.success || !json.data) {
        console.error('[Image] Backend error:', json.error);
        throw new Error(json.error ?? 'Image generation failed');
      }

      console.log(`[Image] Backend использовал: ${json.data.provider}`);
      return json.data.imageBase64;
    } finally {
      _imageInProgress = false;
    }
  }

  public async submitFeedback(params: {
    rating: number;
    textPrompt: string;
    imagePrompt: string;
    generatedText: string;
    model?: string;
  }): Promise<void> {
    await fetch(`${this.backendUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  public async generateText(prompt: string): Promise<string | null> {
    if (_textInProgress) return null;
    _textInProgress = true;
    try {
      try {
        const response = await fetch(`${this.backendUrl}/api/text/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: AbortSignal.timeout(60_000)
        });

        const json: IGenerateTextResponse = await response.json();

        if (json.success && json.data?.text) {
          console.log(`[Text] Backend использовал: ${json.data.model}`);
          return json.data.text;
        }

        console.warn('[Text] Backend вернул ошибку, переключаемся на OpenRouter:', json.error);
      } catch (backendErr) {
        console.warn('[Text] Backend недоступен, переключаемся на OpenRouter:', backendErr);
      }

      const fallbackText = await callOpenRouterDirect(prompt);
      if (fallbackText) return fallbackText;

      throw new Error('Text generation failed: all providers unavailable');
    } finally {
      _textInProgress = false;
    }
  }
}
