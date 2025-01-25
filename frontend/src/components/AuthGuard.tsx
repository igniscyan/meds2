import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authModelAtom, isLoadingAtom, pb } from '../atoms/auth';
import { Box, CircularProgress } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [authModel] = useAtom(authModelAtom);
  const [isLoading] = useAtom(isLoadingAtom);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const email = pb.authStore.model.email;
        const token = pb.authStore.token;
        
        if (!email || !token) {
          console.error('Auth data missing');
          pb.authStore.clear();
          window.location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`;
        }
      }
    };

    checkAuth();
  }, [location.pathname]);

  // Don't redirect while loading
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Check for valid auth state
  if (!authModel || !pb.authStore.isValid) {
    // Prevent redirect loops by checking location state
    if (location.state?.loggedOut) {
      return <Navigate to="/login" replace />;
    }
    
    return <Navigate 
      to={`/login?redirect=${encodeURIComponent(location.pathname)}`} 
      replace 
    />;
  }

  return <>{children}</>;
};

export default AuthGuard;
