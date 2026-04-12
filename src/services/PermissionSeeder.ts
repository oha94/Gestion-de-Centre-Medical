import { getDb } from "../lib/db";

export const PermissionSeeder = {
    seed: async () => {
        try {
            const db = await getDb();
            console.log("🌱 Starting Permission Seeding...");

            // --- 1. MIGRATION SCHEMA (Ensure columns exist) ---
            try {
                await db.execute("SELECT code FROM app_menus LIMIT 1");
            } catch (e) {
                console.log("Migration: Adding 'code' column to app_menus...");
                // Add code column
                await db.execute("ALTER TABLE app_menus ADD COLUMN code VARCHAR(100) NULL");
                // Add unique index to avoid duplicates based on code
                try {
                    await db.execute("CREATE UNIQUE INDEX idx_menu_code ON app_menus(code)");
                } catch (errIndex) {
                    console.warn("Index creation failed (might exist):", errIndex);
                }
            }

            try {
                await db.execute("SELECT categorie FROM app_menus LIMIT 1");
            } catch (e) {
                console.log("Migration: Adding 'categorie' column to app_menus...");
                await db.execute("ALTER TABLE app_menus ADD COLUMN categorie VARCHAR(100) DEFAULT 'AUTRES'");
            }

            try {
                await db.execute("SELECT lien FROM app_menus LIMIT 1");
            } catch (e) {
                console.log("Migration: Adding 'lien' column to app_menus...");
                await db.execute("ALTER TABLE app_menus ADD COLUMN lien VARCHAR(255) DEFAULT ''");
            }


            // --- 2. DEFINE PERMISSIONS ---
            // Distinguish Categories with a prefix for clarity in filtering, or just use clear names.
            const permissions = [
                // --- CAISSE ---
                { code: 'CAISSE_VIEW', libelle: 'Vue Principale', categorie: 'MODULE_CAISSE', icone: '💰', ordre: 10 },
                { code: 'CAISSE_ADD_ITEM', libelle: 'Ajouter au Panier', categorie: 'MODULE_CAISSE', icone: '➕', ordre: 20 },
                { code: 'CAISSE_DEL_ROW', libelle: 'Supprimer Ligne Panier', categorie: 'MODULE_CAISSE', icone: '🗑️', ordre: 30 },
                { code: 'CAISSE_VALIDATE', libelle: 'Valider Encaissement', categorie: 'MODULE_CAISSE', icone: '🚀', ordre: 40 },
                { code: 'CAISSE_TOGGLE_ASSUR', libelle: 'Basculer Assurance/Cash', categorie: 'MODULE_CAISSE', icone: '🛡️', ordre: 50 },
                { code: 'CAISSE_FORCE_PRICE', libelle: 'Forcer Prix (Admin)', categorie: 'MODULE_CAISSE', icone: '✏️', ordre: 60 },
                { code: 'CAISSE_PRINT_REC', libelle: 'Réimprimer Reçu', categorie: 'MODULE_CAISSE', icone: '🖨️', ordre: 70 },

                // --- INFIRMIER ---
                { code: 'INFIRMIER_VIEW', libelle: 'Vue Principale', categorie: 'MODULE_INFIRMIER', icone: '💉', ordre: 10 },
                { code: 'INFIRMIER_ACTES', libelle: 'Gestion Actes/Soins', categorie: 'MODULE_INFIRMIER', icone: '🩹', ordre: 20 },
                { code: 'INFIRMIER_KITS_MANAGE', libelle: 'Gestion des Kits', categorie: 'MODULE_INFIRMIER', icone: '📦', ordre: 30 },
                { code: 'INFIRMIER_KITS_CONSUME', libelle: 'Sortie de Stock/Kit', categorie: 'MODULE_INFIRMIER', icone: '📤', ordre: 40 },

                // --- CONSULTATION ---
                { code: 'CONSULT_VIEW', libelle: 'Vue Consultations', categorie: 'MODULE_CONSULTATION', icone: '🩺', ordre: 10 },
                { code: 'CONSULT_CREATE', libelle: 'Nouvelle Consultation', categorie: 'MODULE_CONSULTATION', icone: '➕', ordre: 20 },
                { code: 'CONSULT_HISTORY', libelle: 'Voir Historique Dossier', categorie: 'MODULE_CONSULTATION', icone: '📜', ordre: 30 },
                { code: 'CONSULT_CONSTANTES', libelle: 'Saisie Constantes', categorie: 'MODULE_CONSULTATION', icone: '🌡️', ordre: 40 },

                // --- LABORATOIRE ---
                { code: 'LABO_VIEW', libelle: 'Vue Laboratoire', categorie: 'MODULE_LABO', icone: '🔬', ordre: 10 },
                { code: 'LABO_RESULTS', libelle: 'Saisir Résultats', categorie: 'MODULE_LABO', icone: '🧪', ordre: 20 },
                { code: 'LABO_VALIDATE', libelle: 'Valider Résultats', categorie: 'MODULE_LABO', icone: '✅', ordre: 30 },
                { code: 'LABO_PRINT', libelle: 'Imprimer Résultats', categorie: 'MODULE_LABO', icone: '🖨️', ordre: 40 },

                // --- HOSPITALISATION ---
                { code: 'HOSPI_VIEW', libelle: 'Vue Hospitalisation', categorie: 'MODULE_HOSPI', icone: '🏥', ordre: 10 },
                { code: 'HOSPI_ADMIT', libelle: 'Nouvelle Admission', categorie: 'MODULE_HOSPI', icone: '📥', ordre: 20 },
                { code: 'HOSPI_DISCHARGE', libelle: 'Sortie Patient', categorie: 'MODULE_HOSPI', icone: '📤', ordre: 30 },
                { code: 'HOSPI_PLANNING', libelle: 'Gestion Lits/Planning', categorie: 'MODULE_HOSPI', icone: '🛏️', ordre: 40 },

                // --- STOCK ---
                { code: 'STOCK_VIEW', libelle: 'Vue Stock Global', categorie: 'MODULE_STOCK', icone: '📦', ordre: 10 },
                { code: 'STOCK_ENTRY', libelle: 'Faire une Entrée', categorie: 'MODULE_STOCK', icone: '📥', ordre: 20 },
                { code: 'STOCK_EXIT', libelle: 'Faire une Sortie', categorie: 'MODULE_STOCK', icone: '📤', ordre: 30 },
                { code: 'STOCK_INVENTORY', libelle: 'Faire Inventaire', categorie: 'MODULE_STOCK', icone: '📝', ordre: 40 },
                { code: 'STOCK_SEE_PRICES', libelle: 'Voir Prix Achat/Marge', categorie: 'MODULE_STOCK', icone: '👁️', ordre: 50 },
                { code: 'STOCK_RAYONS', libelle: 'Gérer Rayons', categorie: 'MODULE_STOCK', icone: '🗄️', ordre: 60 },

                // --- DOCUMENTS ---
                { code: 'DOCS_VIEW', libelle: 'Vue Documents', categorie: 'MODULE_DOCUMENTS', icone: '📂', ordre: 10 },
                { code: 'DOCS_STATS', libelle: 'Voir Statistiques', categorie: 'MODULE_DOCUMENTS', icone: '📊', ordre: 20 },

                // --- PATIENTS ---
                { code: 'PATIENTS_VIEW', libelle: 'Vue Patients', categorie: 'MODULE_PATIENTS', icone: '👥', ordre: 10 },
                { code: 'PATIENTS_ADD', libelle: 'Créer Patient', categorie: 'MODULE_PATIENTS', icone: '➕', ordre: 20 },
                { code: 'PATIENTS_EDIT', libelle: 'Modifier Patient', categorie: 'MODULE_PATIENTS', icone: '✏️', ordre: 30 },

                // --- FACTURATION ---
                { code: 'BILLING_VIEW', libelle: 'Factures & Devis', categorie: 'MODULE_FACTURATION', icone: '📄', ordre: 10 },
                { code: 'BILLING_NEW', libelle: 'Nouvelle Facture', categorie: 'MODULE_FACTURATION', icone: '➕', ordre: 20 },

                // --- VENTES (HISTORIQUE) ---
                { code: 'VENTES_VIEW', libelle: 'Historique Ventes', categorie: 'MODULE_VENTES', icone: '📜', ordre: 10 },
                { code: 'VENTES_EDIT', libelle: 'Modifier/Recharger Vente', categorie: 'MODULE_VENTES', icone: '✏️', ordre: 20 },
                { code: 'VENTES_DELETE', libelle: 'Annuler/Supprimer Vente', categorie: 'MODULE_VENTES', icone: '🗑️', ordre: 30 },

                // --- RECOUVREMENT ---
                { code: 'RECOUVREMENT_VIEW', libelle: 'Vue Recouvrement', categorie: 'MODULE_RECOUVREMENT', icone: '💸', ordre: 10 },
                { code: 'RECOUVREMENT_COLLECT', libelle: 'Encaisser Dette', categorie: 'MODULE_RECOUVREMENT', icone: '💰', ordre: 20 },
                { code: 'RECOUVREMENT_HISTORY', libelle: 'Voir Historique', categorie: 'MODULE_RECOUVREMENT', icone: 'clock', ordre: 30 },

                // --- ADMIN / PARAMETRES --- 
                { code: 'PARAM_VIEW', libelle: 'Vue Paramètres', categorie: 'MODULE_PARAMETRES', icone: '⚙️', ordre: 10 },
                { code: 'PARAM_USERS', libelle: 'Gestion Utilisateurs', categorie: 'MODULE_PARAMETRES', icone: '👤', ordre: 20 },
                { code: 'PARAM_ROLES', libelle: 'Gestion Rôles', categorie: 'MODULE_PARAMETRES', icone: '🔑', ordre: 30 },
                { code: 'PARAM_DB', libelle: 'Config BDD', categorie: 'MODULE_PARAMETRES', icone: '💾', ordre: 40 },
                
                // --- SUIVI COMPTES ---
                { code: 'suivi_comptes', libelle: 'Suivi des Comptes', categorie: 'MODULE_FACTURATION', icone: '📒', ordre: 100 }
            ];

            // --- 3. INSERT / UPDATE ---
            for (const p of permissions) {
                // Check if exists by CODE
                const exists = await db.select<any[]>("SELECT id FROM app_menus WHERE code = ?", [p.code]);

                if (exists.length === 0) {
                    // Insert
                    // Note: 'lien' is required by some legacy logic? We set it to empty string or a dummy path.
                    await db.execute(
                        "INSERT INTO app_menus (code, libelle, categorie, icone, ordre, actif, lien) VALUES (?, ?, ?, ?, ?, 1, '')",
                        [p.code, p.libelle, p.categorie, p.icone, p.ordre]
                    );
                    console.log(`[SEED] Added: ${p.code}`);
                } else {
                    // Update (to ensure labels/categories are up to date)
                    await db.execute(
                        "UPDATE app_menus SET libelle = ?, categorie = ?, icone = ?, ordre = ? WHERE code = ?",
                        [p.libelle, p.categorie, p.icone, p.ordre, p.code]
                    );
                }
            }

            console.log("✅ Permissions seeded successfully.");

        } catch (e) {
            console.error("❌ Error seeding permissions:", e);
        }
    }
};
