import { IRawPostsListData, IRawPostsListItemData, IRawSinglePostData } from 'shared';
import { IPostsListData, IPostListItemData, ISinglePostData } from 'shared';

import { REQUEST_TIMEOUT } from 'shared';

export class PostsService {
  private _apiBaseUrl: string;
  private _fetchOptions: RequestInit;
  private _timeout: number;

  private _apiRootUrl: string;

  constructor() {
    this._apiRootUrl = import.meta.env.VITE_POSTS_API_URL ?? 'https://devweek-2025.ru';
    this._apiBaseUrl = this._apiRootUrl + '/posts';
    this._fetchOptions = {
      method: 'GET'
    };
    this._timeout = REQUEST_TIMEOUT;
  }

  getResource = async (url: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._timeout);

    try {
      const response = await fetch(url, {
        ...this._fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Could not fetch ${url}, status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout exceeded ${this._timeout}ms`);
        }

        throw new Error(`Could not fetch ${url}, error: ${error.message}`);
      }

      throw new Error(`Unknown error occurred while fetching ${url}`);
    }
  };

  getPosts = async (page: number): Promise<IPostsListData> => {
    const raw: IRawPostsListData = await this.getResource(`${this._apiBaseUrl}?page=${page}`);

    const transformed = this._transformPostsData(raw.data);

    return {
      data: transformed,
      totalPages: raw.totalPages
    };
  };

  getPostById = async (postId: number): Promise<ISinglePostData> => {
    const raw: IRawSinglePostData = await this.getResource(`${this._apiBaseUrl}/${postId}`);

    const transformed = this._transformSinglePostData(raw);

    return transformed;
  };

  triggerScrape = async (): Promise<{ newPosts: number; cached: boolean; nextAllowedIn: number }> => {
    const response = await fetch(`${this._apiRootUrl}/api/scrape`, {
      method: 'POST',
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      throw new Error(`Scrape failed: ${response.status}`);
    }

    const data = await response.json() as {
      success: boolean;
      newPosts?: number;
      cached?: boolean;
      nextAllowedIn?: number;
      error?: string;
    };

    if (!data.success) {
      throw new Error(data.error ?? 'Неизвестная ошибка парсинга');
    }

    return {
      newPosts: data.newPosts ?? 0,
      cached: data.cached ?? false,
      nextAllowedIn: data.nextAllowedIn ?? 0,
    };
  };

  _transformPostsData = (rawPostsData: IRawPostsListItemData[]): IPostListItemData[] => {
    return rawPostsData.map((rawData) => {
      return {
        id: rawData.id,
        title: rawData.title,
        date: new Date(rawData.date),
        previewImageUrl: rawData.image_link,
        originLink: rawData.origin_link
      };
    });
  };

  _extractAuthorText = (raw: string, fallback: string): string => {
    if (!raw || raw === 'unknown') return fallback;
    // Strip HTML tags — keep text nodes only, ignore attributes (including alt)
    const stripped = raw.replace(/<[^>]*>/g, '').trim();
    return stripped || fallback;
  };

  _transformSinglePostData = (rawSinglePostData: IRawSinglePostData): ISinglePostData => {
    return {
      id: rawSinglePostData.id,
      title: rawSinglePostData.title,
      date: new Date(rawSinglePostData.date),
      description: rawSinglePostData.text,
      previewImageUrl: rawSinglePostData.image_link,
      sourceUrl: rawSinglePostData.origin_link,
      source: this._extractAuthorText(rawSinglePostData.author, rawSinglePostData.origin_link),
      tag: 'Аналитика' // TODO: Получить с сервера актуальные, сейчас хардкод
    };
  };
}
