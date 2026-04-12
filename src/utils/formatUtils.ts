/**
 * Normalise une date au format ISO (YYYY-MM-DD)
 * Gère les formats DD/MM/YYYY et YYYY-MM-DD
 */
export const normalizeToISO = (dateStr: string): string => {
    if (!dateStr) return "";
    
    // Si déjà au format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Si au format DD/MM/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Cas DD/MM/YYYY
            if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            // Cas YYYY/MM/DD
            if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
    }
    
    return dateStr;
};

/**
 * Convertit une date ISO (YYYY-MM-DD) en format français (DD/MM/YYYY)
 */
export const toFRFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    const iso = normalizeToISO(dateStr);
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

/**
 * Convertit une chaîne en majuscules de manière sécurisée
 */
export const toUpperCaseSafe = (str: any): string => {
    if (!str) return "";
    return String(str).toUpperCase();
};
