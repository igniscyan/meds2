import { atom, useSetAtom } from 'jotai';
import PocketBase, { BaseModel } from 'pocketbase';
import { useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';

// Define our AuthModel type to match PocketBase's structure
export interface AuthModel extends BaseModel {
  email: string;
  emailVisibility: boolean;
  name?: string;
  role?: string;
}

// Define the PocketBase user record type
interface UserRecord extends BaseModel {
  email: string;
  emailVisibility: boolean;
  name?: string;
  role: string;
  username: string;
  verified: boolean;
}

// Create a singleton PocketBase instance
export const pb = new PocketBase(API_URL);

let isClearing = false;
let currentValidation: Promise<AuthModel | null> | null = null;

// Debug function to log auth state
const logAuthState = (context: string) => {
  console.log(`[Auth Debug] ${context}:`, {
    isValid: pb.authStore.isValid,
    hasModel: !!pb.authStore.model,
    modelId: pb.authStore.model?.id,
    token: pb.authStore.token ? '[PRESENT]' : '[NONE]',
    isClearing,
    hasCurrentValidation: !!currentValidation,
    timestamp: new Date().toISOString()
  });
};

// Create atoms first
export const authModelAtom = atom<AuthModel | null>(null);
authModelAtom.debugLabel = 'authModelAtom';

export const isLoadingAtom = atom<boolean>(false);
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

// Initialize auth listener after atoms are created
console.log('PocketBase initialized with URL:', API_URL);
console.log('Initial auth state:', pb.authStore.model);

// Initialize auth state if PocketBase has a valid session
if (pb.authStore.isValid && pb.authStore.model) {
  console.log('[Auth Debug] Setting initial auth state from PocketBase');
  const setInitialAuth = (model: any) => {
    const authStore = pb.authStore;
    if (authStore.isValid && authStore.model) {
      return model as AuthModel;
    }
    return null;
  };
  authModelAtom.init = setInitialAuth(pb.authStore.model);
}

const validateAuthToken = async (): Promise<AuthModel | null> => {
  logAuthState('Starting token validation');

  if (isClearing) {
    console.log('[Auth Debug] Skipping validation - clearing in progress');
    return null;
  }

  // If we already have a validation in progress, return it
  if (currentValidation) {
    console.log('[Auth Debug] Returning existing validation');
    return currentValidation;
  }

  if (!pb.authStore.isValid) {
    console.log('[Auth Debug] Auth store is not valid');
    return null;
  }

  try {
    // Start a new validation
    currentValidation = (async () => {
      logAuthState('Validating token');

      if (!pb.authStore.model?.id) {
        console.log('[Auth Debug] No user ID found');
        return null;
      }

      console.log('[Auth Debug] Fetching current user:', pb.authStore.model.id);
      const user = await pb.collection('users').getOne<UserRecord>(pb.authStore.model.id);
      console.log('[Auth Debug] Auth token validated successfully:', {
        userId: user.id,
        role: user.role
      });

      logAuthState('Validation complete');
      return user as AuthModel;
    })();

    return await currentValidation;
  } catch (error) {
    console.error('[Auth Debug] Validation error:', error);
    return null;
  } finally {
    currentValidation = null;
  }
};

pb.authStore.onChange(async () => {
  logAuthState('Auth store onChange triggered');

  if (isClearing) {
    console.log('[Auth Debug] Skipping auth change handler - clearing in progress');
    return;
  }

  const validModel = await validateAuthToken();
  logAuthState('After validation in onChange');

  window.dispatchEvent(new CustomEvent('pocketbase-auth-change', {
    detail: { model: validModel }
  }));
});

// Hook for handling auth changes
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
