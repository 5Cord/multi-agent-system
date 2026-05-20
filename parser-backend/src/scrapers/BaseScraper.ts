import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { IRawScrapedPost } from '../types';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export abstract class BaseScraper {
  protected readonly name: string;
  protected readonly http: AxiosInstance;

  constructor(name: string) {
    this.name = name;
    this.http = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': process.env.USER_AGENT ?? DEFAULT_USER_AGENT,
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
  }

  abstract scrape(): Promise<IRawScrapedPost[]>;

  protected async fetchHtml(url: string): Promise<string> {
    const response = await this.http.get<string>(url);
    return response.data;
  }

  protected load(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  protected logError(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[${this.name}] ${message}${detail ? `: ${detail}` : ''}`);
  }
}
