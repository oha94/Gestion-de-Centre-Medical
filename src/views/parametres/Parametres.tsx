import { useState, useEffect } from "react";
import EntrepriseConfig from "./EntrepriseConfig";
import ApplicationConfig from "./ApplicationConfig";
import UtilisateursConfig from "./UtilisateursConfig";
import RolesPermissions from "./RolesPermissions";
import PersonnelConfig from "./Personnelconfig";
import { getDb } from "../../lib/db";

export default function ParametresView() {
  const [activeSub, setActiveSub] = useState("entreprise");
  const [appName, setAppName] = useState("FOCOLARI");

  useEffect(() => {
    const charger = async () => {
      try {
        const db = await getDb();
        const res = await db.select<any[]>("SELECT nom_application FROM app_parametres_app LIMIT 1");
        if (res.length > 0) setAppName(res[0].nom_application);
      } catch (e) {
        console.error("Erreur chargement app name:", e);
      }
    };
    charger();
  }, []);

  const renderContent = () => {
    switch (activeSub) {
      case "entreprise":
        return <EntrepriseConfig />;
      case "application":
        return <ApplicationConfig />;
      case "utilisateurs":
        return <UtilisateursConfig onChangeView={setActiveSub} />;
      case "roles":
        return <RolesPermissions />;
      case "personnel":
        return <PersonnelConfig />;
      default:
        return <EntrepriseConfig />;
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'hidden' }}>

      {/* Sidebar interne des paramètres */}
      <div style={sidebarSubStyle}>
        <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', margin: '0 0 15px 0' }}>
          ⚙️ Paramètres Système
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          <SubMenuBtn
            label="Informations Entreprise"
            id="entreprise"
            active={activeSub}
            onClick={setActiveSub}
            icon="🏢"
          />

          <SubMenuBtn
            label="Configuration Application"
            id="application"
            active={activeSub}
            onClick={setActiveSub}
            icon="🎨"
          />

          <div style={dividerStyle}>SÉCURITÉ & ACCÈS</div>

          <SubMenuBtn
            label="Utilisateurs"
            id="utilisateurs"
            active={activeSub}
            onClick={setActiveSub}
            icon="👥"
          />

          <SubMenuBtn
            label="Personnel"
            id="personnel"
            active={activeSub}
            onClick={setActiveSub}
            icon="👔"
          />

          <SubMenuBtn
            label="Rôles & Permissions"
            id="roles"
            active={activeSub}
            onClick={setActiveSub}
            icon="🔐"
          />
        </div>

        {/* Info version en bas */}
        <div style={{
          marginTop: 'auto',
          padding: '15px 10px',
          borderTop: '1px solid #ecf0f1',
          fontSize: '11px',
          color: '#95a5a6',
          textAlign: 'center'
        }}>
          <div><strong>{appName}</strong></div>
          <div>Version 1.0.0</div>
          <div style={{ marginTop: '5px' }}>© 2024</div>
        </div>
      </div>

      {/* Zone de contenu dynamique */}
      <div style={contentAreaStyle}>
        {renderContent()}
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---

function SubMenuBtn({ label, id, active, onClick, icon }: any) {
  const isSelected = active === id;
  return (
    <button onClick={() => onClick(id)} style={{
      ...subBtnNormal,
      backgroundColor: isSelected ? '#3498db' : 'transparent',
      color: isSelected ? 'white' : '#333',
      fontWeight: isSelected ? 'bold' : 'normal',
    }}>
      <span style={{ marginRight: '10px' }}>{icon}</span>
      {label}
    </button>
  );
}

// --- STYLES ---

const sidebarSubStyle: React.CSSProperties = {
  width: '280px',
  background: 'white',
  padding: '20px',
  borderRadius: '15px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  background: 'white',
  padding: '25px',
  borderRadius: '15px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  overflowY: 'auto'
};

const subBtnNormal: React.CSSProperties = {
  padding: '12px 15px',
  textAlign: 'left',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  transition: '0.2s',
  display: 'flex',
  alignItems: 'center'
};

const dividerStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 'bold',
  color: '#bdc3c7',
  padding: '15px 10px 5px 10px',
  letterSpacing: '1px'
};