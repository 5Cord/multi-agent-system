import axios from 'axios';

const SC_API_URL = 'https://api.stablecog.com/v1/image/generation/create';
const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';

interface StableCogResponse {
  outputs: Array<{ id: string; url: string }>;
}

export class StableCogService {
  private readonly apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.STABLECOG_SECRET_KEY ?? null;
  }

  public async generateImage(prompt: string, negativePrompt?: string): Promise<string> {
    if (this.apiKey) {
      try {
        return await this.generateWithStableCog(prompt, negativePrompt);
      } catch (err) {
        const detail = axios.isAxiosError(err) && err.response?.data
          ? JSON.stringify(err.response.data).slice(0, 300)
          : (err as Error).message;
        console.warn('[StableCog] Недоступен, пробую Pollinations:', detail);
      }
    } else {
      console.warn('[StableCog] STABLECOG_SECRET_KEY не задан, пробую Pollinations');
    }

    return await this.generateWithPollinations(prompt, negativePrompt);
  }

  private async generateWithStableCog(prompt: string, negativePrompt?: string): Promise<string> {
    console.log('[StableCog] Генерирую изображение...');

    const response = await axios.post<StableCogResponse>(
      SC_API_URL,
      {
        prompt: prompt.slice(0, 500),
        negative_prompt: negativePrompt?.trim() || undefined,
        model_id: '0a99668b-45bd-4f7e-aa9c-f9aaa41ef13b', // FLUX.1
        width: 1024,
        height: 1024,
        num_outputs: 1,
        inference_steps: 30,
        guidance_scale: 7,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      }
    );

    const imageUrl = response.data?.outputs?.[0]?.url;
    if (!imageUrl) {
      console.error('[StableCog] Ответ:', JSON.stringify(response.data));
      throw new Error('StableCog вернул пустой ответ');
    }

    // Скачиваем картинку и конвертируем в base64
    const imageResponse = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });

    const mime = (imageResponse.headers['content-type'] as string) || 'image/jpeg';
    const base64 = Buffer.from(imageResponse.data).toString('base64');
    console.log('[StableCog] Готово');
    return `data:${mime};base64,${base64}`;
  }

  private async generateWithPollinations(prompt: string, negativePrompt?: string): Promise<string> {
    console.log('[Pollinations] Генерирую изображение...');

    const encoded = encodeURIComponent(prompt.slice(0, 400));
    const negParam = negativePrompt?.trim()
      ? `&negative_prompt=${encodeURIComponent(negativePrompt.trim())}`
      : '';
    const url = `${POLLINATIONS_URL}/${encoded}?width=1024&height=1024&nologo=true&model=flux&seed=${Date.now() % 99999}${negParam}`;

    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 90_000,
    });

    const mime = (response.headers['content-type'] as string) || '';
    if (!mime.startsWith('image/')) {
      throw new Error(`Pollinations вернул неожиданный тип: ${mime || 'unknown'}`);
    }

    const base64 = Buffer.from(response.data).toString('base64');
    console.log('[Pollinations] Готово');
    return `data:${mime};base64,${base64}`;
  }
}
