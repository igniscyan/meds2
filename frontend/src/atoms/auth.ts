import { atom, useSetAtom } from 'jotai';
import PocketBase from 'pocketbase';
import { BaseModel } from 'pocketbase';
import { useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';

// Define our AuthModel type to match PocketBase's structure
export interface AuthModel extends BaseModel {
  email: string;
  emailVisibility: boolean;
  username: string;
  verified: boolean;
  name?: string;
}

// Create a singleton PocketBase instance
export const pb = new PocketBase(API_URL);

// Flag to prevent re-validation during clear operations
let isClearing = false;
let currentValidation: Promise<AuthModel | null> | null = null;

// Helper function to validate auth token
const validateAuthToken = async () => {
  if (isClearing) {
    console.log('Skipping validation - clearing in progress');
    return null;
  }

  if (currentValidation) {
    console.log('Returning existing validation promise');
    return currentValidation;
  }

  console.log('Starting token validation');

  currentValidation = (async () => {
    try {
      if (!pb.authStore.isValid) {
        console.log('Auth token is invalid');
        isClearing = true;
        pb.authStore.clear();
        isClearing = false;
        return null;
      }

      if (!pb.authStore.model?.id) {
        console.log('No user model or ID present');
        return null;
      }

      // Try to refresh the auth token by fetching the current user
      const user = await pb.collection('users').getOne(pb.authStore.model.id);
      console.log('Auth token validated successfully');
      return user as AuthModel;
    } catch (error) {
      console.error('Token validation failed:', error);
      isClearing = true;
      pb.authStore.clear();
      isClearing = false;
      return null;
    } finally {
      currentValidation = null;
      console.log('Validation complete');
    }
  })();

  return currentValidation;
};

// Create auth atoms with debug labels
export const authModelAtom = atom<AuthModel | null>(null);
authModelAtom.debugLabel = 'authModelAtom';

export const isLoadingAtom = atom(false);
isLoadingAtom.debugLabel = 'isLoadingAtom';

export const logoutAtom = atom(
  null,
  async (get, set) => {
    set(isLoadingAtom, true);
    
    try {
      set(authModelAtom, null);
      isClearing = true;
      pb.authStore.clear();
      isClearing = false;
      
      window.dispatchEvent(new Event('pocketbase-auth-change'));
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);
logoutAtom.debugLabel = 'logoutAtom';

console.log('PocketBase initialized with URL:', API_URL);
console.log('Initial auth state:', pb.authStore.model);

// Enhanced auth state change handler
pb.authStore.onChange(async () => {
  if (isClearing) {
    console.log('Skipping auth change handler - clearing in progress');
    return;
  }

  console.log('Auth state changed:', {
    isValid: pb.authStore.isValid,
    model: pb.authStore.model,
    token: pb.authStore.token ? '[PRESENT]' : '[NONE]'
  });

  const validModel = await validateAuthToken();
  
  window.dispatchEvent(new CustomEvent('pocketbase-auth-change', {
    detail: { model: validModel }
  }));
});

// Add an effect to the App component to handle auth changes
export const useAuthChangeEffect = () => {
  const setAuthModel = useSetAtom(authModelAtom);
  const setLoading = useSetAtom(isLoadingAtom);
  const initialized = useRef(false);

  const handleAuthChange = useCallback(async (event: Event) => {
    const customEvent = event as CustomEvent;
    const validModel = customEvent.detail?.model || null;
    console.log('Auth change event received:', validModel);
    setAuthModel(validModel);
    setLoading(false);
  }, [setAuthModel, setLoading]);

  useEffect(() => {
    if (initialized.current) {
      console.log('Auth already initialized, skipping');
      return;
    }
    
    console.log('Auth change effect mounted');
    initialized.current = true;

    window.addEventListener('pocketbase-auth-change', handleAuthChange);
    
    // Initial validation
    const initializeAuth = async () => {
      console.log('Starting initial auth validation');
      setLoading(true);
      
      try {
        const validModel = await validateAuthToken();
        console.log('Setting initial auth model:', validModel);
        setAuthModel(validModel);
      } finally {
        console.log('Initial auth validation complete');
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      console.log('Auth change effect unmounting');
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
    };
  }, [handleAuthChange, setAuthModel, setLoading]);
};
