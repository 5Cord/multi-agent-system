// Внутренняя модель поста (хранится в БД)
export interface IPost {
  id: number;
  title: string;
  date: string;        // ISO 8601
  image_link: string;
  origin_link: string;
  text: string;
  author: string;
}

// То, что фронтенд ждёт от GET /posts?page=N
export interface IPostsListResponse {
  data: IPostsListItem[];
  totalPages: number;
}

export interface IPostsListItem {
  id: number;
  title: string;
  date: string;
  image_link: string;
  origin_link: string;
}

// Сырые данные от скрапера до записи в БД (без id)
export type IRawScrapedPost = Omit<IPost, 'id'>;
