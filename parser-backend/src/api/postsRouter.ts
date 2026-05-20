import { Router, Request, Response } from 'express';
import { getPosts, getPostById } from '../db/database';

export const postsRouter = Router();

// GET /posts?page=1
postsRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
  const result = await getPosts(page);
  res.json(result);
});

// GET /posts/:id
postsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const post = await getPostById(id);

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json(post);
});
