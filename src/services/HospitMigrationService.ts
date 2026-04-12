import { getDb } from "../lib/db";

export const HospitMigrationService = {
    async runMigration() {
        const db = await getDb();
        console.log("Début de la migration Hospitalisation...");

        try {
            // 1. Table Types de Chambres
            await db.execute(`
            CREATE TABLE IF NOT EXISTS chambre_types (
                id INT(11) NOT NULL AUTO_INCREMENT,
                libelle VARCHAR(100) NOT NULL,
                prix_journalier_standard INT(11) DEFAULT 0,
                prix_ami_standard INT(11) DEFAULT 4000,
                prix_journalier_ventile INT(11) DEFAULT 0,
                prix_ami_ventile INT(11) DEFAULT 4000,
                PRIMARY KEY (id)
            )
        `);

            // Insertion types par défaut
            const types = await db.select<any[]>("SELECT * FROM chambre_types");
            if (types.length === 0) {
                await db.execute("INSERT INTO chambre_types (libelle, prix_journalier_standard, prix_ami_standard) VALUES ('Standard', 10000, 4000)");
                await db.execute("INSERT INTO chambre_types (libelle, prix_journalier_standard, prix_ami_standard) VALUES ('VIP', 25000, 4000)");
            }

            // 2. Colonne type_id dans chambres
            // Check if column exists is tricky in portable SQL, we try to Select it, if fails we add it? 
            // Or cleaner: use a try/catch block for the ALTER
            try {
                await db.select("SELECT type_id FROM chambres LIMIT 1");
            } catch (e) {
                console.log("Colonne type_id manquante, ajout...");
                await db.execute("ALTER TABLE chambres ADD COLUMN type_id INT(11) DEFAULT NULL");
            }

            // 3. Table Tarifs Spécifiques Assurances
            await db.execute(`
            CREATE TABLE IF NOT EXISTS tarifs_hospitalisation (
                id INT(11) NOT NULL AUTO_INCREMENT,
                assurance_id INT(11) NOT NULL,
                chambre_type_id INT(11) NOT NULL,
                prix_chambre INT(11) DEFAULT 0,
                prix_ami INT(11) DEFAULT 0,
                prix_chambre_ventile INT(11) DEFAULT 0,
                prix_ami_ventile INT(11) DEFAULT 0,
                PRIMARY KEY (id),
                UNIQUE KEY unique_assur_type (assurance_id, chambre_type_id)
            )
        `);

            // 3b. Mettre à jour la table tarifs_hospitalisation si elle existait déjà sans les colonnes ventilées
            try {
                await db.select("SELECT prix_chambre_ventile FROM tarifs_hospitalisation LIMIT 1");
            } catch (e) {
                console.log("Colonnes ventilées manquantes dans tarifs_hospitalisation, ajout...");
                await db.execute("ALTER TABLE tarifs_hospitalisation ADD COLUMN prix_chambre_ventile INT(11) DEFAULT 0");
                await db.execute("ALTER TABLE tarifs_hospitalisation ADD COLUMN prix_ami_ventile INT(11) DEFAULT 0");
            }

            // 4. Table Prestations durant Séjour
            await db.execute(`
            CREATE TABLE IF NOT EXISTS admission_prestations (
                id INT(11) NOT NULL AUTO_INCREMENT,
                admission_id INT(11) NOT NULL,
                prestation_id INT(11) DEFAULT NULL,
                libelle VARCHAR(255) DEFAULT NULL,
                prix_unitaire INT(11) DEFAULT 0,
                quantite INT(11) DEFAULT 1,
                type ENUM('ACTE', 'MEDICAMENT', 'AUTRE') DEFAULT 'ACTE',
                source_id INT(11) DEFAULT NULL,
                date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id INT(11) DEFAULT NULL,
                PRIMARY KEY (id)
            )
        `);

            // 5. Table Observations Médicales
            await db.execute(`
            CREATE TABLE IF NOT EXISTS admission_observations (
                id INT(11) NOT NULL AUTO_INCREMENT,
                admission_id INT(11) NOT NULL,
                note TEXT NOT NULL,
                date_obs DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id INT(11) DEFAULT NULL,
                PRIMARY KEY (id)
            )
        `);

            // 6. Colonne mode_tarif dans admissions
            try {
                await db.select("SELECT mode_tarif FROM admissions LIMIT 1");
            } catch (e) {
                console.log("Colonne mode_tarif manquante, ajout...");
                await db.execute("ALTER TABLE admissions ADD COLUMN mode_tarif VARCHAR(50) DEFAULT 'STANDARD'");
            }

            // 7. Colonne cotation dans prestations (Pour Actes Labo)
            try {
                await db.select("SELECT cotation FROM prestations LIMIT 1");
            } catch (e) {
                console.log("Colonne cotation manquante, ajout...");
                await db.execute("ALTER TABLE prestations ADD COLUMN cotation INT(11) DEFAULT 0");
            }

            // 8. Colonne valeur_cotation dans assurances (Pour calcul dynamique : Cotation * Valeur)
            try {
                await db.select("SELECT valeur_cotation FROM assurances LIMIT 1");
            } catch (e) {
                console.log("Colonne valeur_cotation manquante, ajout...");
                await db.execute("ALTER TABLE assurances ADD COLUMN valeur_cotation INT(11) DEFAULT 0");
            }

            console.log("Migration terminée avec succès.");
            return { success: true, message: "Base de données mise à jour avec succès !" };
        } catch (e: any) {
            console.error("Erreur migration:", e);
            return { success: false, message: "Erreur migration: " + e.message };
        }
    }
};
