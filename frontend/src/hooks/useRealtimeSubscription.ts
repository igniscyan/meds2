import { useEffect, useState, useRef } from 'react';
import { ClientResponseError } from 'pocketbase';
import type { Record as PBRecord, Admin, AuthModel } from 'pocketbase';
import { pb, trackSubscription, untrackSubscription } from '../atoms/auth';
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

// Create a map to store update callbacks
const updateCallbacks = new Map<string, () => void>();

// Track active subscriptions to prevent duplicates
const activeSubscriptions = new Map<string, boolean>();

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
  const subscriptionKey = `${collection}_${JSON.stringify(queryParams)}`;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Only update stableQueryParams if queryParams actually changed
  useEffect(() => {
    if (!isEqual(queryParams, stableQueryParams.current)) {
      stableQueryParams.current = queryParams;
      loadedRef.current = false; // Reset loaded state when params change
    }
  }, [queryParams]);

  useEffect(() => {
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
            signal: abortControllerRef.current.signal
          });
        
          if (isMounted) {
            console.log('[useRealtimeSubscription] Data loaded successfully:', {
              collection,
              itemCount: resultList.items.length
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
      // Check if we already have an active subscription for this collection
      if (activeSubscriptions.get(subscriptionKey)) {
        console.log('[useRealtimeSubscription] Subscription already active for:', subscriptionKey);
        return;
      }
      
      const authModel = pb.authStore.model as ExtendedAuthModel;
      if (!authModel) {
        console.log('[useRealtimeSubscription] No auth model found, skipping subscription');
        return;
      }

      try {
        console.log('[useRealtimeSubscription] Subscribing to collection:', {
          collection,
          authRole: authModel.role,
          subscriptionKey
        });
        
        // Mark this subscription as active
        activeSubscriptions.set(subscriptionKey, true);
        
        // Track this subscription in the auth module
        trackSubscription(subscriptionKey);

        // Clean up any existing subscription first
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        unsubscribeRef.current = await pb.collection(collection).subscribe('*', (data) => {
          if (!isMounted) return;
          
          console.log('[useRealtimeSubscription] Received realtime update:', {
            collection,
            action: data.action,
            record: data.record.id,
            authRole: (pb.authStore.model as ExtendedAuthModel)?.role
          });

          // Instead of immediately fetching fresh data, update the local state
          // This reduces the number of API calls
          setRecords(prev => {
            try {
              if (data.action === 'create') {
                // For new records, add to the list
                return [...prev, data.record as T];
              } else if (data.action === 'update') {
                // For updates, update the existing record
                return prev.map(item => item.id === data.record.id ? {...item, ...data.record} as T : item);
              } else if (data.action === 'delete') {
                // For deletes, remove from the list
                return prev.filter(item => item.id !== data.record.id);
              }
              return prev;
            } catch (err) {
              console.error('[useRealtimeSubscription] Error processing realtime update:', err);
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
        // Mark subscription as inactive on error
        activeSubscriptions.delete(subscriptionKey);
        untrackSubscription(subscriptionKey);
      }
    };

    // Load data first, then subscribe
    loadInitialData().then(() => {
      if (isMounted) {
        subscribe();
      }
    });

    // Listen for auth changes
    const handleAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const action = customEvent.detail?.action;
      
      console.log('[useRealtimeSubscription] Auth state changed:', {
        collection,
        action,
        newAuthRole: (pb.authStore.model as ExtendedAuthModel)?.role
      });
      
      // Only reload data if we have a valid auth model and the action is login
      if (action === 'login' && pb.authStore.isValid && pb.authStore.model) {
        loadedRef.current = false; // Reset loaded state on auth change
        loadInitialData().then(() => {
          if (isMounted) {
            subscribe(); // Re-subscribe with new auth state
          }
        });
      } else if (action === 'logout') {
        // Clear data if auth is invalid or on logout
        setRecords([]);
        setError(new Error('Not authenticated'));
        
        // Clean up subscription
        if (unsubscribeRef.current) {
          try {
            unsubscribeRef.current();
          } catch (err) {
            console.error('[useRealtimeSubscription] Error unsubscribing:', err);
          }
          unsubscribeRef.current = null;
          activeSubscriptions.delete(subscriptionKey);
          untrackSubscription(subscriptionKey);
        }
      }
    };
    
    window.addEventListener('pocketbase-auth-change', handleAuthChange);

    // Add a listener for pre-logout events
    const handlePreLogout = () => {
      console.log('[useRealtimeSubscription] Pre-logout event received, cleaning up subscription:', subscriptionKey);
      
      // Immediately mark this subscription as inactive to prevent further updates
      activeSubscriptions.delete(subscriptionKey);
      untrackSubscription(subscriptionKey);
      
      // Cancel any ongoing requests first
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
          console.log('[useRealtimeSubscription] Aborted ongoing requests for:', subscriptionKey);
        } catch (err) {
          console.error('[useRealtimeSubscription] Error aborting requests:', err);
        }
      }
      
      // Clean up subscription before auth token is cleared
      if (unsubscribeRef.current) {
        try {
          // Wrap in a timeout to prevent blocking the logout process
          // This ensures the logout continues even if unsubscribe hangs
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              console.log('[useRealtimeSubscription] Unsubscribe timed out for:', subscriptionKey);
              resolve();
            }, 200);
          });
          
          // Race between the unsubscribe and the timeout
          Promise.race([
            new Promise<void>((resolve) => {
              try {
                unsubscribeRef.current?.();
                console.log('[useRealtimeSubscription] Successfully unsubscribed before logout:', subscriptionKey);
              } catch (err) {
                console.error('[useRealtimeSubscription] Error unsubscribing before logout:', err);
              }
              resolve();
            }),
            timeoutPromise
          ]);
        } catch (err) {
          console.error('[useRealtimeSubscription] Error in unsubscribe process:', err);
        }
        
        // Clear the reference regardless of success/failure
        unsubscribeRef.current = null;
      }
      
      // Clear local state to prevent further updates
      if (isMounted) {
        setRecords([]);
        setError(new Error('Logged out'));
        setLoading(false);
      }
    };
    
    window.addEventListener('pocketbase-pre-logout', handlePreLogout);
    
    // Also listen for the logout-complete event
    const handleLogoutComplete = () => {
      console.log('[useRealtimeSubscription] Logout complete, ensuring cleanup for:', subscriptionKey);
      
      // Double-check that everything is cleaned up
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (err) {
          // Ignore errors at this point
        }
        unsubscribeRef.current = null;
      }
      
      activeSubscriptions.delete(subscriptionKey);
      untrackSubscription(subscriptionKey);
    };
    
    window.addEventListener('pocketbase-logout-complete', handleLogoutComplete);

    // Store the update callback for this collection
    updateCallbacks.set(collection, loadInitialData);

    return () => {
      isMounted = false;
      
      // Clean up event listeners
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
      window.removeEventListener('pocketbase-pre-logout', handlePreLogout);
      window.removeEventListener('pocketbase-logout-complete', handleLogoutComplete);
      
      // Clean up subscription
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
          console.log('[useRealtimeSubscription] Unsubscribed on unmount:', subscriptionKey);
        } catch (err) {
          console.error('[useRealtimeSubscription] Error unsubscribing on unmount:', err);
        }
        unsubscribeRef.current = null;
        activeSubscriptions.delete(subscriptionKey);
        untrackSubscription(subscriptionKey);
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [collection, queryParams]);

  // Add a function to force refresh the data
  const refreshData = async () => {
    loadedRef.current = false;
    setLoading(true);
    
    try {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const resultList = await pb.collection(collection).getList(1, 1000, {
        ...stableQueryParams.current,
        $autoCancel: false,
        signal: abortControllerRef.current.signal
      });
      
      setRecords(resultList.items as T[]);
      setLoading(false);
      setError(null);
      loadedRef.current = true;
    } catch (err: any) {
      if (!isAutoCancelError(err)) {
        console.error('[useRealtimeSubscription] Error refreshing data:', err);
        setError(err instanceof Error ? err : new Error('Failed to refresh data'));
      }
      setLoading(false);
    }
  };

  return {
    records,
    loading,
    error,
    refreshData
  };
}

// Add a static method to force update a collection
useRealtimeSubscription.forceUpdate = (collection: string) => {
  const callback = updateCallbacks.get(collection);
  if (callback) {
    callback();
  }
};

export default useRealtimeSubscription;
