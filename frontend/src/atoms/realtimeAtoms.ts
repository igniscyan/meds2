import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { pb } from './auth';
import type { Record as PBRecord } from 'pocketbase';

// Type for subscription status
type SubscriptionStatus = 'idle' | 'subscribing' | 'subscribed' | 'error';

// Define the subscription state type
export interface SubscriptionState<T> {
  records: T[];
  status: 'idle' | 'subscribing' | 'subscribed' | 'refreshing' | 'error';
  error: Error | null;
  lastUpdated: number;
}

// Interface for subscription options
interface SubscriptionOptions {
  filter?: string;
  sort?: string;
  expand?: string;
  [key: string]: any;
}

// Define the subscription parameters type
interface SubscriptionParams {
  collection: string;
  options?: Record<string, any>;
}

// Utility function to check if an error is due to request cancellation
function isAutoCancelError(error: any): boolean {
  // Check for PocketBase's auto-cancellation
  if (error?.isAbort || error?.name === 'AbortError') {
    return true;
  }
  
  // Check for error message patterns
  const errorMessage = String(error?.message || error).toLowerCase();
  if (
    errorMessage.includes('autocancelled') || 
    errorMessage.includes('aborted') ||
    errorMessage.includes('abort') ||
    errorMessage.includes('cancel')
  ) {
    return true;
  }
  
  // Check for DOMException with name AbortError
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  
  return false;
}

// Create a registry of active subscriptions to prevent duplicates
const activeSubscriptions = new Map<string, { 
  count: number, 
  unsubscribe: () => void, 
  abort: () => void,
  lastUpdated: number 
}>();

// Create a debug atom to track all active subscriptions
export const activeSubscriptionsDebugAtom = atom((get) => {
  return Array.from(activeSubscriptions.keys()).map(key => ({
    key,
    refCount: activeSubscriptions.get(key)?.count || 0,
    lastUpdated: activeSubscriptions.get(key)?.lastUpdated || 0
  }));
});
activeSubscriptionsDebugAtom.debugLabel = 'activeSubscriptionsDebugAtom';

// Create a unique key for this subscription based on collection and options
const getSubscriptionKey = (collection: string, options: Record<string, any> = {}) => {
  // Filter out options that don't affect the query result
  const relevantOptions = { ...options };
  delete relevantOptions.$autoCancel;
  delete relevantOptions.signal;
  
  return `${collection}:${JSON.stringify(relevantOptions)}`;
};

// Create an atom family for collections
export const collectionAtomFamily = atomFamily(
  ({ collection, options = {} }: SubscriptionParams) => {
    // Create a unique key for this subscription based on collection and options
    const subscriptionKey = getSubscriptionKey(collection, options);
    
    // Create a base atom for this subscription
    const baseAtom = atom<SubscriptionState<Record<string, any>>>({
      records: [],
      status: 'idle',
      error: null,
      lastUpdated: 0
    });
    
    // Add debug label to baseAtom
    baseAtom.debugLabel = `${collection}BaseAtom`;
    
    // Create a read-write atom that handles subscription actions
    const rwAtom = atom(
      (get) => get(baseAtom), // Read from baseAtom
      async (get, set, action: 'subscribe' | 'unsubscribe' | 'refresh') => {
        // For unsubscribe actions, execute immediately
        if (action === 'unsubscribe') {
          // Handle unsubscribe action
          const subscription = activeSubscriptions.get(subscriptionKey);
          if (subscription) {
            subscription.count -= 1;
            
            if (subscription.count <= 0) {
              // Last subscriber is gone, clean up the subscription
              try {
                // Abort any pending requests
                subscription.abort();
                
                // Unsubscribe from realtime updates
                subscription.unsubscribe();
                console.log(`[realtimeAtoms] Unsubscribed from ${subscriptionKey}`);
              } catch (err) {
                console.error(`[realtimeAtoms] Error unsubscribing from ${subscriptionKey}:`, err);
              }
              activeSubscriptions.delete(subscriptionKey);
            } else {
              console.log(`[realtimeAtoms] Decreased ref count for ${subscriptionKey} to ${subscription.count}`);
            }
          }
          return;
        }
        
        // Set loading state immediately
        if (action === 'subscribe') {
          set(baseAtom, prev => ({ ...prev, status: 'subscribing' }));
        } else if (action === 'refresh') {
          set(baseAtom, prev => ({ ...prev, status: 'refreshing' }));
        }
        
        try {
          // If we already have an active subscription, increase the reference count
          if (activeSubscriptions.has(subscriptionKey)) {
            const subscription = activeSubscriptions.get(subscriptionKey)!;
            subscription.count += 1;
            subscription.lastUpdated = Date.now();
            
            // If this is a refresh action, fetch new data
            if (action === 'refresh') {
              try {
                // Create an abort controller for this request
                const abortController = new AbortController();
                
                // Create a copy of options and explicitly disable auto-cancellation
                const fetchOptions = {
                  ...options,
                  $autoCancel: false,
                  signal: abortController.signal
                };
                
                const resultList = await pb.collection(collection).getList(1, 1000, fetchOptions);
                
                set(baseAtom, prev => ({
                  ...prev,
                  records: resultList.items as PBRecord[],
                  status: 'subscribed',
                  lastUpdated: Date.now()
                }));
              } catch (error) {
                if (!isAutoCancelError(error)) {
                  console.error(`[realtimeAtoms] Error refreshing ${subscriptionKey}:`, error);
                  set(baseAtom, prev => ({
                    ...prev,
                    status: 'error',
                    error: error instanceof Error ? error : new Error(String(error))
                  }));
                }
              }
            } else {
              // Just update the status for subscribe actions
              set(baseAtom, prev => ({ ...prev, status: 'subscribed' }));
            }
            
            return;
          }
          
          // Load initial data
          console.log(`[realtimeAtoms] Loading data for ${subscriptionKey}`);
          
          // Create an abort controller for this request
          const abortController = new AbortController();
          
          // Create a copy of options and explicitly disable auto-cancellation
          const fetchOptions = {
            ...options,
            $autoCancel: false,
            signal: abortController.signal
          };
          
          const resultList = await pb.collection(collection).getList(1, 1000, fetchOptions);
          
          set(baseAtom, {
            records: resultList.items as PBRecord[],
            status: 'subscribing',
            error: null,
            lastUpdated: Date.now()
          });
          
          // Create a new subscription
          console.log(`[realtimeAtoms] Subscribing to ${subscriptionKey}`);
          const unsubscribe = await pb.collection(collection).subscribe('*', (data) => {
            console.log(`[realtimeAtoms] Received update for ${subscriptionKey}:`, data.action);
            
            set(baseAtom, prev => {
              let updatedRecords = [...prev.records];
              
              if (data.action === 'create') {
                // For new records, add to the list if it doesn't already exist
                const recordExists = updatedRecords.some(item => item.id === data.record.id);
                if (!recordExists) {
                  updatedRecords = [...updatedRecords, data.record as PBRecord];
                }
              } else if (data.action === 'update') {
                // For updates, update the existing record
                updatedRecords = updatedRecords.map(item => 
                  item.id === data.record.id ? { ...item, ...data.record } as PBRecord : item
                );
              } else if (data.action === 'delete') {
                // For deletes, remove from the list
                updatedRecords = updatedRecords.filter(item => item.id !== data.record.id);
              }
              
              return {
                ...prev,
                records: updatedRecords,
                status: 'subscribed',
                lastUpdated: Date.now()
              };
            });
          });
          
          // Store the subscription with the abort controller
          activeSubscriptions.set(subscriptionKey, { 
            count: 1, 
            unsubscribe,
            abort: () => abortController.abort(),
            lastUpdated: Date.now()
          });
          
          // Update the state to subscribed
          set(baseAtom, prev => ({ ...prev, status: 'subscribed' }));
          
        } catch (error) {
          console.error(`[realtimeAtoms] Error in subscription ${subscriptionKey}:`, error);
          
          // Check if this is an auto-cancellation error
          if (isAutoCancelError(error)) {
            console.log(`[realtimeAtoms] Request for ${subscriptionKey} was cancelled - this is normal during navigation or unmounting`);
            return;
          }
          
          // For other errors, update the state
          set(baseAtom, prev => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error))
          }));
        }
      }
    );
    
    // Add debug label to the read-write atom
    rwAtom.debugLabel = `${collection}Atom`;
    
    return rwAtom;
  },
  // Use a custom equality function to prevent unnecessary atom recreation
  (a, b) => {
    return a.collection === b.collection && 
           JSON.stringify(a.options || {}) === JSON.stringify(b.options || {});
  }
);

// Utility function to get collection data without subscribing
export const getCollectionData = <T extends PBRecord>(
  collection: string, 
  options: SubscriptionOptions = {}
): Promise<T[]> => {
  return pb.collection(collection)
    .getList(1, 1000, { ...options, $autoCancel: false })
    .then(result => result.items as T[]);
};

// Create a hook to use the collection atom
export const useCollection = <T extends PBRecord>(
  collection: string,
  options: SubscriptionOptions = {}
) => {
  const atom = collectionAtomFamily({ collection, options });
  return atom;
};

// Add a listener for auth changes to clean up subscriptions on logout
if (typeof window !== 'undefined') {
  window.addEventListener('pocketbase-pre-logout', () => {
    console.log('[realtimeAtoms] Pre-logout event received, cleaning up all subscriptions');
    
    // Clean up all subscriptions
    activeSubscriptions.forEach((subscription, key) => {
      try {
        subscription.unsubscribe();
        console.log(`[realtimeAtoms] Unsubscribed from ${key} during logout`);
      } catch (err) {
        console.error(`[realtimeAtoms] Error unsubscribing from ${key} during logout:`, err);
      }
    });
    
    // Clear the map
    activeSubscriptions.clear();
  });
} 