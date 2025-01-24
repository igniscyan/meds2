import { pb } from '../atoms/auth';
import { Record } from 'pocketbase';

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
  const userRole = (pb.authStore.model as UserRecord)?.role;
  
  // Allow admin users to access any role-restricted content
  if (!userRole || (userRole !== requiredRole && userRole !== 'admin')) {
    return null;
  }
  
  return <>{children}</>;
}; 