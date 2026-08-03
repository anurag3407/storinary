'use client';

import { Button } from '@/components/ui/Button';
import type { PaginationProps } from '@/types';
import styles from './Pagination.module.css';

function getPageItems(currentPage: number, totalPages: number): (number | '...')[] {
  const candidates = new Set<number>([
    1,
    totalPages,
    currentPage,
    currentPage - 1,
    currentPage - 2,
    currentPage + 1,
    currentPage + 2,
  ]);

  const pages = Array.from(candidates)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: (number | '...')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) items.push('...');
    items.push(p);
    prev = p;
  }
  return items;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);

  return (
    <div className={styles.pagination}>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ← Prev
      </Button>

      {items.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className={styles.ellipsis}>
            ...
          </span>
        ) : (
          <Button
            key={item}
            variant={item === currentPage ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
