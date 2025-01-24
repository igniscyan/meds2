import { pb } from '../atoms/auth';
import { Record } from 'pocketbase';
import React from 'react';

interface UserRecord extends Record {
  role?: 'pharmacy' | 'provider' | 'admin';
}

interface RoleBasedAccessProps {
  requiredRole: 'pharmacy' | 'provider' | 'admin';
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
  React.useEffect(() => {
    console.log('RoleBasedAccess mounted:', {
      requiredRole,
      currentRole: (pb.authStore.model as UserRecord)?.role,
      authModel: pb.authStore.model,
    });
  }, [requiredRole]);

  const userRole = (pb.authStore.model as UserRecord)?.role;
  
  console.log('RoleBasedAccess Debug:', {
    userRole,
    requiredRole,
    authModel: pb.authStore.model,
    isValid: pb.authStore.isValid,
    timestamp: new Date().toISOString()
  });
  
  // If no user role, deny access
  if (!userRole) {
    console.log('RoleBasedAccess: No user role found, denying access');
    return null;
  }

  // Admin can access everything
  if (userRole === 'admin') {
    console.log('RoleBasedAccess: Admin access granted for', requiredRole);
    return <>{children}</>;
  }

  // Other roles can only access their specific role content
  if (userRole === requiredRole) {
    console.log(`RoleBasedAccess: Role match (${userRole}), access granted`);
    return <>{children}</>;
  }
  
  console.log(`RoleBasedAccess: Role mismatch (${userRole} ≠ ${requiredRole}), denying access`);
  return null;
}; 