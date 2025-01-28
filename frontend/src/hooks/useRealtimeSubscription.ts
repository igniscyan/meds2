import { useEffect, useState, useRef } from 'react';
import { ClientResponseError } from 'pocketbase';
import type { Record as PBRecord, Admin, AuthModel } from 'pocketbase';
import { pb } from '../atoms/auth';
import { isEqual } from 'lodash';

// Extend AuthModel to include role
interface ExtendedAuthModel extends AuthModel {
  role?: string;
}

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
      const authModel = pb.authStore.model as ExtendedAuthModel;
      if (!authModel) {
        console.log('[useRealtimeSubscription] No auth model found, skipping data load');
        if (isMounted) {
          setError(new Error('Not authenticated'));
          setLoading(false);
        }
        return;
      }

      console.log('[useRealtimeSubscription] Auth model:', {
        id: authModel.id,
        role: authModel.role,
        collection: collection,
        queryParams: queryParams
        });
      
      try {
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        
        if (!loadedRef.current) {
          console.log('[useRealtimeSubscription] Loading initial data for collection:', collection);
          
          const resultList = await pb.collection(collection).getList(1, 1000, {
            ...stableQueryParams.current,
          $autoCancel: false,
            $cancelKey: collection,
            signal: abortControllerRef.current.signal
        });
        
        if (isMounted) {
            console.log('[useRealtimeSubscription] Data loaded successfully:', {
              collection,
              itemCount: resultList.items.length,
              items: resultList.items
            });
            setRecords(resultList.items as T[]);
            setLoading(false);
            setError(null);
            loadedRef.current = true;
        }
        }
      } catch (err: any) {
        // Only log and set error if it's not an auto-cancellation
        if (!isAutoCancelError(err)) {
          console.error('[useRealtimeSubscription] Error loading data:', {
            collection,
            error: err,
            authModel: pb.authStore.model
          });
        if (isMounted) {
            setError(err instanceof Error ? err : new Error('Failed to load data'));
            setLoading(false);
        }
      }
    }
    };
      
    const subscribe = async () => {
      const authModel = pb.authStore.model as ExtendedAuthModel;
      if (!authModel) {
        console.log('[useRealtimeSubscription] No auth model found, skipping subscription');
        return;
      }

      try {
        console.log('[useRealtimeSubscription] Subscribing to collection:', {
          collection,
          authRole: authModel.role
        });

        unsubscribe = await pb.collection(collection).subscribe('*', (data) => {
          if (!isMounted) return;
          
          console.log('[useRealtimeSubscription] Received realtime update:', {
            collection,
            action: data.action,
            record: data.record,
            authRole: (pb.authStore.model as ExtendedAuthModel)?.role
          });

          setRecords(prev => {
            try {
              if (data.action === 'create') {
                // For new records, fetch with expanded fields
                pb.collection(collection).getOne(data.record.id, {
                  expand: stableQueryParams.current.expand
                }).then(expandedRecord => {
                  if (isMounted) {
                    console.log('[useRealtimeSubscription] Fetched expanded record for create:', expandedRecord);
                    setRecords(prev => [...prev, expandedRecord as T]);
                  }
                }).catch(err => {
                  if (!isAutoCancelError(err)) {
                    console.error('[useRealtimeSubscription] Error fetching expanded record:', err);
                  }
                });
                return prev;
              } else if (data.action === 'update') {
                // For updates, fetch the updated record with expanded fields
                pb.collection(collection).getOne(data.record.id, {
                  expand: stableQueryParams.current.expand
                }).then(expandedRecord => {
                  if (isMounted) {
                    console.log('[useRealtimeSubscription] Fetched expanded record for update:', expandedRecord);
                    setRecords(prev => 
                      prev.map(item => item.id === data.record.id ? expandedRecord as T : item)
                    );
                  }
                }).catch(err => {
                  if (!isAutoCancelError(err)) {
                    console.error('[useRealtimeSubscription] Error fetching updated record:', err);
                  }
        });
                return prev;
              } else if (data.action === 'delete') {
                return prev.filter(item => item.id !== data.record.id);
              }
              return prev;
      } catch (err) {
              if (!isAutoCancelError(err)) {
                console.error('[useRealtimeSubscription] Error processing realtime update:', err);
              }
              return prev;
            }
          });
        });
        console.log('[useRealtimeSubscription] Successfully subscribed to collection:', collection);
      } catch (err: any) {
        if (!isAutoCancelError(err)) {
          console.error('[useRealtimeSubscription] Error subscribing to collection:', {
            collection,
            error: err,
            authRole: authModel.role
          });
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
      console.log('[useRealtimeSubscription] Auth state changed:', {
        collection,
        newAuthRole: (pb.authStore.model as ExtendedAuthModel)?.role
      });
      loadedRef.current = false; // Reset loaded state on auth change
      loadInitialData();
      subscribe(); // Re-subscribe with new auth state
    };
    window.addEventListener('pocketbase-auth-change', handleAuthChange);

    return () => {
      isMounted = false;
      if (unsubscribe) {
        console.log('[useRealtimeSubscription] Cleaning up subscription for collection:', collection);
        unsubscribe();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
    };
  }, [collection, queryParams]);

  return { records, loading, error };
}
