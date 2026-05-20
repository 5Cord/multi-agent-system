import axios from 'axios';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

const AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

// GigaChat использует российский удостоверяющий центр — браузеры ему не доверяют.
// Поэтому генерация идёт через этот бэкенд-прокси.
// В продакшне замени rejectUnauthorized на корректный CA-сертификат Сбера.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

interface IGigaChatToken {
  access_token: string;
  expires_at: number; // timestamp в миллисекундах
}

export class GigaChatService {
  private readonly authKey: string; // base64(clientId:clientSecret)
  private token: IGigaChatToken | null = null;

  constructor(authKey: string) {
    this.authKey = authKey;
  }

  public async generateText(prompt: string): Promise<string> {
    const token = await this.getToken();

    const response = await axios.post(
      `${API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512
      },
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content: string = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('GigaChat вернул пустой ответ');
    return content;
  }

  public async generateImage(prompt: string): Promise<string> {
    const token = await this.getToken();

    // GigaChat генерирует изображение через обычный чат с командой "Нарисуй"
    const chatResponse = await axios.post(
      `${API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [{ role: 'user', content: `Нарисуй: ${prompt}` }],
        function_call: 'auto',
      },
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content: string = chatResponse.data?.choices?.[0]?.message?.content ?? '';
    console.log('[GigaChat] Ответ модели:', content.slice(0, 300));

    // Ответ содержит тег вида: <img src="FILE_ID" fuse="true"/>
    const fileIdMatch = content.match(/src="([^"]+)"/);
    if (!fileIdMatch) {
      throw new Error(`GigaChat не вернул изображение. Ответ: ${content.slice(0, 200)}`);
    }

    const fileId = fileIdMatch[1];
    return this.downloadImageAsBase64(fileId, token);
  }

  private async downloadImageAsBase64(fileId: string, token: string): Promise<string> {
    const response = await axios.get(`${API_URL}/files/${fileId}/content`, {
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
    const mimeType = (response.headers['content-type'] as string) || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  }

  private async getToken(): Promise<string> {
    // Кешируем токен — он живёт 30 минут
    if (this.token && Date.now() < this.token.expires_at - 60_000) {
      return this.token.access_token;
    }

    const response = await axios.post(
      AUTH_URL,
      'scope=GIGACHAT_API_PERS',
      {
        httpsAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          RqUID: uuidv4(),
          Authorization: `Basic ${this.authKey}`
        }
      }
    );

    this.token = {
      access_token: response.data.access_token,
      expires_at: response.data.expires_at
    };

    return this.token.access_token;
  }
}
