-- Script SQL pour ajouter les colonnes de thème
-- À exécuter dans phpMyAdmin ou votre client MySQL

USE focolari_db;

-- Ajouter les colonnes de thème si elles n'existent pas
ALTER TABLE app_parametres_app 
ADD COLUMN IF NOT EXISTS theme_nom VARCHAR(50) DEFAULT 'Purple Elegance',
ADD COLUMN IF NOT EXISTS theme_couleur_primaire VARCHAR(7) DEFAULT '#667eea',
ADD COLUMN IF NOT EXISTS theme_couleur_secondaire VARCHAR(7) DEFAULT '#764ba2';

-- Vérifier que les colonnes ont été ajoutées
DESCRIBE app_parametres_app;
