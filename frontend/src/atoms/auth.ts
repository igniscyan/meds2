import { atom, useSetAtom } from 'jotai';
import PocketBase, { BaseModel, AuthModel as PBAuthModel, ClientResponseError } from 'pocketbase';
import { useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';

// Define our AuthModel type to match PocketBase's structure
export interface AuthModel extends BaseModel {
  email: string;
  emailVisibility: boolean;
  name?: string;
  role?: string;
}

// Create a singleton PocketBase instance
export const pb = new PocketBase(API_URL);

// Create atoms for auth state
export const authModelAtom = atom<AuthModel | null>(null);
export const isLoadingAtom = atom<boolean>(true);
export const authErrorAtom = atom<string | null>(null);

// Track active realtime subscriptions
const activeSubscriptions = new Set<string>();

// Simple function to log auth state in development
const logAuthState = (context: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Auth] ${context}:`, {
      isValid: pb.authStore.isValid,
      hasModel: !!pb.authStore.model,
      modelId: pb.authStore.model?.id,
      timestamp: new Date().toISOString()
    });
  }
};

// Export a function to check if auth is valid
export const isAuthValid = (): boolean => {
  return pb.authStore.isValid && !!pb.authStore.model;
};

// Export a function to get the current user
export const getCurrentUser = (): AuthModel | null => {
  if (!pb.authStore.isValid || !pb.authStore.model) {
    return null;
  }
  return pb.authStore.model as unknown as AuthModel;
};

// Export a function to track realtime subscriptions
export const trackSubscription = (topic: string) => {
  activeSubscriptions.add(topic);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Auth] Added subscription to ${topic}, total: ${activeSubscriptions.size}`);
  }
};

// Export a function to untrack realtime subscriptions
export const untrackSubscription = (topic: string) => {
  activeSubscriptions.delete(topic);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Auth] Removed subscription to ${topic}, total: ${activeSubscriptions.size}`);
  }
};

// Simple logout function
export const logoutAtom = atom(
  null,
  async (get, set) => {
    set(isLoadingAtom, true);
    set(authErrorAtom, null);
    
    try {
      // Dispatch a pre-logout event to allow components to clean up subscriptions
      // before the auth token is cleared
      window.dispatchEvent(new CustomEvent('pocketbase-pre-logout'));
      
      // Small delay to allow components to unsubscribe
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now it's safe to clear the auth token
      pb.authStore.clear();
      
      // Update our atom state
      set(authModelAtom, null);
      
      // Clear our tracked subscriptions
      activeSubscriptions.clear();
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      set(authErrorAtom, 'Failed to log out properly. Please try again.');
      return false;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// Hook for handling auth changes
export const useAuthChangeEffect = () => {
  const setAuthModel = useSetAtom(authModelAtom);
  const setLoading = useSetAtom(isLoadingAtom);
  const setAuthError = useSetAtom(authErrorAtom);
  const initialized = useRef(false);

  // Handle auth store changes
  useEffect(() => {
    if (initialized.current) {
      return;
    }
    
    initialized.current = true;
    logAuthState('Auth change effect mounted');

    // Set up listener for auth store changes
    const removeListener = pb.authStore.onChange((token, model) => {
      logAuthState('Auth store changed');
      
      if (token && model) {
        // We have a valid auth, update our state
        setAuthModel(model as unknown as AuthModel);
        setAuthError(null);
      } else {
        // Auth was cleared, update our state
        setAuthModel(null);
      }
      
      // Always clear loading state on auth change
      setLoading(false);
    });

    // Initial auth check
    const checkInitialAuth = async () => {
      setLoading(true);
      
      try {
        if (pb.authStore.isValid && pb.authStore.model) {
          logAuthState('Using existing auth from store');
          setAuthModel(pb.authStore.model as unknown as AuthModel);
        } else {
          logAuthState('No valid auth found');
          setAuthModel(null);
        }
      } catch (error) {
        console.error('Initial auth check error:', error);
        setAuthError('Authentication error. Please log in again.');
        setAuthModel(null);
        pb.authStore.clear();
      } finally {
        setLoading(false);
      }
    };

    // Run initial auth check
    checkInitialAuth();

    return () => {
      return removeListener;
    };
  }, [setAuthModel, setLoading, setAuthError]);
};
