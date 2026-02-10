import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectProps {
    code: string; // The permission code, e.g., 'CAISSE_DEL_ROW'
    children: React.ReactNode;
    fallback?: React.ReactNode; // Optional content to show if permission is denied
}

/**
 * Wrapper component to protect UI elements based on granular permissions.
 * Usage:
 * <Protect code="CAISSE_DEL_ROW">
 *   <button>Delete</button>
 * </Protect>
 */
export const Protect: React.FC<ProtectProps> = ({ code, children, fallback = null }) => {
    const { user, userPermissions, isAuthenticated } = useAuth();

    // 1. If not authenticated, deny
    if (!isAuthenticated || !user) return <>{fallback}</>;

    // 2. Admin always has access
    if (user.role_nom === 'Administrateur') return <>{children}</>;

    // 3. Check if the user has the specific permission code
    // The 'userPermissions' array in AuthContext now holds all the codes (menus + granular actions)
    // that the user has been granted access to.
    // We assume 'checkGranular' logic is for CRUD on a specific resource, 
    // but for simple "Can I see this button?", checking the list of codes is sufficient.
    // HOWEVER, AuthContext.loadPermissions currently loads `app_menus.code`.
    // We will insert these granular actions into `app_menus` so they appear in that list.

    const hasAccess = userPermissions.includes(code);

    if (hasAccess) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
