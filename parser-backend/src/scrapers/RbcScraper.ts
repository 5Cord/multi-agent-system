import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { IRawScrapedPost } from '../types';

const LIST_URL = 'https://realty.rbc.ru/housing/';
const ARTICLE_PATTERN = /realty\.rbc\.ru\/news\/[a-f0-9]{24}/;

export class RbcScraper extends BaseScraper {
  constructor() {
    super('RBC');
  }

  async scrape(): Promise<IRawScrapedPost[]> {
    this.log('Начинаю парсинг...');

    let links: string[] = [];
    try {
      links = await this.scrapeLinks();
      this.log(`Найдено ссылок: ${links.length}`);
    } catch (err) {
      this.logError('Не удалось получить список статей', err);
      return [];
    }

    const posts: IRawScrapedPost[] = [];
    for (const link of links) {
      try {
        const post = await this.scrapeArticle(link);
        if (post) posts.push(post);
      } catch (err) {
        this.logError(`Ошибка при парсинге статьи ${link}`, err);
      }
    }

    this.log(`Готово. Спарсено постов: ${posts.length}`);
    return posts;
  }

  private async scrapeLinks(): Promise<string[]> {
    const html = await this.fetchHtml(LIST_URL);
    const $ = cheerio.load(html);
    const seen = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      // Убираем параметры трекинга (?from=newsfeed и т.п.)
      const clean = href.split('?')[0];
      if (ARTICLE_PATTERN.test(clean) && !seen.has(clean)) {
        seen.add(clean);
      }
    });

    return [...seen];
  }

  private async scrapeArticle(url: string): Promise<IRawScrapedPost | null> {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    // og:title надёжнее любых CSS-классов
    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim();

    if (!title) return null;

    // Дата публикации
    const dateAttr =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time[datetime]').first().attr('datetime') ||
      '';
    const date = dateAttr ? new Date(dateAttr).toISOString() : new Date().toISOString();

    // Картинка
    const imageUrl =
      $('meta[property="og:image"]').attr('content') ?? '';

    // Текст статьи — ищем параграфы внутри основного контента
    // RBC оборачивает текст в article или div с классом, содержащим "article__text" / "article-body"
    const textParts: string[] = [];

    const contentSelectors = [
      'div.article__text p',
      'div[class*="article__text"] p',
      'div[class*="article-body"] p',
      'article p',
    ];

    for (const sel of contentSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 40) textParts.push(text);
      });
      if (textParts.length > 0) break;
    }

    // Фолбэк: берём og:description если текст не нашли
    if (textParts.length === 0) {
      const desc = $('meta[property="og:description"]').attr('content')?.trim();
      if (desc) textParts.push(desc);
    }

    const text = textParts.join('\n\n');

    // Автор
    const author =
      $('meta[name="author"]').attr('content')?.trim() ||
      $('[class*="article__authors"] a').first().text().trim() ||
      $('[class*="author"] a').first().text().trim() ||
      'РБК Недвижимость';

    return { title, date, image_link: imageUrl, origin_link: url, text, author };
  }
}
