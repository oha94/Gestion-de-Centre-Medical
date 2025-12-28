-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : sam. 27 déc. 2025 à 09:12
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `focolari_db`
--

-- --------------------------------------------------------

--
-- Structure de la table `admissions`
--

CREATE TABLE `admissions` (
  `id` int(11) NOT NULL,
  `patient_id` int(11) DEFAULT NULL,
  `lit_id` int(11) DEFAULT NULL,
  `date_entree` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_sortie` date DEFAULT NULL,
  `nb_jours` int(11) DEFAULT 1,
  `statut` enum('en_cours','termine') DEFAULT 'en_cours'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `app_menus`
--

CREATE TABLE `app_menus` (
  `id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `libelle` varchar(200) NOT NULL,
  `categorie` varchar(100) DEFAULT NULL,
  `icone` varchar(50) DEFAULT NULL,
  `ordre` int(11) DEFAULT 0,
  `actif` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Menus et fonctionnalités disponibles dans l application';

--
-- --------------------------------------------------------

--
-- Structure de la table `app_parametres_app`
--

CREATE TABLE `app_parametres_app` (
  `id` int(11) NOT NULL,
  `nom_application` varchar(200) DEFAULT 'FOCOLARI',
  `logo_app_url` varchar(255) DEFAULT NULL,
  `couleur_primaire` varchar(7) DEFAULT '#3498db',
  `couleur_secondaire` varchar(7) DEFAULT '#2c3e50',
  `format_date` varchar(20) DEFAULT 'DD/MM/YYYY',
  `devise` varchar(10) DEFAULT 'FCFA',
  `langue` varchar(10) DEFAULT 'fr',
  `timezone` varchar(50) DEFAULT 'Africa/Abidjan',
  `activer_email` tinyint(1) DEFAULT 0,
  `activer_sms` tinyint(1) DEFAULT 0,
  `maintenance_mode` tinyint(1) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `date_systeme_actuelle` date DEFAULT NULL,
  `derniere_cloture` date DEFAULT NULL,
  `alerte_date_diff` tinyint(1) DEFAULT 1,
  `jours_decloture_max` int(11) DEFAULT 7,
  `adresse` text DEFAULT NULL,
  `telephone` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paramètres globaux de l application';

--
-- --------------------------------------------------------

--
-- Structure de la table `app_parametres_entreprise`
--

CREATE TABLE `app_parametres_entreprise` (
  `id` int(11) NOT NULL,
  `nom_entreprise` varchar(200) NOT NULL,
  `sigle` varchar(50) DEFAULT NULL,
  `adresse` text DEFAULT NULL,
  `ville` varchar(100) DEFAULT NULL,
  `pays` varchar(100) DEFAULT 'Côte d''Ivoire',
  `telephone` varchar(50) DEFAULT NULL,
  `telephone2` varchar(50) DEFAULT NULL,
  `email` varchar(200) DEFAULT NULL,
  `site_web` varchar(200) DEFAULT NULL,
  `nif` varchar(100) DEFAULT NULL,
  `rccm` varchar(100) DEFAULT NULL,
  `registre_commerce` varchar(100) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `slogan` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Informations de l entreprise pour documents officiels';

--
-- --------------------------------------------------------

--
-- Structure de la table `app_roles`
--

CREATE TABLE `app_roles` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `couleur` varchar(7) DEFAULT '#3498db',
  `actif` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `can_delete` tinyint(1) DEFAULT 1,
  `can_edit` tinyint(1) DEFAULT 1,
  `can_print` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rôles système (Admin, Médecin, Infirmier, etc.)';

--
-- --------------------------------------------------------

--
-- Structure de la table `app_role_permissions`
--

CREATE TABLE `app_role_permissions` (
  `id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `menu_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Attribution des permissions aux rôles';

--
-- --------------------------------------------------------

--
-- Structure de la table `app_utilisateurs`
--

CREATE TABLE `app_utilisateurs` (
  `id` int(11) NOT NULL,
  `nom_complet` varchar(200) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(200) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int(11) DEFAULT NULL,
  `actif` tinyint(1) DEFAULT 1,
  `photo` varchar(255) DEFAULT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `derniere_connexion` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `personnel_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Utilisateurs du système avec authentification';

--
-- --------------------------------------------------------

--
-- Structure de la table `assurances`
--

CREATE TABLE `assurances` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `statut` enum('actif','suspendu') DEFAULT 'actif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `caisse_mouvements`
--

CREATE TABLE `caisse_mouvements` (
  `id` int(11) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `montant` double DEFAULT NULL,
  `date_mouvement` datetime DEFAULT NULL,
  `motif` text DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `mode_paiement` varchar(50) DEFAULT NULL,
  `reference` varchar(100) DEFAULT NULL,
  `autorise_par` varchar(100) DEFAULT NULL,
  `beneficiaire` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `caisse_recouvrements_details`
--

CREATE TABLE `caisse_recouvrements_details` (
  `id` int(11) NOT NULL,
  `caisse_mouvement_id` int(11) DEFAULT NULL,
  `vente_id` int(11) DEFAULT NULL,
  `montant_regle` double DEFAULT NULL,
  `date_created` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `chambres`
--

CREATE TABLE `chambres` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prix_journalier` int(11) DEFAULT 0,
  `statut` enum('actif','suspendu') DEFAULT 'actif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `clinique_info`
--

CREATE TABLE `clinique_info` (
  `id` int(11) NOT NULL,
  `nom_clinique` varchar(150) DEFAULT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `logo_path` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `clotures_journalieres`
--

CREATE TABLE `clotures_journalieres` (
  `id` int(11) NOT NULL,
  `date_cloture` date DEFAULT NULL,
  `date_systeme_suivante` date DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_especes` double DEFAULT 0,
  `total_wave` double DEFAULT 0,
  `total_orange` double DEFAULT 0,
  `total_mtn` double DEFAULT 0,
  `total_credit` double DEFAULT 0,
  `total_general` double DEFAULT 0,
  `nombre_ventes` int(11) DEFAULT 0,
  `observations` text DEFAULT NULL,
  `date_creation` datetime DEFAULT current_timestamp(),
  `statut` varchar(20) DEFAULT 'CLOTUREE',
  `decloture_user_id` int(11) DEFAULT NULL,
  `decloture_date` datetime DEFAULT NULL,
  `decloture_raison` text DEFAULT NULL,
  `recloture_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `commandes`
--

CREATE TABLE `commandes` (
  `id` int(11) NOT NULL,
  `numero_commande` varchar(50) DEFAULT NULL,
  `fournisseur_id` int(11) DEFAULT NULL,
  `date_commande` datetime DEFAULT NULL,
  `statut` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `commande_details`
--

CREATE TABLE `commande_details` (
  `id` int(11) NOT NULL,
  `commande_id` int(11) DEFAULT NULL,
  `article_id` int(11) DEFAULT NULL,
  `quantite_demandee` int(11) DEFAULT NULL,
  `prix_achat_estime` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `corrections_dates_metier`
--

CREATE TABLE `corrections_dates_metier` (
  `id` int(11) NOT NULL,
  `table_source` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `date_avant` date DEFAULT NULL,
  `date_apres` date DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `raison` text NOT NULL,
  `date_correction` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `depenses`
--

CREATE TABLE `depenses` (
  `id` int(11) NOT NULL,
  `motif` varchar(200) DEFAULT NULL,
  `montant` int(11) DEFAULT NULL,
  `date_depense` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `factures_globales`
--

CREATE TABLE `factures_globales` (
  `id` int(11) NOT NULL,
  `numero_facture` varchar(50) DEFAULT NULL,
  `type_tiers` varchar(50) DEFAULT NULL,
  `tiers_id` int(11) DEFAULT NULL,
  `date_creation` datetime DEFAULT current_timestamp(),
  `periode_debut` date DEFAULT NULL,
  `periode_fin` date DEFAULT NULL,
  `montant_total` double DEFAULT NULL,
  `statut` varchar(50) DEFAULT 'VALIDEE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `factures_globales_details`
--

CREATE TABLE `factures_globales_details` (
  `id` int(11) NOT NULL,
  `facture_globale_id` int(11) DEFAULT NULL,
  `vente_id` int(11) DEFAULT NULL,
  `montant_tiers` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `fournisseurs`
--

CREATE TABLE `fournisseurs` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `contact` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lits`
--

CREATE TABLE `lits` (
  `id` int(11) NOT NULL,
  `chambre_id` int(11) DEFAULT NULL,
  `nom_lit` varchar(100) NOT NULL,
  `prix_journalier` int(11) DEFAULT 0,
  `statut` enum('actif','inactif') DEFAULT 'actif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `logs_modifications`
--

CREATE TABLE `logs_modifications` (
  `id` int(11) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `field_name` varchar(50) DEFAULT NULL,
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `date_modification` datetime DEFAULT current_timestamp(),
  `motif` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `patients`
--

CREATE TABLE `patients` (
  `id` int(11) NOT NULL,
  `numero_carnet` varchar(50) DEFAULT NULL,
  `nom_prenoms` varchar(255) DEFAULT NULL,
  `sexe` enum('Homme','Femme') DEFAULT NULL,
  `date_naissance` date DEFAULT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `societe_id` int(11) DEFAULT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `telephone2` varchar(20) DEFAULT NULL,
  `taux_patient` int(11) DEFAULT NULL,
  `statut` enum('actif','suspendu') DEFAULT 'actif',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `ville` varchar(100) DEFAULT NULL,
  `sous_prefecture` varchar(100) DEFAULT NULL,
  `village` varchar(100) DEFAULT NULL,
  `assurance_id` int(11) DEFAULT NULL,
  `numero_assure` varchar(100) DEFAULT NULL,
  `taux_couverture` int(11) DEFAULT 80,
  `nom_salarie` text DEFAULT NULL,
  `telephone_assurance` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `personnel`
--

CREATE TABLE `personnel` (
  `id` int(11) NOT NULL,
  `nom_prenoms` varchar(255) NOT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `sexe` enum('M','F') DEFAULT NULL,
  `quartier` varchar(255) DEFAULT NULL,
  `fonction` varchar(255) DEFAULT NULL,
  `date_creation` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `prestations`
--

CREATE TABLE `prestations` (
  `id` int(11) NOT NULL,
  `libelle` varchar(100) DEFAULT NULL,
  `prix_standard` int(11) DEFAULT NULL,
  `categorie` varchar(50) DEFAULT 'GENERAL'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `societes`
--

CREATE TABLE `societes` (
  `id` int(11) NOT NULL,
  `assurance_id` int(11) DEFAULT NULL,
  `nom_societe` varchar(100) NOT NULL,
  `taux_prise_en_charge` int(11) DEFAULT 0,
  `statut` enum('actif','inactif') DEFAULT 'actif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_articles`
--

CREATE TABLE `stock_articles` (
  `cip` varchar(100) DEFAULT NULL,
  `id` int(11) NOT NULL,
  `designation` varchar(150) NOT NULL,
  `rayon_id` int(11) DEFAULT NULL,
  `quantite_stock` int(11) DEFAULT 0,
  `seuil_alerte` int(11) DEFAULT 5,
  `unite_mesure` varchar(20) DEFAULT 'Unité',
  `prix_achat` int(11) DEFAULT 0,
  `unite_gros` varchar(50) DEFAULT 'Boîte',
  `unite_detail` varchar(50) DEFAULT 'Plaquette',
  `coefficient_conversion` int(11) DEFAULT 1,
  `prix_vente` decimal(10,2) NOT NULL DEFAULT 0.00,
  `article_parent_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_avoirs_fournisseurs`
--

CREATE TABLE `stock_avoirs_fournisseurs` (
  `id` int(11) NOT NULL,
  `numero_avoir` varchar(50) NOT NULL,
  `date_avoir` date NOT NULL,
  `br_id` int(11) NOT NULL,
  `montant_total` decimal(15,2) DEFAULT 0.00,
  `statut` enum('En attente','Validé','Annulé') DEFAULT 'En attente',
  `observation` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Avoirs fournisseurs suite aux retours';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_avoir_details`
--

CREATE TABLE `stock_avoir_details` (
  `id` int(11) NOT NULL,
  `avoir_id` int(11) NOT NULL,
  `article_id` int(11) NOT NULL,
  `quantite` decimal(10,2) NOT NULL,
  `prix_unitaire` decimal(10,2) NOT NULL,
  `motif` enum('Rejeté','Remplacé','Déduit facture') NOT NULL,
  `total_ligne` decimal(15,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Détails des lignes d avoir fournisseur';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_avoir_mouvements`
--

CREATE TABLE `stock_avoir_mouvements` (
  `id` int(11) NOT NULL,
  `avoir_detail_id` int(11) NOT NULL,
  `article_id` int(11) NOT NULL,
  `quantite` decimal(10,2) NOT NULL,
  `type_mouvement` enum('Remplacé','Déduit') NOT NULL,
  `stock_avant` decimal(10,2) NOT NULL,
  `stock_apres` decimal(10,2) NOT NULL,
  `date_mouvement` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Traçabilité des mouvements de stock suite aux avoirs';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_bl_details`
--

CREATE TABLE `stock_bl_details` (
  `id` int(11) NOT NULL,
  `bl_id` int(11) DEFAULT NULL,
  `article_id` int(11) DEFAULT NULL,
  `quantite` int(11) NOT NULL,
  `prix_achat_ht` int(11) DEFAULT 0,
  `prix_vente` int(11) DEFAULT 0,
  `tva` int(11) DEFAULT 0,
  `date_peremption` date DEFAULT NULL,
  `total_ligne` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_bl_supprimes`
--

CREATE TABLE `stock_bl_supprimes` (
  `id` int(11) NOT NULL,
  `bl_id` int(11) DEFAULT NULL,
  `numero_bl` varchar(50) DEFAULT NULL,
  `fournisseur_nom` varchar(255) DEFAULT NULL,
  `montant_total` double DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `date_suppression` datetime DEFAULT current_timestamp(),
  `details_json` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_bons_livraison`
--

CREATE TABLE `stock_bons_livraison` (
  `id` int(11) NOT NULL,
  `numero_bl` varchar(50) DEFAULT NULL,
  `fournisseur_id` int(11) DEFAULT NULL,
  `date_reception` date DEFAULT NULL,
  `montant_total` int(11) DEFAULT 0,
  `date_bl` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_bons_retour`
--

CREATE TABLE `stock_bons_retour` (
  `id` int(11) NOT NULL,
  `numero_br` varchar(50) NOT NULL,
  `date_br` date NOT NULL,
  `bl_id` int(11) NOT NULL,
  `montant_total` decimal(15,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des bons de retour de marchandises aux fournisseurs';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_br_details`
--

CREATE TABLE `stock_br_details` (
  `id` int(11) NOT NULL,
  `br_id` int(11) NOT NULL,
  `article_id` int(11) NOT NULL,
  `quantite_retour` decimal(10,2) NOT NULL,
  `prix_achat_ht` decimal(10,2) NOT NULL,
  `motif` varchar(100) NOT NULL,
  `total_ligne` decimal(15,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des lignes de détail des bons de retour';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_commandes`
--

CREATE TABLE `stock_commandes` (
  `id` int(11) NOT NULL,
  `date_commande` timestamp NOT NULL DEFAULT current_timestamp(),
  `statut` enum('En attente','Reçue','Annulée') DEFAULT 'En attente',
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_deconditionnements`
--

CREATE TABLE `stock_deconditionnements` (
  `id` int(11) NOT NULL,
  `numero_operation` varchar(50) NOT NULL,
  `date_operation` date DEFAULT NULL,
  `article_source_id` int(11) DEFAULT NULL,
  `quantite_source` double DEFAULT NULL,
  `unite_source` varchar(50) DEFAULT NULL,
  `article_destination_id` int(11) DEFAULT NULL,
  `quantite_destination` double DEFAULT NULL,
  `unite_destination` varchar(50) DEFAULT NULL,
  `ratio_conversion` double DEFAULT NULL,
  `cout_unitaire_source` double DEFAULT NULL,
  `cout_unitaire_destination` double DEFAULT NULL,
  `cout_total` double DEFAULT NULL,
  `motif` text DEFAULT NULL,
  `statut` varchar(50) DEFAULT 'En cours',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(50) DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `validated_by` varchar(50) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_fournisseurs`
--

CREATE TABLE `stock_fournisseurs` (
  `id` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `contact_nom` varchar(255) DEFAULT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `adresse` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_inventaires`
--

CREATE TABLE `stock_inventaires` (
  `id` int(11) NOT NULL,
  `date_inventaire` timestamp NOT NULL DEFAULT current_timestamp(),
  `agent_responsable` varchar(100) DEFAULT NULL,
  `commentaire` text DEFAULT NULL,
  `rayon_ids` text DEFAULT NULL,
  `code` varchar(50) DEFAULT NULL,
  `date_creation` datetime DEFAULT current_timestamp(),
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('BROUILLON','VALIDE') DEFAULT 'BROUILLON',
  `type` enum('GLOBAL','RAYON') DEFAULT NULL,
  `valorisation_theorique` double DEFAULT 0,
  `valorisation_reelle` double DEFAULT 0,
  `created_by` varchar(100) DEFAULT NULL,
  `libelle` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_inventaire_lignes`
--

CREATE TABLE `stock_inventaire_lignes` (
  `id` int(11) NOT NULL,
  `inventaire_id` int(11) DEFAULT NULL,
  `article_id` int(11) DEFAULT NULL,
  `stock_theorique` double DEFAULT NULL,
  `stock_compte` double DEFAULT NULL,
  `ecart` double DEFAULT 0,
  `prix_achat` double DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_mouvements`
--

CREATE TABLE `stock_mouvements` (
  `id` int(11) NOT NULL,
  `article_id` int(11) DEFAULT NULL,
  `type_mouvement` enum('ENTREE','SORTIE') NOT NULL,
  `quantite` int(11) NOT NULL,
  `motif` varchar(255) DEFAULT NULL,
  `date_mouvement` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_paiements_fournisseurs`
--

CREATE TABLE `stock_paiements_fournisseurs` (
  `id` int(11) NOT NULL,
  `numero_paiement` varchar(50) NOT NULL,
  `bl_id` int(11) NOT NULL,
  `fournisseur_id` int(11) NOT NULL,
  `montant_paye` decimal(15,2) NOT NULL,
  `mode_paiement` enum('Chèque','Espèces','Mobile Money','Virement','TPE') NOT NULL,
  `reference_paiement` varchar(100) DEFAULT NULL,
  `date_paiement` date NOT NULL,
  `observation` text DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paiements effectués aux fournisseurs sur les BL';

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_rayons`
--

CREATE TABLE `stock_rayons` (
  `id` int(11) NOT NULL,
  `libelle` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_regularisations`
--

CREATE TABLE `stock_regularisations` (
  `id` int(11) NOT NULL,
  `date_reg` datetime DEFAULT current_timestamp(),
  `article_id` int(11) DEFAULT NULL,
  `rubrique_id` int(11) DEFAULT NULL,
  `quantite` double DEFAULT NULL,
  `sens` enum('+','-') DEFAULT NULL,
  `motif` text DEFAULT NULL,
  `created_by` varchar(50) DEFAULT 'Admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `stock_rubriques`
--

CREATE TABLE `stock_rubriques` (
  `id` int(11) NOT NULL,
  `libelle` varchar(100) NOT NULL,
  `type` enum('ENTREE','SORTIE','MIXTE') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `ventes`
--

CREATE TABLE `ventes` (
  `id` int(11) NOT NULL,
  `patient_id` int(11) DEFAULT NULL,
  `acte_libelle` varchar(100) DEFAULT NULL,
  `montant_total` int(11) DEFAULT NULL,
  `part_patient` int(11) DEFAULT NULL,
  `part_assureur` int(11) DEFAULT NULL,
  `mode_paiement` enum('CASH','WAVE','ORANGE','MTN') DEFAULT 'CASH',
  `date_vente` datetime DEFAULT NULL,
  `statut` text DEFAULT 'PAYE',
  `reste_a_payer` double DEFAULT 0,
  `type_vente` text DEFAULT 'ACTE',
  `article_id` int(11) DEFAULT NULL,
  `personnel_id` int(11) DEFAULT NULL,
  `numero_bon` text DEFAULT NULL,
  `societe_nom` text DEFAULT NULL,
  `numero_ticket` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `ventes_supprimees`
--

CREATE TABLE `ventes_supprimees` (
  `id` int(11) NOT NULL,
  `vente_id` int(11) DEFAULT NULL,
  `patient_nom` varchar(255) DEFAULT NULL,
  `acte_libelle` varchar(255) DEFAULT NULL,
  `montant_total` double DEFAULT NULL,
  `raison_suppression` varchar(255) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `date_suppression` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `ventes_transferts`
--

CREATE TABLE `ventes_transferts` (
  `id` int(11) NOT NULL,
  `patient_id` int(11) DEFAULT NULL,
  `personnel_id_source` int(11) DEFAULT NULL,
  `date_transfert` datetime DEFAULT current_timestamp(),
  `statut` varchar(20) DEFAULT 'EN_ATTENTE',
  `observation` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Structure de la table `ventes_transferts_items`
--

CREATE TABLE `ventes_transferts_items` (
  `id` int(11) NOT NULL,
  `transfert_id` int(11) DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `libelle` varchar(255) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `prix_unitaire` double DEFAULT NULL,
  `qte` double DEFAULT NULL,
  `use_assurance` tinyint(1) DEFAULT NULL,
  `part_assureur_unitaire` double DEFAULT NULL,
  `part_patient_unitaire` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_deductions_bl`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_deductions_bl` (
`bl_id` int(11)
,`numero_bl` varchar(50)
,`numero_avoir` varchar(50)
,`date_avoir` date
,`numero_br` varchar(50)
,`article_id` int(11)
,`designation` varchar(150)
,`quantite` decimal(10,2)
,`prix_unitaire` double
,`montant_deduction` double
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_historique_deconditionnements`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_historique_deconditionnements` (
`id` int(11)
,`numero_operation` varchar(50)
,`date_operation` date
,`article_source_id` int(11)
,`designation_source` varchar(150)
,`cip_source` varchar(100)
,`rayon_source` varchar(100)
,`stock_actuel_source` double
,`quantite_source` double
,`unite_source` varchar(50)
,`cout_unitaire_source` double
,`article_destination_id` int(11)
,`designation_destination` varchar(150)
,`cip_destination` varchar(100)
,`rayon_destination` varchar(100)
,`stock_actuel_destination` double
,`quantite_destination` double
,`unite_destination` varchar(50)
,`cout_unitaire_destination` double
,`ratio_conversion` double
,`cout_total` double
,`motif` text
,`statut` varchar(50)
,`created_at` timestamp
,`created_by` varchar(50)
,`validated_at` datetime
,`validated_by` varchar(50)
,`cancelled_at` datetime
,`cancelled_by` varchar(50)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_historique_paiements`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_historique_paiements` (
`id` int(11)
,`numero_paiement` varchar(50)
,`date_paiement` date
,`bl_id` int(11)
,`numero_bl` varchar(50)
,`date_bl` date
,`montant_bl` double
,`fournisseur_id` int(11)
,`nom_fournisseur` varchar(255)
,`montant_paye` double
,`mode_paiement` enum('Chèque','Espèces','Mobile Money','Virement','TPE')
,`reference_paiement` varchar(100)
,`observation` text
,`created_by` varchar(100)
,`created_at` timestamp
,`numero_versement` bigint(22)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_situation_bl`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_situation_bl` (
`bl_id` int(11)
,`numero_bl` varchar(50)
,`date_bl` date
,`fournisseur_id` int(11)
,`nom_fournisseur` varchar(255)
,`montant_bl` double
,`montant_deductions` double
,`montant_net` double
,`montant_paye` double
,`solde_restant` double
,`nb_paiements` bigint(21)
,`statut_paiement` varchar(18)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_stats_deconditionnement_articles`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_stats_deconditionnement_articles` (
`article_id` int(11)
,`designation` varchar(150)
,`nb_operations_source` bigint(21)
,`nb_operations_destination` bigint(21)
,`total_deconditionne` double
,`total_cree` double
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_stats_deconditionnement_globales`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_stats_deconditionnement_globales` (
`statut` varchar(50)
,`nombre_operations` bigint(21)
,`valeur_totale` double
);

-- --------------------------------------------------------

--
-- Structure de la vue `v_deductions_bl`
--
DROP TABLE IF EXISTS `v_deductions_bl`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_deductions_bl`  AS SELECT `bl`.`id` AS `bl_id`, `bl`.`numero_bl` AS `numero_bl`, `av`.`numero_avoir` AS `numero_avoir`, `av`.`date_avoir` AS `date_avoir`, `br`.`numero_br` AS `numero_br`, `ad`.`article_id` AS `article_id`, `art`.`designation` AS `designation`, `ad`.`quantite` AS `quantite`, cast(`ad`.`prix_unitaire` as double) AS `prix_unitaire`, cast(`ad`.`total_ligne` as double) AS `montant_deduction` FROM ((((`stock_bons_livraison` `bl` join `stock_bons_retour` `br` on(`br`.`bl_id` = `bl`.`id`)) join `stock_avoirs_fournisseurs` `av` on(`av`.`br_id` = `br`.`id`)) join `stock_avoir_details` `ad` on(`ad`.`avoir_id` = `av`.`id`)) join `stock_articles` `art` on(`ad`.`article_id` = `art`.`id`)) WHERE `ad`.`motif` = 'Déduit facture' AND `av`.`statut` = 'Validé' ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_historique_deconditionnements`
--
DROP TABLE IF EXISTS `v_historique_deconditionnements`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_historique_deconditionnements`  AS SELECT `d`.`id` AS `id`, `d`.`numero_operation` AS `numero_operation`, `d`.`date_operation` AS `date_operation`, `d`.`article_source_id` AS `article_source_id`, `asrc`.`designation` AS `designation_source`, `asrc`.`cip` AS `cip_source`, `rsrc`.`libelle` AS `rayon_source`, cast(`asrc`.`quantite_stock` as double) AS `stock_actuel_source`, `d`.`quantite_source` AS `quantite_source`, `d`.`unite_source` AS `unite_source`, `d`.`cout_unitaire_source` AS `cout_unitaire_source`, `d`.`article_destination_id` AS `article_destination_id`, `adest`.`designation` AS `designation_destination`, `adest`.`cip` AS `cip_destination`, `rdest`.`libelle` AS `rayon_destination`, cast(`adest`.`quantite_stock` as double) AS `stock_actuel_destination`, `d`.`quantite_destination` AS `quantite_destination`, `d`.`unite_destination` AS `unite_destination`, `d`.`cout_unitaire_destination` AS `cout_unitaire_destination`, `d`.`ratio_conversion` AS `ratio_conversion`, `d`.`cout_total` AS `cout_total`, `d`.`motif` AS `motif`, `d`.`statut` AS `statut`, `d`.`created_at` AS `created_at`, `d`.`created_by` AS `created_by`, `d`.`validated_at` AS `validated_at`, `d`.`validated_by` AS `validated_by`, `d`.`cancelled_at` AS `cancelled_at`, `d`.`cancelled_by` AS `cancelled_by` FROM ((((`stock_deconditionnements` `d` left join `stock_articles` `asrc` on(`d`.`article_source_id` = `asrc`.`id`)) left join `stock_rayons` `rsrc` on(`asrc`.`rayon_id` = `rsrc`.`id`)) left join `stock_articles` `adest` on(`d`.`article_destination_id` = `adest`.`id`)) left join `stock_rayons` `rdest` on(`adest`.`rayon_id` = `rdest`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_historique_paiements`
--
DROP TABLE IF EXISTS `v_historique_paiements`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_historique_paiements`  AS SELECT `p`.`id` AS `id`, `p`.`numero_paiement` AS `numero_paiement`, `p`.`date_paiement` AS `date_paiement`, `p`.`bl_id` AS `bl_id`, `bl`.`numero_bl` AS `numero_bl`, `bl`.`date_bl` AS `date_bl`, cast(`bl`.`montant_total` as double) AS `montant_bl`, `p`.`fournisseur_id` AS `fournisseur_id`, `f`.`nom` AS `nom_fournisseur`, cast(`p`.`montant_paye` as double) AS `montant_paye`, `p`.`mode_paiement` AS `mode_paiement`, `p`.`reference_paiement` AS `reference_paiement`, `p`.`observation` AS `observation`, `p`.`created_by` AS `created_by`, `p`.`created_at` AS `created_at`, (select count(0) + 1 from `stock_paiements_fournisseurs` `p2` where `p2`.`bl_id` = `p`.`bl_id` and `p2`.`id` < `p`.`id`) AS `numero_versement` FROM ((`stock_paiements_fournisseurs` `p` join `stock_bons_livraison` `bl` on(`p`.`bl_id` = `bl`.`id`)) join `stock_fournisseurs` `f` on(`p`.`fournisseur_id` = `f`.`id`)) ORDER BY `p`.`date_paiement` DESC, `p`.`created_at` DESC ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_situation_bl`
--
DROP TABLE IF EXISTS `v_situation_bl`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_situation_bl`  AS SELECT `bl`.`id` AS `bl_id`, `bl`.`numero_bl` AS `numero_bl`, `bl`.`date_bl` AS `date_bl`, `bl`.`fournisseur_id` AS `fournisseur_id`, `f`.`nom` AS `nom_fournisseur`, cast(`bl`.`montant_total` as double) AS `montant_bl`, cast(coalesce((select sum(`ad`.`total_ligne`) from ((`stock_avoirs_fournisseurs` `av` join `stock_avoir_details` `ad` on(`av`.`id` = `ad`.`avoir_id`)) join `stock_bons_retour` `br` on(`av`.`br_id` = `br`.`id`)) where `br`.`bl_id` = `bl`.`id` and `ad`.`motif` = 'Déduit facture' and `av`.`statut` = 'Validé'),0) as double) AS `montant_deductions`, cast(`bl`.`montant_total` - coalesce((select sum(`ad`.`total_ligne`) from ((`stock_avoirs_fournisseurs` `av` join `stock_avoir_details` `ad` on(`av`.`id` = `ad`.`avoir_id`)) join `stock_bons_retour` `br` on(`av`.`br_id` = `br`.`id`)) where `br`.`bl_id` = `bl`.`id` and `ad`.`motif` = 'Déduit facture' and `av`.`statut` = 'Validé'),0) as double) AS `montant_net`, cast(coalesce((select sum(`stock_paiements_fournisseurs`.`montant_paye`) from `stock_paiements_fournisseurs` where `stock_paiements_fournisseurs`.`bl_id` = `bl`.`id`),0) as double) AS `montant_paye`, cast(`bl`.`montant_total` - coalesce((select sum(`ad`.`total_ligne`) from ((`stock_avoirs_fournisseurs` `av` join `stock_avoir_details` `ad` on(`av`.`id` = `ad`.`avoir_id`)) join `stock_bons_retour` `br` on(`av`.`br_id` = `br`.`id`)) where `br`.`bl_id` = `bl`.`id` and `ad`.`motif` = 'Déduit facture' and `av`.`statut` = 'Validé'),0) - coalesce((select sum(`stock_paiements_fournisseurs`.`montant_paye`) from `stock_paiements_fournisseurs` where `stock_paiements_fournisseurs`.`bl_id` = `bl`.`id`),0) as double) AS `solde_restant`, coalesce((select count(0) from `stock_paiements_fournisseurs` where `stock_paiements_fournisseurs`.`bl_id` = `bl`.`id`),0) AS `nb_paiements`, CASE WHEN coalesce((select sum(`stock_paiements_fournisseurs`.`montant_paye`) from `stock_paiements_fournisseurs` where `stock_paiements_fournisseurs`.`bl_id` = `bl`.`id`),0) = 0 THEN 'Non payé' WHEN coalesce((select sum(`stock_paiements_fournisseurs`.`montant_paye`) from `stock_paiements_fournisseurs` where `stock_paiements_fournisseurs`.`bl_id` = `bl`.`id`),0) >= `bl`.`montant_total` - coalesce((select sum(`ad`.`total_ligne`) from ((`stock_avoirs_fournisseurs` `av` join `stock_avoir_details` `ad` on(`av`.`id` = `ad`.`avoir_id`)) join `stock_bons_retour` `br` on(`av`.`br_id` = `br`.`id`)) where `br`.`bl_id` = `bl`.`id` AND `ad`.`motif` = 'Déduit facture' AND `av`.`statut` = 'Validé'),0) - 0.5 THEN 'Payé' ELSE 'Partiellement payé' END AS `statut_paiement` FROM (`stock_bons_livraison` `bl` left join `stock_fournisseurs` `f` on(`bl`.`fournisseur_id` = `f`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_stats_deconditionnement_articles`
--
DROP TABLE IF EXISTS `v_stats_deconditionnement_articles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_stats_deconditionnement_articles`  AS SELECT `asrc`.`id` AS `article_id`, `asrc`.`designation` AS `designation`, count(case when `d`.`article_source_id` = `asrc`.`id` then 1 end) AS `nb_operations_source`, count(case when `d`.`article_destination_id` = `asrc`.`id` then 1 end) AS `nb_operations_destination`, cast(sum(case when `d`.`article_source_id` = `asrc`.`id` then `d`.`quantite_source` else 0 end) as double) AS `total_deconditionne`, cast(sum(case when `d`.`article_destination_id` = `asrc`.`id` then `d`.`quantite_destination` else 0 end) as double) AS `total_cree` FROM (`stock_articles` `asrc` join `stock_deconditionnements` `d` on(`d`.`article_source_id` = `asrc`.`id` or `d`.`article_destination_id` = `asrc`.`id`)) WHERE `d`.`statut` = 'Validé' GROUP BY `asrc`.`id`, `asrc`.`designation` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_stats_deconditionnement_globales`
--
DROP TABLE IF EXISTS `v_stats_deconditionnement_globales`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_stats_deconditionnement_globales`  AS SELECT `stock_deconditionnements`.`statut` AS `statut`, count(0) AS `nombre_operations`, cast(sum(`stock_deconditionnements`.`cout_total`) as double) AS `valeur_totale` FROM `stock_deconditionnements` GROUP BY `stock_deconditionnements`.`statut` ;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `admissions`
--
ALTER TABLE `admissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `patient_id` (`patient_id`),
  ADD KEY `lit_id` (`lit_id`);

--
-- Index pour la table `app_menus`
--
ALTER TABLE `app_menus`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_code` (`code`),
  ADD KEY `idx_categorie` (`categorie`);

--
-- Index pour la table `app_parametres_app`
--
ALTER TABLE `app_parametres_app`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `app_parametres_entreprise`
--
ALTER TABLE `app_parametres_entreprise`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `app_roles`
--
ALTER TABLE `app_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nom` (`nom`),
  ADD KEY `idx_nom` (`nom`);

--
-- Index pour la table `app_role_permissions`
--
ALTER TABLE `app_role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_role_menu` (`role_id`,`menu_id`),
  ADD KEY `idx_role` (`role_id`),
  ADD KEY `idx_menu` (`menu_id`);

--
-- Index pour la table `app_utilisateurs`
--
ALTER TABLE `app_utilisateurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_role` (`role_id`),
  ADD KEY `idx_actif` (`actif`);

--
-- Index pour la table `assurances`
--
ALTER TABLE `assurances`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `caisse_mouvements`
--
ALTER TABLE `caisse_mouvements`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `caisse_recouvrements_details`
--
ALTER TABLE `caisse_recouvrements_details`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `chambres`
--
ALTER TABLE `chambres`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `clinique_info`
--
ALTER TABLE `clinique_info`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `clotures_journalieres`
--
ALTER TABLE `clotures_journalieres`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `date_cloture` (`date_cloture`);

--
-- Index pour la table `commandes`
--
ALTER TABLE `commandes`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `commande_details`
--
ALTER TABLE `commande_details`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `corrections_dates_metier`
--
ALTER TABLE `corrections_dates_metier`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `depenses`
--
ALTER TABLE `depenses`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `factures_globales`
--
ALTER TABLE `factures_globales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_facture` (`numero_facture`);

--
-- Index pour la table `factures_globales_details`
--
ALTER TABLE `factures_globales_details`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `fournisseurs`
--
ALTER TABLE `fournisseurs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `lits`
--
ALTER TABLE `lits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chambre_id` (`chambre_id`);

--
-- Index pour la table `logs_modifications`
--
ALTER TABLE `logs_modifications`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `patients`
--
ALTER TABLE `patients`
  ADD PRIMARY KEY (`id`),
  ADD KEY `societe_id` (`societe_id`),
  ADD KEY `fk_patient_assurance` (`assurance_id`);

--
-- Index pour la table `personnel`
--
ALTER TABLE `personnel`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `prestations`
--
ALTER TABLE `prestations`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `societes`
--
ALTER TABLE `societes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `assurance_id` (`assurance_id`);

--
-- Index pour la table `stock_articles`
--
ALTER TABLE `stock_articles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cip` (`cip`),
  ADD KEY `rayon_id` (`rayon_id`),
  ADD KEY `fk_article_parent` (`article_parent_id`);

--
-- Index pour la table `stock_avoirs_fournisseurs`
--
ALTER TABLE `stock_avoirs_fournisseurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_numero_avoir` (`numero_avoir`),
  ADD KEY `idx_numero` (`numero_avoir`),
  ADD KEY `idx_date` (`date_avoir`),
  ADD KEY `idx_br` (`br_id`);

--
-- Index pour la table `stock_avoir_details`
--
ALTER TABLE `stock_avoir_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_avoir` (`avoir_id`),
  ADD KEY `idx_article` (`article_id`);

--
-- Index pour la table `stock_avoir_mouvements`
--
ALTER TABLE `stock_avoir_mouvements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_avoir_detail` (`avoir_detail_id`),
  ADD KEY `idx_article` (`article_id`);

--
-- Index pour la table `stock_bl_details`
--
ALTER TABLE `stock_bl_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bl_id` (`bl_id`),
  ADD KEY `article_id` (`article_id`);

--
-- Index pour la table `stock_bl_supprimes`
--
ALTER TABLE `stock_bl_supprimes`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stock_bons_livraison`
--
ALTER TABLE `stock_bons_livraison`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stock_bons_livraison_fournisseur` (`fournisseur_id`);

--
-- Index pour la table `stock_bons_retour`
--
ALTER TABLE `stock_bons_retour`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_numero_br` (`numero_br`),
  ADD KEY `idx_numero_br` (`numero_br`),
  ADD KEY `idx_date_br` (`date_br`),
  ADD KEY `idx_bl_id` (`bl_id`);

--
-- Index pour la table `stock_br_details`
--
ALTER TABLE `stock_br_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_br_id` (`br_id`),
  ADD KEY `idx_article_id` (`article_id`);

--
-- Index pour la table `stock_commandes`
--
ALTER TABLE `stock_commandes`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stock_deconditionnements`
--
ALTER TABLE `stock_deconditionnements`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stock_fournisseurs`
--
ALTER TABLE `stock_fournisseurs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stock_inventaires`
--
ALTER TABLE `stock_inventaires`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Index pour la table `stock_inventaire_lignes`
--
ALTER TABLE `stock_inventaire_lignes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventaire_id` (`inventaire_id`);

--
-- Index pour la table `stock_mouvements`
--
ALTER TABLE `stock_mouvements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `article_id` (`article_id`);

--
-- Index pour la table `stock_paiements_fournisseurs`
--
ALTER TABLE `stock_paiements_fournisseurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_paiement` (`numero_paiement`),
  ADD KEY `idx_numero` (`numero_paiement`),
  ADD KEY `idx_bl` (`bl_id`),
  ADD KEY `idx_fournisseur` (`fournisseur_id`),
  ADD KEY `idx_date` (`date_paiement`),
  ADD KEY `idx_paiement_composite` (`bl_id`,`fournisseur_id`,`date_paiement`);

--
-- Index pour la table `stock_rayons`
--
ALTER TABLE `stock_rayons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `libelle` (`libelle`);

--
-- Index pour la table `stock_regularisations`
--
ALTER TABLE `stock_regularisations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `rubrique_id` (`rubrique_id`),
  ADD KEY `article_id` (`article_id`);

--
-- Index pour la table `stock_rubriques`
--
ALTER TABLE `stock_rubriques`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_libelle_unique` (`libelle`);

--
-- Index pour la table `ventes`
--
ALTER TABLE `ventes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `patient_id` (`patient_id`);

--
-- Index pour la table `ventes_supprimees`
--
ALTER TABLE `ventes_supprimees`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `ventes_transferts`
--
ALTER TABLE `ventes_transferts`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `ventes_transferts_items`
--
ALTER TABLE `ventes_transferts_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transfert_id` (`transfert_id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `admissions`
--
ALTER TABLE `admissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `app_menus`
--
ALTER TABLE `app_menus`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT pour la table `app_parametres_app`
--
ALTER TABLE `app_parametres_app`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `app_parametres_entreprise`
--
ALTER TABLE `app_parametres_entreprise`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `app_roles`
--
ALTER TABLE `app_roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT pour la table `app_role_permissions`
--
ALTER TABLE `app_role_permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT pour la table `app_utilisateurs`
--
ALTER TABLE `app_utilisateurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `assurances`
--
ALTER TABLE `assurances`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `caisse_mouvements`
--
ALTER TABLE `caisse_mouvements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `caisse_recouvrements_details`
--
ALTER TABLE `caisse_recouvrements_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `chambres`
--
ALTER TABLE `chambres`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `clotures_journalieres`
--
ALTER TABLE `clotures_journalieres`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `commandes`
--
ALTER TABLE `commandes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `commande_details`
--
ALTER TABLE `commande_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT pour la table `corrections_dates_metier`
--
ALTER TABLE `corrections_dates_metier`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `depenses`
--
ALTER TABLE `depenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `factures_globales`
--
ALTER TABLE `factures_globales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `factures_globales_details`
--
ALTER TABLE `factures_globales_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `fournisseurs`
--
ALTER TABLE `fournisseurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `lits`
--
ALTER TABLE `lits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `logs_modifications`
--
ALTER TABLE `logs_modifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `patients`
--
ALTER TABLE `patients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `personnel`
--
ALTER TABLE `personnel`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `prestations`
--
ALTER TABLE `prestations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `societes`
--
ALTER TABLE `societes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `stock_articles`
--
ALTER TABLE `stock_articles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `stock_avoirs_fournisseurs`
--
ALTER TABLE `stock_avoirs_fournisseurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `stock_avoir_details`
--
ALTER TABLE `stock_avoir_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT pour la table `stock_avoir_mouvements`
--
ALTER TABLE `stock_avoir_mouvements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `stock_bl_details`
--
ALTER TABLE `stock_bl_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT pour la table `stock_bl_supprimes`
--
ALTER TABLE `stock_bl_supprimes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_bons_livraison`
--
ALTER TABLE `stock_bons_livraison`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT pour la table `stock_bons_retour`
--
ALTER TABLE `stock_bons_retour`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `stock_br_details`
--
ALTER TABLE `stock_br_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `stock_commandes`
--
ALTER TABLE `stock_commandes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_deconditionnements`
--
ALTER TABLE `stock_deconditionnements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `stock_fournisseurs`
--
ALTER TABLE `stock_fournisseurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `stock_inventaires`
--
ALTER TABLE `stock_inventaires`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `stock_inventaire_lignes`
--
ALTER TABLE `stock_inventaire_lignes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT pour la table `stock_mouvements`
--
ALTER TABLE `stock_mouvements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_paiements_fournisseurs`
--
ALTER TABLE `stock_paiements_fournisseurs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `stock_rayons`
--
ALTER TABLE `stock_rayons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `stock_regularisations`
--
ALTER TABLE `stock_regularisations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `stock_rubriques`
--
ALTER TABLE `stock_rubriques`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT pour la table `ventes`
--
ALTER TABLE `ventes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT pour la table `ventes_supprimees`
--
ALTER TABLE `ventes_supprimees`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `ventes_transferts`
--
ALTER TABLE `ventes_transferts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `ventes_transferts_items`
--
ALTER TABLE `ventes_transferts_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `admissions`
--
ALTER TABLE `admissions`
  ADD CONSTRAINT `admissions_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  ADD CONSTRAINT `admissions_ibfk_2` FOREIGN KEY (`lit_id`) REFERENCES `lits` (`id`);

--
-- Contraintes pour la table `lits`
--
ALTER TABLE `lits`
  ADD CONSTRAINT `lits_ibfk_1` FOREIGN KEY (`chambre_id`) REFERENCES `chambres` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `patients`
--
ALTER TABLE `patients`
  ADD CONSTRAINT `fk_patient_assurance` FOREIGN KEY (`assurance_id`) REFERENCES `assurances` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`societe_id`) REFERENCES `societes` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `societes`
--
ALTER TABLE `societes`
  ADD CONSTRAINT `societes_ibfk_1` FOREIGN KEY (`assurance_id`) REFERENCES `assurances` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `stock_articles`
--
ALTER TABLE `stock_articles`
  ADD CONSTRAINT `fk_article_parent` FOREIGN KEY (`article_parent_id`) REFERENCES `stock_articles` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `stock_articles_ibfk_1` FOREIGN KEY (`rayon_id`) REFERENCES `stock_rayons` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `stock_avoirs_fournisseurs`
--
ALTER TABLE `stock_avoirs_fournisseurs`
  ADD CONSTRAINT `stock_avoirs_fournisseurs_ibfk_1` FOREIGN KEY (`br_id`) REFERENCES `stock_bons_retour` (`id`);

--
-- Contraintes pour la table `stock_avoir_details`
--
ALTER TABLE `stock_avoir_details`
  ADD CONSTRAINT `stock_avoir_details_ibfk_1` FOREIGN KEY (`avoir_id`) REFERENCES `stock_avoirs_fournisseurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_avoir_details_ibfk_2` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`);

--
-- Contraintes pour la table `stock_avoir_mouvements`
--
ALTER TABLE `stock_avoir_mouvements`
  ADD CONSTRAINT `stock_avoir_mouvements_ibfk_1` FOREIGN KEY (`avoir_detail_id`) REFERENCES `stock_avoir_details` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_avoir_mouvements_ibfk_2` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`);

--
-- Contraintes pour la table `stock_bl_details`
--
ALTER TABLE `stock_bl_details`
  ADD CONSTRAINT `stock_bl_details_ibfk_1` FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_bl_details_ibfk_2` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`);

--
-- Contraintes pour la table `stock_bons_livraison`
--
ALTER TABLE `stock_bons_livraison`
  ADD CONSTRAINT `fk_stock_bons_livraison_fournisseur` FOREIGN KEY (`fournisseur_id`) REFERENCES `stock_fournisseurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `stock_bons_retour`
--
ALTER TABLE `stock_bons_retour`
  ADD CONSTRAINT `stock_bons_retour_ibfk_1` FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison` (`id`);

--
-- Contraintes pour la table `stock_br_details`
--
ALTER TABLE `stock_br_details`
  ADD CONSTRAINT `stock_br_details_ibfk_1` FOREIGN KEY (`br_id`) REFERENCES `stock_bons_retour` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_br_details_ibfk_2` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`);

--
-- Contraintes pour la table `stock_inventaire_lignes`
--
ALTER TABLE `stock_inventaire_lignes`
  ADD CONSTRAINT `stock_inventaire_lignes_ibfk_1` FOREIGN KEY (`inventaire_id`) REFERENCES `stock_inventaires` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `stock_mouvements`
--
ALTER TABLE `stock_mouvements`
  ADD CONSTRAINT `stock_mouvements_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `stock_paiements_fournisseurs`
--
ALTER TABLE `stock_paiements_fournisseurs`
  ADD CONSTRAINT `stock_paiements_fournisseurs_ibfk_1` FOREIGN KEY (`bl_id`) REFERENCES `stock_bons_livraison` (`id`),
  ADD CONSTRAINT `stock_paiements_fournisseurs_ibfk_2` FOREIGN KEY (`fournisseur_id`) REFERENCES `stock_fournisseurs` (`id`);

--
-- Contraintes pour la table `stock_regularisations`
--
ALTER TABLE `stock_regularisations`
  ADD CONSTRAINT `stock_regularisations_ibfk_1` FOREIGN KEY (`rubrique_id`) REFERENCES `stock_rubriques` (`id`),
  ADD CONSTRAINT `stock_regularisations_ibfk_2` FOREIGN KEY (`article_id`) REFERENCES `stock_articles` (`id`);

--
-- Contraintes pour la table `ventes`
--
ALTER TABLE `ventes`
  ADD CONSTRAINT `ventes_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `ventes_transferts_items`
--
ALTER TABLE `ventes_transferts_items`
  ADD CONSTRAINT `ventes_transferts_items_ibfk_1` FOREIGN KEY (`transfert_id`) REFERENCES `ventes_transferts` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

