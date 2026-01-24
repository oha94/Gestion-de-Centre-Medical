import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../lib/db";

export default function ConsultationView() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState<number | string>("");
  const [search, setSearch] = useState("");

  // États pour la modification
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editPrix, setEditPrix] = useState<number | string>("");

  const chargerConsultations = async () => {
    const db = await getDb();
    // On filtre uniquement les prestations de catégorie 'CONSULTATION'
    try {
      const res = await db.select<any[]>("SELECT id, libelle, CAST(prix_standard AS CHAR) as prix_standard FROM prestations WHERE categorie = 'CONSULTATION' ORDER BY libelle ASC");
      setConsultations(res.map(r => ({ ...r, prix_standard: Number(r.prix_standard) })));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { chargerConsultations(); }, []);

  const ajouterConsultation = async () => {
    if (!nom || !prix) return alert("Veuillez remplir le nom et le prix");
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO prestations (libelle, prix_standard, categorie) VALUES (?, ?, 'CONSULTATION')",
        [nom, prix]
      );
      setNom(""); setPrix("");
      chargerConsultations();
      alert("Type de consultation ajouté !");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement : " + JSON.stringify(e));
    }
  };

  const supprimerConsultation = async (id: number) => {
    if (window.confirm("Voulez-vous supprimer ce type de consultation ?")) {
      const db = await getDb();
      await db.execute("DELETE FROM prestations WHERE id = ?", [id]);
      chargerConsultations();
    }
  };

  const demarrerModif = (item: any) => {
    setEditingId(item.id);
    setEditNom(item.libelle);
    setEditPrix(item.prix_standard);
  };

  const sauvegarderModif = async () => {
    const db = await getDb();
    await db.execute(
      "UPDATE prestations SET libelle = ?, prix_standard = ? WHERE id = ?",
      [editNom, editPrix, editingId]
    );
    setEditingId(null);
    chargerConsultations();
  };

  const filtered = consultations.filter(item =>
    item.libelle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🩺 Catalogue Consultations</h1>
        <div style={{ background: '#3498db', color: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          Total Types : <strong>{consultations.length}</strong>
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT */}
      <div style={cardStyle}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: '#3498db' }}>➕ Nouveau type de consultation</h3>
        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={labelS}>Désignation</label>
            <input
              placeholder="Ex: Consultation Générale, Pédiatrie, Gynécologie..."
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
          <button onClick={ajouterConsultation} style={btnPlus}>Enregistrer</button>
        </div>
      </div>

      {/* LISTE ET RECHERCHE */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h3>Liste des prestations de consultation</h3>
          <input
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid #3498db' }}
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
            {filtered.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                {editingId === item.id ? (
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
                    <td style={tdStyle}><strong>{item.libelle}</strong></td>
                    <td style={tdStyle}>{item.prix_standard.toLocaleString()} FCFA</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => demarrerModif(item)} style={btnEdit}>Modifier</button>
                      <button onClick={() => supprimerConsultation(item.id)} style={btnDelete}>Supprimer</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES ---
const cardStyle: CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: CSSProperties = { padding: '15px', textAlign: 'left' };

const btnPlus: CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' };
const btnDelete: CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' };
const btnSaveSmall: CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnCancelSmall: CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };