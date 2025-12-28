import Database from '@tauri-apps/plugin-sql';

export interface SetupStatus {
    isConfigured: boolean;
    hasAdmin: boolean;
    setupCompleted: boolean;
}

export interface AdminData {
    nom_complet: string;
    username: string;
    email?: string;
    password: string;
}

class SetupService {
    private db: Database | null = null;

    /**
     * Initialize database connection
     */
    private async getDb(): Promise<Database> {
        if (!this.db) {
            this.db = await Database.load('mysql://root@localhost/focolari_db');
        }
        return this.db;
    }

    /**
     * Check if the application is configured
     */
    async checkSetupStatus(): Promise<SetupStatus> {
        try {
            const db = await this.getDb();

            // Check if setup_completed flag is set
            const paramResult: any[] = await db.select(
                'SELECT setup_completed FROM app_parametres_app WHERE id = 1'
            );

            const setupCompleted = paramResult.length > 0 && paramResult[0].setup_completed === 1;

            // Check if there's at least one admin user
            const adminResult: any[] = await db.select(`
        SELECT COUNT(*) as count 
        FROM app_utilisateurs u
        INNER JOIN app_roles r ON u.role_id = r.id
        WHERE r.nom = 'Administrateur' AND u.actif = 1
      `);

            const hasAdmin = adminResult.length > 0 && adminResult[0].count > 0;

            return {
                isConfigured: setupCompleted,
                hasAdmin,
                setupCompleted
            };
        } catch (error) {
            console.error('Error checking setup status:', error);
            return {
                isConfigured: false,
                hasAdmin: false,
                setupCompleted: false
            };
        }
    }

    /**
     * Create initial admin user
     */
    async createInitialAdmin(adminData: AdminData): Promise<boolean> {
        try {
            const db = await this.getDb();

            // Get Admin role ID
            const roleResult: any[] = await db.select(
                "SELECT id FROM app_roles WHERE nom = 'Administrateur' LIMIT 1"
            );

            if (roleResult.length === 0) {
                throw new Error('Admin role not found in database');
            }

            const roleId = roleResult[0].id;

            // Check if username already exists
            const existingUser: any[] = await db.select(
                'SELECT id FROM app_utilisateurs WHERE username = ?',
                [adminData.username]
            );

            if (existingUser.length > 0) {
                throw new Error('Username already exists');
            }

            // Insert new admin user
            await db.execute(
                `INSERT INTO app_utilisateurs 
        (nom_complet, username, email, password_hash, role_id, actif, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
                [
                    adminData.nom_complet,
                    adminData.username,
                    adminData.email || null,
                    adminData.password, // Note: In production, this should be hashed!
                    roleId
                ]
            );

            return true;
        } catch (error) {
            console.error('Error creating admin user:', error);
            throw error;
        }
    }

    /**
     * Complete setup and mark as configured
     */
    async completeSetup(): Promise<boolean> {
        try {
            const db = await this.getDb();

            // Update setup_completed flag
            await db.execute(
                'UPDATE app_parametres_app SET setup_completed = 1, updated_at = NOW() WHERE id = 1'
            );

            return true;
        } catch (error) {
            console.error('Error completing setup:', error);
            return false;
        }
    }

    /**
     * Initialize database with default data if needed
     */
    async initializeDatabase(): Promise<boolean> {
        try {
            const db = await this.getDb();

            // Check if app_parametres_app has a record
            const paramResult: any[] = await db.select(
                'SELECT id FROM app_parametres_app WHERE id = 1'
            );

            if (paramResult.length === 0) {
                // Insert default app parameters
                await db.execute(`
          INSERT INTO app_parametres_app 
          (id, nom_application, couleur_primaire, couleur_secondaire, format_date, devise, langue, timezone, setup_completed) 
          VALUES (1, 'FOCOLARI', '#3498db', '#2c3e50', 'DD/MM/YYYY', 'FCFA', 'fr', 'Africa/Abidjan', 0)
        `);
            }

            // Check if default roles exist
            const rolesResult: any[] = await db.select('SELECT COUNT(*) as count FROM app_roles');

            if (rolesResult[0].count === 0) {
                // Insert default roles
                await db.execute(`
          INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit, can_print) VALUES
          ('Administrateur', 'Accès complet à toutes les fonctionnalités', '#e74c3c', 1, 1, 1, 1),
          ('Médecin', 'Accès aux consultations et dossiers patients', '#3498db', 1, 1, 1, 1),
          ('Infirmier', 'Accès aux soins infirmiers et hospitalisation', '#2ecc71', 1, 1, 1, 1),
          ('Laborantin', 'Accès au laboratoire et analyses', '#9b59b6', 1, 1, 1, 1),
          ('Caissier', 'Accès à la caisse et facturation', '#f39c12', 1, 0, 0, 0),
          ('Pharmacien', 'Accès à la gestion du stock pharmaceutique', '#1abc9c', 1, 1, 1, 1),
          ('Réceptionniste', 'Accès à l accueil et gestion des rendez-vous', '#95a5a6', 1, 1, 1, 1)
        `);
            }

            // Check if default menus exist
            const menusResult: any[] = await db.select('SELECT COUNT(*) as count FROM app_menus');

            if (menusResult[0].count === 0) {
                // Insert default menus
                await db.execute(`
          INSERT INTO app_menus (code, libelle, categorie, icone, ordre, actif) VALUES
          ('dashboard', 'Tableau de bord', 'Général', '🏠', 1, 1),
          ('patients', 'Patients', 'Médical', '👥', 10, 1),
          ('consultation', 'Consultation', 'Médical', '🩺', 11, 1),
          ('laboratoire', 'Laboratoire', 'Médical', '🔬', 12, 1),
          ('infirmier', 'Infirmier', 'Médical', '💉', 13, 1),
          ('hospitalisation', 'Hospitalisation', 'Médical', '🏨', 14, 1),
          ('assurances', 'Assurances', 'Administration', '🛡️', 20, 1),
          ('caisse', 'Caisse & Factures', 'Administration', '💰', 21, 1),
          ('stock', 'Gestion Stock', 'Logistique', '📦', 30, 1),
          ('parametres', 'Paramètres', 'Configuration', '⚙️', 40, 1)
        `);
            }

            return true;
        } catch (error) {
            console.error('Error initializing database:', error);
            return false;
        }
    }

    /**
     * Validate password strength
     */
    validatePassword(password: string): { valid: boolean; message: string } {
        if (password.length < 8) {
            return { valid: false, message: 'Le mot de passe doit contenir au moins 8 caractères' };
        }

        if (!/[a-zA-Z]/.test(password)) {
            return { valid: false, message: 'Le mot de passe doit contenir au moins une lettre' };
        }

        if (!/[0-9]/.test(password)) {
            return { valid: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
        }

        return { valid: true, message: 'Mot de passe valide' };
    }

    /**
     * Validate username
     */
    validateUsername(username: string): { valid: boolean; message: string } {
        if (username.length < 3) {
            return { valid: false, message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' };
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { valid: false, message: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores' };
        }

        return { valid: true, message: 'Nom d\'utilisateur valide' };
    }
}

export default new SetupService();
