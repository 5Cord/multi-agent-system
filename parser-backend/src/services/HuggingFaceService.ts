import axios from 'axios';

const API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

export class HuggingFaceService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateImage(prompt: string, negativePrompt?: string): Promise<string> {
    console.log('[HuggingFace] Генерирую изображение...');

    const body: Record<string, unknown> = { inputs: prompt.slice(0, 500) };
    if (negativePrompt?.trim()) {
      body.parameters = { negative_prompt: negativePrompt.trim() };
    }

    const response = await axios.post<ArrayBuffer>(
      API_URL,
      body,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'image/jpeg',
        },
        responseType: 'arraybuffer',
        timeout: 120_000,
      }
    );

    const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      const text = Buffer.from(response.data).toString('utf-8').slice(0, 300);
      throw new Error(`HuggingFace вернул неожиданный тип: ${contentType} — ${text}`);
    }

    const base64 = Buffer.from(response.data).toString('base64');
    console.log('[HuggingFace] Готово');
    return `data:${contentType};base64,${base64}`;
  }
}
