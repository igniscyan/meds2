import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import type { Record as PBRecord } from 'pocketbase';
import { collectionAtomFamily } from '../atoms/realtimeAtoms';
import { isEqual } from 'lodash';

// Interface for subscription options
interface SubscriptionOptions {
  filter?: string;
  sort?: string;
  expand?: string;
  $autoCancel?: boolean;
  [key: string]: any;
}

/**
 * Hook to subscribe to realtime updates for a collection
 * 
 * @param collection The collection name
 * @param options Query options like filter, sort, expand
 * @returns Object with records, loading state, error, and refresh function
 */
export function useRealtimeCollection<T extends PBRecord>(
  collection: string,
  options: SubscriptionOptions = {}
) {
  // Get the atom for this collection and options
  const collectionAtom = useMemo(() => 
    collectionAtomFamily({ collection, options }),
    // Deep compare options to prevent unnecessary atom recreation
    [collection, JSON.stringify(options)]
  );
  
  // Use the atom - now it's a read-write atom
  const [state, dispatch] = useAtom(collectionAtom);
  
  // Keep track of the subscription status
  const subscriptionRef = useRef<{ isSubscribed: boolean }>({ isSubscribed: false });
  
  // Keep track of the previous options for comparison
  const prevOptionsRef = useRef(options);
  
  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    // Check if options have changed significantly
    const optionsChanged = !isEqual(prevOptionsRef.current, options);
    prevOptionsRef.current = options;
    
    // If already subscribed and options haven't changed, just return
    if (subscriptionRef.current.isSubscribed && !optionsChanged) {
      return;
    }
    
    // If already subscribed but options changed, unsubscribe first
    if (subscriptionRef.current.isSubscribed && optionsChanged) {
      console.log(`[useRealtimeCollection] Options changed for ${collection}, resubscribing`);
      dispatch('unsubscribe');
      subscriptionRef.current.isSubscribed = false;
    }
    
    // Now subscribe with the new options
    console.log(`[useRealtimeCollection] Subscribing to ${collection}`);
    
    // Mark as subscribed
    subscriptionRef.current.isSubscribed = true;
    
    // Subscribe to the collection
    dispatch('subscribe');
    
    // Unsubscribe when the component unmounts or options change
    return () => {
      if (subscriptionRef.current.isSubscribed) {
        console.log(`[useRealtimeCollection] Unsubscribing from ${collection}`);
        subscriptionRef.current.isSubscribed = false;
        dispatch('unsubscribe');
      }
    };
  }, [dispatch, collection, JSON.stringify(options)]);
  
  // Create a refresh function
  const refresh = () => dispatch('refresh');
  
  // Return the data and functions
  return {
    records: state.records as T[],
    loading: state.status === 'idle' || state.status === 'subscribing',
    error: state.error,
    refresh,
    lastUpdated: state.lastUpdated
  };
}

export default useRealtimeCollection;