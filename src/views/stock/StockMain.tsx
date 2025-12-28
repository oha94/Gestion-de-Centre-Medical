import { useState, useEffect } from "react";
import CreationProduit from "./CreationProduit";
import RayonsView from "./Rayons";
import FournisseursView from "./Fournisseurs";
import CompteFournisseursView from "./CompteFournisseurs";
import BonLivraisonView from "./BonLivraison";
import BonRetourView from "./BonRetour";
import AvoirFournisseurView from "./Avoirfournisseurs";
import DeconditionnementView from "./Deconditionnement";
import Regularisation from "./Regularisation";
import InventaireView from "./Inventaire";
import Commande from "./Commande";

// --- ICONS (Simple Emoji for now, can be Lucide/FontAwesome) ---
const ICONS = {
  catalogue: "📦",
  deconditionnement: "💊",
  commande: "📝",
  livraison: "🚚",
  retour: "🔙",
  avoir: "💰",
  compte: "💳",
  inventaire: "📊",
  parametre: "⚙️",
  rayon: "🗄️",
  fournisseur: "👥",
  regularisation: "⚖️"
};

export default function StockMainView({ currentUser }: { currentUser?: any }) {
  const [activeSub, setActiveSub] = useState("catalogue");
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({
    inventaire: true,
    parametre: true
  });

  // Persistance de l'état du menu
  useEffect(() => {
    const saved = localStorage.getItem("stock_sidebar_collapsed");
    if (saved) setSidebarCollapsed(saved === "true");
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("stock_sidebar_collapsed", String(newState));
  };

  const toggleGroup = (group: string) => {
    if (isSidebarCollapsed) {
      setSidebarCollapsed(false); // Ouvrir si on clique un groupe
      setOpenGroups(prev => ({ ...prev, [group]: true }));
    } else {
      setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
    }
  };

  const menuItems = [
    { id: "catalogue", label: "Catalogue / Produits", icon: ICONS.catalogue },
    { id: "deconditionnement", label: "Déconditionnement", icon: ICONS.deconditionnement },
    { id: "commande", label: "Commandes", icon: ICONS.commande },
    { id: "livraison", label: "Bons de livraison", icon: ICONS.livraison },
    { id: "retour", label: "Bons de retour", icon: ICONS.retour },
    { id: "avoir", label: "Avoirs fournisseur", icon: ICONS.avoir },
    { id: "compte", label: "Compte fournisseur", icon: ICONS.compte },

    // GROUPE INVENTAIRES
    {
      id: "grp_inventaire", label: "Inventaires", icon: ICONS.inventaire, isGroup: true,
      children: [
        { id: "saisie_inventaire", label: "Saisie d'inventaire", icon: "📝" },
        { id: "regularisation", label: "Régularisation", icon: ICONS.regularisation }
      ]
    },



    // GROUPE PARAMETRES
    {
      id: "grp_parametre", label: "Paramètres", icon: ICONS.parametre, isGroup: true,
      children: [
        { id: "rayon", label: "Rayons / Emplacements", icon: ICONS.rayon },
        { id: "fournisseur", label: "Fournisseurs", icon: ICONS.fournisseur }
      ]
    }
  ];

  const renderContent = () => {
    switch (activeSub) {
      case "catalogue": return <CreationProduit refresh={() => console.log('refresh')} />;
      case "deconditionnement": return <DeconditionnementView />;
      case "commande": return <Commande currentUser={currentUser} />;
      case "livraison": return <BonLivraisonView currentUser={currentUser} />;
      case "retour": return <BonRetourView currentUser={currentUser} />;
      case "avoir": return <AvoirFournisseurView />;
      case "compte": return <CompteFournisseursView currentUser={currentUser} />;

      // Inventaires
      case "saisie_inventaire": return <InventaireView currentUser={currentUser} />;
      case "regularisation": return <Regularisation />;



      // Paramètres
      case "rayon": return <RayonsView />;
      case "fournisseur": return <FournisseursView />;

      default: return <CreationProduit refresh={() => { }} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f4f6f9', fontFamily: 'Inter, sans-serif' }}>

      {/* --- SMART SIDEBAR --- */}
      <div style={{
        width: isSidebarCollapsed ? '70px' : '260px',
        background: '#2c3e50',
        color: '#ecf0f1',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        {/* HEADER SIDEBAR */}
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', borderBottom: '1px solid #34495e' }}>
          {!isSidebarCollapsed && <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>📦 STOCK</h2>}
          <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', fontSize: '18px' }}>
            {isSidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        {/* MENU ITEMS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {menuItems.map(item => {
            if (item.isGroup && item.children) {
              const isOpen = openGroups[item.id?.replace('grp_', '') || ''];
              return (
                <div key={item.id}>
                  <div
                    onClick={() => toggleGroup(item.id?.replace('grp_', '') || '')}
                    style={{
                      padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: '#bdc3c7', fontSize: '14px', transition: 'background 0.2s',
                      background: isOpen && !isSidebarCollapsed ? '#34495e' : 'transparent'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'white'}
                    onMouseLeave={e => e.currentTarget.style.color = '#bdc3c7'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '18px' }}>{item.icon}</span>
                      {!isSidebarCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && <span style={{ fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</span>}
                  </div>

                  {/* SUB ITEMS */}
                  <div style={{
                    maxHeight: (isOpen && !isSidebarCollapsed) ? '500px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease-in-out',
                    background: '#212f3d'
                  }}>
                    {item.children.map(sub => (
                      <div
                        key={sub.id}
                        onClick={() => setActiveSub(sub.id)}
                        style={{
                          padding: '10px 10px 10px 55px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: activeSub === sub.id ? '#3498db' : '#95a5a6',
                          background: activeSub === sub.id ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                      >
                        {!isSidebarCollapsed && sub.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            } else {
              // ITEM SIMPLE
              const isActive = activeSub === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveSub(item.id)}
                  style={{
                    padding: '12px 20px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '15px',
                    background: isActive ? '#3498db' : 'transparent',
                    color: isActive ? 'white' : '#ecf0f1',
                    borderLeft: isActive ? '4px solid #fff' : '4px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  title={isSidebarCollapsed ? item.label : ''}
                >
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  {!isSidebarCollapsed && <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{item.label}</span>}
                </div>
              );
            }
          })}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '15px', borderTop: '1px solid #34495e', textAlign: 'center', fontSize: '12px', color: '#7f8c8d' }}>
          {!isSidebarCollapsed ? 'v2.1 Genius Edition' : 'v2.1'}
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div style={{ background: 'white', borderRadius: '12px', minHeight: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

