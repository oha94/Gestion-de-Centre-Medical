import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hache un mot de passe en texte clair.
 * @param password Le mot de passe (plain text).
 * @returns Le hash sécurisé.
 */
export const hashPassword = async (password: string): Promise<string> => {
    if (!password) return "";
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Vérifie si un mot de passe correspond au hash.
 * @param password Le mot de passe (plain text).
 * @param hash Le hash stocké en base.
 * @returns true si correspondance, false sinon.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    if (!password || !hash) return false;
    // Si le "hash" ne ressemble pas à un hash bcrypt (ex: ancien mot de passe plain text non migré), 
    // on peut tenter une comparaison simple par sécurité fallback (optionnel, mais risqué).
    // ICI : Politique stricte = on compare uniquement via bcrypt.
    // Si le hash en DB est "admin" (plain), bcrypt.compare("admin", "admin") retournera false.
    // C'est pourquoi la migration dans App.tsx est CRITIQUE.
    return await bcrypt.compare(password, hash);
};

/**
 * Vérifie si une chaîne ressemble à un hash bcrypt.
 * Utile pour la migration.
 */
export const isBcryptHash = (str: string): boolean => {
    return str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$');
};
