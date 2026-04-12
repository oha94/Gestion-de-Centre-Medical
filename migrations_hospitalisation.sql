-- ==========================================
-- MIGRATION MODULE HOSPITALISATION
-- ==========================================

-- 1. Table Types de Chambres (Standard, VIP, etc.)
CREATE TABLE IF NOT EXISTS `chambre_types` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `libelle` VARCHAR(100) NOT NULL,
  `prix_journalier_standard` INT(11) DEFAULT 0,
  `prix_ami_standard` INT(11) DEFAULT 4000,
  `prix_journalier_ventile` INT(11) DEFAULT 0,
  `prix_ami_ventile` INT(11) DEFAULT 4000,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertion des types par défaut si vide
INSERT INTO `chambre_types` (`libelle`, `prix_journalier_standard`, `prix_ami_standard`) 
SELECT 'Standard', 10000, 4000 WHERE NOT EXISTS (SELECT * FROM chambre_types);

INSERT INTO `chambre_types` (`libelle`, `prix_journalier_standard`, `prix_ami_standard`) 
SELECT 'VIP', 25000, 4000 WHERE NOT EXISTS (SELECT * FROM chambre_types WHERE libelle='VIP');

-- 2. Mise à jour de la table Check Chambres existante
-- Ajout de la colonne type_id si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = "chambres";
SET @columnname = "type_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE chambres ADD COLUMN type_id INT(11) DEFAULT NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Lier type_id
-- (Optionnel: ajouter FK si besoin, mais on reste simple pour l'instant)

-- 3. Table Tarifs Spécifiques Assurances (Matrice Assurance x Type Chambre)
CREATE TABLE IF NOT EXISTS `tarifs_hospitalisation` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `assurance_id` INT(11) NOT NULL,
  `chambre_type_id` INT(11) NOT NULL,
  `prix_chambre` INT(11) DEFAULT 0,
  `prix_ami` INT(11) DEFAULT 0,
  `prix_chambre_ventile` INT(11) DEFAULT 0,
  `prix_ami_ventile` INT(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assur_type` (`assurance_id`, `chambre_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Table Prestations durant Séjour (Soins, Médicaments)
CREATE TABLE IF NOT EXISTS `admission_prestations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admission_id` INT(11) NOT NULL,
  `prestation_id` INT(11) DEFAULT NULL,
  `libelle` VARCHAR(255) DEFAULT NULL,
  `prix_unitaire` INT(11) DEFAULT 0,
  `quantite` INT(11) DEFAULT 1,
  `type` ENUM('ACTE', 'MEDICAMENT', 'AUTRE') DEFAULT 'ACTE',
  `source_id` INT(11) DEFAULT NULL COMMENT 'ID dans table prestations ou stock_articles',
  `date_ajout` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `user_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admission` (`admission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Table Observations Médicales (Notes Infirmier/Médecin)
CREATE TABLE IF NOT EXISTS `admission_observations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admission_id` INT(11) NOT NULL,
  `note` TEXT NOT NULL,
  `date_obs` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `user_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admission_obs` (`admission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Mise à jour table Admissions (Mode Tarifaire)
SET @dbname = DATABASE();
SET @tablename = "admissions";
SET @columnname = "mode_tarif";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE admissions ADD COLUMN mode_tarif VARCHAR(50) DEFAULT 'STANDARD';"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

