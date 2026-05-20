import { Router, Request, Response } from 'express';
import { saveFeedback, getFeedback } from '../db/database';

export const feedbackRouter = Router();

// POST /api/feedback
// Body: { rating: number, textPrompt: string, imagePrompt: string, generatedText: string, model?: string }
feedbackRouter.post('/', async (req: Request, res: Response) => {
  const { rating, textPrompt, imagePrompt, generatedText, model } = req.body as {
    rating?: number;
    textPrompt?: string;
    imagePrompt?: string;
    generatedText?: string;
    model?: string;
  };

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.json({ success: false, error: 'rating must be a number between 1 and 5' });
    return;
  }

  if (!generatedText?.trim()) {
    res.json({ success: false, error: 'generatedText is required' });
    return;
  }

  try {
    await saveFeedback({
      rating,
      textPrompt: textPrompt?.trim() ?? '',
      imagePrompt: imagePrompt?.trim() ?? '',
      generatedText: generatedText.trim(),
      model: model ?? null
    });

    console.log(`[Feedback] Оценка ${rating}/5 сохранена`);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Feedback] Ошибка сохранения:', msg);
    res.json({ success: false, error: msg });
  }
});

// GET /api/feedback — для будущего экспорта датасета
feedbackRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const records = await getFeedback();
    res.json({ success: true, data: records, total: records.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, error: msg });
  }
});
