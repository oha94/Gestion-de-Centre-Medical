import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { getDb } from '../lib/db';

export interface User {
  id: number;
  username: string;
  nom_complet: string;
  role_id: number;
  role_nom: string;
  role_couleur?: string;
  can_delete: boolean | number;
  can_edit: boolean | number;
  can_print: boolean | number;
}

interface GranularPermission {
  code: string;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  userPermissions: string[]; // List of menu codes (Legacy/Simple check)
  granularPermissions: GranularPermission[]; // Detailed permissions
  loading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => void;
  hasPermission: (menuCode: string) => boolean;
  // Legacy global checks (kept for compatibility, acting as master switches)
  canEdit: () => boolean;
  canDelete: () => boolean;
  canPrint: () => boolean;
  refreshPermissions: () => Promise<void>;
  // NEW: Hook logic helper
  checkGranular: (menuCode: string) => { canCreate: boolean, canUpdate: boolean, canDelete: boolean, canRead: boolean };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  userPermissions: [],
  granularPermissions: [],
  loading: true,
  login: async () => { },
  logout: () => { },
  hasPermission: () => false,
  canEdit: () => false,
  canDelete: () => false,
  canPrint: () => false,
  refreshPermissions: async () => { },
  checkGranular: () => ({ canCreate: false, canUpdate: false, canDelete: false, canRead: false }),
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [granularPermissions, setGranularPermissions] = useState<GranularPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const refreshPermissions = async () => {
    if (!user) return;
    try {
      const db = await getDb();
      // Fetch user role options again
      const userRes = await db.select<any[]>(`
        SELECT r.can_delete, r.can_edit, r.can_print 
        FROM app_roles r 
        WHERE r.id = ?
      `, [user.role_id]);

      if (userRes.length > 0) {
        setUser(prev => prev ? {
          ...prev,
          can_delete: userRes[0].can_delete,
          can_edit: userRes[0].can_edit,
          can_print: userRes[0].can_print
        } : null);
      }

      await loadPermissions(user.role_id);
    } catch (e) {
      console.error("Error refreshing permissions:", e);
    }
  };

  const loadPermissions = async (roleId: number) => {
    try {
      const db = await getDb();
      // Fetch granular permissions from the join table
      // Note: fields can_create, etc. might not exist yet if migration hasn't run, 
      // so we use a try/catch or assume migration has run in RolesPermissions. 
      // However, for robustness, we should handle if columns are missing.
      // Since we are adding them via RolesPermissions, let's assume they might be there.
      // To be safe, we query *.

      let perms: any[] = [];
      try {
        perms = await db.select<any[]>(`
                SELECT m.code, rp.can_create, rp.can_update, rp.can_delete
                FROM app_role_permissions rp 
                JOIN app_menus m ON rp.menu_id = m.id 
                WHERE rp.role_id = ?
              `, [roleId]);
      } catch (e) {
        // Fallback if columns don't exist yet (Legacy mode)
        console.warn("Granular columns missing, falling back to basic perms", e);
        perms = await db.select<any[]>(`
                SELECT m.code, 1 as can_create, 1 as can_update, 1 as can_delete
                FROM app_role_permissions rp 
                JOIN app_menus m ON rp.menu_id = m.id 
                WHERE rp.role_id = ?
              `, [roleId]);
      }

      const codes = perms.map(p => p.code);
      const granular = perms.map(p => ({
        code: p.code,
        can_create: p.can_create == 1, // Handle 1/0 or true/false
        can_update: p.can_update == 1,
        can_delete: p.can_delete == 1
      }));

      setUserPermissions(codes);
      setGranularPermissions(granular);
      console.log("[AUTH] Permissions Loaded:", granular);

    } catch (e) {
      console.error("Error loading permissions", e);
    }
  };

  const login = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);

    const normalizedUser = {
      ...loggedInUser,
      can_delete: loggedInUser.can_delete === 1 || loggedInUser.can_delete === true,
      can_edit: loggedInUser.can_edit === 1 || loggedInUser.can_edit === true,
      can_print: loggedInUser.can_print === 1 || loggedInUser.can_print === true,
    };
    setUser(normalizedUser);

    await loadPermissions(loggedInUser.role_id);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setUserPermissions([]);
    setGranularPermissions([]);
  };

  const hasPermission = (menuCode: string) => {
    if (!user) return false;
    if (user.role_nom === 'Administrateur') return true;
    return userPermissions.includes(menuCode);
  };

  // Helper centralisé
  const checkGranular = (menuCode: string) => {
    if (!user) return { canCreate: false, canUpdate: false, canDelete: false, canRead: false };

    // Admin has full power
    if (user.role_nom === 'Administrateur') {
      return { canCreate: true, canUpdate: true, canDelete: true, canRead: true };
    }

    const perm = granularPermissions.find(p => p.code === menuCode);
    if (!perm) return { canCreate: false, canUpdate: false, canDelete: false, canRead: false };

    // Global master switches (from Role table) can override specific permissions negatively
    // e.g. if Role.can_delete is FALSE, then NO module can act delete.
    const masterDelete = user.can_delete !== false;
    const masterEdit = user.can_edit !== false; // Covers Create/Update usually

    return {
      canRead: true, // If it exists in permissions list, it's readable
      canCreate: perm.can_create && masterEdit,
      canUpdate: perm.can_update && masterEdit,
      canDelete: perm.can_delete && masterDelete,
    };
  };

  const canEdit = () => {
    if (!user) return false;
    if (user.role_nom === 'Administrateur') return true;
    return !!user.can_edit;
  };

  const canDelete = () => {
    if (!user) return false;
    if (user.role_nom === 'Administrateur') return true;
    return !!user.can_delete;
  };

  const canPrint = () => {
    if (!user) return false;
    if (user.role_nom === 'Administrateur') return true;
    return !!user.can_print;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      userPermissions,
      granularPermissions,
      loading,
      login,
      logout,
      hasPermission,
      canEdit,
      canDelete,
      canPrint,
      refreshPermissions,
      checkGranular
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- NEW HOOK ---
export const usePermission = (menuCode: string) => {
  const { checkGranular } = useAuth();
  return checkGranular(menuCode);
};
