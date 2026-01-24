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
  // ... other fields
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  userPermissions: string[]; // List of menu codes
  loading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => void;
  hasPermission: (menuCode: string) => boolean;
  canEdit: () => boolean;
  canDelete: () => boolean;
  canPrint: () => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  userPermissions: [],
  loading: true,
  login: async () => { },
  logout: () => { },
  hasPermission: () => false,
  canEdit: () => false,
  canDelete: () => false,
  canPrint: () => false,
  refreshPermissions: async () => { },
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user from local storage on mount (if persisted) or valid session
  // For this app, it seems likely we rely on session or re-login. 
  // Looking at App.tsx, there was no auto-login from localStorage visible in the snippet I saw, 
  // except maybe some setup check. I will stick to basic state for now, 
  // but if the user wants persistence we can add it later.
  // Actually, App.tsx had no persistence logic for USER, only for SIDEBAR.
  // So on refresh, user is logged out. That is fine for now.

  useEffect(() => {
    // Just stop loading initially
    setLoading(false);
  }, []);

  const refreshPermissions = async () => {
    if (!user) return;
    try {
      const db = await getDb();
      // Fetch user role options again to be sure (in case they changed)
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

      // Fetch menus
      const perms = await db.select<any[]>(`
        SELECT m.code 
        FROM app_role_permissions rp 
        JOIN app_menus m ON rp.menu_id = m.id 
        WHERE rp.role_id = ?
      `, [user.role_id]);
      const codes = perms.map(p => p.code);
      setUserPermissions(codes);
    } catch (e) {
      console.error("Error refreshing permissions:", e);
    }
  };

  const login = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);

    // Normalize boolean flags from DB (which might be 0/1)
    const normalizedUser = {
      ...loggedInUser,
      can_delete: loggedInUser.can_delete === 1 || loggedInUser.can_delete === true,
      can_edit: loggedInUser.can_edit === 1 || loggedInUser.can_edit === true,
      can_print: loggedInUser.can_print === 1 || loggedInUser.can_print === true,
    };
    setUser(normalizedUser);

    try {
      const db = await getDb();
      console.log(`[AUTH] Fetching permissions for Role ID: ${loggedInUser.role_id}`);
      const perms = await db.select<any[]>(`
        SELECT m.code 
        FROM app_role_permissions rp 
        JOIN app_menus m ON rp.menu_id = m.id 
        WHERE rp.role_id = ?
      `, [loggedInUser.role_id]);
      console.log("[AUTH] Raw Permissions DB Result:", perms);
      const codes = perms.map(p => p.code);
      console.log("[AUTH] Final Permission Codes:", codes);
      setUserPermissions(codes);
    } catch (e) {
      console.error("Error fetching permissions:", e);
      setUserPermissions([]);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setUserPermissions([]);
  };

  const hasPermission = (menuCode: string) => {
    if (!user) return false;
    if (user.role_nom === 'Administrateur') return true;
    return userPermissions.includes(menuCode);
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
      loading,
      login,
      logout,
      hasPermission,
      canEdit,
      canDelete,
      canPrint,
      refreshPermissions
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
