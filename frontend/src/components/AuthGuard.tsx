import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtomValue } from 'jotai/react';
import { authModelAtom, isLoadingAtom, pb, authErrorAtom } from '../atoms/auth';
import { Box, CircularProgress, Typography } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const user = useAtomValue(authModelAtom);
  const loading = useAtomValue(isLoadingAtom);
  const authError = useAtomValue(authErrorAtom);
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verifying your session...
        </Typography>
      </Box>
    );
  }

  // If not loading and no user, redirect to login
  if (!user || !pb.authStore.isValid) {
    console.log('[AuthGuard] No authenticated user, redirecting to login');
    
    // Pass the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location, authError: authError }} replace />;
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default AuthGuard;
