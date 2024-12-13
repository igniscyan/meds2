import { useEffect, useState, useRef } from 'react';
import { ClientResponseError } from 'pocketbase';
import type { Record as PBRecord } from 'pocketbase';
import { pb } from '../atoms/auth';
import { isEqual } from 'lodash';

type RecordSubscription = {
  action: 'create' | 'update' | 'delete';
  record: PBRecord;
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

  // Only update stableQueryParams if queryParams actually changed
  useEffect(() => {
    if (!isEqual(queryParams, stableQueryParams.current)) {
      stableQueryParams.current = queryParams;
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

        console.log('Loading initial data for collection:', collection, 'with params:', queryParams);
        console.log('Auth state:', {
          hasModel: !!pb.authStore.model,
          modelId: pb.authStore.model?.id,
          token: pb.authStore.token
        });
        
        const resultList = await pb.collection(collection).getList(1, 50, {
          ...stableQueryParams.current,
          $cancelKey: collection, // Use collection as cancel key
          signal: abortControllerRef.current.signal
        });

        if (isMounted) {
          console.log('Data loaded successfully:', resultList);
          setRecords(resultList.items as T[]);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
        // Only set error if component is mounted and it's not an auto-cancellation
        if (isMounted && err instanceof ClientResponseError && !err.isAbort) {
          setError(err instanceof Error ? err : new Error('Failed to load data'));
          setLoading(false);
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
        unsubscribe = await pb.collection(collection).subscribe('*', (data: RecordSubscription) => {
          if (!isMounted) return;
          
          console.log('Received realtime update:', data);
          const { action, record } = data;
          
          setRecords(prev => {
            console.log('Current records:', prev);
            let newRecords;
            if (action === 'create') {
              newRecords = [...prev, record as T];
            } else if (action === 'update') {
              newRecords = prev.map(item => item.id === record.id ? record as T : item);
            } else if (action === 'delete') {
              newRecords = prev.filter(item => item.id !== record.id);
            } else {
              newRecords = prev;
            }
            console.log('Updated records:', newRecords);
            return newRecords;
          });
        });
        console.log('Successfully subscribed to collection:', collection);
      } catch (err: any) {
        console.error('Error subscribing to collection:', err);
        if (isMounted && err instanceof ClientResponseError && !err.isAbort) {
          setError(err instanceof Error ? err : new Error('Failed to subscribe'));
        }
      }
    };

    loadInitialData();
    subscribe();

    // Listen for auth changes
    const handleAuthChange = () => {
      console.log('Auth state changed, reloading data...');
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
