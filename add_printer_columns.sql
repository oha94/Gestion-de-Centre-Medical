-- Script SQL pour ajouter les colonnes de configuration d'imprimantes

USE focolari_db;

-- Ajouter les colonnes pour les imprimantes par défaut
ALTER TABLE app_parametres_app 
ADD COLUMN IF NOT EXISTS imprimante_caisse VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imprimante_documents VARCHAR(255) DEFAULT NULL;

-- Vérifier que les colonnes ont été ajoutées
DESCRIBE app_parametres_app;
