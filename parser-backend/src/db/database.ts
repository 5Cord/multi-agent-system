import { PrismaClient } from '@prisma/client';
import { IPost, IRawScrapedPost } from '../types';

const POSTS_PER_PAGE = 12;

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export interface IFeedbackRecord {
  rating: number;
  textPrompt: string;
  imagePrompt: string;
  generatedText: string;
  model: string | null;
  createdAt: string;
}

export async function insertPosts(posts: IRawScrapedPost[]): Promise<number> {
  const result = await prisma.post.createMany({
    data: posts.map((p) => ({
      title: p.title,
      date: p.date,
      image_link: p.image_link,
      origin_link: p.origin_link,
      text: p.text,
      author: p.author,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function getPosts(
  page: number
): Promise<{ data: IPost[]; totalPages: number }> {
  const offset = (page - 1) * POSTS_PER_PAGE;

  const [docs, total] = await Promise.all([
    prisma.post.findMany({
      orderBy: { date: 'desc' },
      skip: offset,
      take: POSTS_PER_PAGE,
      select: {
        id: true,
        title: true,
        date: true,
        image_link: true,
        origin_link: true,
        text: true,
        author: true,
      },
    }),
    prisma.post.count(),
  ]);

  return {
    data: docs,
    totalPages: Math.ceil(total / POSTS_PER_PAGE),
  };
}

export async function getPostById(id: number): Promise<IPost | null> {
  const doc = await prisma.post.findUnique({ where: { id } });
  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    date: doc.date,
    image_link: doc.image_link,
    origin_link: doc.origin_link,
    text: doc.text,
    author: doc.author,
  };
}

export async function getPostsCount(): Promise<number> {
  return prisma.post.count();
}

export async function saveFeedback(record: Omit<IFeedbackRecord, 'createdAt'>): Promise<void> {
  await prisma.feedback.create({
    data: {
      rating: record.rating,
      text_prompt: record.textPrompt,
      image_prompt: record.imagePrompt,
      generated_text: record.generatedText,
      model: record.model,
    },
  });
}

export async function getFeedback(): Promise<IFeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    orderBy: { created_at: 'desc' },
  });

  return rows.map((r) => ({
    rating: r.rating,
    textPrompt: r.text_prompt,
    imagePrompt: r.image_prompt,
    generatedText: r.generated_text,
    model: r.model,
    createdAt: r.created_at.toISOString(),
  }));
}
