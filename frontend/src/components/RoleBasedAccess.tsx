import { pb } from '../atoms/auth';
import { Record } from 'pocketbase';
import React, { useMemo } from 'react';
import { getCachedSettings } from '../hooks/useSettings';

interface UserRecord extends Record {
  role?: 'pharmacy' | 'provider' | 'admin';
}

type Role = 'pharmacy' | 'provider' | 'admin';

interface RoleBasedAccessProps {
  requiredRole: Role | readonly Role[] | Role[];
  children: React.ReactNode;
}

/**
 * RoleBasedAccess - UI Component for role-based feature visibility
 * Note: This is for UI organization only, not security.
 * All security checks should be handled server-side.
 */
export const RoleBasedAccess: React.FC<RoleBasedAccessProps> = ({
  requiredRole,
  children
}) => {
  // Use cached settings to prevent unnecessary subscriptions
  const { displayPreferences } = getCachedSettings();
  
  // Memoize the user role to prevent unnecessary re-renders
  const userRole = useMemo(() => {
    return (pb.authStore.model as UserRecord)?.role;
  }, [pb.authStore.model]);
  
  // If no user role, deny access
  if (!userRole) {
    return null;
  }

  // Admin can access everything, regardless of settings
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // For provider/pharmacy roles, check unified roles setting if available
  if (displayPreferences?.unified_roles && (userRole === 'provider' || userRole === 'pharmacy')) {
    if (Array.isArray(requiredRole)) {
      if (requiredRole.includes('provider') || requiredRole.includes('pharmacy')) {
        return <>{children}</>;
      }
    } else {
      if (requiredRole === 'provider' || requiredRole === 'pharmacy') {
        return <>{children}</>;
      }
    }
  }

  // Standard role check
  if (Array.isArray(requiredRole)) {
    if (requiredRole.includes(userRole)) {
      return <>{children}</>;
    }
  } else {
    if (userRole === requiredRole) {
      return <>{children}</>;
    }
  }
  
  return null;
}; 