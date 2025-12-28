-- =====================================================
-- Structure complète de la base de données focolari_db
-- Centre Médical - Gestion Hospitalière
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- =====================================================
-- TABLES SYSTÈME ET CONFIGURATION
-- =====================================================

-- Table: app_parametres_app
CREATE TABLE IF NOT EXISTS `app_parametres_app` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_application` VARCHAR(200) DEFAULT 'FOCOLARI',
  `logo_app_url` VARCHAR(255) DEFAULT NULL,
  `couleur_primaire` VARCHAR(7) DEFAULT '#3498db',
  `couleur_secondaire` VARCHAR(7) DEFAULT '#2c3e50',
  `format_date` VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  `devise` VARCHAR(10) DEFAULT 'FCFA',
  `langue` VARCHAR(10) DEFAULT 'fr',
  `timezone` VARCHAR(50) DEFAULT 'Africa/Abidjan',
  `activer_email` TINYINT(1) DEFAULT 0,
  `activer_sms` TINYINT(1) DEFAULT 0,
  `maintenance_mode` TINYINT(1) DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `date_systeme_actuelle` DATE DEFAULT NULL,
  `derniere_cloture` DATE DEFAULT NULL,
  `alerte_date_diff` TINYINT(1) DEFAULT 1,
  `jours_decloture_max` INT(11) DEFAULT 7,
  `adresse` TEXT DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `setup_completed` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paramètres globaux de l application';

-- Table: app_parametres_entreprise
CREATE TABLE IF NOT EXISTS `app_parametres_entreprise` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_entreprise` VARCHAR(200) NOT NULL,
  `sigle` VARCHAR(50) DEFAULT NULL,
  `adresse` TEXT DEFAULT NULL,
  `ville` VARCHAR(100) DEFAULT NULL,
  `pays` VARCHAR(100) DEFAULT 'Côte d''Ivoire',
  `telephone` VARCHAR(50) DEFAULT NULL,
  `telephone2` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(200) DEFAULT NULL,
  `site_web` VARCHAR(200) DEFAULT NULL,
  `nif` VARCHAR(100) DEFAULT NULL,
  `rccm` VARCHAR(100) DEFAULT NULL,
  `registre_commerce` VARCHAR(100) DEFAULT NULL,
  `logo_url` VARCHAR(255) DEFAULT NULL,
  `slogan` TEXT DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Informations de l entreprise pour documents officiels';

-- Table: app_menus
CREATE TABLE IF NOT EXISTS `app_menus` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(200) NOT NULL,
  `categorie` VARCHAR(100) DEFAULT NULL,
  `icone` VARCHAR(50) DEFAULT NULL,
  `ordre` INT(11) DEFAULT 0,
  `actif` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_categorie` (`categorie`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Menus et fonctionnalités disponibles dans l application';

-- Table: app_roles
CREATE TABLE IF NOT EXISTS `app_roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `couleur` VARCHAR(7) DEFAULT '#3498db',
  `actif` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `can_delete` TINYINT(1) DEFAULT 1,
  `can_edit` TINYINT(1) DEFAULT 1,
  `can_print` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nom` (`nom`),
  KEY `idx_nom` (`nom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rôles système (Admin, Médecin, Infirmier, etc.)';

-- Table: app_role_permissions
CREATE TABLE IF NOT EXISTS `app_role_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `role_id` INT(11) NOT NULL,
  `menu_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_menu` (`role_id`,`menu_id`),
  KEY `idx_role` (`role_id`),
  KEY `idx_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Attribution des permissions aux rôles';

-- Table: app_utilisateurs
CREATE TABLE IF NOT EXISTS `app_utilisateurs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_complet` VARCHAR(200) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(200) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` INT(11) DEFAULT NULL,
  `actif` TINYINT(1) DEFAULT 1,
  `photo` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `derniere_connexion` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `personnel_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role_id`),
  KEY `idx_actif` (`actif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Utilisateurs du système avec authentification';

-- =====================================================
-- TABLES RÉFÉRENTIEL ADMINISTRATIF
-- =====================================================

-- Table: assurances
CREATE TABLE IF NOT EXISTS `assurances` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(100) NOT NULL,
  `statut` ENUM('actif','suspendu') DEFAULT 'actif',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: societes
CREATE TABLE IF NOT EXISTS `societes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `assurance_id` INT(11) DEFAULT NULL,
  `nom_societe` VARCHAR(100) NOT NULL,
  `taux_prise_en_charge` INT(11) DEFAULT 0,
  `statut` ENUM('actif','inactif') DEFAULT 'actif',
  PRIMARY KEY (`id`),
  KEY `assurance_id` (`assurance_id`),
  FOREIGN KEY (`assurance_id`) REFERENCES `assurances`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES DOSSIERS PATIENTS
-- =====================================================

-- Table: patients
CREATE TABLE IF NOT EXISTS `patients` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_carnet` VARCHAR(50) DEFAULT NULL,
  `nom_prenoms` VARCHAR(255) DEFAULT NULL,
  `sexe` ENUM('Homme','Femme') DEFAULT NULL,
  `date_naissance` DATE DEFAULT NULL,
  `nom` VARCHAR(100) NOT NULL,
  `prenom` VARCHAR(100) DEFAULT NULL,
  `societe_id` INT(11) DEFAULT NULL,
  `telephone` VARCHAR(20) DEFAULT NULL,
  `telephone2` VARCHAR(20) DEFAULT NULL,
  `taux_patient` INT(11) DEFAULT NULL,
  `statut` ENUM('actif','suspendu') DEFAULT 'actif',
  `date_creation` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ville` VARCHAR(100) DEFAULT NULL,
  `sous_prefecture` VARCHAR(100) DEFAULT NULL,
  `village` VARCHAR(100) DEFAULT NULL,
  `assurance_id` INT(11) DEFAULT NULL,
  `numero_assure` VARCHAR(100) DEFAULT NULL,
  `taux_couverture` INT(11) DEFAULT 80,
  `nom_salarie` TEXT DEFAULT NULL,
  `telephone_assurance` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `societe_id` (`societe_id`),
  KEY `fk_patient_assurance` (`assurance_id`),
  FOREIGN KEY (`societe_id`) REFERENCES `societes`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assurance_id`) REFERENCES `assurances`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: personnel
CREATE TABLE IF NOT EXISTS `personnel` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_prenoms` VARCHAR(255) NOT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `sexe` ENUM('M','F') DEFAULT NULL,
  `quartier` VARCHAR(255) DEFAULT NULL,
  `fonction` VARCHAR(255) DEFAULT NULL,
  `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES CATALOGUE DES ACTES ET SOINS
-- =====================================================

-- Table: prestations
CREATE TABLE IF NOT EXISTS `prestations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `libelle` VARCHAR(100) DEFAULT NULL,
  `prix_standard` INT(11) DEFAULT NULL,
  `categorie` VARCHAR(50) DEFAULT 'GENERAL',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES FLUX FINANCIERS (CAISSE)
-- =====================================================

-- Table: ventes
CREATE TABLE IF NOT EXISTS `ventes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patient_id` INT(11) DEFAULT NULL,
  `acte_libelle` VARCHAR(100) DEFAULT NULL,
  `montant_total` INT(11) DEFAULT NULL,
  `part_patient` INT(11) DEFAULT NULL,
  `part_assureur` INT(11) DEFAULT NULL,
  `mode_paiement` ENUM('CASH','WAVE','ORANGE','MTN') DEFAULT 'CASH',
  `date_vente` DATETIME DEFAULT NULL,
  `statut` TEXT DEFAULT 'PAYE',
  `reste_a_payer` DOUBLE DEFAULT 0,
  `type_vente` TEXT DEFAULT 'ACTE',
  `article_id` INT(11) DEFAULT NULL,
  `personnel_id` INT(11) DEFAULT NULL,
  `numero_bon` TEXT DEFAULT NULL,
  `societe_nom` TEXT DEFAULT NULL,
  `numero_ticket` VARCHAR(50) DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: ventes_supprimees
CREATE TABLE IF NOT EXISTS `ventes_supprimees` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `vente_id` INT(11) DEFAULT NULL,
  `patient_nom` VARCHAR(255) DEFAULT NULL,
  `acte_libelle` VARCHAR(255) DEFAULT NULL,
  `montant_total` DOUBLE DEFAULT NULL,
  `raison_suppression` VARCHAR(255) DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `date_suppression` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: ventes_transferts
CREATE TABLE IF NOT EXISTS `ventes_transferts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patient_id` INT(11) DEFAULT NULL,
  `personnel_id_source` INT(11) DEFAULT NULL,
  `date_transfert` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `statut` VARCHAR(20) DEFAULT 'EN_ATTENTE',
  `observation` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: ventes_transferts_items
CREATE TABLE IF NOT EXISTS `ventes_transferts_items` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `transfert_id` INT(11) DEFAULT NULL,
  `item_id` INT(11) DEFAULT NULL,
  `libelle` VARCHAR(255) DEFAULT NULL,
  `type` VARCHAR(50) DEFAULT NULL,
  `prix_unitaire` DOUBLE DEFAULT NULL,
  `qte` DOUBLE DEFAULT NULL,
  `use_assurance` TINYINT(1) DEFAULT NULL,
  `part_assureur_unitaire` DOUBLE DEFAULT NULL,
  `part_patient_unitaire` DOUBLE DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transfert_id` (`transfert_id`),
  FOREIGN KEY (`transfert_id`) REFERENCES `ventes_transferts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: caisse_mouvements
CREATE TABLE IF NOT EXISTS `caisse_mouvements` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(50) DEFAULT NULL,
  `montant` DOUBLE DEFAULT NULL,
  `date_mouvement` DATETIME DEFAULT NULL,
  `motif` TEXT DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `mode_paiement` VARCHAR(50) DEFAULT NULL,
  `reference` VARCHAR(100) DEFAULT NULL,
  `autorise_par` VARCHAR(100) DEFAULT NULL,
  `beneficiaire` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: caisse_recouvrements_details
CREATE TABLE IF NOT EXISTS `caisse_recouvrements_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caisse_mouvement_id` INT(11) DEFAULT NULL,
  `vente_id` INT(11) DEFAULT NULL,
  `montant_regle` DOUBLE DEFAULT NULL,
  `date_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: clotures_journalieres
CREATE TABLE IF NOT EXISTS `clotures_journalieres` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_cloture` DATE DEFAULT NULL,
  `date_systeme_suivante` DATE DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `total_especes` DOUBLE DEFAULT 0,
  `total_wave` DOUBLE DEFAULT 0,
  `total_orange` DOUBLE DEFAULT 0,
  `total_mtn` DOUBLE DEFAULT 0,
  `total_credit` DOUBLE DEFAULT 0,
  `total_general` DOUBLE DEFAULT 0,
  `nombre_ventes` INT(11) DEFAULT 0,
  `observations` TEXT DEFAULT NULL,
  `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `statut` VARCHAR(20) DEFAULT 'CLOTUREE',
  `decloture_user_id` INT(11) DEFAULT NULL,
  `decloture_date` DATETIME DEFAULT NULL,
  `decloture_raison` TEXT DEFAULT NULL,
  `recloture_date` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date_cloture` (`date_cloture`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: factures_globales
CREATE TABLE IF NOT EXISTS `factures_globales` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_facture` VARCHAR(50) DEFAULT NULL,
  `type_tiers` VARCHAR(50) DEFAULT NULL,
  `tiers_id` INT(11) DEFAULT NULL,
  `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `periode_debut` DATE DEFAULT NULL,
  `periode_fin` DATE DEFAULT NULL,
  `montant_total` DOUBLE DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT 'VALIDEE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_facture` (`numero_facture`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: factures_globales_details
CREATE TABLE IF NOT EXISTS `factures_globales_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `facture_globale_id` INT(11) DEFAULT NULL,
  `vente_id` INT(11) DEFAULT NULL,
  `montant_tiers` DOUBLE DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: depenses
CREATE TABLE IF NOT EXISTS `depenses` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `motif` VARCHAR(200) DEFAULT NULL,
  `montant` INT(11) DEFAULT NULL,
  `date_depense` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES LOGISTIQUE & STOCK
-- =====================================================

-- Table: stock_rayons
CREATE TABLE IF NOT EXISTS `stock_rayons` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `libelle` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `libelle` (`libelle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_articles
CREATE TABLE IF NOT EXISTS `stock_articles` (
  `cip` VARCHAR(100) DEFAULT NULL,
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `designation` VARCHAR(150) NOT NULL,
  `rayon_id` INT(11) DEFAULT NULL,
  `quantite_stock` INT(11) DEFAULT 0,
  `seuil_alerte` INT(11) DEFAULT 5,
  `unite_mesure` VARCHAR(20) DEFAULT 'Unité',
  `prix_achat` INT(11) DEFAULT 0,
  `unite_gros` VARCHAR(50) DEFAULT 'Boîte',
  `unite_detail` VARCHAR(50) DEFAULT 'Plaquette',
  `coefficient_conversion` INT(11) DEFAULT 1,
  `prix_vente` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `article_parent_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cip` (`cip`),
  KEY `rayon_id` (`rayon_id`),
  KEY `fk_article_parent` (`article_parent_id`),
  FOREIGN KEY (`rayon_id`) REFERENCES `stock_rayons`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`article_parent_id`) REFERENCES `stock_articles`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_fournisseurs
CREATE TABLE IF NOT EXISTS `stock_fournisseurs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(255) NOT NULL,
  `contact_nom` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `adresse` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_bons_livraison
CREATE TABLE IF NOT EXISTS `stock_bons_livraison` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_bl` VARCHAR(50) DEFAULT NULL,
  `fournisseur_id` INT(11) DEFAULT NULL,
  `date_reception` DATE DEFAULT NULL,
  `montant_total` INT(11) DEFAULT 0,
  `date_bl` DATE DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_stock_bons_livraison_fournisseur` (`fournisseur_id`),
  FOREIGN KEY (`fournisseur_id`) REFERENCES `stock_fournisseurs`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_bl_details
CREATE TABLE IF NOT EXISTS `stock_bl_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bl_id` INT(11) DEFAULT NULL,
  `article_id` INT(11) DEFAULT NULL,
  `quantite` INT(11) NOT NULL,
  `prix_achat_ht` INT(11) DEFAULT 0,
  `prix_vente` INT(11) DEFAULT 0,
  `tva` INT(11) DEFAULT 0,
  `date_peremption` DATE DEFAULT NULL,
  `total_ligne` INT(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `bl_id` (`bl_id`),
  KEY `article_id` (`article_id`),
  FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_bl_supprimes
CREATE TABLE IF NOT EXISTS `stock_bl_supprimes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bl_id` INT(11) DEFAULT NULL,
  `numero_bl` VARCHAR(50) DEFAULT NULL,
  `fournisseur_nom` VARCHAR(255) DEFAULT NULL,
  `montant_total` DOUBLE DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `date_suppression` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `details_json` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_bons_retour
CREATE TABLE IF NOT EXISTS `stock_bons_retour` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_br` VARCHAR(50) NOT NULL,
  `date_br` DATE NOT NULL,
  `bl_id` INT(11) NOT NULL,
  `montant_total` DECIMAL(15,2) DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_numero_br` (`numero_br`),
  KEY `idx_numero_br` (`numero_br`),
  KEY `idx_date_br` (`date_br`),
  KEY `idx_bl_id` (`bl_id`),
  FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des bons de retour de marchandises aux fournisseurs';

-- Table: stock_br_details
CREATE TABLE IF NOT EXISTS `stock_br_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `br_id` INT(11) NOT NULL,
  `article_id` INT(11) NOT NULL,
  `quantite_retour` DECIMAL(10,2) NOT NULL,
  `prix_achat_ht` DECIMAL(10,2) NOT NULL,
  `motif` VARCHAR(100) NOT NULL,
  `total_ligne` DECIMAL(15,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_br_id` (`br_id`),
  KEY `idx_article_id` (`article_id`),
  FOREIGN KEY (`br_id`) REFERENCES `stock_bons_retour`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des lignes de détail des bons de retour';

-- Table: stock_avoirs_fournisseurs
CREATE TABLE IF NOT EXISTS `stock_avoirs_fournisseurs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_avoir` VARCHAR(50) NOT NULL,
  `date_avoir` DATE NOT NULL,
  `br_id` INT(11) NOT NULL,
  `montant_total` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('En attente','Validé','Annulé') DEFAULT 'En attente',
  `observation` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_numero_avoir` (`numero_avoir`),
  KEY `idx_numero` (`numero_avoir`),
  KEY `idx_date` (`date_avoir`),
  KEY `idx_br` (`br_id`),
  FOREIGN KEY (`br_id`) REFERENCES `stock_bons_retour`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Avoirs fournisseurs suite aux retours';

-- Table: stock_avoir_details
CREATE TABLE IF NOT EXISTS `stock_avoir_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `avoir_id` INT(11) NOT NULL,
  `article_id` INT(11) NOT NULL,
  `quantite` DECIMAL(10,2) NOT NULL,
  `prix_unitaire` DECIMAL(10,2) NOT NULL,
  `motif` ENUM('Rejeté','Remplacé','Déduit facture') NOT NULL,
  `total_ligne` DECIMAL(15,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_avoir` (`avoir_id`),
  KEY `idx_article` (`article_id`),
  FOREIGN KEY (`avoir_id`) REFERENCES `stock_avoirs_fournisseurs`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Détails des lignes d avoir fournisseur';

-- Table: stock_avoir_mouvements
CREATE TABLE IF NOT EXISTS `stock_avoir_mouvements` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `avoir_detail_id` INT(11) NOT NULL,
  `article_id` INT(11) NOT NULL,
  `quantite` DECIMAL(10,2) NOT NULL,
  `type_mouvement` ENUM('Remplacé','Déduit') NOT NULL,
  `stock_avant` DECIMAL(10,2) NOT NULL,
  `stock_apres` DECIMAL(10,2) NOT NULL,
  `date_mouvement` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_avoir_detail` (`avoir_detail_id`),
  KEY `idx_article` (`article_id`),
  FOREIGN KEY (`avoir_detail_id`) REFERENCES `stock_avoir_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Traçabilité des mouvements de stock suite aux avoirs';

-- Table: stock_paiements_fournisseurs
CREATE TABLE IF NOT EXISTS `stock_paiements_fournisseurs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_paiement` VARCHAR(50) NOT NULL,
  `bl_id` INT(11) NOT NULL,
  `fournisseur_id` INT(11) NOT NULL,
  `montant_paye` DECIMAL(15,2) NOT NULL,
  `mode_paiement` ENUM('Chèque','Espèces','Mobile Money','Virement','TPE') NOT NULL,
  `reference_paiement` VARCHAR(100) DEFAULT NULL,
  `date_paiement` DATE NOT NULL,
  `observation` TEXT DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_paiement` (`numero_paiement`),
  KEY `idx_numero` (`numero_paiement`),
  KEY `idx_bl` (`bl_id`),
  KEY `idx_fournisseur` (`fournisseur_id`),
  KEY `idx_date` (`date_paiement`),
  KEY `idx_paiement_composite` (`bl_id`,`fournisseur_id`,`date_paiement`),
  FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison`(`id`),
  FOREIGN KEY (`fournisseur_id`) REFERENCES `stock_fournisseurs`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paiements effectués aux fournisseurs sur les BL';

-- Table: stock_inventaires
CREATE TABLE IF NOT EXISTS `stock_inventaires` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_inventaire` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `agent_responsable` VARCHAR(100) DEFAULT NULL,
  `commentaire` TEXT DEFAULT NULL,
  `rayon_ids` TEXT DEFAULT NULL,
  `code` VARCHAR(50) DEFAULT NULL,
  `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `date_validation` DATETIME DEFAULT NULL,
  `statut` ENUM('BROUILLON','VALIDE') DEFAULT 'BROUILLON',
  `type` ENUM('GLOBAL','RAYON') DEFAULT NULL,
  `valorisation_theorique` DOUBLE DEFAULT 0,
  `valorisation_reelle` DOUBLE DEFAULT 0,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `libelle` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_inventaire_lignes
CREATE TABLE IF NOT EXISTS `stock_inventaire_lignes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `inventaire_id` INT(11) DEFAULT NULL,
  `article_id` INT(11) DEFAULT NULL,
  `stock_theorique` DOUBLE DEFAULT NULL,
  `stock_compte` DOUBLE DEFAULT NULL,
  `ecart` DOUBLE DEFAULT 0,
  `prix_achat` DOUBLE DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `inventaire_id` (`inventaire_id`),
  FOREIGN KEY (`inventaire_id`) REFERENCES `stock_inventaires`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_rubriques
CREATE TABLE IF NOT EXISTS `stock_rubriques` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `libelle` VARCHAR(100) NOT NULL,
  `type` ENUM('ENTREE','SORTIE','MIXTE') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_libelle_unique` (`libelle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_regularisations
CREATE TABLE IF NOT EXISTS `stock_regularisations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_reg` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `article_id` INT(11) DEFAULT NULL,
  `rubrique_id` INT(11) DEFAULT NULL,
  `quantite` DOUBLE DEFAULT NULL,
  `sens` ENUM('+','-') DEFAULT NULL,
  `motif` TEXT DEFAULT NULL,
  `created_by` VARCHAR(50) DEFAULT 'Admin',
  PRIMARY KEY (`id`),
  KEY `rubrique_id` (`rubrique_id`),
  KEY `article_id` (`article_id`),
  FOREIGN KEY (`rubrique_id`) REFERENCES `stock_rubriques`(`id`),
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_mouvements
CREATE TABLE IF NOT EXISTS `stock_mouvements` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `article_id` INT(11) DEFAULT NULL,
  `type_mouvement` ENUM('ENTREE','SORTIE') NOT NULL,
  `quantite` INT(11) NOT NULL,
  `motif` VARCHAR(255) DEFAULT NULL,
  `date_mouvement` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `article_id` (`article_id`),
  FOREIGN KEY (`article_id`) REFERENCES `stock_articles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_deconditionnements
CREATE TABLE IF NOT EXISTS `stock_deconditionnements` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_operation` VARCHAR(50) NOT NULL,
  `date_operation` DATE DEFAULT NULL,
  `article_source_id` INT(11) DEFAULT NULL,
  `quantite_source` DOUBLE DEFAULT NULL,
  `unite_source` VARCHAR(50) DEFAULT NULL,
  `article_destination_id` INT(11) DEFAULT NULL,
  `quantite_destination` DOUBLE DEFAULT NULL,
  `unite_destination` VARCHAR(50) DEFAULT NULL,
  `ratio_conversion` DOUBLE DEFAULT NULL,
  `cout_unitaire_source` DOUBLE DEFAULT NULL,
  `cout_unitaire_destination` DOUBLE DEFAULT NULL,
  `cout_total` DOUBLE DEFAULT NULL,
  `motif` TEXT DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT 'En cours',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT NULL,
  `validated_at` DATETIME DEFAULT NULL,
  `validated_by` VARCHAR(50) DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancelled_by` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: stock_commandes
CREATE TABLE IF NOT EXISTS `stock_commandes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_commande` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `statut` ENUM('En attente','Reçue','Annulée') DEFAULT 'En attente',
  `description` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: commandes
CREATE TABLE IF NOT EXISTS `commandes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_commande` VARCHAR(50) DEFAULT NULL,
  `fournisseur_id` INT(11) DEFAULT NULL,
  `date_commande` DATETIME DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: commande_details
CREATE TABLE IF NOT EXISTS `commande_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `commande_id` INT(11) DEFAULT NULL,
  `article_id` INT(11) DEFAULT NULL,
  `quantite_demandee` INT(11) DEFAULT NULL,
  `prix_achat_estime` DOUBLE DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: fournisseurs (legacy)
CREATE TABLE IF NOT EXISTS `fournisseurs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(100) NOT NULL,
  `contact` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES HOSPITALISATION
-- =====================================================

-- Table: chambres
CREATE TABLE IF NOT EXISTS `chambres` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(100) NOT NULL,
  `prix_journalier` INT(11) DEFAULT 0,
  `statut` ENUM('actif','suspendu') DEFAULT 'actif',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: lits
CREATE TABLE IF NOT EXISTS `lits` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `chambre_id` INT(11) DEFAULT NULL,
  `nom_lit` VARCHAR(100) NOT NULL,
  `prix_journalier` INT(11) DEFAULT 0,
  `statut` ENUM('actif','inactif') DEFAULT 'actif',
  PRIMARY KEY (`id`),
  KEY `chambre_id` (`chambre_id`),
  FOREIGN KEY (`chambre_id`) REFERENCES `chambres`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: admissions
CREATE TABLE IF NOT EXISTS `admissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patient_id` INT(11) DEFAULT NULL,
  `lit_id` INT(11) DEFAULT NULL,
  `date_entree` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_sortie` DATE DEFAULT NULL,
  `nb_jours` INT(11) DEFAULT 1,
  `statut` ENUM('en_cours','termine') DEFAULT 'en_cours',
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `lit_id` (`lit_id`),
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`),
  FOREIGN KEY (`lit_id`) REFERENCES `lits`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- TABLES SYSTÈME ET LOGS
-- =====================================================

-- Table: clinique_info
CREATE TABLE IF NOT EXISTS `clinique_info` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_clinique` VARCHAR(150) DEFAULT NULL,
  `adresse` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `logo_path` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: corrections_dates_metier
CREATE TABLE IF NOT EXISTS `corrections_dates_metier` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `table_source` VARCHAR(50) DEFAULT NULL,
  `record_id` INT(11) DEFAULT NULL,
  `date_avant` DATE DEFAULT NULL,
  `date_apres` DATE DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `raison` TEXT NOT NULL,
  `date_correction` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: logs_modifications
CREATE TABLE IF NOT EXISTS `logs_modifications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `table_name` VARCHAR(50) DEFAULT NULL,
  `record_id` INT(11) DEFAULT NULL,
  `field_name` VARCHAR(50) DEFAULT NULL,
  `old_value` VARCHAR(255) DEFAULT NULL,
  `new_value` VARCHAR(255) DEFAULT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `date_modification` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `motif` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;