import { atom } from 'jotai';
import PocketBase from 'pocketbase';
import { BaseModel } from 'pocketbase';
import { useEffect } from 'react';
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

// Initialize auth atoms first
const initialAuthData = (() => {
  try {
    const model = pb.authStore.model;
    return model ? (model as AuthModel) : null;
  } catch (error) {
    console.error('Error initializing auth data:', error);
    return null;
  }
})();

// Create auth atoms with debug labels
export const authModelAtom = atom<AuthModel | null>(initialAuthData);
authModelAtom.debugLabel = 'authModelAtom';

export const isLoadingAtom = atom(false);
isLoadingAtom.debugLabel = 'isLoadingAtom';

export const logoutAtom = atom(
  null,
  async (get, set) => {
    // 1. Set loading state to prevent race conditions
    set(isLoadingAtom, true);
    
    try {
      // 2. Clear auth model first
      set(authModelAtom, null);
      
      // 3. Clear PocketBase auth store
      pb.authStore.clear();
      
      // 4. Wait for a small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 5. Dispatch auth change event
      window.dispatchEvent(new Event('pocketbase-auth-change'));
      
      // 6. Return success to handle navigation in the component
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

// Listen for auth state changes
pb.authStore.onChange(() => {
  console.log('Auth state changed:', {
    isValid: pb.authStore.isValid,
    model: pb.authStore.model,
    token: pb.authStore.token
  });
  
  // Dispatch event for components to react to auth changes
  window.dispatchEvent(new Event('pocketbase-auth-change'));
});

// Check token validity on app start and clear if invalid
if (pb.authStore.isValid) {
  const email = pb.authStore.model?.email;
  const token = pb.authStore.token;
  
  if (!email || !token) {
    console.log('No auth data found, clearing auth state');
    pb.authStore.clear();
    window.location.href = '/login';
  }
}

// Add an effect to the App component to handle auth changes
export const useAuthChangeEffect = () => {
  const setAuthModel = (model: AuthModel | null) => {
    window.dispatchEvent(new CustomEvent('auth-model-change', { detail: model }));
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const model = pb.authStore.model;
      setAuthModel(model ? (model as AuthModel) : null);
    };

    window.addEventListener('pocketbase-auth-change', handleAuthChange);
    // Set initial auth state
    handleAuthChange();

    return () => {
      window.removeEventListener('pocketbase-auth-change', handleAuthChange);
    };
  }, []);
};
