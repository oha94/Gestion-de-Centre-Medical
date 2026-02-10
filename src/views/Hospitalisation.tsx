import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../lib/db";
import { Protect } from "../components/Protect";

export default function HospitalisationView() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "catalogue" | "admissions" | "archives" | "config_lits">("dashboard");

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif', background: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>🏨 Hospitalisation</h1>
        <div style={{ display: 'flex', background: 'white', padding: '5px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <button onClick={() => setActiveTab("dashboard")} style={activeTab === "dashboard" ? tabActive : tabNormal}>📊 Tableau</button>

          <Protect code="HOSPI_PLANNING">
            <button onClick={() => setActiveTab("config_lits")} style={activeTab === "config_lits" ? tabActive : tabNormal}>🛏️ Config</button>
          </Protect>

          <Protect code="HOSPI_ADMIT">
            <button onClick={() => setActiveTab("catalogue")} style={activeTab === "catalogue" ? tabActive : tabNormal}>🛠️ Tarifs</button>
          </Protect>

          <Protect code="HOSPI_ADMIT">
            <button onClick={() => setActiveTab("admissions")} style={activeTab === "admissions" ? tabActive : tabNormal}>👨‍⚕️ Dossiers</button>
          </Protect>

          <Protect code="HOSPI_VIEW">
            <button onClick={() => setActiveTab("archives")} style={activeTab === "archives" ? tabActive : tabNormal}>📚 Historique</button>
          </Protect>
        </div>
      </div>

      {activeTab === "dashboard" && <DashboardView setActiveTab={setActiveTab} />}
      {activeTab === "catalogue" && <CatalogueView />}
      {activeTab === "config_lits" && <ConfigLitsView />}
      {activeTab === "admissions" && <AdmissionsView />}
      {activeTab === "archives" && <ArchivesView />}
    </div>
  );
}

// --- SOUS-COMPOSANT : DASHBOARD ---
function DashboardView({ setActiveTab }: { setActiveTab: (t: any) => void }) {
  const [lits, setLits] = useState<any[]>([]);

  useEffect(() => {
    getDb().then(db => db.select<any[]>(`
      SELECT l.*, c.nom as nom_chambre, a.id as admission_id, p.nom_prenoms 
      FROM lits l 
      LEFT JOIN chambres c ON l.chambre_id = c.id
      LEFT JOIN admissions a ON l.id = a.lit_id AND a.statut = 'en_cours'
      LEFT JOIN patients p ON a.patient_id = p.id
      ORDER BY c.nom, l.nom_lit
    `)).then(res => setLits(res));
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
      {lits.map(lit => (
        <div key={lit.id}
          onClick={() => setActiveTab("admissions")}
          style={{
            padding: '20px',
            borderRadius: '15px',
            background: lit.statut === 'occupe' ? '#FFF5F5' : '#F0FFF4',
            color: lit.statut === 'occupe' ? '#C53030' : '#2F855A',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: lit.statut === 'occupe' ? '2px solid #FC8181' : '2px solid #68D391',
            textAlign: 'center'
          }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{lit.nom_chambre}</div>
          <h2 style={{ margin: '10px 0', fontSize: '1.5rem' }}>{lit.nom_lit}</h2>
          {lit.statut === 'occupe' ? (
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>👤 {lit.nom_prenoms}</div>
              <div style={{ fontSize: '0.8rem', marginTop: '5px', textDecoration: 'underline' }}>Voir Dossier &rarr;</div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 'bold' }}>✅ LIBRE</div>
              <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>+ Nouvelle Admission</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
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

// --- SOUS-COMPOSANT : ADMISSIONS (Avec Dossier Médical) ---
function AdmissionsView() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "new" | "details">("list");
  const [selectedAdm, setSelectedAdm] = useState<any>(null);

  // Form New Admission
  const [patients, setPatients] = useState<any[]>([]);
  const [lits, setLits] = useState<any[]>([]);
  const [searchP, setSearchP] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [selectedLitId, setSelectedLitId] = useState("");
  const [nbJours, setNbJours] = useState(1);
  const [modeTarif, setModeTarif] = useState<"STANDARD" | "VENTILE">("STANDARD");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Medical Notes
  const [observations, setObservations] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  const loadData = async () => {
    const db = await getDb();
    const resAdm = await db.select<any[]>(`
            SELECT a.*, p.nom_prenoms, p.numero_carnet, l.nom_lit, c.nom as nom_chambre
            FROM admissions a
            JOIN patients p ON a.patient_id = p.id
            LEFT JOIN lits l ON a.lit_id = l.id
            LEFT JOIN chambres c ON l.chambre_id = c.id
            WHERE a.statut = 'en_cours'
            ORDER BY a.date_entree DESC
        `);
    setAdmissions(resAdm);

    // Preload
    const resP = await db.select<any[]>("SELECT * FROM patients");
    setPatients(resP);
    const resLits = await db.select<any[]>(`
        SELECT l.*, c.nom as nom_chambre 
        FROM lits l 
        LEFT JOIN chambres c ON l.chambre_id = c.id 
        WHERE l.statut != 'occupe'
        ORDER BY c.nom, l.nom_lit
    `);
    setLits(resLits);
    const resCat = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'HOSPITALISATION'");
    setCatalog(resCat);
  };

  useEffect(() => { loadData(); }, []);

  // --- DETAILS & OBSERVATIONS ---
  const openDetails = async (adm: any) => {
    setSelectedAdm(adm);
    setViewMode("details");
    loadObservations(adm.id);
    loadServices(adm.id);
  };

  const loadObservations = async (admId: number) => {
    const db = await getDb();
    const obs = await db.select<any[]>("SELECT * FROM admission_observations WHERE admission_id = ? ORDER BY date_obs DESC", [admId]);
    setObservations(obs);
  };

  const loadServices = async (admId: number) => {
    const db = await getDb();
    const srv = await db.select<any[]>("SELECT * FROM admission_prestations WHERE admission_id = ?", [admId]);
    setServices(srv); // Reuse local state for display in details
  };

  const addObservation = async () => {
    if (!newNote) return;
    const db = await getDb();
    await db.execute("INSERT INTO admission_observations (admission_id, note) VALUES (?, ?)", [selectedAdm.id, newNote]);
    setNewNote("");
    loadObservations(selectedAdm.id);
  };

  const addServiceToAdm = async (srv: any) => {
    if (!confirm(`Ajouter ${srv.libelle} au dossier ?`)) return;
    const db = await getDb();
    await db.execute(
      "INSERT INTO admission_prestations (admission_id, prestation_id, libelle, prix_unitaire, quantite) VALUES (?, ?, ?, ?, 1)",
      [selectedAdm.id, srv.id, srv.libelle, srv.prix_standard]
    );
    loadServices(selectedAdm.id);
  };

  // --- NEW ADMISSION LOGIC ---
  const doAdmission = async () => {
    if (!patient || !selectedLitId) return alert("Patient et Lit requis");
    const db = await getDb();
    try {
      await db.execute(
        "INSERT INTO admissions (patient_id, lit_id, nb_jours, date_entree, statut, mode_tarif) VALUES (?, ?, ?, CURDATE(), 'en_cours', ?)",
        [patient.id, selectedLitId, nbJours, modeTarif]
      );
      await db.execute("UPDATE lits SET statut = 'occupe' WHERE id = ?", [selectedLitId]);
      alert("Admission enregistrée !");
      setViewMode("list");
      setPatient(null);
      loadData();
    } catch (e) { alert("Erreur: " + e); }
  };

  const liberer = async (adm: any) => {
    if (!confirm(`Libérer ${adm.nom_prenoms} ?\nCela clôturera le dossier.`)) return;
    const db = await getDb();
    await db.execute("UPDATE admissions SET statut = 'termine', date_sortie = CURDATE() WHERE id = ?", [adm.id]);
    await db.execute("UPDATE lits SET statut = 'disponible' WHERE id = ?", [adm.lit_id]);
    if (selectedAdm?.id === adm.id) setViewMode("list");
    loadData();
  };

  // Helper to check ventilated option
  const selectedLitObj = lits.find(l => l.id == selectedLitId);
  const canVentile = selectedLitObj && selectedLitObj.prix_ventile > 0;

  return (
    <div style={{ display: 'flex', height: '80vh', gap: '20px' }}>

      {/* LISTE GAUCHE */}
      <div style={{ flex: 1, ...cardStyle, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3>📂 Dossiers ({admissions.length})</h3>
          <button onClick={() => setViewMode("new")} style={btnPlus}>+ Nouveau</button>
        </div>
        <div>
          {admissions.map(a => (
            <div key={a.id} onClick={() => openDetails(a)} style={{
              padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer',
              background: selectedAdm?.id === a.id ? '#e8f6f3' : 'white'
            }}>
              <div style={{ fontWeight: 'bold' }}>{a.nom_prenoms}</div>
              <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                {a.nom_chambre} - {a.nom_lit} | Entrée: {new Date(a.date_entree).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENU DROITE */}
      <div style={{ flex: 2, ...cardStyle, overflowY: 'auto' }}>

        {viewMode === "list" && (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#999' }}>
            <h2>👈 Sélectionnez un dossier ou créez une admission</h2>
          </div>
        )}

        {viewMode === "new" && (
          <div>
            <h3>🏥 Nouvelle Hospitalisation</h3>
            <div style={{ display: 'grid', gap: '15px', background: '#f9f9f9', padding: '20px', borderRadius: '10px' }}>
              <div>
                <label style={labelS}>Recherche Patient</label>
                <input value={searchP} onChange={e => {
                  setSearchP(e.target.value);
                  const found = patients.find(p => p.numero_carnet === e.target.value || p.nom_prenoms.toLowerCase().includes(e.target.value.toLowerCase()));
                  setPatient(found || null);
                }} style={inputStyle} placeholder="Nom ou Numéro Carnet..." />
                {patient && <div style={{ color: 'green', marginTop: '5px' }}>✅ {patient.nom_prenoms}</div>}
              </div>

              <div>
                <label style={labelS}>Choix du Lit</label>
                <select value={selectedLitId} onChange={e => setSelectedLitId(e.target.value)} style={inputStyle}>
                  <option value="">-- Lit Disponible --</option>
                  {lits.map(l => <option key={l.id} value={l.id}>{l.nom_chambre} - {l.nom_lit} ({l.prix_journalier} F)</option>)}
                </select>
              </div>

              {canVentile && (
                <div style={{ padding: '10px', background: '#fff3cd', border: '1px solid #f39c12', borderRadius: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#d35400' }}>
                    <input type="checkbox" checked={modeTarif === "VENTILE"} onChange={e => setModeTarif(e.target.checked ? "VENTILE" : "STANDARD")} />
                    Option Ventilé (Économique)
                  </label>
                  <div style={{ fontSize: '0.8rem', marginLeft: '25px' }}>
                    Prix Standard: {selectedLitObj.prix_journalier} F <br />
                    Prix Ventilé: {selectedLitObj.prix_ventile} F
                  </div>
                </div>
              )}

              <div>
                <label style={labelS}>Durée estimée (jours)</label>
                <input type="number" value={nbJours} onChange={e => setNbJours(parseInt(e.target.value) || 1)} style={inputStyle} min="1" />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={doAdmission} style={btnSave}>Valider Entrée</button>
                <button onClick={() => setViewMode("list")} style={btnCancel}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "details" && selectedAdm && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>{selectedAdm.nom_prenoms}</h2>
                <div style={{ color: '#7f8c8d' }}>
                  {selectedAdm.nom_chambre} - {selectedAdm.nom_lit} &bull;
                  <span style={{ marginLeft: '10px', background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                    Tarif: {selectedAdm.mode_tarif || 'STANDARD'}
                  </span>
                </div>
              </div>
              <button onClick={() => liberer(selectedAdm)} style={btnDelete}>Sortie / Libérer</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* DOSSIER MEDICAL / OBSERVATIONS */}
              <div>
                <h4 style={{ background: '#3498db', color: 'white', padding: '10px', borderRadius: '5px', margin: 0 }}>📝 Suivi Médical</h4>
                <div style={{ border: '1px solid #ddd', padding: '10px', height: '300px', overflowY: 'auto', background: '#fff' }}>
                  {observations.map(obs => (
                    <div key={obs.id} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>{new Date(obs.date_obs).toLocaleString()}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{obs.note}</div>
                    </div>
                  ))}
                  {observations.length === 0 && <div style={{ color: '#ccc', textAlign: 'center', marginTop: '50px' }}>Aucune note.</div>}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                  <textarea
                    value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Nouvelle observation..."
                    style={{ ...inputStyle, height: '60px' }}
                  />
                  <button onClick={addObservation} style={btnPlus}>Ajouter</button>
                </div>
              </div>

              {/* PRESTATIONS / SOINS */}
              <div>
                <h4 style={{ background: '#27ae60', color: 'white', padding: '10px', borderRadius: '5px', margin: 0 }}>💊 Soins & Services</h4>
                <div style={{ border: '1px solid #ddd', padding: '10px', height: '300px', overflowY: 'auto', background: '#fff' }}>
                  {services.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee' }}>
                      <span>{s.libelle}</span>
                      <span style={{ fontWeight: 'bold' }}>{s.quantite}</span>
                    </div>
                  ))}

                  <div style={{ marginTop: '20px', borderTop: '2px dashed #eee', paddingTop: '10px' }}>
                    <label style={labelS}>Ajouter un soin :</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {catalog.filter(c => !c.libelle.toLowerCase().includes('chambre') && !c.libelle.toLowerCase().includes('ami') && !c.libelle.toLowerCase().includes('visitem')).slice(0, 10).map(c => (
                        <button key={c.id} onClick={() => addServiceToAdm(c)} style={{ ...btnText, background: '#f0f0f0', padding: '5px 10px', borderRadius: '15px' }}>
                          + {c.libelle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
  const [newLitPrixAssur, setNewLitPrixAssur] = useState<number>(0);
  const [newLitPrixVentile, setNewLitPrixVentile] = useState<number>(0);
  const [newLitPrixVentileAssur, setNewLitPrixVentileAssur] = useState<number>(0);

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
        `INSERT INTO lits 
        (nom_lit, chambre_id, statut, prix_journalier, prix_assurance, prix_ventile, prix_ventile_assurance) 
        VALUES (?, ?, 'disponible', ?, ?, ?, ?)`,
        [
          newLit, selectedChambre, newLitPrix,
          newLitPrixAssur || newLitPrix,
          newLitPrixVentile || null,
          newLitPrixVentileAssur || null
        ]
      );
      setNewLit("");
      setNewLitPrix(0);
      setNewLitPrixAssur(0);
      setNewLitPrixVentile(0);
      setNewLitPrixVentileAssur(0);
      loadData();
    } catch (e) { alert("Erreur ajout lit: " + e); }
  };

  const deleteChambre = async (id: number) => {
    if (!confirm("Supprimer cette chambre ? Cela supprimera aussi les lits associés.")) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM lits WHERE chambre_id = ?", [id]);
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

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>⚙️ Configuration des Lits</h3>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px' }}>

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
          <h4 style={{ marginTop: 0 }}>🛏️ Lits Physiques & Tarifs</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '5px', alignItems: 'center' }}>
            <select value={selectedChambre} onChange={e => setSelectedChambre(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
              <option value="">Sélectionner Chambre...</option>
              {chambres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <input placeholder="Nom Lit (ex: Lit 1)" value={newLit} onChange={e => setNewLit(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px', marginBottom: '10px', background: '#eef', padding: '10px', borderRadius: '8px' }}>
            <div>
              <label style={labelS}>Prix Standard (Clim)</label>
              <input type="number" placeholder="Standard" value={newLitPrix || ""} onChange={e => setNewLitPrix(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelS}>Prix Assurance (Clim)</label>
              <input type="number" placeholder="Assurance" value={newLitPrixAssur || ""} onChange={e => setNewLitPrixAssur(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelS}>Prix Ventilé (Option)</label>
              <input type="number" placeholder="Ventilé" value={newLitPrixVentile || ""} onChange={e => setNewLitPrixVentile(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelS}>Prix Ventilé Assur</label>
              <input type="number" placeholder="Ventilé Assur" value={newLitPrixVentileAssur || ""} onChange={e => setNewLitPrixVentileAssur(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
          <button onClick={addLit} style={{ ...btnPlus, width: '100%', marginBottom: '15px' }}>Ajouter Nouveau Lit</button>

          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#ecf0f1' }}>
                <th style={tdStyle}>Lit</th>
                <th style={tdStyle}>Chambre</th>
                <th style={tdStyle}>Prix Std / Assur</th>
                <th style={tdStyle}>Ventilé Std / Assur</th>
                <th style={tdStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lits.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}><strong>{l.nom_lit}</strong></td>
                  <td style={tdStyle}>{l.nom_chambre}</td>
                  <td style={tdStyle}>
                    <div>{Number(l.prix_journalier || 0).toLocaleString()} F</div>
                    <div style={{ color: '#3498db', fontSize: '0.8rem' }}>{Number(l.prix_assurance || l.prix_journalier).toLocaleString()} F</div>
                  </td>
                  <td style={tdStyle}>
                    {l.prix_ventile ? (
                      <>
                        <div>{Number(l.prix_ventile).toLocaleString()} F</div>
                        <div style={{ color: '#3498db', fontSize: '0.8rem' }}>{Number(l.prix_ventile_assurance || l.prix_ventile).toLocaleString()} F</div>
                      </>
                    ) : <span style={{ color: '#ccc' }}>-</span>}
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

// Fix: Avoid mixing 'border' shorthand and 'borderBottom' in React styles.
const tabBase: CSSProperties = { padding: '10px 20px', cursor: 'pointer', marginRight: '5px', background: 'none' };
const tabNormal: CSSProperties = { ...tabBase, border: 'none', borderBottom: '2px solid transparent', color: '#7f8c8d', fontWeight: '500' };
const tabActive: CSSProperties = { ...tabBase, border: 'none', borderBottom: '2px solid #3498db', color: '#3498db', fontWeight: 'bold', background: '#f8f9fa' };

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tdStyle: CSSProperties = { padding: '12px', textAlign: 'left' };
const btnPlus: CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnSave: CSSProperties = { background: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancel: CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };
const btnDelete: CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' };
const btnText: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#3498db', fontWeight: 'bold' };
