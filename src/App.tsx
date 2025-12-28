import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "./lib/db";
import DatabaseConfig from "./views/setup/DatabaseConfig"; // New import
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
  const { theme } = useTheme();
  const [view, setView] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({ nom_application: "Centre Médical", couleur_primaire: '#3498db', couleur_secondaire: '#2c3e50' });
  const [showClotureAlert, setShowClotureAlert] = useState(false);
  const [dateSysteme, setDateSysteme] = useState("");
  const [dateOrdinateur, setDateOrdinateur] = useState("");

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

  const checkDbConfiguration = async () => {
    try {
      const db = await getDb(); // Will throw if not configured or connection fails


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
          { code: 'labo', libelle: 'Laboratoire' },
          { code: 'infirmier', libelle: 'Infirmier' },
          { code: 'hosp', libelle: 'Hospitalisation' },
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
          ['labo', 'Laboratoire', '🔬', 'Médical', 4],
          ['infirmier', 'Infirmier', '💉', 'Médical', 5],
          ['hosp', 'Hospitalisation', '🏨', 'Médical', 6],
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
          numero_ticket VARCHAR(50) NULL
        )
      `);

      // Migration Ventes
      try { await db.execute("ALTER TABLE ventes ADD COLUMN numero_ticket VARCHAR(50) NULL"); } catch (e) { }
      try { await db.execute("ALTER TABLE ventes ADD COLUMN user_id INT NULL"); } catch (e) { }

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


      // Insertion Rôle Admin
      const checkRole = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Administrateur'");
      if (checkRole.length === 0) {
        await db.execute("INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit) VALUES (?, ?, ?, ?, ?, ?)",
          ['Administrateur', 'Accès complet', '#e74c3c', 1, 1, 1]);
      }
      const adminRoleRes = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Administrateur'");
      const rId = adminRoleRes[0].id;

      // Réparation Forcée Admin (très agressive)
      // On s'assure que le compte est actif et que le mot de passe est 'admin'
      await db.execute("UPDATE app_utilisateurs SET actif = 1, password_hash = 'admin', role_id = ? WHERE username = 'admin'", [rId]);

      // Si l'update n'a rien fait (compte inexistant), on l'insère
      const verifyAdmin = await db.select<any[]>("SELECT id FROM app_utilisateurs WHERE username = 'admin'");
      if (verifyAdmin.length === 0) {
        await db.execute("INSERT INTO app_utilisateurs (nom_complet, username, password_hash, role_id, actif) VALUES (?, ?, ?, ?, ?)",
          ['Administrateur Système', 'admin', 'admin', rId, 1]);
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

    } catch (e: any) {
      console.error("Initialisation error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (loggedInUser: any) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    try {
      const db = await getDb();
      const perms = await db.select<any[]>(`SELECT m.code FROM app_role_permissions rp JOIN app_menus m ON rp.menu_id = m.id WHERE rp.role_id = ?`, [loggedInUser.role_id]);
      const codes = perms.map(p => p.code);
      setUserPermissions(codes);
      if (codes.length > 0 && !codes.includes("dashboard")) setView(codes[0]);
      else setView("dashboard");
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setUserPermissions([]);
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

  // Modal de clôture obligatoire
  if (showClotureAlert) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '50px', maxWidth: '650px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '3px solid #e74c3c' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '5rem', marginBottom: '25px' }}>🔒</div>
            <h2 style={{ margin: '0 0 20px 0', color: '#e74c3c', fontSize: '2rem', fontWeight: 'bold' }}>CLÔTURE OBLIGATOIRE</h2>
            <p style={{ color: '#7f8c8d', fontSize: '1.1rem', lineHeight: '1.6' }}>
              La date système ({new Date(dateSysteme).toLocaleDateString('fr-FR')}) est différente de la date de l'ordinateur ({new Date(dateOrdinateur).toLocaleDateString('fr-FR')}).
            </p>
            <p style={{ color: '#2c3e50', fontWeight: 'bold', fontSize: '1.1rem' }}>
              Vous devez clôturer la journée précédente avant de continuer.
            </p>
          </div>
          <button
            onClick={() => {
              // Ne pas fermer le modal, juste changer la vue vers la clôture
              setView('caisse');
            }}
            style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)' }}
          >
            🔒 Accéder à la Clôture Maintenant
          </button>
          <p style={{
            textAlign: 'center',
            color: '#95a5a6',
            fontSize: '0.9rem',
            marginTop: '20px',
            fontStyle: 'italic',
            borderTop: '1px solid #ecf0f1',
            paddingTop: '15px'
          }}>
            ⚠️ Cette fenêtre ne peut pas être fermée. Vous devez clôturer pour continuer à travailler.
          </p>
        </div>
      </div>
    );
  }

  const canAccess = (code: string) => (user?.role_nom === 'Administrateur' || userPermissions.includes(code));

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
          {canAccess('dashboard') && <MenuBtn label="🏠 Tableau de bord" id="dashboard" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>MÉDICAL</div>

          {canAccess('patients') && <MenuBtn label="👥 Patients" id="patients" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('consultation') && <MenuBtn label="🩺 Consultation" id="consultation" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('labo') && <MenuBtn label="🔬 Laboratoire" id="labo" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('infirmier') && <MenuBtn label="💉 Infirmier" id="infirmier" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('hosp') && <MenuBtn label="🏨 Hospitalisation" id="hosp" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>ADMINISTRATION</div>

          {canAccess('assur') && <MenuBtn label="🛡️ Assurances" id="assur" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('caisse') && <MenuBtn label="💰 Facturation" id="caisse" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}

          <div style={{ ...sectionTitleStyle, opacity: isSidebarExpanded ? 1 : 0, height: isSidebarExpanded ? 'auto' : '0px', padding: isSidebarExpanded ? '15px 10px 5px 10px' : '0' }}>LOGISTIQUE</div>

          {canAccess('stock') && <MenuBtn label="📦 Gestion Stock" id="stock" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('documents') && <MenuBtn label="📂 Documents" id="documents" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}
          {canAccess('params') && <MenuBtn label="⚙️ Paramètres" id="params" active={view} onClick={setView} color={config.couleur_primaire} expanded={isSidebarExpanded} />}

          <button onClick={handleLogout} style={{ ...navBtnStyle, marginTop: 'auto', color: '#e74c3c', justifyContent: isSidebarExpanded ? 'flex-start' : 'center' }}>
            {isSidebarExpanded ? '🚪 Déconnexion' : '🚪'}
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)' }}>
        <DateSystemeBanner onClotureComplete={() => window.location.reload()} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '25px 30px' }}>
          {view === "dashboard" && <DashboardView setView={setView} />}
          {view === "patients" && <PatientsView currentUser={user} />}
          {view === "labo" && <LaboratoireView />}
          {view === "infirmier" && <InfirmierView />}
          {view === "hosp" && <HospitalisationView />}
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

function MenuBtn({ label, id, active, onClick, color, expanded }: any) {
  const { theme } = useTheme();
  const isSelected = active === id;
  // Fallback icon extraction (first 2 chars assuming emoji) or just standard split
  // Our system uses "Emoji Title", so splitting by space might usually work, but emoji length varies.
  // Simple heuristic: just display the whole label if expanded, else just substring(0,2) or similar if we assume emoji is first.
  // Better: The label is typically "ICON Text".

  return (
    <button
      onClick={() => onClick(id)}
      title={label}
      style={{
        ...navBtnStyle,
        backgroundColor: isSelected ? theme.primaryColor : 'transparent',
        color: isSelected ? 'white' : '#ecf0f1',
        justifyContent: expanded ? 'flex-start' : 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center'
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