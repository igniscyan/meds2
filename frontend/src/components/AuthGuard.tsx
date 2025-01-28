import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { authModelAtom, isLoadingAtom, pb, AuthModel } from '../atoms/auth';
import { Box, CircularProgress } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const user = useAtomValue(authModelAtom);
  const loading = useAtomValue(isLoadingAtom);
  const location = useLocation();
  const setAuthModel = useSetAtom(authModelAtom);

  // Sync PocketBase auth state with Jotai on mount and auth changes
  useEffect(() => {
    const syncAuthState = async () => {
      console.log('[AuthGuard Debug] Syncing auth state:', {
        hasUser: !!user,
        pbAuthValid: pb.authStore.isValid,
        pbAuthModel: pb.authStore.model?.id,
        timestamp: new Date().toISOString()
      });

      // If PocketBase has valid auth but Jotai doesn't, sync the state
      if (pb.authStore.isValid && pb.authStore.model && !user) {
        console.log('[AuthGuard Debug] Syncing PocketBase auth to Jotai');
        setAuthModel(pb.authStore.model as unknown as AuthModel);
        return;
      }

      // If Jotai has auth but PocketBase doesn't, clear Jotai
      if (!pb.authStore.isValid && user) {
        console.log('[AuthGuard Debug] Clearing Jotai auth state');
        setAuthModel(null);
      }
    };

    syncAuthState();
  }, [user, setAuthModel]);

  // Show loading state while checking auth
  if (loading) {
    console.log('[AuthGuard Debug] Showing loading state');
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!user || !pb.authStore.isValid) {
    console.log('[AuthGuard Debug] No authenticated user, redirecting to login:', {
      from: location.pathname,
      search: location.search,
      timestamp: new Date().toISOString()
    });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[AuthGuard Debug] Rendering protected content:', {
    userId: user.id,
    path: location.pathname,
    timestamp: new Date().toISOString()
  });

  return <>{children}</>;
};

export default AuthGuard;
