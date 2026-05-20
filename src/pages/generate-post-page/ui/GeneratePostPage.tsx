import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import classNames from 'classnames';

import { Button } from '@consta/uikit/Button';
import { Checkbox } from '@consta/uikit/Checkbox';
import { Layout } from '@consta/uikit/Layout';
import { Text } from '@consta/uikit/Text';
import { TextField } from '@consta/uikit/TextField';
import { Select } from '@consta/uikit/Select';
import { SkeletonBrick, SkeletonText } from '@consta/uikit/Skeleton';

import { IconDownload } from '@consta/icons/IconDownload';
import { IconPicture } from '@consta/icons/IconPicture';
import { IconRevert } from '@consta/icons/IconRevert';

import { BackendGenerationService } from 'services/GigaChatService';

import { CustomError } from 'features';
import { getPromptFromArticle } from 'shared';
import { ErrorType, IStyleItem } from 'shared';
import { IMAGE_STYLES, IPlatformItem, PLATFORM_ITEMS } from 'shared';

import { MIN_PROMPT_LENGTH } from '../model/constants';
import { getImageByStyleId, checkIsValidPrompt } from '../model/helpers';

import styles from './GeneratePostPage.module.scss';

// TODO: Разнести код по компонентам (backlog)
export const GeneratePostPage = () => {
  const location = useLocation();

  const [imageStyle, setImageStyle] = useState<IStyleItem | null>(IMAGE_STYLES[0]);
  const [imageNegativePrompt, seImagetNegativePrompt] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState<string | null>(null);

  const [platform, setPlatform] = useState<IPlatformItem>(PLATFORM_ITEMS[0]);
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(true);

  const [isImagePromptAlert, setIsImagePromptAlert] = useState(false);
  const [isTextPromptAlert, setIsTextPromptAlert] = useState(false);

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isTextLoading, setIsTextLoading] = useState(false);

  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [generatedText, setGeneratedText] = useState('');

  const [error, setError] = useState<ErrorType | null>(null);

  useEffect(() => {
    const title = location.state?.title;
    const article = location.state?.article;

    if (title && article) {
      const customImagePrompt = getPromptFromArticle('image', title, article);
      const customTextPrompt = getPromptFromArticle('text', title, article);

      setImagePrompt(customImagePrompt);
      setTextPrompt(customTextPrompt);
    }
  }, [location.state]);

  // Functions to change state

  const handleImageStyleChange = (value: IStyleItem | null) => {
    setImageStyle(value);
  };

  const handleImageNegativePromptChange = (value: string | null) => {
    seImagetNegativePrompt(value);
  };

  const handleImagePromptChange = (value: string | null) => {
    setImagePrompt(value);
  };

  const handleTextPromptChange = (value: string | null) => {
    setTextPrompt(value);
  };

  const buildFinalTextPrompt = (rawPrompt: string): string => {
    return [
      rawPrompt,
      platform.promptInstruction,
      useEmojis
        ? 'Обязательно используй смайлики и эмодзи.'
        : 'Не используй смайлики и эмодзи.',
      useHashtags
        ? 'В конце обязательно добавь подходящие хэштеги.'
        : 'Не добавляй хэштеги.',
    ].join(' ');
  };

  const handleTextGeneration = async () => {
    if (textPrompt && textPrompt.length >= MIN_PROMPT_LENGTH) {
      setGeneratedText('');
      setError(null);
      setIsTextLoading(true);
      setIsTextPromptAlert(false);

      try {
        const result = await generateTextWithFallback(buildFinalTextPrompt(textPrompt));
        if (result) setGeneratedText(result);
      } catch (err) {
        console.error('[Text] Ошибка генерации:', err);
        setError('generation-error');
      } finally {
        setIsTextLoading(false);
      }
    } else {
      setIsTextPromptAlert(true);
    }
  };

  const handleImageGeneration = async () => {
    if (!checkIsValidPrompt(imagePrompt)) {
      setIsImagePromptAlert(true);
      return;
    }

    resetGenerationState();

    try {
      await generateImageWithFallback();
    } catch (err) {
      console.error('[Image] Ошибка генерации:', err);
      setError('generation-error');
    } finally {
      setIsImageLoading(false);
    }
  };

  const resetGenerationState = () => {
    setGeneratedImageUrl('');
    setIsImageLoading(true);
    setIsImagePromptAlert(false);
    setError(null);
  };

  const backendService = useRef(new BackendGenerationService()).current;

  const generateImageWithFallback = async () => {
    const imageBase64 = await backendService.generateImage(imagePrompt!, imageNegativePrompt, imageStyle?.id);
    if (imageBase64) setGeneratedImageUrl(imageBase64);
  };

  const generateTextWithFallback = async (prompt: string): Promise<string | null> => {
    return backendService.generateText(prompt);
  };

  const handleDownload = (base64Image: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(14, Math.round(img.width / 38));
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Контент сгенерирован с помощью ИИ', img.width - 14, img.height - 12);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'generated.png';
      link.click();
    };
    img.src = base64Image;
  };

  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  const handleRatingSubmit = async (star: number) => {
    setRating(star);
    setIsRatingSubmitted(true);
    try {
      await backendService.submitFeedback({
        rating: star,
        textPrompt: textPrompt ?? '',
        imagePrompt: imagePrompt ?? '',
        generatedText
      });
    } catch (err) {
      console.error('[Feedback] Ошибка отправки оценки:', err);
    }
  };

  const isContentGenerated = generatedText && generatedImageUrl;

  const showGenerationBlock = isTextLoading || isImageLoading || generatedText || generatedImageUrl || error;
  const showGenerationContent = showGenerationBlock && !error;

  const regenerateButton = (
    <Button
      className={classNames(styles.button, styles.button_wide)}
      label="Перегенерировать пост"
      iconLeft={IconRevert}
      disabled={isTextLoading || isImageLoading}
      onClick={() => {
        handleTextGeneration();
        handleImageGeneration();
      }}
    />
  );

  return (
    <Layout className={classNames('container', 'containerBlock', styles.topWrapper)}>
      <Layout direction="column" className={styles.wrapper}>
        <Text view="brand" size="2xl" weight="bold" lineHeight="xs" className={styles.title}>
          Генерация поста с помощью ИИ
        </Text>

        <Layout direction="column" className={styles.settings}>
          <Layout className={styles.imageSettings}>
            <Layout direction="column" className={styles.imageSettings__inputs}>
              <Select
                label="Стиль изображения"
                items={IMAGE_STYLES}
                value={imageStyle}
                onChange={handleImageStyleChange}
                className={styles.input}
              />

              <TextField
                label="Негативный промпт"
                placeholder="Чего нужно избегать при генерации"
                caption="Пример: яркие цвета, кислотность"
                maxLength={50}
                value={imageNegativePrompt}
                onChange={handleImageNegativePromptChange}
                className={styles.input}
              />

              <Select<IPlatformItem>
                label="Площадка публикации"
                items={PLATFORM_ITEMS}
                value={platform}
                onChange={(value) => value && setPlatform(value)}
                getItemLabel={(item) => item.label}
                getItemKey={(item) => item.id}
                className={styles.input}
              />

              <Layout className={styles.imageSettings__checkboxes}>
                <Checkbox
                  label="Использовать эмодзи"
                  checked={useEmojis}
                  onChange={() => setUseEmojis((v) => !v)}
                />
                <Checkbox
                  label="Использовать хэштеги"
                  checked={useHashtags}
                  onChange={() => setUseHashtags((v) => !v)}
                />
              </Layout>
            </Layout>

            <Layout direction="column" className={styles.imageSettings__preview}>
              <Text view="secondary" size="m" lineHeight="xs">
                Пример изображения
              </Text>

              {imageStyle && <img src={getImageByStyleId(imageStyle.id)} alt="Пример для демонстрации стиля" />}
            </Layout>
          </Layout>

          <Layout className={styles.textFieldSettings}>
            <TextField
              label="Промпт для изображения"
              placeholder="Подробное описание изображения"
              type="textarea"
              cols={900}
              rows={10}
              value={imagePrompt}
              onChange={handleImagePromptChange}
              status={isImagePromptAlert ? 'alert' : undefined}
              caption={isImagePromptAlert ? `Промпт должен содержать не менее ${MIN_PROMPT_LENGTH} символов` : ''}
            />

            <TextField
              label="Промпт для текста"
              placeholder="Подробное описание текста"
              type="textarea"
              cols={4500}
              rows={10}
              value={textPrompt}
              onChange={handleTextPromptChange}
              status={isTextPromptAlert ? 'alert' : undefined}
              caption={isTextPromptAlert ? `Промпт должен содержать не менее ${MIN_PROMPT_LENGTH} символов` : ''}
            />
          </Layout>
        </Layout>

        {!showGenerationBlock && (
          <Button
            className={classNames(styles.button, styles.button_centered)}
            label="Сгенерировать пост"
            iconLeft={IconPicture}
            disabled={isTextLoading || isImageLoading}
            onClick={() => {
              handleTextGeneration();
              handleImageGeneration();
            }}
          />
        )}

        {showGenerationBlock && (
          <>
            <Text view="brand" size="xl" weight="bold" lineHeight="xs">
              Результаты генерации
            </Text>

            <Layout className={styles.generation}>
              {error && <CustomError errorType={error} customButton={regenerateButton} />}

              {showGenerationContent && (
                <>
                  {generatedImageUrl && (
                    <div className={styles.generation__imageWrapper}>
                      <img
                        className={styles.generation__image}
                        src={generatedImageUrl}
                        alt="Сгенерированная иллюстрация для поста"
                      />
                      <span className={styles.generation__watermark}>
                        Контент сгенерирован с помощью ИИ
                      </span>
                    </div>
                  )}
                  {isImageLoading && !generatedImageUrl && (
                    <div className={styles.generation__imageWrapper}>
                      <SkeletonBrick height="100%" width="100%" />
                    </div>
                  )}

                  <Layout direction="column" className={styles.generation__side}>
                    {isContentGenerated && (
                      <>
                        <Layout className={styles.generation__buttons}>
                          <Button
                            className={classNames(styles.button, styles.button_wide)}
                            label="Перегенерировать пост"
                            iconLeft={IconRevert}
                            disabled={isTextLoading || isImageLoading}
                            onClick={() => {
                              setRating(null);
                              setIsRatingSubmitted(false);
                              handleTextGeneration();
                              handleImageGeneration();
                            }}
                          />

                          <Button
                            className={classNames(styles.button, styles.button_wide)}
                            label="Скачать картинку"
                            iconLeft={IconDownload}
                            onClick={() => {
                              handleDownload(generatedImageUrl);
                            }}
                          />
                        </Layout>

                        <Layout direction="column" className={styles.rating}>
                          <Text size="l" weight="semibold">
                            Оцените качество сгенерированного контента
                          </Text>
                          <Layout className={styles.rating__stars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                className={classNames(styles.rating__star, {
                                  [styles.rating__star_active]: star <= (hoverRating ?? rating ?? 0)
                                })}
                                disabled={isRatingSubmitted}
                                onClick={() => handleRatingSubmit(star)}
                                onMouseEnter={() => !isRatingSubmitted && setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(null)}
                                aria-label={`Оценить на ${star} из 5`}
                              >
                                ★
                              </button>
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

                    {generatedText && (
                      <>
                        <Text className={styles.generation__text} size="l">
                          {generatedText}
                        </Text>

                        <Text view="alert" size="m">
                          Не забудьте упомянуть, что контент сгенерирован с помощью ИИ!
                        </Text>
                      </>
                    )}
                    {isTextLoading && !generatedText && <SkeletonText rows={5} fontSize="xl" lineHeight="xs" />}
                  </Layout>
                </>
              )}
            </Layout>
          </>
        )}
      </Layout>
    </Layout>
  );
};
