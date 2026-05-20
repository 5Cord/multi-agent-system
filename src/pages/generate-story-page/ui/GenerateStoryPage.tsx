import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { toPng } from 'html-to-image';

import { Button } from '@consta/uikit/Button';
import { Layout } from '@consta/uikit/Layout';
import { Text } from '@consta/uikit/Text';
import { TextField } from '@consta/uikit/TextField';
import { Select } from '@consta/uikit/Select';
import { Slider } from '@consta/uikit/Slider';
import { Switch } from '@consta/uikit/Switch';
import { SkeletonBrick } from '@consta/uikit/Skeleton';

import { IconDownload } from '@consta/icons/IconDownload';
import { IconRevert } from '@consta/icons/IconRevert';
import { IconPhoto } from '@consta/icons/IconPhoto';

import { BackendGenerationService } from 'services/GigaChatService';
import { CustomError } from 'features';
import { IMAGE_STYLES, IStyleItem, ErrorType, getPromptFromArticle } from 'shared';

import { StoryCanvas, StoryStyle, Position } from './StoryCanvas';
import styles from './GenerateStoryPage.module.scss';

// ── Промпты ────────────────────────────────────────────────────

const THESES_PROMPT = (topic: string) =>
  `Ты помогаешь риелтору создавать истории для социальных сетей. Создай ровно 5 коротких тезисов по теме: "${topic}".
Требования:
- Каждый тезис — максимум 10 слов
- Каждый тезис на отдельной строке
- Без нумерации, без маркеров, без символа «•»
- Только сами тезисы, никаких вступлений и пояснений`;

const THESES_FROM_ARTICLE_PROMPT = (title: string, article: string) =>
  `Ты помогаешь риелтору создавать истории для социальных сетей. На основе статьи ниже создай ровно 5 коротких тезисов — ключевых фактов или выводов из статьи.
Требования:
- Каждый тезис — максимум 10 слов
- Каждый тезис на отдельной строке
- Без нумерации, без маркеров, без символа «•»
- Только сами тезисы, никаких вступлений и пояснений
- Тезисы должны быть основаны на реальном содержании статьи

Название: ${title}
Статья: ${article.slice(0, 2000)}`;

const parseTheses = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.replace(/^[\d\.\-\•\*\s]+/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 7);

// ── Константы ──────────────────────────────────────────────────

const PLATE_COLORS = [
  { hex: '#000000', label: 'Чёрный' },
  { hex: '#1a1a2e', label: 'Тёмно-синий' },
  { hex: '#ffffff', label: 'Белый' },
  { hex: '#f5a623', label: 'Акцент' },
  { hex: '#0076eb', label: 'Синий' },
  { hex: '#22c55e', label: 'Зелёный' },
];

const DEFAULT_STORY_STYLE: StoryStyle = {
  overlayOpacity: 65,
  showPlate: false,
  plateColor: '#000000',
  plateOpacity: 55,
  plateRadius: 8,
};

const getDefaultPositions = (count: number): Position[] =>
  Array.from({ length: count }, (_, i) => ({ xPct: 5, yPct: 55 + i * 9 }));

// ── Компонент ──────────────────────────────────────────────────

export const GenerateStoryPage = () => {
  const backendService = useRef(new BackendGenerationService()).current;
  const canvasRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const [topic, setTopic] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<IStyleItem | null>(IMAGE_STYLES[0]);
  const [sourceArticle, setSourceArticle] = useState<{ title: string; article: string } | null>(null);

  useEffect(() => {
    const title = location.state?.title as string | undefined;
    const article = location.state?.article as string | undefined;
    if (title && article) {
      setTopic(title);
      setSourceArticle({ title, article });
      setImagePrompt(getPromptFromArticle('image', title, article));
    }
  }, [location.state]);

  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [theses, setTheses] = useState<string[]>([]);

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isThesesLoading, setIsThesesLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<ErrorType | null>(null);

  const [storyStyle, setStoryStyle] = useState<StoryStyle>(DEFAULT_STORY_STYLE);
  const [positions, setPositions] = useState<Position[]>([]);

  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  const isLoading = isImageLoading || isThesesLoading;
  const hasResult = generatedImageUrl || theses.length > 0;

  const patchStyle = (patch: Partial<StoryStyle>) =>
    setStoryStyle((prev) => ({ ...prev, ...patch }));

  const getEffectiveImagePrompt = () => {
    if (imagePrompt?.trim()) return imagePrompt.trim();
    if (topic?.trim())
      return `Недвижимость, риелтор: ${topic.trim()}. Профессиональное фото, современный интерьер или городской пейзаж.`;
    return null;
  };

  const handleGenerate = async () => {
    const effectiveImagePrompt = getEffectiveImagePrompt();
    if (!effectiveImagePrompt || !topic?.trim()) return;

    setError(null);
    setGeneratedImageUrl('');
    setTheses([]);
    setPositions([]);
    setRating(null);
    setIsRatingSubmitted(false);
    setIsImageLoading(true);
    setIsThesesLoading(true);

    const thesesPrompt = sourceArticle
      ? THESES_FROM_ARTICLE_PROMPT(sourceArticle.title, sourceArticle.article)
      : THESES_PROMPT(topic.trim());

    const [imageResult, thesesResult] = await Promise.allSettled([
      backendService.generateImage(effectiveImagePrompt, null, imageStyle?.id),
      backendService.generateText(thesesPrompt),
    ]);

    if (imageResult.status === 'fulfilled' && imageResult.value) {
      setGeneratedImageUrl(imageResult.value);
    } else {
      setError('generation-error');
    }
    setIsImageLoading(false);

    if (thesesResult.status === 'fulfilled' && thesesResult.value) {
      const parsed = parseTheses(thesesResult.value);
      setTheses(parsed);
      setPositions(getDefaultPositions(parsed.length));
    }
    setIsThesesLoading(false);
  };

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setEditingIndex(null);
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 80));
    try {
      const dataUrl = await toPng(canvasRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'story.png';
      link.click();
    } catch (err) {
      console.error('[Story] Ошибка экспорта:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRatingSubmit = async (star: number) => {
    setRating(star);
    setIsRatingSubmitted(true);
    try {
      await backendService.submitFeedback({
        rating: star,
        textPrompt: THESES_PROMPT(topic ?? ''),
        imagePrompt: getEffectiveImagePrompt() ?? '',
        generatedText: theses.join('\n'),
      });
    } catch (err) {
      console.error('[Feedback] Ошибка отправки оценки:', err);
    }
  };

  return (
    <Layout className={classNames('container', 'containerBlock', styles.wrapper)} direction="column">
      <Text view="brand" size="2xl" weight="bold" lineHeight="xs" className={styles.title}>
        Генерация историй для соцсетей
      </Text>
      <Text view="secondary" size="m" className={styles.subtitle}>
        Создайте историю с фоном и тезисами — отредактируйте текст и сохраните как картинку
      </Text>

      {sourceArticle && (
        <Layout className={styles.articleBadge}>
          <Text size="s" view="brand" weight="semibold">Заготовки из статьи:</Text>
          <Text size="s" view="secondary">{sourceArticle.title}</Text>
          <button
            className={styles.articleBadge__clear}
            onClick={() => { setSourceArticle(null); setTopic(null); setImagePrompt(null); }}
          >✕</button>
        </Layout>
      )}

      <Layout direction="column" className={styles.settings}>
        <Layout className={styles.promptRow}>
          <TextField
            label="Тема истории"
            placeholder="Например: новостройки у метро, ипотека 2024, советы покупателям"
            value={topic}
            onChange={(val) => {
              setTopic(val);
              if (sourceArticle && val !== sourceArticle.title) setSourceArticle(null);
            }}
            style={{ flex: 1 }}
          />
          <Select
            label="Стиль изображения"
            items={IMAGE_STYLES}
            value={imageStyle}
            onChange={setImageStyle}
            style={{ width: 220 }}
          />
        </Layout>
        <TextField
          label="Промпт для изображения (необязательно)"
          placeholder="Оставьте пустым — промпт сгенерируется автоматически из темы"
          value={imagePrompt}
          onChange={setImagePrompt}
        />
      </Layout>

      <Layout className={styles.actions}>
        <Button
          className={styles.button}
          label={hasResult ? 'Перегенерировать' : 'Сгенерировать историю'}
          iconLeft={hasResult ? IconRevert : IconPhoto}
          disabled={isLoading || !topic?.trim()}
          loading={isLoading}
          onClick={handleGenerate}
        />
      </Layout>

      {error && !isLoading && <CustomError errorType={error} />}

      {(isLoading || hasResult) && !error && (
        <Layout className={styles.result}>
          {isImageLoading ? (
            <SkeletonBrick width={405} height={720} style={{ borderRadius: 16, flexShrink: 0 }} />
          ) : (
            <StoryCanvas
              ref={canvasRef}
              imageUrl={generatedImageUrl}
              theses={theses}
              editingIndex={editingIndex}
              storyStyle={storyStyle}
              positions={positions}
              onPositionsChange={setPositions}
              isExporting={isExporting}
              onThesisClick={setEditingIndex}
              onThesisChange={(i, val) =>
                setTheses((prev) => prev.map((t, idx) => (idx === i ? val : t)))
              }
              onThesisBlur={() => setEditingIndex(null)}
              onThesisRemove={(i) => {
                setTheses((prev) => prev.filter((_, idx) => idx !== i));
                setPositions((prev) => prev.filter((_, idx) => idx !== i));
              }}
              onAddThesis={() => {
                setTheses((prev) => [...prev, 'Новый тезис']);
                setPositions((prev) => [...prev, { xPct: 5, yPct: 68 }]);
              }}
            />
          )}

          <Layout direction="column" className={styles.side}>
            {!isLoading && hasResult && (
              <>
                {/* ── Панель оформления ── */}
                <Layout direction="column" className={styles.panel}>
                  <Text size="m" weight="semibold">Оформление</Text>

                  {/* Затемнение фона */}
                  <Layout direction="column" className={styles.control}>
                    <Layout className={styles.control__header}>
                      <Text size="xs" view="secondary">Затемнение фона</Text>
                      <Text size="xs" view="secondary">{storyStyle.overlayOpacity}%</Text>
                    </Layout>
                    <Slider
                      min={0} max={100} step={5}
                      value={storyStyle.overlayOpacity}
                      onChange={(value) => patchStyle({ overlayOpacity: value as number })}
                    />
                  </Layout>

                  {/* Плашки */}
                  <Layout direction="column" className={styles.control}>
                    <Switch
                      label="Плашки под тезисы"
                      checked={storyStyle.showPlate}
                      onChange={(e) => patchStyle({ showPlate: e.target.checked })}
                    />

                    {storyStyle.showPlate && (
                      <Layout direction="column" className={styles.plateControls}>
                        {/* Цвет */}
                        <Text size="xs" view="secondary">Цвет плашки</Text>
                        <Layout className={styles.colorPicker}>
                          {PLATE_COLORS.map(({ hex, label }) => (
                            <button
                              key={hex}
                              className={classNames(styles.colorSwatch, {
                                [styles.colorSwatch_active]: storyStyle.plateColor === hex,
                              })}
                              style={{ background: hex }}
                              title={label}
                              onClick={() => patchStyle({ plateColor: hex })}
                            />
                          ))}
                        </Layout>

                        {/* Прозрачность */}
                        <Layout className={styles.control__header}>
                          <Text size="xs" view="secondary">Прозрачность</Text>
                          <Text size="xs" view="secondary">{storyStyle.plateOpacity}%</Text>
                        </Layout>
                        <Slider
                          min={5} max={100} step={5}
                          value={storyStyle.plateOpacity}
                          onChange={(value) => patchStyle({ plateOpacity: value as number })}
                        />

                        {/* Скругление */}
                        <Layout className={styles.control__header}>
                          <Text size="xs" view="secondary">Скругление углов</Text>
                          <Text size="xs" view="secondary">{storyStyle.plateRadius} px</Text>
                        </Layout>
                        <Slider
                          min={0} max={32} step={2}
                          value={storyStyle.plateRadius}
                          onChange={(value) => patchStyle({ plateRadius: value as number })}
                        />
                      </Layout>
                    )}
                  </Layout>
                </Layout>

                {/* ── Подсказка ── */}
                <Layout direction="column" className={styles.hint}>
                  <Text size="s" view="secondary">
                    Кликните на тезис — чтобы отредактировать. Enter или клик вне поля — сохранить.
                  </Text>
                </Layout>

                {/* ── Экспорт ── */}
                <Button
                  className={styles.exportButton}
                  label="Сохранить историю как картинку"
                  iconLeft={IconDownload}
                  loading={isExporting}
                  disabled={!generatedImageUrl || isExporting}
                  onClick={handleExport}
                />

                {/* ── Рейтинг ── */}
                <Layout direction="column" className={styles.rating}>
                  <Text size="l" weight="semibold">Оцените качество истории</Text>
                  <Layout className={styles.rating__stars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        className={classNames(styles.rating__star, {
                          [styles.rating__star_active]: star <= (hoverRating ?? rating ?? 0),
                        })}
                        disabled={isRatingSubmitted}
                        onClick={() => handleRatingSubmit(star)}
                        onMouseEnter={() => !isRatingSubmitted && setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        aria-label={`Оценить на ${star} из 5`}
                      >★</button>
                    ))}
                  </Layout>
                  {isRatingSubmitted && rating !== null && (
                    <Text view="success" size="m">
                      Спасибо! Оценка {rating}/5 отправлена — это поможет улучшить модели.
                    </Text>
                  )}
                </Layout>
              </>
            )}
          </Layout>
        </Layout>
      )}
    </Layout>
  );
};
