import { useState, useEffect, useRef, useCallback } from 'react';
import { pb } from '../atoms/auth';
import type { Record as PBRecord } from 'pocketbase';

/**
 * A simplified hook for subscribing to PocketBase collections
 * This hook doesn't use atoms or complex state management, making it
 * more straightforward for simple use cases.
 */
export function useSimpleSubscription<T extends PBRecord>(
  collection: string,
  options: Record<string, any> = {}
) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track if the component is mounted
  const isMountedRef = useRef(true);
  
  // Track the unsubscribe function
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Create a refresh function
  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      
      // Create a copy of options and explicitly disable auto-cancellation
      const fetchOptions = {
        ...options,
        $autoCancel: false
      };
      
      const resultList = await pb.collection(collection).getList(1, 1000, fetchOptions);
      
      if (isMountedRef.current) {
        setRecords(resultList.items as T[]);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      console.error(`[useSimpleSubscription] Error refreshing ${collection}:`, err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, [collection, options]);
  
  // Subscribe to the collection
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    // Load initial data
    refresh();
    
    // Subscribe to realtime updates
    const subscribeToCollection = async () => {
      try {
        // Clean up any existing subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // Create a new subscription
        unsubscribeRef.current = await pb.collection(collection).subscribe('*', (data) => {
          if (!isMountedRef.current) return;
          
          setRecords(prev => {
            // Create a new array to ensure React detects the change
            let updatedRecords = [...prev];
            
            if (data.action === 'create') {
              // For new records, add to the list if it doesn't already exist
              const recordExists = updatedRecords.some(item => item.id === data.record.id);
              if (!recordExists) {
                updatedRecords = [...updatedRecords, data.record as T];
              }
            } else if (data.action === 'update') {
              // For updates, update the existing record
              updatedRecords = updatedRecords.map(item => 
                item.id === data.record.id ? { ...item, ...data.record } as T : item
              );
            } else if (data.action === 'delete') {
              // For deletes, remove from the list
              updatedRecords = updatedRecords.filter(item => item.id !== data.record.id);
            }
            
            return updatedRecords;
          });
        });
      } catch (err) {
        console.error(`[useSimpleSubscription] Error subscribing to ${collection}:`, err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };
    
    // Subscribe after loading initial data
    subscribeToCollection();
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      
      // Unsubscribe from realtime updates
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (err) {
          console.error(`[useSimpleSubscription] Error unsubscribing from ${collection}:`, err);
        }
        unsubscribeRef.current = null;
      }
    };
  }, [collection, refresh]);
  
  return {
    records,
    loading,
    error,
    refresh
  };
}

export default useSimpleSubscription; 