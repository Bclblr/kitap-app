import { supabase } from '@/lib/supabase';

export type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export type AdminAccess = {
  userId: string | null;
  role: AppRole;
  canOpenAdmin: boolean;
  canManageUsers: boolean;
  canManageAdmins: boolean;
  canManageSystem: boolean;
};

const ADMIN_ROLES: AppRole[] = ['moderator', 'admin', 'super_admin'];

export function isAdminRole(role: AppRole) {
  return ADMIN_ROLES.includes(role);
}

export async function getCurrentAdminAccess(): Promise<AdminAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      role: 'user',
      canOpenAdmin: false,
      canManageUsers: false,
      canManageAdmins: false,
      canManageSystem: false,
    };
  }

  const { data, error } = await supabase.rpc('current_app_role');

  if (error) {
    console.error('Admin rolü okunamadı:', error);
  }

  const role: AppRole =
    data === 'moderator' || data === 'admin' || data === 'super_admin'
      ? data
      : 'user';

  return {
    userId: user.id,
    role,
    canOpenAdmin: isAdminRole(role),
    canManageUsers: role === 'admin' || role === 'super_admin',
    canManageAdmins: role === 'super_admin',
    canManageSystem: role === 'admin' || role === 'super_admin',
  };
}
