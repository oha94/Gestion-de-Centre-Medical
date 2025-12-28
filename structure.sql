-- --- 1. REFERENTIEL ADMINISTRATIF ---
CREATE TABLE IF NOT EXISTS assurances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    statut ENUM('actif', 'suspendu') DEFAULT 'actif'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS societes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assurance_id INT,
    nom_societe VARCHAR(100) NOT NULL,
    taux_prise_en_charge INT DEFAULT 0,
    statut ENUM('actif', 'inactif') DEFAULT 'actif',
    FOREIGN KEY (assurance_id) REFERENCES assurances(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --- 2. DOSSIERS PATIENTS ---
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_carnet VARCHAR(50) UNIQUE,
    nom_prenoms VARCHAR(255) NOT NULL,
    sexe ENUM('Homme', 'Femme'),
    date_naissance DATE,
    telephone VARCHAR(20),
    telephone2 VARCHAR(20),
    ville VARCHAR(100),
    sous_prefecture VARCHAR(100),
    village VARCHAR(100),
    societe_id INT,
    taux_patient INT DEFAULT NULL,
    statut ENUM('actif', 'suspendu') DEFAULT 'actif',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- --- 3. CATALOGUE DES ACTES ET SOINS ---
CREATE TABLE IF NOT EXISTS prestations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL,
    prix_standard INT DEFAULT 0,
    categorie VARCHAR(50) -- 'LABO', 'SOINS', 'CONSULTATION'
) ENGINE=InnoDB;

-- --- 4. FLUX FINANCIERS (CAISSE) ---
CREATE TABLE IF NOT EXISTS ventes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    acte_libelle VARCHAR(100),
    montant_total INT,
    part_patient INT,
    part_assureur INT,
    mode_paiement VARCHAR(50),
    date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- --- 5. LOGISTIQUE & STOCK ---
CREATE TABLE IF NOT EXISTS stock_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cip VARCHAR(50) UNIQUE,
    designation VARCHAR(150) NOT NULL,
    prix_achat INT DEFAULT 0,
    prix_vente INT DEFAULT 0,
    unite_gros VARCHAR(50),
    unite_detail VARCHAR(50),
    coefficient_conversion INT DEFAULT 1,
    quantite_stock INT DEFAULT 0,
    seuil_alerte INT DEFAULT 5
) ENGINE=InnoDB;

-- --- 6. HOSPITALISATION ---
CREATE TABLE IF NOT EXISTS chambres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prix_journalier INT DEFAULT 0,
    statut ENUM('actif', 'suspendu') DEFAULT 'actif'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chambre_id INT,
    nom_lit VARCHAR(100) NOT NULL,
    prix_unitaire INT DEFAULT 0,
    statut ENUM('actif', 'inactif') DEFAULT 'actif',
    FOREIGN KEY (chambre_id) REFERENCES chambres(id) ON DELETE CASCADE
) ENGINE=InnoDB;