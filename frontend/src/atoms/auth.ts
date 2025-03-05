import { atom } from 'jotai/vanilla';
import { useSetAtom } from 'jotai/react';
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

// Disable auto-cancellation globally to prevent "request was autocancelled" errors
pb.autoCancellation(false);

// Create atoms for auth state
export const authModelAtom = atom<AuthModel | null>(null);
authModelAtom.debugLabel = 'authModelAtom';

export const isLoadingAtom = atom<boolean>(true);
isLoadingAtom.debugLabel = 'isLoadingAtom';

export const authErrorAtom = atom<string | null>(null);
authErrorAtom.debugLabel = 'authErrorAtom';

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
export const logoutAtom = atom(null, async (get, set) => {
  console.log('[auth] Starting logout process...');
  
  // Dispatch pre-logout event to allow components to clean up
  window.dispatchEvent(new CustomEvent('pocketbase-pre-logout'));
  
  // Wait a bit for components to unsubscribe
  await new Promise(resolve => setTimeout(resolve, 300));
  
  try {
    // Force disconnect from realtime API before clearing auth
    try {
      console.log('[auth] Forcing disconnect from realtime API...');
      // @ts-ignore - accessing private API
      if (pb.realtime && typeof pb.realtime.disconnect === 'function') {
        // @ts-ignore - accessing private API
        await pb.realtime.disconnect();
        console.log('[auth] Successfully disconnected from realtime API');
      }
    } catch (err) {
      // Don't let this error stop the logout process
      console.error('[auth] Error disconnecting from realtime API:', err);
    }
    
    console.log('[auth] Clearing auth token...');
    pb.authStore.clear();
    
    // Clear tracked subscriptions
    activeSubscriptions.clear();
    
    // Dispatch auth change event
    window.dispatchEvent(
      new CustomEvent('pocketbase-auth-change', {
        detail: { action: 'logout' },
      })
    );
    
    // Dispatch logout-complete event
    window.dispatchEvent(new CustomEvent('pocketbase-logout-complete'));
    
    console.log('[auth] Logout complete');
    
    // Update atoms
    set(authModelAtom, null);
    set(isLoadingAtom, false);
  } catch (err) {
    console.error('[auth] Error during logout:', err);
    // Still dispatch logout-complete event even if there was an error
    window.dispatchEvent(new CustomEvent('pocketbase-logout-complete'));
  }
});

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
