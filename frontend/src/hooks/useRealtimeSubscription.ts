import { useEffect, useState, useRef } from 'react';
import { ClientResponseError } from 'pocketbase';
import type { Record as PBRecord } from 'pocketbase';
import { pb } from '../atoms/auth';
import { isEqual } from 'lodash';

type RecordSubscription = {
  action: 'create' | 'update' | 'delete';
  record: PBRecord;
};

// Add this utility function at the top level
const isAutoCancelError = (error: any): boolean => {
  return error?.message?.includes('autocancelled') || 
         error?.message?.includes('aborted') ||
         error?.isAbort ||
         error?.name === 'AbortError' ||
         error?.status === 0;
};

export function useRealtimeSubscription<T extends PBRecord>(
  collection: string,
  queryParams: { [key: string]: any } = {}
) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const stableQueryParams = useRef(queryParams);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedRef = useRef(false);

  // Only update stableQueryParams if queryParams actually changed
  useEffect(() => {
    if (!isEqual(queryParams, stableQueryParams.current)) {
      stableQueryParams.current = queryParams;
      loadedRef.current = false; // Reset loaded state when params change
    }
  }, [queryParams]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const loadInitialData = async () => {
      if (!pb.authStore.model) {
        console.log('No auth model found, skipping data load');
        if (isMounted) {
          setError(new Error('Not authenticated'));
          setLoading(false);
        }
        return;
      }

      try {
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (!loadedRef.current) {
          console.log('Loading initial data for collection:', collection, 'with params:', queryParams);
          
          const resultList = await pb.collection(collection).getList(1, 1000, {
            ...stableQueryParams.current,
            $autoCancel: false,
            $cancelKey: collection,
            signal: abortControllerRef.current.signal
          });

          if (isMounted) {
            console.log('Data loaded successfully:', resultList);
            setRecords(resultList.items as T[]);
            setLoading(false);
            setError(null);
            loadedRef.current = true;
          }
        }
      } catch (err: any) {
        // Only log and set error if it's not an auto-cancellation
        if (!isAutoCancelError(err)) {
          console.error('Error loading data:', err);
          if (isMounted) {
            setError(err instanceof Error ? err : new Error('Failed to load data'));
            setLoading(false);
          }
        }
      }
    };

    const subscribe = async () => {
      if (!pb.authStore.model) {
        console.log('No auth model found, skipping subscription');
        return;
      }

      try {
        console.log('Subscribing to collection:', collection);
        unsubscribe = await pb.collection(collection).subscribe('*', async (data: RecordSubscription) => {
          if (!isMounted) return;
          
          console.log('Received realtime update:', data);
          const { action, record } = data;
          
          setRecords(prev => {
            try {
              if (action === 'create') {
                // For new records, fetch with expanded fields
                pb.collection(collection).getOne(record.id, {
                  expand: stableQueryParams.current.expand
                }).then(expandedRecord => {
                  if (isMounted) {
                    setRecords(prev => [...prev, expandedRecord as T]);
                  }
                }).catch(err => {
                  if (!isAutoCancelError(err)) {
                    console.error('Error fetching expanded record:', err);
                  }
                });
                return prev;
              } else if (action === 'update') {
                // For updates, fetch the updated record with expanded fields
                pb.collection(collection).getOne(record.id, {
                  expand: stableQueryParams.current.expand
                }).then(expandedRecord => {
                  if (isMounted) {
                    setRecords(prev => 
                      prev.map(item => item.id === record.id ? expandedRecord as T : item)
                    );
                  }
                }).catch(err => {
                  if (!isAutoCancelError(err)) {
                    console.error('Error fetching updated record:', err);
                  }
                });
                return prev;
              } else if (action === 'delete') {
                return prev.filter(item => item.id !== record.id);
              }
              return prev;
            } catch (err: any) {
              if (!isAutoCancelError(err)) {
                console.error('Error processing realtime update:', err);
              }
              return prev;
            }
          });
        });
        console.log('Successfully subscribed to collection:', collection);
      } catch (err: any) {
        if (!isAutoCancelError(err)) {
          console.error('Error subscribing to collection:', err);
          if (isMounted) {
            setError(err instanceof Error ? err : new Error('Failed to subscribe'));
          }
        }
      }
    };

    loadInitialData();
    subscribe();

    // Listen for auth changes
    const handleAuthChange = () => {
      console.log('Auth state changed, reloading data...');
      loadedRef.current = false; // Reset loaded state on auth change
      loadInitialData();
    };
    window.addEventListener('pocketbase-auth-change', handleAuthChange);

    return () => {
      isMounted = false;
      if (unsubscribe) {
        console.log('Cleaning up subscription for collection:', collection);
        unsubscribe();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
    };
  }, [collection, stableQueryParams.current]);

  return { records, loading, error };
}
