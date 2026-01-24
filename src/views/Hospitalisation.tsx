import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../lib/db";

export default function HospitalisationView() {
  const [activeTab, setActiveTab] = useState<"catalogue" | "admissions" | "archives" | "config_lits">("catalogue");

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif', background: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>🏨 Hospitalisation</h1>
        <div style={{ display: 'flex', background: 'white', padding: '5px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <button onClick={() => setActiveTab("catalogue")} style={activeTab === "catalogue" ? tabActive : tabNormal}>🛠️ Catalogue & Tarifs</button>
          <button onClick={() => setActiveTab("config_lits")} style={activeTab === "config_lits" ? tabActive : tabNormal}>🛏️ Gestion Lits</button>
          <button onClick={() => setActiveTab("admissions")} style={activeTab === "admissions" ? tabActive : tabNormal}>👨‍⚕️ Admissions en cours</button>
          <button onClick={() => setActiveTab("archives")} style={activeTab === "archives" ? tabActive : tabNormal}>📚 Historique</button>
        </div>
      </div>

      {activeTab === "catalogue" && <CatalogueView />}
      {activeTab === "config_lits" && <ConfigLitsView />}
      {activeTab === "admissions" && <AdmissionsView />}
      {activeTab === "archives" && <ArchivesView />}
    </div>
  );
}

// --- SOUS-COMPOSANT : CATALOGUE (STYLE LABORATOIRE) ---
function CatalogueView() {
  const [items, setItems] = useState<any[]>([]);
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState<number | string>("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLibelle, setEditLibelle] = useState("");
  const [editPrix, setEditPrix] = useState<number | string>("");

  const loadItems = async () => {
    const db = await getDb();
    const res = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'HOSPITALISATION' ORDER BY libelle");
    setItems(res);
  };

  useEffect(() => { loadItems(); }, []);

  const addItem = async () => {
    if (!libelle || !prix) return;
    const db = await getDb();
    await db.execute("INSERT INTO prestations (libelle, prix_standard, categorie) VALUES (?, ?, 'HOSPITALISATION')", [libelle, prix]);
    setLibelle(""); setPrix(""); loadItems();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Supprimer ?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM prestations WHERE id = ?", [id]);
    loadItems();
  };

  const updateItem = async () => {
    const db = await getDb();
    await db.execute("UPDATE prestations SET libelle = ?, prix_standard = ? WHERE id = ?", [editLibelle, editPrix, editingId]);
    setEditingId(null); loadItems();
  }

  const filtered = items.filter(i => i.libelle.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Liste des Chambres & Services</h3>

      {/* FORMULAIRE AJOUT */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ flex: 2 }}>
          <label style={labelS}>Désignation (Chambre, Soin, Kit...)</label>
          <input placeholder="Ex: Chambre VIP, Kit Perfusion..." value={libelle} onChange={e => setLibelle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelS}>Prix Unitaire</label>
          <input type="number" placeholder="0" value={prix} onChange={e => setPrix(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={addItem} style={btnPlus}>Ajouter</button>
      </div>

      {/* LISTE */}
      <input placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: '10px', width: '300px' }} />

      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={tdStyle}>Désignation</th>
            <th style={tdStyle}>Prix</th>
            <th style={tdStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
              {editingId === item.id ? (
                <>
                  <td style={tdStyle}><input value={editLibelle} onChange={e => setEditLibelle(e.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}><input type="number" value={editPrix} onChange={e => setEditPrix(e.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}>
                    <button onClick={updateItem} style={btnSave}>OK</button>
                    <button onClick={() => setEditingId(null)} style={btnCancel}>Annuler</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={tdStyle}>{item.libelle}</td>
                  <td style={tdStyle}>{Number(item.prix_standard).toLocaleString()} F</td>
                  <td style={tdStyle}>
                    <button onClick={() => { setEditingId(item.id); setEditLibelle(item.libelle); setEditPrix(item.prix_standard); }} style={btnEdit}>✏️</button>
                    <button onClick={() => deleteItem(item.id)} style={btnDelete}>🗑️</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- SOUS-COMPOSANT : ADMISSIONS (SUIVI SIMPLE) ---
function AdmissionsView() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  // Form States
  const [patients, setPatients] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [lits, setLits] = useState<any[]>([]); // Pour garder retro-compatibilité si besoin, ou on simplifie

  const [searchP, setSearchP] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [selectedLitId, setSelectedLitId] = useState(""); // Si on garde la notion de lit
  const [nbJours, setNbJours] = useState(1);
  const [services, setServices] = useState<{ id: number, libelle: string, prix: number, qte: number }[]>([]);

  const loadData = async () => {
    const db = await getDb();
    const resAdm = await db.select<any[]>(`
            SELECT a.id, p.nom_prenoms, p.numero_carnet, l.nom_lit, a.date_entree, a.nb_jours 
            FROM admissions a
            JOIN patients p ON a.patient_id = p.id
            LEFT JOIN lits l ON a.lit_id = l.id
            WHERE a.statut = 'en_cours'
        `);
    setAdmissions(resAdm);

    // Preload for form
    const resP = await db.select<any[]>("SELECT * FROM patients");
    setPatients(resP);
    const resCat = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'HOSPITALISATION'");
    setCatalog(resCat);
    const resLits = await db.select<any[]>(`
        SELECT l.*, c.nom as nom_chambre 
        FROM lits l 
        LEFT JOIN chambres c ON l.chambre_id = c.id 
        WHERE l.statut != 'occupe'
        ORDER BY c.nom, l.nom_lit
    `);
    setLits(resLits);
  };

  useEffect(() => { loadData(); }, []);

  const toggleService = (item: any) => {
    if (services.find(s => s.id === item.id)) {
      setServices(prev => prev.filter(s => s.id !== item.id));
    } else {
      setServices(prev => [...prev, { id: item.id, libelle: item.libelle, prix: item.prix_standard, qte: 1 }]);
    }
  }

  const doAdmission = async () => {
    if (!patient || !selectedLitId) return alert("Patient et Lit requis");
    const db = await getDb();

    try {
      // Créer admission
      const res = await db.execute(
        "INSERT INTO admissions (patient_id, lit_id, nb_jours, date_entree, statut) VALUES (?, ?, ?, CURDATE(), 'en_cours')",
        [patient.id, selectedLitId, nbJours]
      );
      const admId = res.lastInsertId;

      // Ajouter Services
      for (const s of services) {
        await db.execute(
          "INSERT INTO admission_prestations (admission_id, prestation_id, libelle, prix_unitaire, quantite) VALUES (?, ?, ?, ?, ?)",
          [admId, s.id, s.libelle, s.prix, s.qte]
        );
      }

      // Marquer lit occupé
      await db.execute("UPDATE lits SET statut = 'occupe' WHERE id = ?", [selectedLitId]);

      alert("Admission enregistrée !");
      setShowNew(false);
      setPatient(null);
      setServices([]);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Erreur");
    }
  };

  const liberer = async (adm: any) => {
    if (!confirm(`Libérer ${adm.nom_prenoms} ?`)) return;
    const db = await getDb();
    await db.execute("UPDATE admissions SET statut = 'termine', date_sortie = CURDATE() WHERE id = ?", [adm.id]);
    // Libérer lit (si on peut trouver l'id du lit depuis adm)
    // Ici on fait une requete pour trouver le lit id car adm.lit_id n'est pas dans la liste affichée
    const resLit = await db.select<any[]>("SELECT lit_id FROM admissions WHERE id = ?", [adm.id]);
    if (resLit.length) {
      await db.execute("UPDATE lits SET statut = 'disponible' WHERE id = ?", [resLit[0].lit_id]);
    }
    loadData();
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>🛏️ Patients Hospitalisés ({admissions.length})</h3>
        <button onClick={() => setShowNew(true)} style={btnPlus}>+ Nouvelle Admission</button>
      </div>

      {showNew && (
        <div style={{ background: '#ebf5fb', padding: '20px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #3498db' }}>
          <h4 style={{ marginTop: 0 }}>Nouvelle Admission</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={labelS}>Patient (Recherche Carnet/Nom)</label>
              <input value={searchP} onChange={e => {
                setSearchP(e.target.value);
                const found = patients.find(p => p.numero_carnet === e.target.value || p.nom_prenoms.toLowerCase().includes(e.target.value.toLowerCase()));
                setPatient(found || null);
              }} style={inputStyle} placeholder="Tapez pour chercher..." />
              {patient && <div style={{ color: 'green', fontWeight: 'bold' }}>✅ {patient.nom_prenoms}</div>}
            </div>
            <div>
              <label style={labelS}>Lit / Chambre</label>
              <select value={selectedLitId} onChange={e => setSelectedLitId(e.target.value)} style={inputStyle}>
                <option value="">-- Choisir un lit libre --</option>
                {lits.map(l => (
                  <option key={l.id} value={l.id}>{l.nom_chambre} - {l.nom_lit}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelS}>Durée prévue (Jours)</label>
              <input type="number" value={nbJours} onChange={e => setNbJours(parseInt(e.target.value))} style={inputStyle} min="1" />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={labelS}>Services & Soins Initiaux</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {catalog.filter(c => !c.libelle.toLowerCase().includes('chambre')).map(c => {
                const sel = services.find(s => s.id === c.id);
                return (
                  <div key={c.id} onClick={() => toggleService(c)} style={{
                    padding: '5px 10px', borderRadius: '15px', border: '1px solid #ccc', cursor: 'pointer',
                    background: sel ? '#3498db' : 'white', color: sel ? 'white' : '#333'
                  }}>
                    {c.libelle}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button onClick={() => setShowNew(false)} style={{ ...btnCancel, marginRight: '10px' }}>Annuler</button>
            <button onClick={doAdmission} style={btnSave}>Valider Admission</button>
          </div>
        </div>
      )}

      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#2c3e50', color: 'white' }}>
            <th style={tdStyle}>Patient</th>
            <th style={tdStyle}>Chambre</th>
            <th style={tdStyle}>Entrée</th>
            <th style={tdStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {admissions.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}><strong>{a.nom_prenoms}</strong><br /><small>{a.numero_carnet}</small></td>
              <td style={tdStyle}>{a.nom_lit}</td>
              <td style={tdStyle}>{new Date(a.date_entree).toLocaleDateString()}</td>
              <td style={tdStyle}>
                <button onClick={() => liberer(a)} style={btnDelete}>Libérer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ArchivesView() {
  const [archives, setArchives] = useState<any[]>([]);
  useEffect(() => {
    getDb().then(db => db.select("SELECT a.*, p.nom_prenoms FROM admissions a JOIN patients p ON a.patient_id = p.id WHERE a.statut='termine' ORDER BY date_sortie DESC LIMIT 50"))
      .then((res: any) => setArchives(res));
  }, []);

  return (
    <div style={cardStyle}>
      <h3>📚 Historique Récent</h3>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#95a5a6', color: 'white' }}>
            <th style={tdStyle}>Patient</th>
            <th style={tdStyle}>Entrée</th>
            <th style={tdStyle}>Sortie</th>
          </tr>
        </thead>
        <tbody>
          {archives.map((a: any) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{a.nom_prenoms}</td>
              <td style={tdStyle}>{new Date(a.date_entree).toLocaleDateString()}</td>
              <td style={tdStyle}>{new Date(a.date_sortie).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- SOUS-COMPOSANT : CONFIGURATION LITS (Physique) ---
function ConfigLitsView() {
  const [chambres, setChambres] = useState<any[]>([]);
  const [lits, setLits] = useState<any[]>([]);
  const [newChambre, setNewChambre] = useState("");

  // Bed Form
  const [newLit, setNewLit] = useState("");
  const [selectedChambre, setSelectedChambre] = useState("");
  const [newLitPrix, setNewLitPrix] = useState<number>(0);

  const loadData = async () => {
    const db = await getDb();
    // Load Chambres
    try {
      const resC = await db.select<any[]>("SELECT * FROM chambres ORDER BY nom");
      setChambres(resC);
    } catch (e) { console.error("Error loading chambres", e); }

    // Load Lits
    try {
      const resL = await db.select<any[]>(`
            SELECT l.*, c.nom as nom_chambre 
            FROM lits l 
            LEFT JOIN chambres c ON l.chambre_id = c.id 
            ORDER BY c.nom, l.nom_lit
        `);
      setLits(resL);
    } catch (e) { console.error("Error loading lits", e); }
  };

  useEffect(() => { loadData(); }, []);

  const addChambre = async () => {
    if (!newChambre) return;
    try {
      const db = await getDb();
      await db.execute("INSERT INTO chambres (nom) VALUES (?)", [newChambre]);
      setNewChambre("");
      loadData();
    } catch (e) { alert("Erreur ajout chambre: " + e); }
  };

  const addLit = async () => {
    if (!newLit || !selectedChambre) return alert("Nom du lit et Chambre requis");
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO lits (nom_lit, chambre_id, statut, prix_journalier) VALUES (?, ?, 'disponible', ?)",
        [newLit, selectedChambre, newLitPrix]
      );
      setNewLit("");
      setNewLitPrix(0);
      loadData();
    } catch (e) { alert("Erreur ajout lit: " + e); }
  };

  const deleteChambre = async (id: number) => {
    if (!confirm("Supprimer cette chambre ? Cela supprimera aussi les lits associés.")) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM lits WHERE chambre_id = ?", [id]); // Cascade manually if needed
      await db.execute("DELETE FROM chambres WHERE id = ?", [id]);
      loadData();
    } catch (e) { alert("Erreur suppression: " + e); }
  };

  const deleteLit = async (id: number) => {
    if (!confirm("Supprimer ce lit ?")) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM lits WHERE id = ?", [id]);
      loadData();
    } catch (e) { alert("Erreur suppression lit: " + e); }
  };

  const importerDepuisCatalogue = async () => {
    if (!confirm("⚠️ Cette action va analyser le Catalogue pour créer automatiquement les Chambres et Lits.\n\nConfirmer ?")) return;

    try {
      const db = await getDb();
      const catalogue = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'HOSPITALISATION' AND libelle LIKE '%Chambre%'");

      if (catalogue.length === 0) return alert("Aucune 'Chambre' trouvée dans le catalogue.");

      let countC = 0;
      let countL = 0;

      for (const item of catalogue) {
        // Check if exists
        const existing = await db.select<any[]>("SELECT id FROM chambres WHERE nom = ?", [item.libelle]);
        let chambreId;

        if (existing.length > 0) {
          chambreId = existing[0].id; // Use existing
        } else {
          // Create Room
          const res = await db.execute("INSERT INTO chambres (nom) VALUES (?)", [item.libelle]);
          chambreId = res.lastInsertId;
          countC++;
        }

        // Determine nb beds
        const name = item.libelle.toLowerCase();
        let nbLits = 1;
        if (name.includes("double")) nbLits = 2;
        else if (name.includes("triple")) nbLits = 3;
        else if (name.includes("quadruple")) nbLits = 4;

        // Create Beds if they don't exist
        for (let i = 1; i <= nbLits; i++) {
          const litName = `Lit ${i}`;
          const existLit = await db.select<any[]>("SELECT id FROM lits WHERE chambre_id = ? AND nom_lit = ?", [chambreId, litName]);

          if (existLit.length === 0) {
            await db.execute(
              "INSERT INTO lits (nom_lit, chambre_id, statut, prix_journalier) VALUES (?, ?, 'disponible', ?)",
              [litName, chambreId, item.prix_standard]
            );
            countL++;
          }
        }
      }

      loadData();
      alert(`✅ Importation terminée !\n\n🏠 ${countC} Chambres créées\n🛏️ ${countL} Lits ajoutés`);

    } catch (e) { console.error(e); alert("Erreur import: " + e); }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>⚙️ Configuration des Lits</h3>
        <button onClick={importerDepuisCatalogue} style={{ background: '#8e44ad', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          🪄 Générer depuis le Catalogue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>

        {/* GESTION CHAMBRES */}
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
          <h4 style={{ marginTop: 0 }}>🏠 Chambres</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              placeholder="Nom Chambre..."
              value={newChambre}
              onChange={e => setNewChambre(e.target.value)}
              style={inputStyle}
            />
            <button onClick={addChambre} style={btnPlus}>+</button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {chambres.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'white', marginBottom: '5px', borderRadius: '5px', border: '1px solid #eee' }}>
                <span>{c.nom}</span>
                <button onClick={() => deleteChambre(c.id)} style={{ ...btnDelete, padding: '2px 6px', fontSize: '0.8rem' }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* GESTION LITS */}
        <div>
          <h4 style={{ marginTop: 0 }}>🛏️ Lits Physiques</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
            <select value={selectedChambre} onChange={e => setSelectedChambre(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
              <option value="">Sélectionner Chambre...</option>
              {chambres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <input
              placeholder="Nom/Numéro Lit..."
              value={newLit}
              onChange={e => setNewLit(e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Prix/J"
              value={newLitPrix}
              onChange={e => setNewLitPrix(parseInt(e.target.value))}
              style={{ ...inputStyle, width: '100px' }}
            />
            <button onClick={addLit} style={btnPlus}>Ajouter Lit</button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#ecf0f1' }}>
                <th style={tdStyle}>Lit</th>
                <th style={tdStyle}>Chambre</th>
                <th style={tdStyle}>Prix / J</th>
                <th style={tdStyle}>Statut</th>
                <th style={tdStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lits.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}><strong>{l.nom_lit}</strong></td>
                  <td style={tdStyle}>{l.nom_chambre}</td>
                  <td style={tdStyle}><strong>{Number(l.prix_journalier || 0).toLocaleString()} F</strong></td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                      background: l.statut === 'occupe' ? '#fadbd8' : '#d5f5e3',
                      color: l.statut === 'occupe' ? '#c0392b' : '#27ae60'
                    }}>
                      {l.statut?.toUpperCase()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => deleteLit(l.id)} style={btnDelete}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const cardStyle: CSSProperties = { background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const inputStyle: CSSProperties = { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tabNormal: CSSProperties = { padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#7f8c8d', fontWeight: '500', marginRight: '5px' };
const tabActive: CSSProperties = { ...tabNormal, color: '#3498db', borderBottom: '2px solid #3498db', fontWeight: 'bold', background: '#f8f9fa' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tdStyle: CSSProperties = { padding: '12px', textAlign: 'left' };
const btnPlus: CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnSave: CSSProperties = { background: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancel: CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };
const btnDelete: CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' };
