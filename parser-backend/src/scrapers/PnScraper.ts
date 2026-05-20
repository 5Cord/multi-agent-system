import * as cheerio from 'cheerio';
import https from 'https';
import { constants } from 'crypto';
import axios from 'axios';
import { BaseScraper } from './BaseScraper';
import { IRawScrapedPost } from '../types';

const LIST_URL = 'https://pn.ru/company/news';
const BASE_URL = 'https://pn.ru';

// pn.ru использует российский CA (Минцифры) — Windows SChannel не может
// установить TLS-рукопожатие. Используем кастомный агент с расширенным набором
// шифров и отключённой проверкой сертификата.
const pnHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  secureOptions: (constants as any).SSL_OP_LEGACY_SERVER_CONNECT |
                 (constants as any).SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  ciphers: 'DEFAULT@SECLEVEL=0'
});

// pn.ru — полностью статический SSR-HTML.
// Структура карточки в списке:
//   <li data-emerge-label="company:news:elem">
//     <div class="contant">   ← опечатка в оригинале, не "content"
//       <a href="/company/news/..." class="image"><img src="..."></a>
//       <div class="body">
//         <a href="/company/news/..." class="name">Заголовок</a>
//         <div class="date"><span>1 апреля 2026, 10:00</span></div>
//       </div>
//     </div>
//   </li>
//
// Структура страницы статьи:
//   <h1 class="name">Заголовок</h1>
//   <div class="date"><span>1 апреля 2026, 10:00</span></div>
//   <div class="image"><img src="..."></div>
//   <div class="ArticleContent"><p>Абзац 1</p><p>Абзац 2</p></div>
//   <div class="type links"><a>Тег</a></div>
//   <div class="ArticleAuthor__name">Автор</div>
export class PnScraper extends BaseScraper {
  constructor() {
    super('PN.ru');
  }

  // Переопределяем fetchHtml — используем агент с расширенным TLS
  protected async fetchHtml(url: string): Promise<string> {
    const response = await axios.get<string>(url, {
      httpsAgent: pnHttpsAgent,
      timeout: 15000,
      headers: {
        'User-Agent': process.env.USER_AGENT ??
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    return response.data;
  }

  async scrape(): Promise<IRawScrapedPost[]> {
    this.log('Начинаю парсинг...');

    let links: Array<{ url: string; imageUrl: string; title: string; dateRaw: string }> = [];

    try {
      links = await this.scrapeList();
      this.log(`Найдено статей: ${links.length}`);
    } catch (err) {
      this.logError('Не удалось получить список статей', err);
      return [];
    }

    const posts: IRawScrapedPost[] = [];

    for (const item of links) {
      try {
        const post = await this.scrapeArticle(item);
        if (post) posts.push(post);
      } catch (err) {
        this.logError(`Ошибка при парсинге статьи ${item.url}`, err);
      }
    }

    this.log(`Готово. Спарсено постов: ${posts.length}`);
    return posts;
  }

  private async scrapeList(): Promise<Array<{ url: string; imageUrl: string; title: string; dateRaw: string }>> {
    const html = await this.fetchHtml(LIST_URL);
    const $ = cheerio.load(html);
    const results: Array<{ url: string; imageUrl: string; title: string; dateRaw: string }> = [];

    $('li[data-emerge-label="company:news:elem"]').each((_, el) => {
      const titleLink = $(el).find('a.name, a.header-news-link').first();
      const href = titleLink.attr('href') ?? '';
      const title = titleLink.text().trim();

      if (!href || !title) return;

      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const imageUrl = $(el).find('a.image img').first().attr('src') ?? '';
      const dateRaw = $(el).find('div.date span').first().text().trim();

      results.push({ url, imageUrl, title, dateRaw });
    });

    return results;
  }

  private parseRussianDate(raw: string): string {
    // Формат: "1 апреля 2026, 10:00"
    const months: Record<string, string> = {
      января: '01', февраля: '02', марта: '03', апреля: '04',
      мая: '05', июня: '06', июля: '07', августа: '08',
      сентября: '09', октября: '10', ноября: '11', декабря: '12'
    };

    const match = raw.match(/(\d+)\s+(\S+)\s+(\d{4}),\s+(\d+):(\d+)/);
    if (!match) return new Date().toISOString();

    const [, day, monthStr, year, hours, minutes] = match;
    const month = months[monthStr.toLowerCase()];
    if (!month) return new Date().toISOString();

    return new Date(`${year}-${month}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:00`).toISOString();
  }

  private async scrapeArticle(item: {
    url: string;
    imageUrl: string;
    title: string;
    dateRaw: string;
  }): Promise<IRawScrapedPost | null> {
    const html = await this.fetchHtml(item.url);
    const $ = cheerio.load(html);

    // h1.name — заголовок статьи
    const title =
      $('h1.name').first().text().trim() ||
      $('h1').first().text().trim() ||
      item.title;

    if (!title) return null;

    // .date span — дата публикации
    const dateRaw = $('.date span').first().text().trim();
    const date = dateRaw
      ? this.parseRussianDate(dateRaw)
      : this.parseRussianDate(item.dateRaw);

    // img внутри .image — основное изображение
    const imageUrl =
      $('.image img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      item.imageUrl;

    // .ArticleContent — весь текст статьи, абзацы через \n\n
    const textParts: string[] = [];
    $('.ArticleContent p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) textParts.push(text);
    });
    // Fallback если .ArticleContent не нашёлся
    if (textParts.length === 0) {
      $('[data-emerge-label="company:news:single:text"] p').each((_, el) => {
        const text = $(el).text().trim();
        if (text) textParts.push(text);
      });
    }
    const text = textParts.join('\n\n');

    // .ArticleAuthor__name — автор
    const author =
      $('.ArticleAuthor__name').first().text().trim() ||
      'Петербургская Недвижимость';

    return {
      title,
      date,
      image_link: imageUrl,
      origin_link: item.url,
      text,
      author
    };
  }
}
