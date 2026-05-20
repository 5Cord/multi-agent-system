import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Grid, GridItem } from '@consta/uikit/Grid';
import { Layout } from '@consta/uikit/Layout';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { IconArrowRedone } from '@consta/icons/IconArrowRedone';

import { CustomPagination } from './CustomPagination';

import { generatePostListsData } from 'shared';

import { PostsService } from 'services/PostsService';

import { PostsListItem, CustomLoader, CustomError } from 'features';
import { IPostListItemData, ErrorType } from 'shared';

import styles from './PostsList.module.scss';

export const PostsList = () => {
  const [listData, setListData] = useState<IPostListItemData[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  const postsService = useRef(new PostsService()).current;

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'up-to-date' | 'updated' | 'cached'>('idle');
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [nextAllowedIn, setNextAllowedIn] = useState(0);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsDataLoading(true);
      setError(null);
      setErrorMessage(null);

      let apiError: Error | null = null;

      // Try to get posts data from real API
      try {
        const { data, totalPages } = await postsService.getPosts(page);

        setListData(data);
        setTotalPages(totalPages);
        setUsingMockData(false);

        if (!data.length) {
          setError('empty-data');
        }

        return; // successful request, return to main flow
      } catch (error) {
        apiError = error instanceof Error ? error : new Error(String(error));
      }

      // If real API is unavailable, get mock data
      try {
        const { data, totalPages } = await generatePostListsData(page);

        setListData(data);
        setTotalPages(totalPages);
        setUsingMockData(true);

        if (!data.length) {
          setError('empty-data');
        }
      } catch {
        setError('default');
        setErrorMessage(
          apiError instanceof Error
            ? `${apiError.message}. Тестовые данные недоступны`
            : 'Ошибка при загрузке данных. Тестовые данные недоступны'
        );
        setListData([]);
        setUsingMockData(false);
      }
    };

    fetchPosts()
      .catch(() => {
        setError('default');
        setErrorMessage('Неизвестная ошибка при загрузке данных');
      })
      .finally(() => {
        setIsDataLoading(false);
      });
  }, [page]);

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeStatus('idle');
    try {
      const { newPosts, cached, nextAllowedIn: next } = await postsService.triggerScrape();

      if (cached) {
        setScrapeStatus('cached');
        setNextAllowedIn(next);
      } else {
        setNewPostsCount(newPosts);
        setScrapeStatus(newPosts > 0 ? 'updated' : 'up-to-date');
        if (newPosts > 0) setPage(1);
      }
    } catch {
      setScrapeStatus('idle');
    } finally {
      setIsScraping(false);
    }
  };

  const hasContent = !isDataLoading && !error && listData && listData.length;

  const scrapeButton = (
    <Layout className={styles.list__scrape}>
      <Button
        label={isScraping ? 'Парсинг...' : 'Обновить'}
        iconLeft={IconArrowRedone}
        size="s"
        view="secondary"
        loading={isScraping}
        disabled={isScraping}
        onClick={handleScrape}
      />
      {scrapeStatus === 'up-to-date' && (
        <Text size="xs" view="secondary">Все данные актуальны</Text>
      )}
      {scrapeStatus === 'updated' && (
        <Text size="xs" view="success">Добавлено {newPostsCount} новых постов</Text>
      )}
      {scrapeStatus === 'cached' && (
        <Text size="xs" view="secondary">
          Данные актуальны, повтор через {Math.ceil(nextAllowedIn / 60)} мин
        </Text>
      )}
    </Layout>
  );

  return (
    <Layout className={styles.wrapper}>
      {isDataLoading && <CustomLoader />}
      {error && <CustomError errorType={error} message={errorMessage} hasReturnButton={false} customButton={scrapeButton} />}

      {hasContent && (
        <Layout direction="column" className={styles.list}>
          <Layout className={styles.list__header}>
            <Text view="brand" size="3xl" weight="bold" lineHeight="xs" className={styles.list__title}>
              Список актуальных новостей
            </Text>

            {scrapeButton}
          </Layout>

          {usingMockData && (
            <Text view="warning" size="m">
              Внимание: используются тестовые данные, так как сервер недоступен
            </Text>
          )}

          <Grid
            cols={1}
            gap="3xl"
            className={styles.grid}
            breakpoints={{
              577: {
                cols: 2,
                gap: 'xl'
              },
              993: {
                cols: 3
              }
            }}
          >
            {listData.map((item) => {
              return (
                <Link to={`/posts/${item.id}`} key={item.id}>
                  <GridItem col={1}>
                    <PostsListItem postsListItemData={item} isDataLoading={false} />
                  </GridItem>
                </Link>
              );
            })}
          </Grid>

          <CustomPagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </Layout>
      )}
    </Layout>
  );
};
