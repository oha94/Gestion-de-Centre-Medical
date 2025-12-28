import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

// Types
interface Article {
  id: number;
  designation: string;
  cip: string;
  stock: number;
  unite: string; // 'unite_gros' ou 'unite_detail' selon le contexte
  prix: number;

  // Champs spécifiques pour le lien
  article_parent_id?: number | null;
  coefficient_conversion?: number;

  // Champs enrichis
  parent_designation?: string;
  parent_stock?: number;
}

export default function Deconditionnement() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "config" | "historique">("dashboard");
  const [articles, setArticles] = useState<Article[]>([]); // Tous les articles (pour la config)
  const [linkedArticles, setLinkedArticles] = useState<Article[]>([]); // Articles 'Détail' qui ont un parent
  const [historique, setHistorique] = useState<any[]>([]);

  // États Config
  const [selectedDetail, setSelectedDetail] = useState<Article | null>(null);
  const [selectedParent, setSelectedParent] = useState<Article | null>(null);
  const [ratio, setRatio] = useState<number>(0);
  const [searchDetail, setSearchDetail] = useState("");
  const [searchParent, setSearchParent] = useState("");

  // Migration V4 (Database Update)
  useEffect(() => {
    const runMigration = async () => {
      const migrationKeyV4 = "deconditionnement_smart_v4_fix";
      if (!localStorage.getItem(migrationKeyV4)) {
        try {
          const db = await getDb();
          // Vérif colonne
          try { await db.execute("SELECT article_parent_id FROM stock_articles LIMIT 1"); }
          catch {
            await db.execute("ALTER TABLE stock_articles ADD COLUMN article_parent_id INT NULL DEFAULT NULL");
            await db.execute("ALTER TABLE stock_articles ADD CONSTRAINT fk_article_parent FOREIGN KEY (article_parent_id) REFERENCES stock_articles(id) ON DELETE SET NULL");
          }
          localStorage.setItem(migrationKeyV4, "true");
        } catch (e) {
          console.error("Migration error:", e);
        }
      }
      loadData();
    };
    runMigration();
  }, []);

  const loadData = async () => {
    try {
      const db = await getDb();

      // 1. Tous les articles (pour la config)
      const allArticles = await db.select<any[]>(`
        SELECT id, designation, cip, 
        CAST(quantite_stock AS DOUBLE) as stock, 
        unite_detail as unite, 
        CAST(prix_vente AS DOUBLE) as prix,
        article_parent_id, coefficient_conversion
        FROM stock_articles
        ORDER BY designation
      `);
      setArticles(allArticles);

      // 2. Articles liés (Dashboard)
      // On récupère ceux qui ont un parent
      const linked = await db.select<any[]>(`
        SELECT 
          child.id, child.designation, child.cip, 
          CAST(child.quantite_stock AS DOUBLE) as stock, 
          child.unite_detail as unite,
          child.article_parent_id, child.coefficient_conversion,
          parent.designation as parent_designation,
          CAST(parent.quantite_stock AS DOUBLE) as parent_stock,
          parent.unite_gros as parent_unite
        FROM stock_articles child
        JOIN stock_articles parent ON child.article_parent_id = parent.id
        ORDER BY child.designation
      `);
      setLinkedArticles(linked);

      // 3. Historique
      const hist = await db.select<any[]>(`
        SELECT * FROM v_historique_deconditionnements 
        ORDER BY date_operation DESC LIMIT 50
      `);
      setHistorique(hist);

    } catch (e) {
      console.error("Erreur chargement:", e);
    }
  };

  // --- ACTIONS ---

  const handleLinkProducts = async () => {
    if (!selectedDetail || !selectedParent || !ratio) return alert("Veuillez tout remplir");
    if (selectedDetail.id === selectedParent.id) return alert("Impossible de lier un article à lui-même");

    try {
      const db = await getDb();
      await db.execute(`
        UPDATE stock_articles 
        SET article_parent_id = ?, coefficient_conversion = ?
        WHERE id = ?
      `, [selectedParent.id, ratio, selectedDetail.id]);

      alert(`✅ ${selectedDetail.designation} est maintenant alimenté par ${selectedParent.designation}`);
      setSelectedDetail(null); setSelectedParent(null); setRatio(0); setSearchDetail(""); setSearchParent("");
      loadData();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la liaison");
    }
  };

  const handleDeconditionnementRapide = async (article: Article, qtyToOpen: number = 1) => {
    if (!article.article_parent_id || !article.coefficient_conversion) return;
    if ((article.parent_stock || 0) < qtyToOpen) return alert("❌ Stock parent insuffisant !");

    if (!confirm(`Ouvrir ${qtyToOpen} boîte(s) de "${article.parent_designation}" pour obtenir ${qtyToOpen * article.coefficient_conversion} "${article.designation}" ?`)) return;

    try {
      const db = await getDb();

      // 1. Mettre à jour les stocks
      await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?", [qtyToOpen, article.article_parent_id]);
      await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [qtyToOpen * article.coefficient_conversion, article.id]);

      // 2. Enregistrer l'opération (pour historique)
      const numeroOp = `QUICK-${Date.now()}`;
      await db.execute(`
        INSERT INTO stock_deconditionnements (
          numero_operation, date_operation, 
          article_source_id, quantite_source,
          article_destination_id, quantite_destination,
          ratio_conversion, statut, created_by, validated_at
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, 'Validé', 'System', NOW())
      `, [
        numeroOp,
        article.article_parent_id, qtyToOpen,
        article.id, qtyToOpen * article.coefficient_conversion,
        article.coefficient_conversion
      ]);

      loadData(); // Rafraîchir
      alert(`✅ +${qtyToOpen * article.coefficient_conversion} ajoutes au stock !`);

    } catch (e) {
      console.error(e);
      alert("Erreur technique");
    }
  };

  const handleUnlink = async (articleId: number) => {
    if (!confirm("Supprimer la liaison ?")) return;
    try {
      const db = await getDb();
      await db.execute("UPDATE stock_articles SET article_parent_id = NULL WHERE id = ?", [articleId]);
      loadData();
    } catch (e) { console.error(e); }
  }

  // --- RENDER HELPERS ---

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '28px' }}>📦 Déconditionnement Intelligent</h1>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d' }}>Gérez vos conversions Boîte ↔ Détail en un clic</p>
        </div>
        <div style={{ display: 'flex', background: '#ecf0f1', padding: '5px', borderRadius: '10px' }}>
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>🚀 Dashboard</TabButton>
          <TabButton active={activeTab === "config"} onClick={() => setActiveTab("config")}>⚙️ Configuration</TabButton>
          <TabButton active={activeTab === "historique"} onClick={() => setActiveTab("historique")}>📜 Historique</TabButton>
        </div>
      </header>

      {/* DASHBOARD */}
      {activeTab === "dashboard" && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {linkedArticles.length === 0 ? (
            <div style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center', background: '#f8f9fa', borderRadius: '15px' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔗</div>
              <h3 style={{ color: '#2c3e50' }}>Aucun produit lié</h3>
              <p style={{ color: '#7f8c8d' }}>Allez dans l'onglet <strong>Configuration</strong> pour associer vos boîtes à vos détails.</p>
              <button onClick={() => setActiveTab("config")} style={btnPrimaryStyle}>Configurer maintenant</button>
            </div>
          ) : (
            linkedArticles.map(art => (
              <div key={art.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>{art.designation}</div>
                  <button onClick={() => handleUnlink(art.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.3 }}>🔗</button>
                </div>

                {/* VISUALIZATION */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                  {/* PARENT */}
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#e8f6f3', borderRadius: '10px', border: '1px solid #a2d9ce' }}>
                    <div style={{ fontSize: '12px', color: '#16a085', fontWeight: 'bold', marginBottom: '5px' }}>📦 STOCK BOÎTE</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0e6251' }}>{art.parent_stock}</div>
                    <div style={{ fontSize: '11px', color: '#16a085' }}>{art.parent_designation}</div>
                  </div>

                  {/* ARROW */}
                  <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                    <div style={{ fontSize: '20px' }}>➔</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>x{art.coefficient_conversion}</div>
                  </div>

                  {/* CHILD */}
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: (art.stock || 0) < 10 ? '#fdedec' : '#f4f6f7', borderRadius: '10px', border: (art.stock || 0) < 10 ? '1px solid #fadbd8' : '1px solid #d5dbdb' }}>
                    <div style={{ fontSize: '12px', color: (art.stock || 0) < 10 ? '#c0392b' : '#7f8c8d', fontWeight: 'bold', marginBottom: '5px' }}>💊 STOCK DÉTAIL</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: (art.stock || 0) < 10 ? '#c0392b' : '#2c3e50' }}>{art.stock}</div>
                    <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{art.unite || 'Unités'}</div>
                  </div>
                </div>

                {/* ACTION */}
                <button
                  onClick={() => handleDeconditionnementRapide(art)}
                  disabled={(art.parent_stock || 0) < 1}
                  style={{
                    ...btnActionStyle,
                    background: (art.parent_stock || 0) < 1 ? '#bdc3c7' : '#3498db',
                    cursor: (art.parent_stock || 0) < 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {(art.parent_stock || 0) < 1 ? "⚠️ Stock Boîte Épuisé" : `⚡ Ouvrir 1 Boîte (+${art.coefficient_conversion})`}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONFIGURATION */}
      {activeTab === "config" && (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 5px 30px rgba(0,0,0,0.08)' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#2c3e50' }}>🔗 Associer Boîte & Détail</h2>

          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            {/* PARENT SELECTION */}
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>1️⃣ Produit "Gros" (Boîte)</label>
              <input
                placeholder="Rechercher... (ex: Paracétamol Boîte)"
                value={searchParent}
                onChange={e => setSearchParent(e.target.value)}
                style={inputStyle}
              />
              <div style={listStyle}>
                {articles.filter(a => a.designation.toLowerCase().includes(searchParent.toLowerCase())).slice(0, 5).map(a => (
                  <div key={a.id} onClick={() => { setSelectedParent(a); setSearchParent(a.designation); }} style={{ ...itemStyle, background: selectedParent?.id === a.id ? '#d6eaf8' : 'white' }}>
                    <div>{a.designation}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Stock: {a.stock}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CHILD SELECTION */}
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>2️⃣ Produit "Détail" (Unité)</label>
              <input
                placeholder="Rechercher... (ex: Paracétamol Unité)"
                value={searchDetail}
                onChange={e => setSearchDetail(e.target.value)}
                style={inputStyle}
              />
              <div style={listStyle}>
                {articles.filter(a => a.designation.toLowerCase().includes(searchDetail.toLowerCase())).slice(0, 5).map(a => (
                  <div key={a.id} onClick={() => { setSelectedDetail(a); setSearchDetail(a.designation); }} style={{ ...itemStyle, background: selectedDetail?.id === a.id ? '#d6eaf8' : 'white' }}>
                    <div>{a.designation}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Stock: {a.stock}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <label style={labelStyle}>3️⃣ Contenance (Combien d'unités dans 1 boîte ?)</label>
            <input
              type="number"
              value={ratio || ''}
              onChange={e => setRatio(parseInt(e.target.value))}
              placeholder="Ex: 20"
              style={{ ...inputStyle, width: '150px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}
            />
          </div>

          <button onClick={handleLinkProducts} style={{ ...btnPrimaryStyle, width: '100%', marginTop: '30px', padding: '15px' }}>
            💾 Sauvegarder la Liaison
          </button>
        </div>
      )}

      {/* HISTORIQUE */}
      {activeTab === "historique" && (
        <div style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Opération</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Qté</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {historique.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{new Date(h.date_operation).toLocaleString('fr-FR')}</td>
                  <td style={tdStyle}>{h.numero_operation}</td>
                  <td style={tdStyle}>{h.designation_source}</td>
                  <td style={{ ...tdStyle, color: '#e74c3c' }}>-{h.quantite_source}</td>
                  <td style={tdStyle}>{h.designation_destination} (+{h.quantite_destination})</td>
                  <td style={tdStyle}><span style={{ background: '#d5f5e3', color: '#27ae60', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>{h.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Components & Styles
const TabButton = ({ active, children, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 20px',
      border: 'none',
      background: active ? 'white' : 'transparent',
      borderRadius: '8px',
      color: active ? '#2c3e50' : '#7f8c8d',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
      transition: '0.2s'
    }}
  >
    {children}
  </button>
);

const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: '25px',
  borderRadius: '15px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  border: '1px solid #f0f2f5'
};

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #dcdcdc', fontSize: '14px', boxSizing: 'border-box' };
const listStyle: React.CSSProperties = { marginTop: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' };
const itemStyle: React.CSSProperties = { padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' };

const btnPrimaryStyle: React.CSSProperties = {
  background: '#2c3e50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
  transition: '0.2s'
};

const btnActionStyle: React.CSSProperties = {
  width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px',
  transition: '0.2s'
};

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '15px', color: '#7f8c8d', fontSize: '13px' };
const tdStyle: React.CSSProperties = { padding: '15px', fontSize: '14px', color: '#333' };