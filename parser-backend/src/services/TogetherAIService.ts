import axios from 'axios';

const API_URL = 'https://api.together.xyz/v1/images/generations';
const MODEL = 'black-forest-labs/FLUX.1-schnell-Free';

interface TogetherImageResponse {
  data: Array<{ b64_json: string }>;
}

export class TogetherAIService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateImage(prompt: string): Promise<string> {
    console.log('[TogetherAI] Генерирую изображение...');

    const response = await axios.post<TogetherImageResponse>(
      API_URL,
      {
        model: MODEL,
        prompt: prompt.slice(0, 500),
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      }
    );

    const b64 = response.data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('TogetherAI вернул пустой ответ');

    console.log('[TogetherAI] Готово');
    return `data:image/jpeg;base64,${b64}`;
  }
}
