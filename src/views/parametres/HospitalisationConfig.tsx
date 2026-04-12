
import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../../lib/db";

export default function HospitalisationConfig() {
    const [activeTab, setActiveTab] = useState<"chambres" | "types" | "tarifs" | "actes">("chambres");

    return (
        <div>
            <h2 style={{ color: '#2c3e50', marginTop: 0 }}>💲 Tarifs & Hospitalisation</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab("chambres")} style={activeTab === "chambres" ? tabActive : tabNormal}>Chambres & Lits</button>
                <button onClick={() => setActiveTab("types")} style={activeTab === "types" ? tabActive : tabNormal}>Types de Chambres</button>
                <button onClick={() => setActiveTab("tarifs")} style={activeTab === "tarifs" ? tabActive : tabNormal}>Tarifs Hospitalisation</button>
                <button onClick={() => setActiveTab("actes")} style={activeTab === "actes" ? tabActive : tabNormal}>Tarifs Soins & Actes</button>
            </div>

            {activeTab === "chambres" && <ConfigChambresLits />}
            {activeTab === "types" && <TypesChambresConfig />}
            {activeTab === "tarifs" && <TarifsAssuranceConfig />}
            {activeTab === "actes" && <TarifsActesConfig />}
        </div>
    );
}

// --- CHAMBRES & LITS ---
function ConfigChambresLits() {
    const [chambreTypes, setChambreTypes] = useState<any[]>([]);
    const [chambres, setChambres] = useState<any[]>([]);
    const [lits, setLits] = useState<any[]>([]);

    const [newChambre, setNewChambre] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [newLit, setNewLit] = useState("");
    const [selectedChambre, setSelectedChambre] = useState("");

    const loadData = async () => {
      const db = await getDb();
      try {
        setChambreTypes(await db.select("SELECT * FROM chambre_types ORDER BY libelle"));
        const resC = await db.select<any[]>(`SELECT c.*, t.libelle as type_libelle FROM chambres c LEFT JOIN chambre_types t ON c.type_id = t.id ORDER BY c.nom`);
        setChambres(resC);
        const resL = await db.select<any[]>(`SELECT l.*, c.nom as nom_chambre, t.libelle as type_libelle FROM lits l LEFT JOIN chambres c ON l.chambre_id = c.id LEFT JOIN chambre_types t ON c.type_id = t.id ORDER BY c.nom, l.nom_lit`);
        setLits(resL);
      } catch (e) { console.error(e); }
    };

    useEffect(() => { loadData(); }, []);

    const addChambre = async () => {
      if (!newChambre || !selectedTypeId) return alert("Nom et Type requis");
      try {
        const db = await getDb();
        await db.execute("INSERT INTO chambres (nom, type_id) VALUES (?, ?)", [newChambre, selectedTypeId]);
        setNewChambre(""); loadData();
      } catch (e) { alert("Erreur: " + e); }
    };

    const addLit = async () => {
      if (!newLit || !selectedChambre) return alert("Nom Lit et Chambre requis");
      try {
        const db = await getDb();
        await db.execute("INSERT INTO lits (nom_lit, chambre_id, statut) VALUES (?, ?, 'disponible')", [newLit, selectedChambre]);
        setNewLit(""); loadData();
      } catch (e) { alert("Erreur: " + e); }
    };

    const deleteChambre = async (id: number) => {
      if (!confirm("Supprimer chambre et ses lits ?")) return;
      try { 
        const db = await getDb(); 
        await db.execute("DELETE FROM lits WHERE chambre_id = ?", [id]);
        await db.execute("DELETE FROM chambres WHERE id = ?", [id]); 
        loadData(); 
      } catch (e) { alert(e); }
    };
    const deleteLit = async (id: number) => {
      if (!confirm("Supprimer lit ?")) return;
      try { const db = await getDb(); await db.execute("DELETE FROM lits WHERE id = ?", [id]); loadData(); } catch (e) { alert(e); }
    };

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px' }}>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
          <h4 style={{ marginTop: 0 }}>🏠 Chambres</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexDirection: 'column' }}>
            <input placeholder="Nom Chambre..." value={newChambre} onChange={e => setNewChambre(e.target.value)} style={inputStyle} />
            <select value={selectedTypeId} onChange={e => setSelectedTypeId(e.target.value)} style={inputStyle}>
              <option value="">-- Type --</option>
              {chambreTypes.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
            </select>
            <button onClick={addChambre} style={btnPlus}>Ajouter</button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {chambres.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedChambre(c.id.toString())}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px', 
                  background: selectedChambre === c.id.toString() ? '#e8f6fc' : 'white', 
                  borderLeft: selectedChambre === c.id.toString() ? '4px solid #3498db' : '4px solid transparent',
                  marginBottom: '5px', 
                  borderRadius: '5px',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}>
                <span>{c.nom} <small style={{ color: '#7f8c8d' }}>({c.type_libelle})</small></span>
                <button 
                   onClick={(e) => { e.stopPropagation(); deleteChambre(c.id); }} 
                   style={{ ...btnDelete, padding: '2px 5px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ marginTop: 0 }}>🛏️ Lits Physiques</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <select value={selectedChambre} onChange={e => setSelectedChambre(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
              <option value="">Chambre...</option>
              {chambres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <input placeholder="Nom Lit" value={newLit} onChange={e => setNewLit(e.target.value)} style={inputStyle} />
            <button onClick={addLit} style={btnPlus}>Ajouter Lit</button>
          </div>
          <table style={tableStyle}>
            <thead><tr style={{ background: '#eee' }}><th style={tdStyle}>Lit</th><th style={tdStyle}>Chambre</th><th style={tdStyle}>Type</th><th style={tdStyle}>Action</th></tr></thead>
            <tbody>{lits.map(l => <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}><td style={tdStyle}>{l.nom_lit}</td><td style={tdStyle}>{l.nom_chambre}</td><td style={tdStyle}>{l.type_libelle}</td><td style={tdStyle}><button onClick={() => deleteLit(l.id)} style={btnDelete}>🗑️</button></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    )
}

// --- TYPES DE CHAMBRES ---
function TypesChambresConfig() {
    const [types, setTypes] = useState<any[]>([]);
    const [form, setForm] = useState({ id: null, libelle: "", prix_journalier_standard: 0, prix_ami_standard: 0, prix_kit_standard: 1000 });

    const loadTypes = async () => {
        const db = await getDb();
        try {
            // S'assurer que la colonne prix_kit_standard existe dans la table
            await db.execute("ALTER TABLE chambre_types ADD COLUMN prix_kit_standard INTEGER DEFAULT 1000");
        } catch (e) { /* Ignore si elle existe déjà */ }

        const res = await db.select<any[]>("SELECT * FROM chambre_types ORDER BY prix_journalier_standard");
        setTypes(res);
    };

    useEffect(() => { loadTypes(); }, []);

    const saveType = async () => {
        if (!form.libelle) return alert("Libellé requis");
        const db = await getDb();
        if (form.id) {
            await db.execute("UPDATE chambre_types SET libelle=?, prix_journalier_standard=?, prix_ami_standard=?, prix_kit_standard=? WHERE id=?",
                [form.libelle, form.prix_journalier_standard, form.prix_ami_standard, form.prix_kit_standard, form.id]);
        } else {
            await db.execute("INSERT INTO chambre_types (libelle, prix_journalier_standard, prix_ami_standard, prix_kit_standard) VALUES (?, ?, ?, ?)",
                [form.libelle, form.prix_journalier_standard, form.prix_ami_standard, form.prix_kit_standard]);
        }
        setForm({ id: null, libelle: "", prix_journalier_standard: 0, prix_ami_standard: 0, prix_kit_standard: 1000 });
        loadTypes();
    };

    const deleteType = async (id: number) => {
        if (!confirm("Supprimer ce type ? Vérifiez qu'il n'est pas utilisé.")) return;
        const db = await getDb();
        await db.execute("DELETE FROM chambre_types WHERE id=?", [id]);
        loadTypes();
    };

    return (
        <div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1.5, minWidth: '150px' }}>
                    <label style={labelS}>Libellé Type</label>
                    <input value={form.libelle} onChange={e => setForm({ ...form, libelle: e.target.value })} placeholder="Ex: Climatisée Standard" style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelS}>Prix Chambre Std</label>
                    <input type="number" value={form.prix_journalier_standard} onChange={e => setForm({ ...form, prix_journalier_standard: parseInt(e.target.value) || 0 })} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelS}>Prix AMI Std</label>
                    <input type="number" value={form.prix_ami_standard} onChange={e => setForm({ ...form, prix_ami_standard: parseInt(e.target.value) || 0 })} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelS}>Prix Kit Consommable</label>
                    <input type="number" value={form.prix_kit_standard} onChange={e => setForm({ ...form, prix_kit_standard: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, borderColor: '#3498db' }} />
                </div>
                <button onClick={saveType} style={{...btnSave, height: '35px'}}>{form.id ? 'Modifier' : 'Ajouter'}</button>
                {form.id && <button onClick={() => setForm({ id: null, libelle: "", prix_journalier_standard: 0, prix_ami_standard: 0, prix_kit_standard: 1000 })} style={{...btnCancel, height: '35px'}}>Annuler</button>}
            </div>

            <table style={tableStyle}>
                <thead>
                    <tr style={{ background: '#ecf0f1' }}>
                        <th style={tdStyle}>Libellé</th>
                        <th style={tdStyle}>Prix Chambre (Cash)</th>
                        <th style={tdStyle}>Prix AMI (Cash)</th>
                        <th style={tdStyle}>Prix Kit Cons.</th>
                        <th style={tdStyle}>Total Journalier (Cash)</th>
                        <th style={tdStyle}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {types.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}><strong>{t.libelle}</strong></td>
                            <td style={tdStyle}>{t.prix_journalier_standard.toLocaleString()} F</td>
                            <td style={tdStyle}>{t.prix_ami_standard.toLocaleString()} F</td>
                            <td style={{ ...tdStyle, color: '#3498db', fontWeight: 'bold' }}>{(t.prix_kit_standard || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, color: '#27ae60', fontWeight: 'bold' }}>{(t.prix_journalier_standard + t.prix_ami_standard + (t.prix_kit_standard||0)).toLocaleString()} F</td>
                            <td style={tdStyle}>
                                <button onClick={() => setForm({ ...t, prix_kit_standard: t.prix_kit_standard || 0 })} style={btnEdit}>✏️</button>
                                <button onClick={() => deleteType(t.id)} style={btnDelete}>🗑️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- TARIFS ASSURANCES ---
function TarifsAssuranceConfig() {
    const [assurances, setAssurances] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [selectedAssurance, setSelectedAssurance] = useState<string>("");
    
    // Valeurs enregistrées en base
    const [tarifs, setTarifs] = useState<any[]>([]); 
    // Valeurs en cours de modification (locale)
    const [edits, setEdits] = useState<any>({}); 

    const loadData = async () => {
        const db = await getDb();
        setAssurances(await db.select("SELECT * FROM assurances WHERE statut='actif' ORDER BY nom"));
        setTypes(await db.select("SELECT * FROM chambre_types ORDER BY libelle"));
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (selectedAssurance) {
            loadTarifs();
            setEdits({}); // Reset edits when changing assurance
        }
    }, [selectedAssurance]);

    const loadTarifs = async () => {
        const db = await getDb();
        const res = await db.select<any[]>("SELECT * FROM tarifs_hospitalisation WHERE assurance_id=?", [selectedAssurance]);
        setTarifs(res);
    };

    // Obtenir la valeur DB si pas d'édition
    const getTarifValue = (typeId: number, field: 'prix_chambre' | 'prix_ami') => {
        const t = tarifs.find(r => r.chambre_type_id === typeId);
        return t ? t[field] : 0;
    };

    // Valeur affichée dans le input
    const getDisplayValue = (typeId: number, field: 'prix_chambre' | 'prix_ami') => {
        const key = `${typeId}_${field}`;
        if (edits[key] !== undefined) return edits[key]; // Si modif en cours
        const val = getTarifValue(typeId, field); // Sinon valeur base
        return val === 0 ? "" : val;
    };

    const handleEdit = (typeId: number, field: 'prix_chambre' | 'prix_ami', valStr: string) => {
        setEdits({ ...edits, [`${typeId}_${field}`]: valStr });
    };

    const saveAll = async () => {
        const db = await getDb();
        let hasChanges = false;

        for (const type of types) {
            const keyChambre = `${type.id}_prix_chambre`;
            const keyAmi = `${type.id}_prix_ami`;
            
            // Si aucune modif sur ce type, on passe
            if (edits[keyChambre] === undefined && edits[keyAmi] === undefined) continue;

            hasChanges = true;
            
            // Résolution des prix finaux à sauvegarder
            const rawChambre = edits[keyChambre] !== undefined ? edits[keyChambre] : getTarifValue(type.id, 'prix_chambre');
            const rawAmi = edits[keyAmi] !== undefined ? edits[keyAmi] : getTarifValue(type.id, 'prix_ami');
            
            const pChambre = parseInt(rawChambre) || 0;
            const pAmi = parseInt(rawAmi) || 0;

            const existing = tarifs.find(t => t.chambre_type_id === type.id);

            if (existing) {
                await db.execute(
                    `UPDATE tarifs_hospitalisation SET prix_chambre=?, prix_ami=? WHERE id=?`, 
                    [pChambre, pAmi, existing.id]
                );
            } else {
                await db.execute(
                    `INSERT INTO tarifs_hospitalisation (assurance_id, chambre_type_id, prix_chambre, prix_ami) VALUES (?, ?, ?, ?)`,
                    [selectedAssurance, type.id, pChambre, pAmi]
                );
            }
        }

        if (hasChanges) {
            await loadTarifs();
            setEdits({});
            alert("Tarifs enregistrés avec succès !");
        } else {
            alert("Aucune modification à enregistrer.");
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <label style={labelS}>Sélectionner Assurance :</label>
                    <select value={selectedAssurance} onChange={e => setSelectedAssurance(e.target.value)} style={{ ...inputStyle, width: '400px' }}>
                        <option value="">-- Choisir Assurance --</option>
                        {assurances.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                    </select>
                </div>
                {selectedAssurance && Object.keys(edits).length > 0 && (
                    <button onClick={saveAll} style={{ ...btnSave, padding: '10px 20px', fontSize: '1rem', background: '#e67e22' }}>💾 Enregistrer les Modifications</button>
                )}
            </div>

            {selectedAssurance && (
                <div>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ background: '#ecf0f1' }}>
                                <th style={tdStyle}>Type de Chambre</th>
                                <th style={tdStyle}>Prix Standard (Ref)</th>
                                <th style={{ ...tdStyle, background: '#e8f6f3' }}>Prix Négocié Chambre</th>
                                <th style={{ ...tdStyle, background: '#e8f6f3' }}>Prix Négocié AMI</th>
                                <th style={{ ...tdStyle, background: '#e8f6f3' }}>Total Assurance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types.map(type => {
                                const prixChambre = parseInt(getDisplayValue(type.id, 'prix_chambre') as string) || getTarifValue(type.id, 'prix_chambre') || type.prix_journalier_standard;
                                const prixAMI = parseInt(getDisplayValue(type.id, 'prix_ami') as string) || getTarifValue(type.id, 'prix_ami') || type.prix_ami_standard;

                                // Highlight if different from standard
                                const isChambreDiff = prixChambre !== type.prix_journalier_standard;
                                const isAMIDiff = prixAMI !== type.prix_ami_standard;

                                return (
                                    <tr key={type.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={tdStyle}>{type.libelle}</td>
                                        <td style={{ ...tdStyle, opacity: 0.6 }}>
                                            {type.prix_journalier_standard} + {type.prix_ami_standard} = <strong>{(type.prix_journalier_standard + type.prix_ami_standard)}</strong>
                                        </td>
                                        <td style={{ ...tdStyle, background: '#e8f6f3' }}>
                                            <input
                                                type="number"
                                                value={getDisplayValue(type.id, 'prix_chambre')}
                                                placeholder={type.prix_journalier_standard}
                                                onChange={e => handleEdit(type.id, 'prix_chambre', e.target.value)}
                                                style={{ ...inputStyle, borderColor: isChambreDiff ? '#27ae60' : '#ddd', fontWeight: isChambreDiff ? 'bold' : 'normal' }}
                                            />
                                        </td>
                                        <td style={{ ...tdStyle, background: '#e8f6f3' }}>
                                            <input
                                                type="number"
                                                value={getDisplayValue(type.id, 'prix_ami')}
                                                placeholder={type.prix_ami_standard}
                                                onChange={e => handleEdit(type.id, 'prix_ami', e.target.value)}
                                                style={{ ...inputStyle, borderColor: isAMIDiff ? '#27ae60' : '#ddd', fontWeight: isAMIDiff ? 'bold' : 'normal' }}
                                            />
                                        </td>
                                        <td style={{ ...tdStyle, background: '#e8f6f3', fontWeight: 'bold', color: '#2c3e50' }}>
                                            {(prixChambre + prixAMI).toLocaleString()} F
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    {/* Bouton de sauvegarde également en bas pour plus de visibilité */}
                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <button onClick={saveAll} style={{ ...btnSave, padding: '12px 30px', fontSize: '1.1rem' }}>
                            ✅ Valider et Sauvegarder
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- STYLES UTILS ---
const inputStyle: CSSProperties = { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' };
const labelS: CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tabBase: CSSProperties = { padding: '10px 20px', cursor: 'pointer', marginRight: '5px', background: 'none', border: 'none', fontSize: '1rem' };
const tabNormal: CSSProperties = { ...tabBase, borderBottom: '2px solid transparent', color: '#7f8c8d' };
const tabActive: CSSProperties = { ...tabBase, borderBottom: '2px solid #3498db', color: '#3498db', fontWeight: 'bold' };
const btnSave: CSSProperties = { background: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancel: CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };
const btnDelete: CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' };
const btnPlus: CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tdStyle: CSSProperties = { padding: '10px', textAlign: 'left' };

// --- TARIFS SOINS ET ACTES ---
function TarifsActesConfig() {
    const [assurances, setAssurances] = useState<any[]>([]);
    const [actes, setActes] = useState<any[]>([]);
    const [selectedAssurance, setSelectedAssurance] = useState<string>("");
    
    // Valeurs enregistrées en base
    const [tarifs, setTarifs] = useState<any[]>([]); 
    // Valeurs en cours de modification (locale)
    const [edits, setEdits] = useState<any>({}); 

    const loadData = async () => {
        const db = await getDb();
        // Créer la table si elle n'existe pas
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS tarifs_prestations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assurance_id INTEGER,
                    prestation_id INTEGER,
                    prix INTEGER,
                    UNIQUE(assurance_id, prestation_id)
                )
            `);
        } catch(e) {}

        setAssurances(await db.select("SELECT * FROM assurances WHERE statut='actif' ORDER BY nom"));
        setActes(await db.select("SELECT * FROM prestations WHERE categorie='SOINS' ORDER BY libelle"));
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (selectedAssurance) {
            loadTarifs();
            setEdits({});
        }
    }, [selectedAssurance]);

    const loadTarifs = async () => {
        const db = await getDb();
        const res = await db.select<any[]>("SELECT * FROM tarifs_prestations WHERE assurance_id=?", [selectedAssurance]);
        setTarifs(res);
    };

    const getTarifValue = (acteId: number) => {
        const t = tarifs.find(r => r.prestation_id === acteId);
        return t ? t.prix : 0;
    };

    const getDisplayValue = (acteId: number) => {
        if (edits[acteId] !== undefined) return edits[acteId];
        const val = getTarifValue(acteId);
        return val === 0 ? "" : val;
    };

    const handleEdit = (acteId: number, valStr: string) => {
        setEdits({ ...edits, [acteId]: valStr });
    };

    const saveAll = async () => {
        const db = await getDb();
        let hasChanges = false;

        for (const acte of actes) {
            if (edits[acte.id] === undefined) continue;

            hasChanges = true;
            const pActe = parseInt(edits[acte.id]) || 0;
            const existing = tarifs.find(t => t.prestation_id === acte.id);

            if (existing) {
                await db.execute(
                    `UPDATE tarifs_prestations SET prix=? WHERE id=?`, 
                    [pActe, existing.id]
                );
            } else if (pActe > 0) {
                await db.execute(
                    `INSERT INTO tarifs_prestations (assurance_id, prestation_id, prix) VALUES (?, ?, ?)`,
                    [selectedAssurance, acte.id, pActe]
                );
            }
        }

        if (hasChanges) {
            await loadTarifs();
            setEdits({});
            alert("Tarifs des actes enregistrés avec succès !");
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <label style={labelS}>Sélectionner Assurance :</label>
                    <select value={selectedAssurance} onChange={e => setSelectedAssurance(e.target.value)} style={{ ...inputStyle, width: '400px' }}>
                        <option value="">-- Choisir Assurance --</option>
                        {assurances.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                    </select>
                </div>
                {selectedAssurance && Object.keys(edits).length > 0 && (
                    <button onClick={saveAll} style={{ ...btnSave, padding: '10px 20px', fontSize: '1rem', background: '#e67e22' }}>💾 Enregistrer les Modifications</button>
                )}
            </div>

            {selectedAssurance && (
                <div>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ background: '#ecf0f1' }}>
                                <th style={tdStyle}>Désignation du Soin / Acte</th>
                                <th style={tdStyle}>Prix Standard (Cash)</th>
                                <th style={{ ...tdStyle, background: '#e8f6f3' }}>Prix Négocié Assurance (FCFA)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actes.map(acte => {
                                const prixActuel = parseInt(getDisplayValue(acte.id) as string) || getTarifValue(acte.id) || acte.prix_standard;
                                const isDiff = prixActuel !== acte.prix_standard;

                                return (
                                    <tr key={acte.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={tdStyle}><strong>{acte.libelle}</strong></td>
                                        <td style={{ ...tdStyle, opacity: 0.6 }}>{acte.prix_standard.toLocaleString()} FCFA</td>
                                        <td style={{ ...tdStyle, background: '#e8f6f3' }}>
                                            <input
                                                type="number"
                                                value={getDisplayValue(acte.id)}
                                                placeholder={acte.prix_standard}
                                                onChange={e => handleEdit(acte.id, e.target.value)}
                                                style={{ ...inputStyle, borderColor: isDiff ? '#27ae60' : '#ddd', fontWeight: isDiff ? 'bold' : 'normal', width: '250px' }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                        <button onClick={saveAll} style={{ ...btnSave, padding: '12px 30px', fontSize: '1.1rem' }}>
                            ✅ Valider et Sauvegarder
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
