import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

export default function LaboratoireView() {
  const [examens, setExamens] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState<number | string>("");
  const [search, setSearch] = useState("");

  // États pour la modification
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editPrix, setEditPrix] = useState<number | string>("");

  const chargerExamens = async () => {
    const db = await getDb();
    // On filtre uniquement les prestations de catégorie 'LABO'
    const res = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'LABO' ORDER BY libelle ASC");
    setExamens(res);
  };

  useEffect(() => { chargerExamens(); }, []);

  const ajouterExamen = async () => {
    if (!nom || !prix) return alert("Veuillez remplir le nom et le prix");
    const db = await getDb();
    await db.execute(
      "INSERT INTO prestations (libelle, prix_standard, categorie) VALUES (?, ?, 'LABO')",
      [nom, prix]
    );
    setNom(""); setPrix("");
    chargerExamens();
    alert("Examen ajouté au catalogue");
  };

  const supprimerExamen = async (id: number) => {
    if (window.confirm("Voulez-vous vraiment supprimer cet examen du catalogue ?")) {
      const db = await getDb();
      await db.execute("DELETE FROM prestations WHERE id = ?", [id]);
      chargerExamens();
    }
  };

  const demarrerModif = (ex: any) => {
    setEditingId(ex.id);
    setEditNom(ex.libelle);
    setEditPrix(ex.prix_standard);
  };

  const sauvegarderModif = async () => {
    const db = await getDb();
    await db.execute(
      "UPDATE prestations SET libelle = ?, prix_standard = ? WHERE id = ?",
      [editNom, editPrix, editingId]
    );
    setEditingId(null);
    chargerExamens();
  };

  const filtered = examens.filter(ex =>
    ex.libelle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🔬 Catalogue Laboratoire</h1>
        <div style={{ background: '#34495e', color: 'white', padding: '10px 20px', borderRadius: '10px' }}>
          Total Examens : <strong>{examens.length}</strong>
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT */}
      <div style={cardStyle}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>➕ Ajouter un nouvel examen</h3>
        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={labelS}>Désignation de l'examen</label>
            <input
              placeholder="Ex: NFS, Glycémie, Test Palu..."
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
          <button onClick={ajouterExamen} style={btnPlus}>Enregistrer l'examen</button>
        </div>
      </div>

      {/* LISTE ET RECHERCHE */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h3>Liste des analyses proposées</h3>
          <input
            placeholder="🔍 Rechercher un examen..."
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
            {filtered.map(ex => (
              <tr key={ex.id} style={{ borderBottom: '1px solid #eee' }}>
                {editingId === ex.id ? (
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
                    <td style={tdStyle}><strong>{ex.libelle}</strong></td>
                    <td style={tdStyle}>{ex.prix_standard.toLocaleString()} FCFA</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => demarrerModif(ex)} style={btnEdit}>Modifier</button>
                      <button onClick={() => supprimerExamen(ex.id)} style={btnDelete}>Supprimer</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                  Aucun examen trouvé dans le catalogue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES ---
const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '15px', textAlign: 'left' };

const btnPlus: React.CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: React.CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' };
const btnDelete: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' };

const btnSaveSmall: React.CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnCancelSmall: React.CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };