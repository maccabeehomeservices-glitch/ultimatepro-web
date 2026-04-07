import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

export function useGet(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const depsRef = useRef(deps);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [url, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const mutate = useCallback(async (method, url, body) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api[method](url, body);
      setData(res.data);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'An error occurred';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, data };
}
