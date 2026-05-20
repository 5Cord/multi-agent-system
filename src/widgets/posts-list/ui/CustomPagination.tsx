import classNames from 'classnames';
import styles from './CustomPagination.module.scss';

interface ICustomPaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export const CustomPagination = ({ page, totalPages, onChange }: ICustomPaginationProps) => {
  if (totalPages <= 1) return null;

  // Окно из 5 страниц: текущая в центре (±2), прижатое к краям
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = start + windowSize - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className={styles.pagination}>
      {/* << первая */}
      <button
        className={styles.btn}
        disabled={page === 1}
        onClick={() => onChange(1)}
        aria-label="Первая страница"
      >
        «
      </button>

      {/* < предыдущая */}
      <button
        className={styles.btn}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Предыдущая страница"
      >
        ‹
      </button>

      {pages.map((p) => (
        <button
          key={p}
          className={classNames(styles.btn, { [styles.btn_active]: p === page })}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {/* > следующая */}
      <button
        className={styles.btn}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Следующая страница"
      >
        ›
      </button>

      {/* >> последняя */}
      <button
        className={styles.btn}
        disabled={page === totalPages}
        onClick={() => onChange(totalPages)}
        aria-label="Последняя страница"
      >
        »
      </button>
    </nav>
  );
};
