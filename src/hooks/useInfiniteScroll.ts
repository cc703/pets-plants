import { useState, useCallback, useRef, useEffect } from 'react';

interface UseInfiniteScrollOptions<T> {
  initialData?: T[];
  pageSize?: number;
  loadMore: (page: number, pageSize: number) => Promise<T[]>;
}

export default function useInfiniteScroll<T>({
  initialData = [],
  pageSize = 10,
  loadMore,
}: UseInfiniteScrollOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // 首次加载 & 当 loadMore 变化时自动刷新（排序/筛选切换）
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setError(null);
    loadingRef.current = true;
    setLoading(true);

    loadMore(1, pageSize)
      .then((newItems) => {
        setData(newItems);
        setPage(2);
        if (newItems.length < pageSize) {
          setHasMore(false);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        setLoading(false);
        loadingRef.current = false;
      });
  }, [loadMore, pageSize]);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const newItems = await loadMore(page, pageSize);

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setData(prev => [...prev, ...newItems]);
        setPage(prev => prev + 1);

        if (newItems.length < pageSize) {
          setHasMore(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, pageSize, hasMore, loadMore]);

  const refresh = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    setError(null);
    loadingRef.current = true;
    setLoading(true);

    try {
      const newItems = await loadMore(1, pageSize);
      setData(newItems);
      setPage(2);

      if (newItems.length < pageSize) {
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [pageSize, loadMore]);

  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    loading,
    hasMore,
    error,
    loadNextPage,
    refresh,
    reset,
    setData,
  };
}
