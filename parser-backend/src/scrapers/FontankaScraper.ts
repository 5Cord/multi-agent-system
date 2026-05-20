import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { IRawScrapedPost } from '../types';

const LIST_URL = 'https://www.fontanka.ru/realty/';
const BASE_URL = 'https://www.fontanka.ru';
// /YYYY/MM/DD/NNNNNN/ или /longreads/NNNNNN/
const ARTICLE_PATTERN = /fontanka\.ru\/((\d{4}\/\d{2}\/\d{2}\/\d+)|longreads\/\d+)\//;

export class FontankaScraper extends BaseScraper {
  constructor() {
    super('Fontanka');
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
        this.logError(`Ошибка при парсинге ${link}`, err);
      }
    }

    this.log(`Готово. Спарсено: ${posts.length}`);
    return posts;
  }

  private async scrapeLinks(): Promise<string[]> {
    const html = await this.fetchHtml(LIST_URL);
    const $ = cheerio.load(html);
    const seen = new Set<string>();

    // Только ссылки внутри <article> — главный фид, без сайдбаров и "похожих"
    $('article a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const clean = full.split('?')[0];
      if (ARTICLE_PATTERN.test(clean) && !seen.has(clean)) {
        seen.add(clean);
      }
    });

    return [...seen];
  }

  private async scrapeArticle(url: string): Promise<IRawScrapedPost | null> {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    // Проверяем категорию: Fontanka проставляет тег-ссылку на раздел внутри статьи
    const isRealty = $('a[href*="/realty/"]').length > 0;
    if (!isRealty) {
      this.log(`Пропускаю (не недвижимость): ${url}`);
      return null;
    }

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim();

    if (!title) return null;

    // time[datetime] подтверждён — самый надёжный источник даты
    const dateAttr =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time[datetime]').first().attr('datetime') ||
      '';
    const date = dateAttr ? new Date(dateAttr).toISOString() : new Date().toISOString();

    const imageUrl =
      $('meta[property="og:image"]').attr('content') ??
      $('article img').first().attr('src') ??
      '';

    // Текст — data-article-block-text устарел, перебираем стабильные варианты
    const textParts: string[] = [];

    const lead = $('[class*="leadParagraph"]').first().text().trim();
    if (lead) textParts.push(lead);

    const contentSelectors = [
      '[data-article-block-text] p',
      'div[class*="article-body"] p',
      'div[class*="articleBody"] p',
      'div[class*="article__text"] p',
      'div[class*="text_"] p',
      'article p',
    ];

    for (const sel of contentSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 40) textParts.push(text);
      });
      if (textParts.length > (lead ? 1 : 0)) break;
    }

    if (textParts.length === 0) {
      const desc = $('meta[property="og:description"]').attr('content')?.trim();
      if (desc) textParts.push(desc);
    }

    const text = textParts.join('\n\n');

    const author =
      $('meta[name="author"]').attr('content')?.trim() ||
      $('[class*="ArticleAuthor"] a').first().text().trim() ||
      $('[class*="author"] a').first().text().trim() ||
      $('[itemprop="author"]').first().text().trim() ||
      'Фонтанка.РУ';

    return { title, date, image_link: imageUrl, origin_link: url, text, author };
  }
}
