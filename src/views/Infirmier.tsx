import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

export default function InfirmierView() {
  const [actes, setActes] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState<number | string>("");
  const [search, setSearch] = useState("");

  // États pour la modification
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editPrix, setEditPrix] = useState<number | string>("");

  const chargerActes = async () => {
    const db = await getDb();
    // On filtre uniquement les prestations de catégorie 'SOINS'
    const res = await db.select<any[]>("SELECT * FROM prestations WHERE categorie = 'SOINS' ORDER BY libelle ASC");
    setActes(res);
  };

  useEffect(() => { chargerActes(); }, []);

  const ajouterActe = async () => {
    if (!nom || !prix) return alert("Veuillez remplir le nom et le prix");
    const db = await getDb();
    await db.execute(
      "INSERT INTO prestations (libelle, prix_standard, categorie) VALUES (?, ?, 'SOINS')",
      [nom, prix]
    );
    setNom(""); setPrix("");
    chargerActes();
    alert("Acte infirmier ajouté avec succès");
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

  const filtered = actes.filter(act =>
    act.libelle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>💉 Actes Infirmier</h1>
        <div style={{ background: '#27ae60', color: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          Nombre d'actes : <strong>{actes.length}</strong>
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT */}
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

      {/* LISTE ET RECHERCHE */}
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
                      <button onClick={() => demarrerModif(act)} style={btnEdit}>Modifier</button>
                      <button onClick={() => supprimerActe(act.id)} style={btnDelete}>Supprimer</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                  Aucun acte infirmier enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES (Identiques pour la cohérence) ---
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