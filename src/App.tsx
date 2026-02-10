import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "./lib/db";
import { SQL_RAYONS } from "./seeds/data_rayons";
import { SQL_PRESTATIONS } from "./seeds/data_prestations";
import { SQL_ARTICLES_PART1 } from "./seeds/data_articles_part1";
import { SQL_ARTICLES_PART2 } from "./seeds/data_articles_part2";
import { AuthProvider, useAuth } from "./contexts/AuthContext"; // Import Context
import DatabaseConfig from "./views/setup/DatabaseConfig";
import { KitService } from "./services/KitService";
import { PermissionSeeder } from "./services/PermissionSeeder"; // New import
import Setup from "./views/Setup"; // Setup wizard
import { useTheme } from "./contexts/ThemeContext";


// --- IMPORTATION DES VUES ---
import DashboardView from "./views/Dashboard";
import PatientsView from "./views/Patients";
import LaboratoireView from "./views/Laboratoire";
import InfirmierView from "./views/Infirmier";
import HospitalisationView from "./views/Hospitalisation";
import AssurancesView from "./views/Assurances";
import StockMainView from "./views/stock/StockMain";
import ParametresView from "./views/parametres/Parametres";
import BillingMain from "./views/facturation/BillingMain";
import DocumentsMain from "./views/DocumentsMain";
import ConsultationView from "./views/Consultation";
import DateSystemeBanner from "./components/DateSystemeBanner";
import LoginView from "./views/Login";

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { user, isAuthenticated, login, logout, hasPermission } = useAuth(); // Use Context
  const [view, setView] = useState("dashboard");
  // const [isAuthenticated, setIsAuthenticated] = useState(false); // REMOVED
  // const [user, setUser] = useState<any>(null); // REMOVED
  // const [userPermissions, setUserPermissions] = useState<string[]>([]); // REMOVED
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({ nom_application: "Centre Médical", couleur_primaire: '#3498db', couleur_secondaire: '#2c3e50' });
  const [showClotureAlert, setShowClotureAlert] = useState(false);
  const [, setDateSysteme] = useState("");
  const [, setDateOrdinateur] = useState("");

  // SIDEBAR STATE
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem("app_sidebar_expanded");
    if (saved !== null) setIsSidebarExpanded(saved === "true");
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarExpanded;
    setIsSidebarExpanded(newState);
    localStorage.setItem("app_sidebar_expanded", String(newState));
  };
  const [isDbConfigured, setIsDbConfigured] = useState(true); // Assume configured initially
  const [setupCompleted, setSetupCompleted] = useState(true); // Assume setup completed initially

  useEffect(() => {
    checkDbConfiguration();
  }, []);

  // --- MODIFICATION: Plus de blocage complet ici ---
  // On calcule si l'accès est restreint
  const isRestricted = showClotureAlert && user?.role_nom !== 'Administrateur';
  // console.log("App Render:", { isRestricted, showClotureAlert, role: user?.role_nom, view });

  // Si restreint, on force la vue sur "caisse" (là où est la clôture)
  useEffect(() => {
    if (isRestricted && view !== 'caisse') {
      // console.log("Redirecting to caisse due to restriction");
      setView('caisse');
    }
  }, [isRestricted, view]);

  const checkDbConfiguration = async () => {
    try {
      await getDb(); // Will throw if not configured or connection fails


      // Check if setup is completed (DÉSACTIVÉ EN MODE DEV)
      // Pour activer le setup wizard, décommenter le code ci-dessous et mettre DEV_MODE = false
      /*
      try {
        const setupCheck: any[] = await db.select(
          'SELECT setup_completed FROM app_parametres_app WHERE id = 1'
        );

        if (setupCheck.length > 0 && setupCheck[0].setup_completed === 0) {
          setSetupCompleted(false);
          setLoading(false);
          return;
        }
      } catch (e) {
        // If table doesn't exist or column doesn't exist, assume setup not completed
        console.log('Setup check failed, assuming not completed:', e);
        setSetupCompleted(false);
        setLoading(false);
        return;
      }
      */


      initialiserGénéral();

      // Initialisation des modules
      KitService.initTables();

    } catch (e: any) {
      console.error("DB Check Failed:", e);
      if (e.message === "DB_NOT_CONFIGURED" || e.toString().includes("DB_NOT_CONFIGURED")) {
        setIsDbConfigured(false);
        setLoading(false); // Stop loading to show config screen
      } else {
        // Real connection error, might also want to show config to fix it
        setIsDbConfigured(false);
        setLoading(false);
      }
    }
  };

  const initialiserGénéral = async () => {
    try {
      const db = await getDb();

      // Table Paramètres App
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_parametres_app (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          nom_application VARCHAR(255) DEFAULT 'FOCOLARI',
          logo_app_url LONGTEXT,
          couleur_primaire VARCHAR(20) DEFAULT '#3498db',
          couleur_secondaire VARCHAR(20) DEFAULT '#2c3e50',
          maintenance_mode TINYINT(1) DEFAULT 0
        )
      `);

      // 🛡️🛡️ CORRECTIF FINAL ET GLOBAL : AUTO-INCREMENT SUR TOUTES LES TABLES 🛡️🛡️
      const globalFixKey = "SYSTEM_GLOBAL_AUTO_INCREMENT_FIX_V100";
      if (!localStorage.getItem(globalFixKey)) {
        console.log("🚑 Lancement du correctif global AUTO_INCREMENT...");
        const allTables = [
          "app_parametres_app", "app_parametres_entreprise", "app_menus", "app_roles",
          "app_role_permissions", "app_utilisateurs", "app_permissions",
          "ventes", "patients", "assurances", "societes", "prestations", "chambres", "lits", "admissions",
          "clotures_journalieres", "caisse_mouvements", "caisse_recouvrements_details",
          "ventes_supprimees", "logs_modifications", "factures_globales", "factures_globales_details",
          "corrections_dates_metier", "ventes_transferts", "ventes_transferts_items",
          "stock_rayons", "stock_articles", "stock_fournisseurs", "stock_mouvements",
          "stock_bons_livraison", "stock_bl_details", "stock_bl_supprimes",
          "stock_bons_retour", "stock_br_details",
          "stock_avoirs_fournisseurs", "stock_avoir_details", "stock_avoir_mouvements",
          "stock_paiements_fournisseurs",
          "stock_inventaires", "stock_inventaire_lignes", "stock_rubriques", "stock_regularisations",
          "commandes", "commande_details", "personnel"
        ];

        for (const table of allTables) {
          try {
            // Tentative d'ajout de PK si manquante (échouera silencieusement si existe)
            try { await db.execute(`ALTER TABLE ${table} ADD PRIMARY KEY (id)`); } catch (pkErr) { }

            // Forçage Auto-Increment
            await db.execute(`ALTER TABLE ${table} MODIFY COLUMN id INT AUTO_INCREMENT`);
            console.log(`✅ ${table} : Auto-Increment OK.`);
          } catch (e) {
            // Ignorer si la table n'existe pas encore ou erreur autre
            // console.log(`ℹ️ ${table} : Skipped (${e})`);
          }
        }
        localStorage.setItem(globalFixKey, "true");
        alert("✅ Une maintenance complète de la base de données a été effectuée avec succès !");
      }


      // Migration colonnes app_parametres_app
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN logo_app_url LONGTEXT"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN couleur_primaire VARCHAR(20)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN couleur_secondaire VARCHAR(20)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN maintenance_mode TINYINT(1)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN date_systeme_actuelle DATE"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN derniere_cloture DATE"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN alerte_date_diff TINYINT(1) DEFAULT 1"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN jours_decloture_max INT DEFAULT 7"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN adresse TEXT"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN telephone VARCHAR(100)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN email VARCHAR(100)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN imprimante_caisse VARCHAR(255)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_parametres_app ADD COLUMN imprimante_documents VARCHAR(255)"); } catch (e) { }

      // Table Paramètres Entreprise (Infos Société pour Documents)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_parametres_entreprise (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          nom_entreprise VARCHAR(255),
          sigle VARCHAR(50),
          adresse TEXT,
          ville VARCHAR(100),
          pays VARCHAR(100),
          telephone VARCHAR(100),
          telephone2 VARCHAR(100),
          email VARCHAR(100),
          site_web VARCHAR(255),
          nif VARCHAR(50),
          rccm VARCHAR(50),
          registre_commerce VARCHAR(100),
          logo_url LONGTEXT,
          slogan VARCHAR(255),
          description TEXT
        )
      `);

      // Migration pour agrandir la colonne logo_url (Fix Data too long)
      try { await db.execute("ALTER TABLE app_parametres_entreprise MODIFY COLUMN logo_url LONGTEXT"); } catch (e) { }

      // Table Menus
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_menus (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          code VARCHAR(50) UNIQUE,
          libelle VARCHAR(100),
          icone VARCHAR(50),
          categorie VARCHAR(50),
          ordre INTEGER DEFAULT 0,
          actif TINYINT(1) DEFAULT 1
        )
      `);

      // Menus par défaut
      const mCount = await db.select<any[]>("SELECT COUNT(*) as total FROM app_menus");
      if (mCount[0].total === 0) {
        // Permissions par défaut
        const permissions = [
          { code: 'dashboard', libelle: 'Tableau de bord' },
          { code: 'patients', libelle: 'Gestion Patients' },
          { code: 'consultation', libelle: 'Consultation' },
          { code: 'laboratoire', libelle: 'Laboratoire' },
          { code: 'infirmier', libelle: 'Infirmier' },
          { code: 'hospitalisation', libelle: 'Hospitalisation' },
          { code: 'assur', libelle: 'Assurances' },
          { code: 'caisse', libelle: 'Facturation' },
          { code: 'stock', libelle: 'Gestion Stock' },
          { code: 'params', libelle: 'Paramètres' },
          { code: 'reopen_dates', libelle: 'Réouverture de dates clôturées' },
          { code: 'decloture_dates', libelle: 'Dé-clôturer des dates passées' },
          { code: 'correct_date_errors', libelle: 'Corriger les erreurs de date' }
        ];
        const defaultMenus = [
          ['dashboard', 'Tableau de bord', '🏠', 'Général', 1],
          ['patients', 'Patients', '👥', 'Médical', 2],
          ['consultation', 'Consultation', '🩺', 'Médical', 3],
          ['laboratoire', 'Laboratoire', '🔬', 'Médical', 4],
          ['infirmier', 'Infirmier', '💉', 'Médical', 5],
          ['hospitalisation', 'Hospitalisation', '🏨', 'Médical', 6],
          ['assur', 'Assurances', '🛡️', 'Administration', 7],
          ['caisse', 'Facturation', '💰', 'Administration', 8],
          ['stock', 'Gestion Stock', '📦', 'Logistique', 9],
          ['documents', 'Documents', '📂', 'Logistique', 10],
          ['params', 'Paramètres', '⚙️', 'Logistique', 11],
        ];
        for (const m of defaultMenus) {
          await db.execute("INSERT INTO app_menus (code, libelle, icone, categorie, ordre) VALUES (?, ?, ?, ?, ?)", m);
        }

        // Insérer les permissions
        for (const p of permissions) {
          await db.execute("INSERT INTO app_permissions (code_permission, libelle_permission) VALUES (?, ?)", [p.code, p.libelle]);
        }
      }

      // Tables Auth
      await db.execute(`CREATE TABLE IF NOT EXISTS app_roles (id INTEGER PRIMARY KEY AUTO_INCREMENT, nom VARCHAR(50) UNIQUE, description TEXT, couleur VARCHAR(20) DEFAULT '#3498db', actif TINYINT(1) DEFAULT 1, can_delete TINYINT(1) DEFAULT 1, can_edit TINYINT(1) DEFAULT 1)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS app_role_permissions (id INTEGER PRIMARY KEY AUTO_INCREMENT, role_id INTEGER, menu_id INTEGER)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS app_utilisateurs (id INTEGER PRIMARY KEY AUTO_INCREMENT, nom_complet VARCHAR(255), username VARCHAR(50) UNIQUE, email VARCHAR(255), password_hash VARCHAR(255), role_id INTEGER, actif TINYINT(1) DEFAULT 1, derniere_connexion DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

      // Migration colonnes rôles
      try { await db.execute("ALTER TABLE app_roles ADD COLUMN can_delete TINYINT(1) DEFAULT 1"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_roles ADD COLUMN can_edit TINYINT(1) DEFAULT 1"); } catch (e) { }

      // Migration colonnes utilisateurs
      try { await db.execute("ALTER TABLE app_utilisateurs ADD COLUMN password_hash VARCHAR(255)"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_utilisateurs ADD COLUMN role_id INTEGER"); } catch (e) { }
      try { await db.execute("ALTER TABLE app_utilisateurs ADD COLUMN actif TINYINT(1) DEFAULT 1"); } catch (e) { }
      try { await db.execute("CREATE UNIQUE INDEX idx_username ON app_utilisateurs (username)"); } catch (e) { }

      // Table Ventes (Historique)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ventes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NULL,
          personnel_id INT NULL,
          acte_libelle VARCHAR(255),
          montant_total DOUBLE,
          part_patient DOUBLE,
          part_assureur DOUBLE,
          mode_paiement VARCHAR(50),
          statut VARCHAR(20) DEFAULT 'PAYE',
          reste_a_payer DOUBLE DEFAULT 0,
          type_vente VARCHAR(50),
          article_id INT NULL,
          date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
          numero_bon VARCHAR(50) NULL,
          societe_nom VARCHAR(100) NULL,
          numero_ticket VARCHAR(50) NULL,
          user_id INT NULL
        )
      `);

      // Table PATIENTS (Ensure existence)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS patients (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          numero_carnet VARCHAR(50) UNIQUE,
          nom_prenoms VARCHAR(255),
          sexe VARCHAR(10),
          date_naissance DATE,
          telephone VARCHAR(50),
          telephone2 VARCHAR(50),
          ville VARCHAR(100),
          sous_prefecture VARCHAR(100),
          village VARCHAR(100),
          assurance_id INTEGER,
          numero_assure VARCHAR(100),
          taux_couverture INTEGER,
          societe_id INTEGER,
          nom_salarie TEXT,
          telephone_assurance TEXT,
          date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migrations Ventes
      try { await db.execute("ALTER TABLE ventes ADD COLUMN numero_ticket VARCHAR(50) NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE ventes ADD COLUMN user_id INT NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE ventes ADD COLUMN numero_bon VARCHAR(50) NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE ventes ADD COLUMN societe_nom VARCHAR(100) NULL"); } catch (e) { }

      // Migrations Patients
      // Migrations Patients
      try { await db.execute("ALTER TABLE patients ADD COLUMN societe_id INTEGER"); } catch (e) { }
      try { await db.execute("ALTER TABLE patients ADD COLUMN nom_salarie TEXT"); } catch (e) { }
      try { await db.execute("ALTER TABLE patients ADD COLUMN telephone_assurance TEXT"); } catch (e) { }
      try { await db.execute("ALTER TABLE patients ADD COLUMN numero_assure TEXT"); } catch (e) { }

      // FIX ID AUTO_INCREMENT (Anomaly Fix V2)
      try {
        // Force ID to be Primary Key FIRST (if not already)
        // Note: AUTO_INCREMENT requires the column to be indexed (KEY or PK)
        // We try to add PK. If it fails (duplicate or exists), we ignore.
        try { await db.execute("ALTER TABLE patients ADD PRIMARY KEY (id)"); } catch (e) { }

        // Now make it Auto Increment
        await db.execute("ALTER TABLE patients MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed patients ID auto-increment");
      } catch (e) { console.log("Auto-increment fix skipped or failed", e); }

      // FIX FIELD 'NOM' (Missing default value Anomaly)
      try {
        // The code uses 'nom_prenoms' but table has 'nom' which expects a value.
        // We make 'nom' nullable to prevent insertion errors.
        await db.execute("ALTER TABLE patients MODIFY COLUMN nom VARCHAR(255) NULL");
        console.log("✅ Fixed patients.nom nullable");
      } catch (e) { console.log("Fix patients.nom skipped", e); }

      // FIX ID AUTO_INCREMENT (clotures_journalieres)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM clotures_journalieres");
        const count = rows[0]?.c || 0;
        if (count === 0) {
          await db.execute("DROP TABLE clotures_journalieres");
          console.log("⚠️ Dropped empty clotures_journalieres table to force clear recreation");
        } else {
          // Force ID to be Primary Key FIRST
          try { await db.execute("ALTER TABLE clotures_journalieres ADD PRIMARY KEY (id)"); } catch (e) { }
          // Then Apply Auto Increment
          await db.execute("ALTER TABLE clotures_journalieres MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
          console.log("✅ Fixed clotures_journalieres ID auto-increment");
        }
      } catch (e) { console.log("Auto-increment fix clotures skipped", e); }

      // FIX ID AUTO_INCREMENT (prestations) - For Consultation/Actes
      try {
        // Force ID to be Primary Key FIRST
        try { await db.execute("ALTER TABLE prestations ADD PRIMARY KEY (id)"); } catch (e) { }
        // Then Apply Auto Increment
        await db.execute("ALTER TABLE prestations MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed prestations ID auto-increment");
      } catch (e) { console.log("Auto-increment fix prestations skipped", e); }

      // FIX ID AUTO_INCREMENT (admissions) - For Hospitalisation
      try {
        // Force ID to be Primary Key FIRST
        try { await db.execute("ALTER TABLE admissions ADD PRIMARY KEY (id)"); } catch (e) { }
        // Then Apply Auto Increment
        await db.execute("ALTER TABLE admissions MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed admissions ID auto-increment");
      } catch (e) { console.log("Auto-increment fix admissions skipped", e); }



      // FIX ID AUTO_INCREMENT (chambres & lits) - For Hospitalisation Config
      try {
        try { await db.execute("ALTER TABLE chambres ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE chambres MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed chambres ID auto-increment");
      } catch (e) { console.log("Fix chambres skipped", e); }

      try {
        try { await db.execute("ALTER TABLE lits ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE lits MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed lits ID auto-increment");
      } catch (e) { console.log("Fix lits skipped", e); }

      // FIX COLUMN 'STATUT' (Data truncated Anomaly)
      try {
        // The code inserts 'disponible' (10 chars). If DB has VARCHAR(5) or ENUM('libre'...), it fails.
        // We widen it to VARCHAR(50).
        await db.execute("ALTER TABLE lits MODIFY COLUMN statut VARCHAR(50) DEFAULT 'disponible'");
        console.log("✅ Fixed lits.statut column width");
      } catch (e) { console.log("Fix lits.statut skipped", e); }

      // FIX ID AUTO_INCREMENT (ventes) - For Caisse/Facturation
      try {
        try { await db.execute("ALTER TABLE ventes ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE ventes MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed ventes ID auto-increment");
      } catch (e) { console.log("Fix ventes skipped (likely already correct or table locked)", e); }

      // FIX ID AUTO_INCREMENT (assurances) - SMART REPAIR
      try {
        // 1. Test if the table is writable (Auto-Increment working?)
        try {
          await db.execute("INSERT INTO assurances (nom, statut) VALUES ('__TEST_AUTO_REPAIR__', 'actif')");
          // If we get here, it worked. Clean up.
          await db.execute("DELETE FROM assurances WHERE nom = '__TEST_AUTO_REPAIR__'");
          console.log("✅ Assurance table check: HEALTHY");
        } catch (insertError) {
          console.warn("⚠️ Assurance table check: BROKEN. Recreating table...", insertError);
          // 2. Table is broken (no auto-increment), RECREATE IT.
          await db.execute("SET FOREIGN_KEY_CHECKS=0");
          await db.execute("DROP TABLE IF EXISTS assurances");
          await db.execute("CREATE TABLE assurances (id INTEGER PRIMARY KEY AUTO_INCREMENT, nom VARCHAR(255) NOT NULL, statut VARCHAR(50) DEFAULT 'actif')");
          await db.execute("SET FOREIGN_KEY_CHECKS=1");
          console.log("✅ Recreated assurances table with correct schema.");
        }
      } catch (e) {
        console.error("❌ Critical error fixing assurances table:", e);
        try { await db.execute("SET FOREIGN_KEY_CHECKS=1"); } catch (ez) { }
      }

      // FIX SCHEMA: VENTES_TRANSFERTS (Add nom_patient)
      try {
        await db.execute("ALTER TABLE ventes_transferts ADD COLUMN nom_patient VARCHAR(255) DEFAULT NULL");
      } catch (e) { }

      // FIX AUTO_INCREMENT: VENTES_TRANSFERTS (Aggressive)
      try {
        // If empty, simple recreation is safest
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM ventes_transferts");
        if ((rows[0]?.c || 0) === 0) {
          await db.execute("DROP TABLE IF EXISTS ventes_transferts");
          await db.execute(`CREATE TABLE ventes_transferts (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    patient_id INTEGER DEFAULT NULL,
                    nom_patient VARCHAR(255) DEFAULT NULL,
                    personnel_id_source INTEGER DEFAULT NULL,
                    date_transfert DATETIME DEFAULT CURRENT_TIMESTAMP,
                    statut VARCHAR(50) DEFAULT 'EN_ATTENTE',
                    observation TEXT DEFAULT NULL
                 )`);
          console.log("✅ Recreated ventes_transferts (Clean Schema)");
        } else {
          // Try to force AI
          try { await db.execute("ALTER TABLE ventes_transferts ADD PRIMARY KEY (id)"); } catch (e) { }
          await db.execute("ALTER TABLE ventes_transferts MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
          console.log("✅ Fixed ventes_transferts AI (Alter)");
        }
      } catch (e) { console.error("Fix ventes_transferts failed", e); }

      // FIX AUTO_INCREMENT: VENTES_TRANSFERTS_ITEMS (Aggressive)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM ventes_transferts_items");
        if ((rows[0]?.c || 0) === 0) {
          await db.execute("DROP TABLE IF EXISTS ventes_transferts_items");
          await db.execute(`CREATE TABLE ventes_transferts_items (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    transfert_id INTEGER DEFAULT NULL,
                    item_id INTEGER DEFAULT NULL,
                    libelle VARCHAR(255) DEFAULT NULL,
                    type VARCHAR(50) DEFAULT NULL,
                    prix_unitaire DOUBLE DEFAULT NULL,
                    qte DOUBLE DEFAULT NULL,
                    use_assurance BOOLEAN DEFAULT NULL,
                    part_assureur_unitaire DOUBLE DEFAULT NULL,
                    part_patient_unitaire DOUBLE DEFAULT NULL
                 )`);
          console.log("✅ Recreated ventes_transferts_items (Clean Schema)");
        } else {
          try { await db.execute("ALTER TABLE ventes_transferts_items ADD PRIMARY KEY (id)"); } catch (e) { }
          await db.execute("ALTER TABLE ventes_transferts_items MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
          console.log("✅ Fixed ventes_transferts_items AI (Alter)");
        }
      } catch (e) { console.error("Fix ventes_transferts_items failed", e); }

      // FIX ID AUTO_INCREMENT (societes) - SMART REPAIR
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM societes");
        const count = rows[0]?.c || 0;
        if (count === 0) {
          await db.execute("SET FOREIGN_KEY_CHECKS=0");
          await db.execute("DROP TABLE IF EXISTS societes");
          await db.execute(`
            CREATE TABLE societes (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                assurance_id INTEGER,
                nom_societe VARCHAR(255),
                taux_prise_en_charge INTEGER DEFAULT 80,
                statut VARCHAR(50) DEFAULT 'actif',
                FOREIGN KEY (assurance_id) REFERENCES assurances(id) ON DELETE CASCADE
            )
          `);
          await db.execute("SET FOREIGN_KEY_CHECKS=1");
          console.log("✅ Societes table check: Gentle fix applied (Recreated empty table)");
        } else {
          // If data exists, try the gentle ALTER
          try { await db.execute("ALTER TABLE societes ADD PRIMARY KEY (id)"); } catch (e) { }
          await db.execute("ALTER TABLE societes MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
          console.log("✅ Fixed societes ID auto-increment (Alter)");
        }
      } catch (e) {
        console.log("Fix societes skipped", e);
      }

      // FIX ID AUTO_INCREMENT (caisse_mouvements) - For Decaissement
      try {
        try { await db.execute("ALTER TABLE caisse_mouvements ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE caisse_mouvements MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed caisse_mouvements ID auto-increment");
      } catch (e) { console.log("Fix caisse_mouvements skipped", e); }

      // FIX ID AUTO_INCREMENT (stock_articles) - ROBUST REPAIR
      try {
        const rowsCount = await db.select<any[]>("SELECT COUNT(*) as c, COUNT(DISTINCT id) as d FROM stock_articles");
        const total = rowsCount[0]?.c || 0;
        const distinct = rowsCount[0]?.d || 0;

        if (total > 0 && total !== distinct) {
          console.log("⚠️ stock_articles has duplicate IDs (likely 0). Regenerating IDs...");
          // IDs are broken. Drop and Add.
          try { await db.execute("ALTER TABLE stock_articles DROP COLUMN id"); } catch (e) { }
          await db.execute("ALTER TABLE stock_articles ADD COLUMN id INTEGER PRIMARY KEY AUTO_INCREMENT FIRST");
          console.log("✅ Regenerated stock_articles IDs");
        } else {
          // IDs are unique or table empty. Standard fix.
          try { await db.execute("ALTER TABLE stock_articles ADD PRIMARY KEY (id)"); } catch (e) { }
          await db.execute("ALTER TABLE stock_articles MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
          console.log("✅ Fixed stock_articles ID auto-increment (Standard)");
        }
      } catch (e) { console.log("Fix stock_articles skipped/failed", e); }

      // FIX ID AUTO_INCREMENT (stock_fournisseurs) - For Fournisseurs
      try {
        try { await db.execute("ALTER TABLE stock_fournisseurs ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE stock_fournisseurs MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed stock_fournisseurs ID auto-increment");
      } catch (e) { console.log("Fix stock_fournisseurs skipped", e); }

      // FIX ID AUTO_INCREMENT (stock_inventaires) - For Inventaire
      try {
        try { await db.execute("ALTER TABLE stock_inventaires ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE stock_inventaires MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed stock_inventaires ID auto-increment");
      } catch (e) { console.log("Fix stock_inventaires skipped", e); }

      // FIX ID AUTO_INCREMENT (stock_inventaire_lignes) - For Inventaire Lignes
      try {
        try { await db.execute("ALTER TABLE stock_inventaire_lignes ADD PRIMARY KEY (id)"); } catch (e) { }
        await db.execute("ALTER TABLE stock_inventaire_lignes MODIFY id INTEGER NOT NULL AUTO_INCREMENT");
        console.log("✅ Fixed stock_inventaire_lignes ID auto-increment");
      } catch (e) { console.log("Fix stock_inventaire_lignes skipped", e); }

      // =========================================================
      // 🚀 DATA SEEDING (Auto-Import from focolari_db.sql V3)
      // =========================================================

      // 0. SEED RAYONS (Required for Articles)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM stock_rayons");
        if ((rows[0]?.c || 0) === 0) {
          console.log("🌱 Seeding Rayons...");
          await db.execute(SQL_RAYONS);
          console.log("✅ Rayons seeded!");
        }
      } catch (e) { console.error("Seeding Rayons failed:", e); }

      // 1. SEED PRESTATIONS (Consultations, Labo, Soins, Hospitalisation)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM prestations");
        const count = rows[0]?.c || 0;
        if (count === 0) {
          console.log("🌱 Seeding Prestations (Full V3 Data)...");
          // Clear any partial data just in case? No, rely on clean slate or manual check.
          // Actually, if count is 0, it's safe.
          await db.execute(SQL_PRESTATIONS);
          console.log("✅ Prestations seeded!");
        }
      } catch (e) { console.error("Seeding Prestations failed:", e); }

      // 2. SEED STOCK (Pharmacie - Split in 2 parts)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM stock_articles");
        if ((rows[0]?.c || 0) === 0) {
          console.log("🌱 Seeding Stock (Part 1)...");
          await db.execute(SQL_ARTICLES_PART1);
          console.log("✅ Stock Part 1 seeded!");

          console.log("🌱 Seeding Stock (Part 2)...");
          await db.execute(SQL_ARTICLES_PART2);
          console.log("✅ Stock Part 2 seeded!");
        }
      } catch (e) { console.error("Seeding Stock failed:", e); }

      // 3. SEED CHAMBRES (Hospitalisation)
      try {
        const rows = await db.select<any[]>("SELECT COUNT(*) as c FROM chambres");
        if ((rows[0]?.c || 0) === 0) {
          console.log("🌱 Seeding Chambres...");
          await db.execute(`INSERT INTO chambres (id, nom, prix_journalier, statut) VALUES
                (1, 'Chambre 1', 10000, 'actif'),
                (2, 'Chambre 2', 15000, 'actif'),
                (3, 'VIP 1', 25000, 'actif')
            `);
          // Seed Lits linked to seeded chambres
          await db.execute(`INSERT INTO lits (id, chambre_id, nom_lit, prix_journalier, statut) VALUES
                (1, 1, 'Lit 1-A', 10000, 'disponible'),
                (2, 1, 'Lit 1-B', 10000, 'disponible'),
                (3, 2, 'Lit 2-A', 15000, 'disponible'),
                (4, 3, 'Lit VIP', 25000, 'disponible')
            `);
          console.log("✅ Chambres & Lits seeded!");
        }
      } catch (e) { console.error("Seeding Chambres failed:", e); }


      // Table Clôtures Journalières
      await db.execute(`
        CREATE TABLE IF NOT EXISTS clotures_journalieres (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date_cloture DATE UNIQUE,
          date_systeme_suivante DATE,
          user_id INT,
          total_especes DOUBLE DEFAULT 0,
          total_wave DOUBLE DEFAULT 0,
          total_orange DOUBLE DEFAULT 0,
          total_mtn DOUBLE DEFAULT 0,
          total_credit DOUBLE DEFAULT 0,
          total_general DOUBLE DEFAULT 0,
          nombre_ventes INT DEFAULT 0,
          observations TEXT,
          date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migration colonnes clotures_journalieres
      try { await db.execute("ALTER TABLE clotures_journalieres ADD COLUMN statut VARCHAR(20) DEFAULT 'CLOTUREE'"); } catch (e) { }
      try { await db.execute("ALTER TABLE clotures_journalieres ADD COLUMN decloture_user_id INT NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE clotures_journalieres ADD COLUMN decloture_date DATETIME NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE clotures_journalieres ADD COLUMN decloture_raison TEXT NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE clotures_journalieres ADD COLUMN recloture_date DATETIME NULL"); } catch (e) { }

      // Migration caisse_mouvements (Fix Recouvrement)
      try { await db.execute("CREATE TABLE IF NOT EXISTS caisse_mouvements (id INTEGER PRIMARY KEY AUTO_INCREMENT, type VARCHAR(50), montant DOUBLE, date_mouvement DATETIME, motif TEXT, user_id INTEGER)"); } catch (e) { }
      try { await db.execute("ALTER TABLE caisse_mouvements ADD COLUMN mode_paiement VARCHAR(50)"); } catch (e) { }
      try { await db.execute("ALTER TABLE caisse_mouvements ADD COLUMN reference VARCHAR(100)"); } catch (e) { }
      try { await db.execute("ALTER TABLE caisse_mouvements ADD COLUMN autorise_par VARCHAR(100)"); } catch (e) { }
      try { await db.execute("ALTER TABLE caisse_mouvements ADD COLUMN beneficiaire VARCHAR(100)"); } catch (e) { }

      // Table Détails Recouvrement (Pour historique et annulation)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS caisse_recouvrements_details (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          caisse_mouvement_id INTEGER,
          vente_id INTEGER,
          montant_regle DOUBLE,
          date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // TABLES AUDIT / TRACABILITE
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ventes_supprimees (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          vente_id INT,
          patient_nom VARCHAR(255),
          acte_libelle VARCHAR(255),
          montant_total DOUBLE,
          raison_suppression VARCHAR(255),
          user_id INT,
          date_suppression DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS stock_bl_supprimes (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          bl_id INT,
          numero_bl VARCHAR(50),
          fournisseur_nom VARCHAR(255),
          montant_total DOUBLE,
          user_id INT,
          date_suppression DATETIME DEFAULT CURRENT_TIMESTAMP,
          details_json TEXT
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS logs_modifications (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          table_name VARCHAR(50),
          record_id INT,
          field_name VARCHAR(50),
          old_value VARCHAR(255),
          new_value VARCHAR(255),
          user_id INT,
          date_modification DATETIME DEFAULT CURRENT_TIMESTAMP,
          motif VARCHAR(255)
        )
      `);

      // TABLES FACTURATION GLOBALE (ASSURANCE / TIERS)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS factures_globales (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          numero_facture VARCHAR(50) UNIQUE,
          type_tiers VARCHAR(50), -- ASSURANCE, PERSONNEL
          tiers_id INTEGER,
          date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
          periode_debut DATE,
          periode_fin DATE,
          montant_total DOUBLE,
          statut VARCHAR(50) DEFAULT 'VALIDEE'
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS factures_globales_details (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          facture_globale_id INTEGER,
          vente_id INTEGER,
          montant_tiers DOUBLE
        )
      `);

      // Table Corrections Dates Métier
      await db.execute(`
        CREATE TABLE IF NOT EXISTS corrections_dates_metier (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_source VARCHAR(50),
          record_id INT,
          date_avant DATE,
          date_apres DATE,
          user_id INT,
          raison TEXT NOT NULL,
          date_correction DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table Transferts
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ventes_transferts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NULL,
          personnel_id_source INT NULL,
          date_transfert DATETIME DEFAULT CURRENT_TIMESTAMP,
          statut VARCHAR(20) DEFAULT 'EN_ATTENTE',
          observation TEXT
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS ventes_transferts_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          transfert_id INT,
          item_id INT,
          libelle VARCHAR(255),
          type VARCHAR(50),
          prix_unitaire DOUBLE,
          qte DOUBLE,
          use_assurance TINYINT(1),
          part_assureur_unitaire DOUBLE,
          part_patient_unitaire DOUBLE,
          FOREIGN KEY (transfert_id) REFERENCES ventes_transferts(id) ON DELETE CASCADE
        )
      `);

      // === TABLES STOCK (Manquantes) ===
      await db.execute(`
        CREATE TABLE IF NOT EXISTS stock_rayons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          libelle VARCHAR(100) NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS stock_articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cip VARCHAR(50) UNIQUE,
            designation VARCHAR(150) NOT NULL,
            rayon_id INT,
            prix_achat DOUBLE DEFAULT 0,
            prix_vente DOUBLE DEFAULT 0,
            quantite_stock INT DEFAULT 0,
            seuil_alerte INT DEFAULT 5,
            FOREIGN KEY (rayon_id) REFERENCES stock_rayons(id) ON DELETE SET NULL
        )
      `);

      // Migration pour stock_articles au cas où elle existe déjà sans rayon_id
      try { await db.execute("ALTER TABLE stock_articles ADD COLUMN rayon_id INT"); } catch (e) { }
      try { await db.execute("ALTER TABLE stock_articles ADD COLUMN cip VARCHAR(50)"); } catch (e) { } // Ensure CIP column


      // 🛡️ MIGRATION SECURITE MOTS DE PASSE (BCRYPT) 🛡️
      try {
        const users = await db.select<any[]>("SELECT id, password_hash FROM app_utilisateurs");
        const { hashPassword, isBcryptHash } = await import("./lib/crypto");

        let migratedCount = 0;
        for (const u of users) {
          if (u.password_hash && !isBcryptHash(u.password_hash)) {
            // C'est un mot de passe en clair -> On le hache
            const hashed = await hashPassword(u.password_hash);
            await db.execute("UPDATE app_utilisateurs SET password_hash = ? WHERE id = ?", [hashed, u.id]);
            migratedCount++;
          }
        }
        if (migratedCount > 0) console.log(`🔒 Sécurité : ${migratedCount} mots de passe migrés vers bcrypt.`);
      } catch (e) {
        console.error("Erreur migration sécurité MDP:", e);
      }

      // Insertion Rôle Admin
      const checkRole = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Administrateur'");
      if (checkRole.length === 0) {
        await db.execute("INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit) VALUES (?, ?, ?, ?, ?, ?)",
          ['Administrateur', 'Accès complet', '#e74c3c', 1, 1, 1]);
      }
      const adminRoleRes = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Administrateur'");
      const rId = adminRoleRes[0].id;

      // Vérification Admin
      const verifyAdmin = await db.select<any[]>("SELECT id FROM app_utilisateurs WHERE username = 'admin'");

      if (verifyAdmin.length === 0) {
        // Création initiale (HASHÉ)
        const { hashPassword } = await import("./lib/crypto");
        const adminPass = await hashPassword('admin');
        await db.execute("INSERT INTO app_utilisateurs (nom_complet, username, password_hash, role_id, actif) VALUES (?, ?, ?, ?, ?)",
          ['Administrateur Système', 'admin', adminPass, rId, 1]);
        console.log("✅ Compte Admin créé (sécurisé)");
      } else {
        // En PROD : On ne touche pas au mot de passe existant !
        await db.execute("UPDATE app_utilisateurs SET role_id = ?, actif = 1 WHERE username = 'admin'", [rId]);
        console.log("✅ Compte Admin vérifié");
      }

      // Charger Config
      const res = await db.select<any[]>("SELECT * FROM app_parametres_app LIMIT 1");
      if (res.length > 0) {
        setConfig(res[0]);
        document.documentElement.style.setProperty('--primary-color', res[0].couleur_primaire || '#3498db');
        document.documentElement.style.setProperty('--secondary-color', res[0].couleur_secondaire || '#2c3e50');

        // Vérifier la date système
        const dateSys = res[0].date_systeme_actuelle;
        const dateOrd = new Date().toISOString().split('T')[0];

        // Si pas de date système, initialiser avec la date du jour
        if (!dateSys) {
          await db.execute("UPDATE app_parametres_app SET date_systeme_actuelle = ?", [dateOrd]);
          setDateSysteme(dateOrd);
        } else {
          setDateSysteme(dateSys);
          // Si différence, afficher l'alerte
          if (dateSys !== dateOrd) {
            setDateOrdinateur(dateOrd);
            setShowClotureAlert(true);
          }
        }
      }

      console.log("🚀 Initialisation terminée avec succès.");
      // Kits déjà initialisés au début
      await PermissionSeeder.seed();
      setLoading(false);
    } catch (e: any) {
      console.error("Erreur initialisation générale:", e);
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (loggedInUser: any) => {
    await login(loggedInUser); // Use context login
    // View redirection logic remains, but permissions are now in context.
    // We can access them via the context, but since state updates are async, 
    // strictly speaking we might want to rely on the context's internal logic or 
    // re-fetch here if needed for immediate redirection. 
    // However, context 'login' already fetches permissions.
    // Let's do a quick DB fetch here just for the redirection logic if needed, 
    // or trust the next render.
    // Simpler: Just set view to dashboard. The user can navigate.
    setView("dashboard");

    // Original logic tried to be smart:
    try {
      const db = await getDb();
      const perms = await db.select<any[]>(`SELECT m.code FROM app_role_permissions rp JOIN app_menus m ON rp.menu_id = m.id WHERE rp.role_id = ?`, [loggedInUser.role_id]);
      const codes = perms.map(p => p.code);
      if (codes.length > 0 && !codes.includes("dashboard")) setView(codes[0]);
    } catch (e) { }
  };

  const handleLogout = () => {
    logout(); // Use context logout
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><h2>Chargement...</h2></div>;

  if (!isDbConfigured) {
    return <DatabaseConfig onConfigured={() => {
      setIsDbConfigured(true);
      setLoading(true);
      initialiserGénéral();
    }} />;
  }

  if (!setupCompleted) {
    return <Setup onComplete={() => {
      setSetupCompleted(true);
      window.location.reload(); // Reload to reinitialize everything
    }} />;
  }

  if (!isAuthenticated) return <LoginView onLoginSuccess={handleLoginSuccess} config={config} />;



  const canAccess = (code: string) => {
    // Si restreint, on ne peut accéder qu'à la caisse
    if (isRestricted && code !== 'caisse') return false;
    return hasPermission(code); // Use context permission check
  };

  return (
    <div style={layoutStyle}>
      <nav
        style={{
          ...sidebarStyle,
          background: theme.gradient,
          width: isSidebarExpanded ? '260px' : '70px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div style={{ ...brandBoxStyle, padding: isSidebarExpanded ? '20px' : '20px 5px', flexDirection: 'row', justifyContent: isSidebarExpanded ? 'space-between' : 'center' }}>
          {isSidebarExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              {config.logo_app_url ?
                <img src={config.logo_app_url} alt="Logo" style={{ maxWidth: '40px', maxHeight: '40px' }} /> :
                <h2 style={{ color: config.couleur_primaire, margin: 0, fontSize: '1.2rem' }}>🏥 {config.nom_application}</h2>
              }
              <div style={{ color: '#95a5a6', fontSize: '11px', marginTop: '5px' }}>
                <strong>{user?.nom_complet}</strong><br />{user?.role_nom}
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            style={{
              background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem',
              padding: '5px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.7, transition: 'opacity 0.2s', marginTop: isSidebarExpanded ? '0' : '10px'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            title={isSidebarExpanded ? "Réduire le menu" : "Agrandir le menu"}
          >
            {isSidebarExpanded ? '◀' : '▶'}
          </button>
        </div>
        <div style={menuContainerStyle}>
          {canAccess('dashboard') && <MenuBtn label="🏠 Tableau de bord" id="dashboard" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>MÉDICAL</div>

          {canAccess('patients') && <MenuBtn label="👥 Patients" id="patients" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('consultation') && <MenuBtn label="🩺 Consultation" id="consultation" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('laboratoire') && <MenuBtn label="🔬 Laboratoire" id="laboratoire" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('infirmier') && <MenuBtn label="💉 Infirmier" id="infirmier" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('hospitalisation') && <MenuBtn label="🏨 Hospitalisation" id="hospitalisation" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>ADMINISTRATION</div>

          {canAccess('assur') && <MenuBtn label="🛡️ Assurances" id="assur" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('caisse') && <MenuBtn label="💰 Facturation" id="caisse" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>LOGISTIQUE</div>

          {canAccess('stock') && <MenuBtn label="📦 Gestion Stock" id="stock" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('documents') && <MenuBtn label="📂 Documents" id="documents" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}
          {canAccess('params') && <MenuBtn label="⚙️ Paramètres" id="params" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} disabled={isRestricted} />}

          <button onClick={handleLogout} style={{ ...navBtnStyle, marginTop: 'auto', color: '#e74c3c', justifyContent: isSidebarExpanded ? 'flex-start' : 'center' }}>
            {isSidebarExpanded ? '🚪 Déconnexion' : '🚪'}
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)' }}>
        <DateSystemeBanner onClotureComplete={() => window.location.reload()} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '25px 30px' }}>
          {view === "dashboard" && <DashboardView setView={setView} />}
          {view === "patients" && <PatientsView />}
          {view === "laboratoire" && <LaboratoireView />}
          {view === "infirmier" && <InfirmierView />}
          {view === "hospitalisation" && <HospitalisationView />}
          {view === "assur" && <AssurancesView />}
          {view === "caisse" && <BillingMain currentUser={user} />}
          {view === "stock" && <StockMainView currentUser={user} />}
          {view === "documents" && <DocumentsMain />}
          {view === "params" && <ParametresView />}
          {view === "consultation" && <ConsultationView />}
        </div>
      </main>
    </div>
  );
}

function MenuBtn({ label, id, active, onClick, expanded, disabled }: any) {
  const { theme } = useTheme();
  const isSelected = active === id;

  return (
    <button
      onClick={() => !disabled && onClick(id)}
      title={label}
      disabled={disabled}
      style={{
        ...navBtnStyle,
        backgroundColor: isSelected ? theme.primaryColor : 'transparent',
        color: isSelected ? 'white' : (disabled ? '#7f8c8d' : '#ecf0f1'),
        justifyContent: expanded ? 'flex-start' : 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}>
      {expanded ? label : <span style={{ fontSize: '1.2rem' }}>{label.split(' ')[0]}</span>}
    </button>
  );
}

const layoutStyle: CSSProperties = {
  display: 'flex',
  height: '100vh',
  backgroundColor: '#e9ecef',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};
const sidebarStyle: CSSProperties = { color: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, boxShadow: '4px 0 20px rgba(102, 126, 234, 0.15)' };
const brandBoxStyle: CSSProperties = {
  minHeight: '80px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
  padding: '15px 10px'
};
const menuContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '15px 10px',
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  gap: '2px'
};
const sectionTitleStyle: CSSProperties = { fontSize: '0.7rem', color: '#7f8c8d', letterSpacing: '1px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'all 0.3s' };
const navBtnStyle: CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  marginBottom: '0',
  transition: 'all 0.2s ease',
  height: '48px',
  fontWeight: '500'
};