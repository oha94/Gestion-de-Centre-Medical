import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../lib/db";

export default function AssurancesView() {
  const [assurances, setAssurances] = useState<any[]>([]);
  const [selectedAssurId, setSelectedAssurId] = useState<number | null>(null);
  const [societes, setSocietes] = useState<any[]>([]);

  const [searchAssurTerm, setSearchAssurTerm] = useState("");
  const [searchSocTerm, setSearchSocTerm] = useState("");

  const [nomAssur, setNomAssur] = useState("");
  const [editAssurId, setEditAssurId] = useState<number | null>(null);
  const [editAssurNom, setEditAssurNom] = useState("");

  const [nomSoc, setNomSoc] = useState("");
  const [taux, setTaux] = useState(80);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editTaux, setEditTaux] = useState(0);

  const chargerAssurances = async () => {
    const db = await getDb();
    setAssurances(await db.select<any[]>("SELECT * FROM assurances ORDER BY nom ASC"));
  };

  const chargerSocietes = async (id: number) => {
    const db = await getDb();
    const res = await db.select<any[]>(`
      SELECT s.*, COUNT(p.id) as nb_clients 
      FROM societes s 
      LEFT JOIN patients p ON s.id = p.societe_id 
      WHERE s.assurance_id = ? 
      GROUP BY s.id 
      ORDER BY s.nom_societe ASC
    `, [id]);
    setSocietes(res);
    setSelectedAssurId(id);
  };

  useEffect(() => { chargerAssurances(); }, []);

  const addAssurance = async () => {
    if (!nomAssur) return;
    const db = await getDb();
    await db.execute("INSERT INTO assurances (nom) VALUES (?)", [nomAssur]);
    setNomAssur(""); chargerAssurances();
  };

  const saveEditAssur = async (id: number) => {
    const db = await getDb();
    await db.execute("UPDATE assurances SET nom = ? WHERE id = ?", [editAssurNom, id]);
    setEditAssurId(null); chargerAssurances();
  };

  const toggleAssurStatut = async (id: number, actuel: string) => {
    const nouveau = actuel === 'actif' ? 'suspendu' : 'actif';
    const db = await getDb();
    await db.execute("UPDATE assurances SET statut = ? WHERE id = ?", [nouveau, id]);
    chargerAssurances();
  };

  const addSociete = async () => {
    if (!selectedAssurId || !nomSoc) return;
    const db = await getDb();
    await db.execute("INSERT INTO societes (assurance_id, nom_societe, taux_prise_en_charge) VALUES (?,?,?)", [selectedAssurId, nomSoc, taux]);
    setNomSoc(""); chargerSocietes(selectedAssurId);
  };

  const toggleStatutSoc = async (id: number, actuel: string) => {
    const db = await getDb();
    await db.execute("UPDATE societes SET statut = ? WHERE id = ?", [actuel === 'actif' ? 'inactif' : 'actif', id]);
    if (selectedAssurId) chargerSocietes(selectedAssurId);
  };

  const saveEditSoc = async (id: number) => {
    const db = await getDb();
    await db.execute("UPDATE societes SET nom_societe = ?, taux_prise_en_charge = ? WHERE id = ?", [editNom, editTaux, id]);
    setEditId(null);
    if (selectedAssurId) chargerSocietes(selectedAssurId);
  };

  const assurancesFiltrees = assurances.filter(a => a.nom.toLowerCase().includes(searchAssurTerm.toLowerCase()));
  const societesFiltrees = societes.filter(s => s.nom_societe.toLowerCase().includes(searchSocTerm.toLowerCase()));

  return (
    <div style={{ padding: '10px', display: 'flex', gap: '20px', height: '100%' }}>

      {/* --- COLONNE GAUCHE : ASSURANCES --- */}
      <div style={{ width: '350px' }}>
        <div style={cardStyle}>
          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>🛡️ Assureurs</h3>

          <div style={{ margin: '15px 0' }}>
            <label style={labelS}>Rechercher</label>
            <input value={searchAssurTerm} onChange={e => setSearchAssurTerm(e.target.value)} placeholder="🔍 Filtrer..." style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
            <input value={nomAssur} onChange={e => setNomAssur(e.target.value)} placeholder="Nouvel assureur..." style={inputStyle} />
            <button onClick={addAssurance} style={btnPlus}>+</button>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
            {assurancesFiltrees.map(a => (
              <div key={a.id} style={{
                ...itemStyle,
                backgroundColor: selectedAssurId === a.id ? '#3498db' : '#f8f9fa',
                color: selectedAssurId === a.id ? 'white' : '#333',
                opacity: a.statut === 'suspendu' ? 0.6 : 1
              }}>
                {editAssurId === a.id ? (
                  <input
                    value={editAssurNom}
                    onChange={e => setEditAssurNom(e.target.value)}
                    onBlur={() => saveEditAssur(a.id)}
                    autoFocus
                    style={{ border: 'none', padding: '5px', borderRadius: '4px', width: '80%' }}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span onClick={() => chargerSocietes(a.id)} style={{ flex: 1, cursor: 'pointer', fontWeight: 'bold' }}>{a.nom}</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => { setEditAssurId(a.id); setEditAssurNom(a.nom); }} style={btnIcon}>✎</button>
                      <button onClick={() => toggleAssurStatut(a.id, a.statut)} style={{ ...btnIcon, color: a.statut === 'actif' ? '#e67e22' : '#2ecc71' }}>
                        {a.statut === 'actif' ? 'OFF' : 'ON'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- COLONNE DROITE : SOCIÉTÉS --- */}
      <div style={{ flex: 1 }}>
        {selectedAssurId ? (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>🏢 Sociétés : {assurances.find(a => a.id === selectedAssurId)?.nom}</h2>
              <input value={searchSocTerm} onChange={e => setSearchSocTerm(e.target.value)} placeholder="🔍 Filtrer les sociétés..." style={{ ...inputStyle, width: '250px' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: '#f0f7ff', padding: '15px', borderRadius: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={labelS}>Nom de la société / Branche</label>
                <input value={nomSoc} onChange={e => setNomSoc(e.target.value)} placeholder="Ex: Police Secours" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelS}>Taux Standard (%)</label>
                <input type="number" value={taux} onChange={e => setTaux(parseInt(e.target.value))} style={inputStyle} />
              </div>
              <button onClick={addSociete} style={{ ...btnOk, marginTop: '20px' }}>Ajouter la société</button>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={tdStyle}>Société / Branche</th>
                  <th style={tdStyle}>Taux Std</th>
                  <th style={tdStyle}>Clients</th>
                  <th style={tdStyle}>Statut</th>
                  <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {societesFiltrees.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee', opacity: s.statut === 'inactif' ? 0.5 : 1 }}>
                    <td style={tdStyle}>{editId === s.id ? <input value={editNom} onChange={e => setEditNom(e.target.value)} style={inputStyle} /> : <strong>{s.nom_societe}</strong>}</td>
                    <td style={tdStyle}>{editId === s.id ? <input type="number" value={editTaux} onChange={e => setEditTaux(parseInt(e.target.value))} style={inputStyle} /> : <span style={{ color: '#3498db', fontWeight: 'bold' }}>{s.taux_prise_en_charge}%</span>}</td>
                    <td style={tdStyle}>{s.nb_clients}</td>
                    <td style={tdStyle}>
                      <span style={{ color: s.statut === 'actif' ? '#27ae60' : '#e74c3c', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {s.statut === 'actif' ? '🟢 SOLVABLE' : '🔴 BLOQUÉ'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {editId === s.id ? (
                        <button onClick={() => saveEditSoc(s.id)} style={btnSaveSmall}>OK</button>
                      ) : (
                        <button onClick={() => { setEditId(s.id); setEditNom(s.nom_societe); setEditTaux(s.taux_prise_en_charge); }} style={btnEditSmall}>Modif.</button>
                      )}
                      <button onClick={() => toggleStatutSoc(s.id, s.statut)} style={{ ...btnDeleteSmall, backgroundColor: s.statut === 'actif' ? '#e67e22' : '#2ecc71' }}>
                        {s.statut === 'actif' ? 'Bloquer' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '150px', color: '#bdc3c7' }}>
            <h2 style={{ fontSize: '2rem' }}>👈 Sélectionnez un assureur</h2>
            <p>pour gérer les sociétés et les taux de prise en charge.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLES CSS PROFESSIONNELS ---
const cardStyle: CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', height: 'fit-content' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' };
const labelS: CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px', textTransform: 'uppercase' };
const itemStyle: CSSProperties = { padding: '12px', borderRadius: '8px', marginBottom: '8px', transition: '0.2s', display: 'flex', alignItems: 'center' };
const btnPlus = { background: '#3498db', color: 'white', border: 'none', padding: '0 15px', borderRadius: '8px', cursor: 'pointer', height: '38px', fontWeight: 'bold' as const };
const btnOk = { background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' as const, height: '40px' };
const btnIcon = { background: 'none', border: 'none', cursor: 'pointer', padding: '5px', fontSize: '1rem' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: CSSProperties = { padding: '15px', textAlign: 'left', fontSize: '14px' };

const btnEditSmall = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginRight: '5px' };
const btnDeleteSmall = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
const btnSaveSmall = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginRight: '5px' };