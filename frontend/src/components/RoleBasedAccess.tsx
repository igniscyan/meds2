import { pb } from '../atoms/auth';
import { Record } from 'pocketbase';

interface UserRecord extends Record {
  role?: 'pharmacy' | 'provider' | 'admin';
}

interface RoleBasedAccessProps {
  requiredRole: 'pharmacy' | 'provider' | 'admin';
  children: React.ReactNode;
}

export const RoleBasedAccess: React.FC<RoleBasedAccessProps> = ({
  requiredRole,
  children
}) => {
  const userRole = (pb.authStore.model as UserRecord)?.role;
  
  if (!userRole || userRole !== requiredRole) {
    return null;
  }
  
  return <>{children}</>;
}; 