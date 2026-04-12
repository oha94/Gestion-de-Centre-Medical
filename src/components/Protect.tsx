import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectProps {
    code: string; // The permission code, e.g., 'caisse'
    action?: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE'; // Action to check
    children: React.ReactNode;
    fallback?: React.ReactNode; // Optional content to show if permission is denied
}

/**
 * Wrapper component to protect UI elements based on granular permissions.
 */
export const Protect: React.FC<ProtectProps> = ({ code, action = 'VIEW', children, fallback = null }) => {
    const { user, isAuthenticated, checkGranular } = useAuth();

    // 1. If not authenticated, deny
    if (!isAuthenticated || !user) return <>{fallback}</>;

    // 2. Admin always has access
    if (user.role_nom === 'Administrateur') return <>{children}</>;

    // 3. Check granular permissions
    const perms = checkGranular(code);

    let hasAccess = false;
    switch (action) {
        case 'CREATE':
            hasAccess = perms.canCreate;
            break;
        case 'UPDATE':
            hasAccess = perms.canUpdate;
            break;
        case 'DELETE':
            hasAccess = perms.canDelete;
            break;
        case 'VIEW':
        default:
            hasAccess = perms.canRead;
            break;
    }

    if (hasAccess) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
