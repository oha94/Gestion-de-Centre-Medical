import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import { KitService, Kit, KitComponent, KitConsumption } from "../services/KitService";
import { useAuth } from "../contexts/AuthContext";
import { Protect } from "../components/Protect";

export default function InfirmierView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'actes' | 'kits_gestion' | 'kits_sortie'>('actes');

  // --- STATES COMMON ---
  const [patients, setPatients] = useState<any[]>([]);

  // --- STATES ACTES ---
  const [actes, setActes] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState<number | string>("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editPrix, setEditPrix] = useState<number | string>("");

  // --- STATES KITS GESTION ---
  const [kits, setKits] = useState<Kit[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [showKitModal, setShowKitModal] = useState(false);
  const [kitForm, setKitForm] = useState<Partial<Kit>>({ nom: '', code: '', prix_standard: 0 });
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  // const [selectedStockId, setSelectedStockId] = useState(""); // REMOVED


  // --- STATES RECHERCHE ARTICLE ---
  const [searchArticle, setSearchArticle] = useState("");
  const [showArticleResults, setShowArticleResults] = useState(false);
  const filteredStocks = searchArticle
    ? stocks.filter(s => s.designation.toLowerCase().includes(searchArticle.toLowerCase())).slice(0, 50)
    : [];

  // --- STATES KITS SORTIE ---
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedKitToConsume, setSelectedKitToConsume] = useState<Kit | null>(null);
  const [history, setHistory] = useState<KitConsumption[]>([]);

  // --- INITIALIZATION ---
  useEffect(() => {
    KitService.initTables();
    chargerActes();
    chargerKits();
    chargerStocks();
    chargerPatients();
    chargerHistory();
  }, []);

  const chargerActes = async () => {
    const db = await getDb();
    try {
      const res = await db.select<any[]>("SELECT id, libelle, CAST(prix_standard AS CHAR) as prix_standard FROM prestations WHERE categorie = 'SOINS' ORDER BY libelle ASC");
      setActes(res.map(r => ({ ...r, prix_standard: Number(r.prix_standard) })));
    } catch (e) { console.error(e); }
  };

  const chargerKits = async () => {
    const res = await KitService.getKits();
    setKits(res);
  };

  const chargerStocks = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT id, designation, quantite_stock FROM stock_articles ORDER BY designation ASC");
      setStocks(res);
    } catch (e) { console.error(e); }
  };

  const chargerPatients = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT id, nom_prenoms, numero_carnet FROM patients ORDER BY nom_prenoms ASC");
      setPatients(res);
    } catch (e) { console.error(e); }
  };

  const chargerHistory = async () => {
    const res = await KitService.getHistory();
    setHistory(res);
  };

  // --- LOGIC ACTES ---
  const ajouterActe = async () => {
    if (!nom || !prix) return alert("Veuillez remplir le nom et le prix");
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO prestations (libelle, prix_standard, categorie) VALUES (?, ?, 'SOINS')",
        [nom, prix]
      );
      setNom(""); setPrix("");
      chargerActes();
      alert("Acte infirmier ajouté avec succès");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement : " + JSON.stringify(e));
    }
  };

  const supprimerActe = async (id: number) => {
    if (window.confirm("Voulez-vous vraiment supprimer cet acte du catalogue ?")) {
      const db = await getDb();
      await db.execute("DELETE FROM prestations WHERE id = ?", [id]);
      chargerActes();
    }
  };

  const demarrerModif = (act: any) => {
    setEditingId(act.id);
    setEditNom(act.libelle);
    setEditPrix(act.prix_standard);
  };

  const sauvegarderModif = async () => {
    const db = await getDb();
    await db.execute(
      "UPDATE prestations SET libelle = ?, prix_standard = ? WHERE id = ?",
      [editNom, editPrix, editingId]
    );
    setEditingId(null);
    chargerActes();
  };

  // --- LOGIC KITS GESTION ---
  const handleAddStringComponent = (article: any) => {
    // if (!selectedStockId) return;
    // const article = stocks.find(s => s.id === parseInt(selectedStockId));
    if (!article) return;

    // Check if already exists
    if (kitComponents.find(c => c.article_id === article.id)) {
      return alert("Cet article est déjà dans le kit");
    }

    setKitComponents([...kitComponents, { article_id: article.id, quantite: 1, designation: article.designation }]);
    setKitComponents([...kitComponents, { article_id: article.id, quantite: 1, designation: article.designation }]);
    setSearchArticle("");
    setShowArticleResults(false);
  };

  const updateComponentQty = (articleId: number, qty: number) => {
    setKitComponents(kitComponents.map(c => c.article_id === articleId ? { ...c, quantite: qty } : c));
  };

  const removeComponent = (articleId: number) => {
    setKitComponents(kitComponents.filter(c => c.article_id !== articleId));
  };

  const saveKit = async () => {
    if (!kitForm.nom || !kitForm.code) return alert("Nom et Code obligatoires");
    if (kitComponents.length === 0) return alert("Ajoutez au moins un composant");

    try {
      if (kitForm.id) {
        await KitService.updateKit(kitForm.id, kitForm, kitComponents);
        alert("Kit mis à jour");
      } else {
        await KitService.createKit(kitForm as any, kitComponents);
        alert("Kit créé");
      }
      setShowKitModal(false);
      setKitForm({ nom: '', code: '', prix_standard: 0 });
      setKitComponents([]);
      chargerKits();
    } catch (e: any) {
      alert("Erreur: " + e.message);
    }
  };

  const openEditKit = (kit: Kit) => {
    setKitForm(kit);
    setKitComponents(kit.components || []);
    setShowKitModal(true);
  };

  const deleteKit = async (id: number) => {
    if (window.confirm("Supprimer ce kit ?")) {
      await KitService.deleteKit(id);
      chargerKits();
    }
  };

  // --- LOGIC KITS SORTIE ---
  const filteredPatients = patients.filter(p =>
    p.nom_prenoms.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.numero_carnet?.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const consommerKit = async () => {
    if (!selectedPatient) return alert("Sélectionnez un patient");
    if (!selectedKitToConsume) return alert("Sélectionnez un kit");

    if (!window.confirm(`Confirmer la sortie du kit "${selectedKitToConsume.nom}" pour ${selectedPatient.nom_prenoms} ?`)) return;

    try {
      await KitService.consumeKit(selectedKitToConsume.id, user?.id || 0, selectedPatient.id, "INFIRMIER");
      alert("✅ Kit consommé avec succès ! Stock mis à jour.");
      chargerHistory();
      chargerStocks(); // Refresh stock info
      setSelectedKitToConsume(null);
    } catch (e: any) {
      alert("❌ " + e.message);
    }
  };

  const filtered = actes.filter(act =>
    act.libelle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h1 style={{ margin: 0 }}>💉 Espace Infirmier</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setActiveTab('actes')} style={activeTab === 'actes' ? btnTabActive : btnTab}>Soins & Actes</button>

          <Protect code="INFIRMIER_KITS_MANAGE">
            <button onClick={() => setActiveTab('kits_gestion')} style={activeTab === 'kits_gestion' ? btnTabActive : btnTab}>📦 Gestion des Kits</button>
          </Protect>

          <Protect code="INFIRMIER_KITS_CONSUME">
            <button onClick={() => setActiveTab('kits_sortie')} style={activeTab === 'kits_sortie' ? btnTabActive : btnTab}>📤 Sortie de Kit</button>
          </Protect>
        </div>
      </div>

      {/* --- ONGLET ACTES --- */}
      {activeTab === 'actes' && (
        <div style={{ overflowY: 'auto' }}>
          <Protect code="INFIRMIER_ACTES">
            <div style={cardStyle}>
              <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: '#27ae60' }}>➕ Ajouter un nouvel acte (Soin)</h3>
              <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={labelS}>Désignation du soin</label>
                  <input
                    placeholder="Ex: Pansement, Injection, Kit perfusion, Pose de sonde..."
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Prix Standard (FCFA)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={prix}
                    onChange={e => setPrix(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button onClick={ajouterActe} style={btnPlus}>Enregistrer le soin</button>
              </div>
            </div>
          </Protect>

          <div style={{ ...cardStyle, marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h3>Catalogue des soins infirmiers</h3>
              <input
                placeholder="🔍 Rechercher un soin..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid #27ae60' }}
              />
            </div>

            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={tdStyle}>Désignation</th>
                  <th style={tdStyle}>Prix Standard</th>
                  <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(act => (
                  <tr key={act.id} style={{ borderBottom: '1px solid #eee' }}>
                    {editingId === act.id ? (
                      <>
                        <td style={tdStyle}><input value={editNom} onChange={e => setEditNom(e.target.value)} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={editPrix} onChange={e => setEditPrix(e.target.value)} style={inputStyle} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <button onClick={sauvegarderModif} style={btnSaveSmall}>OK</button>
                          <button onClick={() => setEditingId(null)} style={btnCancelSmall}>Annuler</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={tdStyle}><strong>{act.libelle}</strong></td>
                        <td style={tdStyle}>{act.prix_standard.toLocaleString()} FCFA</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <Protect code="INFIRMIER_ACTES">
                            <button onClick={() => demarrerModif(act)} style={btnEdit}>Modifier</button>
                            <button onClick={() => supprimerActe(act.id)} style={btnDelete}>Supprimer</button>
                          </Protect>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ONGLET GESTION KITS --- */}
      {activeTab === 'kits_gestion' && (
        <div style={{ overflowY: 'auto' }}>
          {!showKitModal ? (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>📦 Liste des Kits Composés</h3>
                <button onClick={() => { setKitForm({ nom: '', code: '', prix_standard: 0 }); setKitComponents([]); setShowKitModal(true); }} style={btnPlus}>+ Nouveau Kit</button>
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={tdStyle}>Nom du Kit</th>
                    <th style={tdStyle}>Code</th>
                    <th style={tdStyle}>Composants</th>
                    <th style={tdStyle}>Prix</th>
                    <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kits.map(kit => (
                    <tr key={kit.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}><strong>{kit.nom}</strong></td>
                      <td style={tdStyle}>{kit.code}</td>
                      <td style={{ ...tdStyle, fontSize: '0.9rem', color: '#555' }}>
                        {kit.components?.map(c => `${c.designation} (x${c.quantite})`).join(', ')}
                      </td>
                      <td style={tdStyle}>{kit.prix_standard} F</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button onClick={() => openEditKit(kit)} style={btnEdit}>Modifier</button>
                        <button onClick={() => deleteKit(kit.id)} style={btnDelete}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                  {kits.length === 0 && <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucun kit défini.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={cardStyle}>
              <h3>{kitForm.id ? "Modifier le kit" : "Créer un nouveau kit"}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={labelS}>Nom du Kit</label>
                  <input style={inputStyle} value={kitForm.nom} onChange={e => setKitForm({ ...kitForm, nom: e.target.value })} placeholder="Ex: Kit Palu" />
                </div>
                <div>
                  <label style={labelS}>Code Unique</label>
                  <input style={inputStyle} value={kitForm.code} onChange={e => setKitForm({ ...kitForm, code: e.target.value })} placeholder="KIT001" />
                </div>
                <div>
                  <label style={labelS}>Prix de Vente (Optionnel)</label>
                  <input style={inputStyle} type="number" value={kitForm.prix_standard} onChange={e => setKitForm({ ...kitForm, prix_standard: Number(e.target.value) })} />
                </div>
              </div>

              <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px', overflow: 'visible' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Composants du Stock</h4>
                <div style={{ position: 'relative', marginBottom: '15px', zIndex: 100 }}>
                  <label style={labelS}>Rechercher un article à ajouter</label>
                  <input
                    style={inputStyle}
                    placeholder="Tapez le nom du médicament..."
                    value={searchArticle}
                    onChange={e => { setSearchArticle(e.target.value); setShowArticleResults(true); }}
                    onFocus={() => setShowArticleResults(true)}
                  />

                  {showArticleResults && searchArticle && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      background: 'white', border: '1px solid #ddd', borderRadius: '0 0 8px 8px',
                      maxHeight: '250px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                    }}>
                      {filteredStocks.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleAddStringComponent(s)}
                          style={{
                            padding: '12px 15px',
                            borderBottom: '1px solid #f1f1f1',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <span style={{ fontWeight: '500', color: '#2c3e50' }}>{s.designation}</span>
                          <span style={{
                            fontSize: '0.75rem',
                            background: s.quantite_stock > 0 ? '#e8f6ef' : '#fcecec',
                            color: s.quantite_stock > 0 ? '#27ae60' : '#e74c3c',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 'bold'
                          }}>
                            Stock: {s.quantite_stock}
                          </span>
                        </div>
                      ))}
                      {filteredStocks.length === 0 && <div style={{ padding: '10px', color: '#999' }}>Aucun article trouvé.</div>}
                    </div>
                  )}
                </div>

                {kitComponents.map(c => (
                  <div key={c.article_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ flex: 1 }}>{c.designation}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem' }}>Qté:</label>
                      <input
                        type="number"
                        value={c.quantite}
                        onChange={e => updateComponentQty(c.article_id, Number(e.target.value))}
                        style={{ width: '60px', padding: '5px' }}
                        min="1"
                      />
                    </div>
                    <button onClick={() => removeComponent(c.article_id)} style={{ ...btnDelete, padding: '2px 5px' }}>X</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={saveKit} style={btnPlus}>Enregistrer le Kit</button>
                <button onClick={() => setShowKitModal(false)} style={btnCancelSmall}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ONGLET SORTIE KITS --- */}
      {activeTab === 'kits_sortie' && (
        <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
          {/* GAUCHE: FORMULAIRE */}
          <div style={{ flex: 1, ...cardStyle }}>
            <h3>📤 Sortie de Kit (Consommation)</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelS}>1. Sélectionner le Patient</label>
              <input
                placeholder="Rechercher patient..."
                value={searchPatient}
                onChange={e => { setSearchPatient(e.target.value); setSelectedPatient(null); }}
                style={inputStyle}
              />
              {searchPatient && !selectedPatient && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', marginTop: '5px' }}>
                  {filteredPatients.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setSearchPatient(p.nom_prenoms); }}
                      style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                    >
                      {p.nom_prenoms} ({p.numero_carnet})
                    </div>
                  ))}
                </div>
              )}
              {selectedPatient && <div style={{ color: '#27ae60', marginTop: '5px', fontWeight: 'bold' }}>Patient sélectionné : {selectedPatient.nom_prenoms}</div>}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelS}>2. Choisir le Kit</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {kits.map(kit => (
                  <div
                    key={kit.id}
                    onClick={() => setSelectedKitToConsume(kit)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: selectedKitToConsume?.id === kit.id ? '2px solid #3498db' : '1px solid #eee',
                      background: selectedKitToConsume?.id === kit.id ? '#eaf2f8' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{kit.nom}</div>
                    <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                      Composants: {kit.components?.map(c => `${c.designation} x${c.quantite}`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={consommerKit}
              disabled={!selectedPatient || !selectedKitToConsume}
              style={{ ...btnPlus, width: '100%', opacity: (!selectedPatient || !selectedKitToConsume) ? 0.5 : 1 }}
            >
              Valider la Sortie
            </button>
          </div>

          {/* DROITE: HISTORIQUE */}
          <div style={{ flex: 1, ...cardStyle }}>
            <h3>🕒 Historique des sorties</h3>
            <div style={{ overflowY: 'auto', height: 'calc(100% - 50px)' }}>
              {history.map(h => (
                <div key={h.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{h.nom_kit || "Kit inconnu"}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>{new Date(h.date_consommation).toLocaleString()}</span>
                  </div>
                  <div style={{ color: '#555' }}>Pour: {h.nom_patient || "Patient inconnu"}</div>
                  <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
                    Par: Infirmier
                  </div>
                </div>
              ))}
              {history.length === 0 && <p style={{ color: '#999', textAlign: 'center' }}>Aucun historique.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '15px', textAlign: 'left' };

const btnPlus: React.CSSProperties = { background: '#27ae60', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: React.CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' };
const btnDelete: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' };

const btnSaveSmall: React.CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnCancelSmall: React.CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };

const btnTab: React.CSSProperties = { padding: '10px 20px', borderRadius: '20px', border: 'none', background: '#eee', cursor: 'pointer', fontWeight: 'bold', color: '#555' };
const btnTabActive: React.CSSProperties = { ...btnTab, background: '#3498db', color: 'white' };
