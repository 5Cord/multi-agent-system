import { describe, it, expect } from 'vitest';
import { getPromptFromArticle, getSafePrompt, getSummaryPrompt } from '../promptUtils';
import { MAX_PROMPT_LENGTH } from 'shared';

// ─── getPromptFromArticle ─────────────────────────────────────────────────────

describe('getPromptFromArticle', () => {
  describe('корректность формирования', () => {
    it('включает заголовок в промпт', () => {
      const result = getPromptFromArticle('text', 'Уникальный заголовок', 'Текст');
      expect(result).toContain('Уникальный заголовок');
    });

    it('включает текст статьи в промпт', () => {
      const result = getPromptFromArticle('text', 'Заг', 'Уникальный текст статьи');
      expect(result).toContain('Уникальный текст статьи');
    });

    it('работает для типа image', () => {
      const result = getPromptFromArticle('image', 'Заг', 'Текст');
      expect(result).toContain('Заг');
      expect(result).toContain('Текст');
    });
  });

  describe(`лимит длины — text (≤ ${MAX_PROMPT_LENGTH.text} символов)`, () => {
    it('короткий промпт не обрезается', () => {
      const result = getPromptFromArticle('text', 'Заголовок', 'Короткий текст');
      expect(result.length).toBeLessThan(MAX_PROMPT_LENGTH.text);
      expect(result.endsWith('...')).toBe(false);
    });

    it('длинный промпт обрезается ровно до MAX_PROMPT_LENGTH.text', () => {
      const result = getPromptFromArticle('text', 'Заг', 'а'.repeat(5000));
      expect(result.length).toBe(MAX_PROMPT_LENGTH.text);
    });

    it('обрезанный промпт заканчивается на "..."', () => {
      const result = getPromptFromArticle('text', 'Заг', 'а'.repeat(5000));
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe(`лимит длины — image (≤ ${MAX_PROMPT_LENGTH.image} символов)`, () => {
    it('длинный промпт обрезается до MAX_PROMPT_LENGTH.image', () => {
      const result = getPromptFromArticle('image', 'Заг', 'б'.repeat(1000));
      expect(result.length).toBe(MAX_PROMPT_LENGTH.image);
      expect(result.endsWith('...')).toBe(true);
    });

    it('промпт для image короче лимита не обрезается', () => {
      const result = getPromptFromArticle('image', 'А', 'Б');
      expect(result.length).toBeLessThan(MAX_PROMPT_LENGTH.image);
      expect(result.endsWith('...')).toBe(false);
    });
  });
});

// ─── getSafePrompt ────────────────────────────────────────────────────────────

describe('getSafePrompt', () => {
  describe('защита от Markdown-разметки', () => {
    it('добавляет инструкцию при длине промпта ровно 100 символов', () => {
      const result = getSafePrompt('text', 'а'.repeat(100));
      expect(result).toContain('Не используй языки разметки');
    });

    it('добавляет инструкцию при длине промпта > 100 символов', () => {
      const result = getSafePrompt('text', 'а'.repeat(200));
      expect(result).toContain('Не используй языки разметки');
    });

    it('НЕ добавляет инструкцию при длине промпта < 100 символов', () => {
      const result = getSafePrompt('text', 'а'.repeat(99));
      expect(result).not.toContain('Не используй языки разметки');
    });
  });

  describe('инжекция стиля изображения', () => {
    it.each([
      ['REALISTIC', 'Реалистичный'],
      ['ANIME', 'Аниме стиль'],
      ['KANDINSKY', 'Абстрактный стиль'],
      ['DEFAULT', 'Стандартный стиль'],
    ] as const)('стиль %s добавляет метку "%s" в начало промпта', (styleId, label) => {
      const result = getSafePrompt('image', 'промпт', styleId);
      expect(result).toContain(label);
      expect(result.indexOf(label)).toBeLessThan(result.indexOf('промпт'));
    });

    it('без стиля промпт не изменяется', () => {
      const prompt = 'промпт без стиля';
      expect(getSafePrompt('image', prompt)).toBe(prompt);
    });

    it('несуществующий стиль даёт метку "Стандартный стиль"', () => {
      const result = getSafePrompt('image', 'промпт', 'UNKNOWN' as any);
      expect(result).toContain('Стандартный стиль');
    });
  });

  describe('соблюдение лимита длины после добавления инструкций', () => {
    it('text: не превышает MAX_PROMPT_LENGTH.text даже с добавленной инструкцией', () => {
      const result = getSafePrompt('text', 'а'.repeat(5000));
      expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH.text);
    });

    it('image: не превышает MAX_PROMPT_LENGTH.image даже с добавленным стилем', () => {
      const result = getSafePrompt('image', 'а'.repeat(900), 'REALISTIC');
      expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH.image);
    });
  });
});

// ─── getSummaryPrompt ─────────────────────────────────────────────────────────

describe('getSummaryPrompt', () => {
  it('включает заголовок в промпт', () => {
    const result = getSummaryPrompt('Уникальный заголовок', 'Текст');
    expect(result).toContain('Уникальный заголовок');
  });

  it('включает текст статьи в промпт', () => {
    const result = getSummaryPrompt('Заг', 'Уникальный текст');
    expect(result).toContain('Уникальный текст');
  });

  it(`длина не превышает ${MAX_PROMPT_LENGTH.summary} символов`, () => {
    const result = getSummaryPrompt('Заголовок', 'а'.repeat(4000));
    expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH.summary);
  });

  it('обрезанный промпт заканчивается на "..."', () => {
    const result = getSummaryPrompt('Заголовок', 'а'.repeat(4000));
    expect(result.endsWith('...')).toBe(true);
  });

  it('короткий промпт не обрезается', () => {
    const result = getSummaryPrompt('Заголовок', 'Краткий текст');
    expect(result.endsWith('...')).toBe(false);
  });
});
