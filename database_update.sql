-- ============================================
-- Script de mise à jour de la base de données
-- Centre Médical - Nouvelles Fonctionnalités
-- Date: 2025-12-28
-- ============================================

USE focolari_db;

-- ============================================
-- 1. SYSTÈME DE THÈMES PERSONNALISABLES
-- ============================================

-- Ajouter les colonnes pour la personnalisation des thèmes
ALTER TABLE app_parametres_app 
ADD COLUMN IF NOT EXISTS theme_nom VARCHAR(50) DEFAULT 'Purple Elegance',
ADD COLUMN IF NOT EXISTS theme_couleur_primaire VARCHAR(7) DEFAULT '#667eea',
ADD COLUMN IF NOT EXISTS theme_couleur_secondaire VARCHAR(7) DEFAULT '#764ba2';

-- Initialiser le thème par défaut si les colonnes existent déjà mais sont NULL
UPDATE app_parametres_app 
SET 
    theme_nom = 'Purple Elegance',
    theme_couleur_primaire = '#667eea',
    theme_couleur_secondaire = '#764ba2'
WHERE id = 1 
AND (theme_nom IS NULL OR theme_couleur_primaire IS NULL OR theme_couleur_secondaire IS NULL);

-- ============================================
-- 2. CONFIGURATION DES IMPRIMANTES
-- ============================================

-- Ajouter les colonnes pour la configuration des imprimantes
ALTER TABLE app_parametres_app 
ADD COLUMN IF NOT EXISTS imprimante_caisse VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imprimante_documents VARCHAR(255) DEFAULT NULL;

-- ============================================
-- 3. VÉRIFICATION DES MODIFICATIONS
-- ============================================

-- Afficher la structure mise à jour de la table
DESCRIBE app_parametres_app;

-- Afficher les valeurs actuelles
SELECT 
    id,
    nom_application,
    theme_nom,
    theme_couleur_primaire,
    theme_couleur_secondaire,
    imprimante_caisse,
    imprimante_documents,
    date_systeme_actuelle,
    derniere_cloture
FROM app_parametres_app
WHERE id = 1;

-- ============================================
-- 4. NOTES ET INFORMATIONS
-- ============================================

/*
NOUVELLES FONCTIONNALITÉS AJOUTÉES:

1. SYSTÈME DE THÈMES PERSONNALISABLES
   - 6 thèmes préinstallés (Purple Elegance, Ocean Blue, Sunset Orange, Forest Green, Royal Red, Dark Mode)
   - Personnalisation complète des couleurs (primaire + secondaire)
   - Prévisualisation en temps réel
   - Sauvegarde persistante
   - Accès: Paramètres → Apparence & Thème

2. CONFIGURATION DES IMPRIMANTES
   - Sélection d'imprimante pour tickets de caisse (80mm)
   - Sélection d'imprimante pour documents A4
   - Détection automatique des imprimantes système
   - Test d'impression pour chaque type
   - Accès: Paramètres → Imprimantes

3. AMÉLIORATIONS VISUELLES
   - Thème violet élégant appliqué à toute l'application
   - Gradient violet sur toutes les sidebars
   - Cohérence visuelle globale
   - Design moderne et professionnel

COLONNES AJOUTÉES À app_parametres_app:
- theme_nom: Nom du thème actif
- theme_couleur_primaire: Couleur primaire du thème (format hex)
- theme_couleur_secondaire: Couleur secondaire du thème (format hex)
- imprimante_caisse: Nom de l'imprimante pour tickets de caisse
- imprimante_documents: Nom de l'imprimante pour documents A4

VALEURS PAR DÉFAUT:
- Thème: Purple Elegance (#667eea → #764ba2)
- Imprimantes: NULL (à configurer par l'utilisateur)
*/

-- ============================================
-- FIN DU SCRIPT
-- ============================================

SELECT 'Mise à jour de la base de données terminée avec succès!' AS Status;
