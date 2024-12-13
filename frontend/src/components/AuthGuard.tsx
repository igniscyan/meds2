import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authModelAtom, pb } from '../atoms/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [authModel] = useAtom(authModelAtom);
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

  if (!authModel) {
    // Save the location they were trying to go to for after login
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
