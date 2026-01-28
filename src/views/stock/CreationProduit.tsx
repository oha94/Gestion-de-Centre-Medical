import React, { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function CreationProduit({ refresh }: { refresh: () => void }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [rayons, setRayons] = useState<any[]>([]);

  // --- ÉTATS FORMULAIRE ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [f, setF] = useState({
    cip: "",
    designation: "",
    pAchat: "",
    pVente: "",
    rayonId: ""
  });

  // --- ÉTATS LISTE & RECHERCHE ---
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const chargerDonnees = async () => {
    try {
      const db = await getDb();

      // Charger les rayons pour la liste déroulante
      try {
        const resR = await db.select<any[]>("SELECT * FROM stock_rayons ORDER BY libelle ASC");
        setRayons(resR);
      } catch (e) {
        console.error("Erreur chargement rayons:", e);
        setRayons([]);
      }

      // Charger les produits avec le nom de leur rayon (Jointure)
      try {
        const resA = await db.select<any[]>(`
          SELECT 
            a.id,
            a.cip,
            a.designation,
            a.rayon_id,
            CAST(a.prix_achat AS CHAR) as prix_achat,
            CAST(a.prix_vente AS CHAR) as prix_vente,
            a.quantite_stock,
            r.libelle as nom_rayon 
          FROM stock_articles a 
          LEFT JOIN stock_rayons r ON a.rayon_id = r.id 
          ORDER BY a.designation ASC
        `);
        setArticles(resA.map(a => ({
          ...a,
          prix_achat: parseFloat(a.prix_achat || "0"),
          prix_vente: parseFloat(a.prix_vente || "0")
        })));
        console.log("Articles chargés:", resA.length);
      } catch (e) {
        console.error("Erreur chargement articles:", e);
        setArticles([]);
        alert("Erreur lors du chargement des produits. Vérifiez que toutes les colonnes existent dans la table stock_articles.");
      }
    } catch (e) {
      console.error("Erreur générale:", e);
    }
  };

  useEffect(() => { chargerDonnees(); }, []);

  const handleSave = async () => {
    if (!f.cip || !f.designation || !f.pVente) return alert("Champs obligatoires : CIP, Désignation et Prix Vente");

    try {
      const db = await getDb();

      if (editingId) {
        // --- MODE MODIFICATION ---
        // On ne touche PAS au stock (quantite_stock), c'est "verrouillé" comme demandé.
        await db.execute(
          "UPDATE stock_articles SET cip=?, designation=?, rayon_id=?, prix_achat=?, prix_vente=? WHERE id=?",
          [f.cip, f.designation, f.rayonId || null, f.pAchat || 0, f.pVente, editingId]
        );
        alert("Produit modifié avec succès !");
        setEditingId(null);
      } else {
        // --- MODE CREATION ---
        // Vérifier si le CIP existe déjà
        const existing = await db.select<any[]>("SELECT id FROM stock_articles WHERE cip = ?", [f.cip]);
        if (existing.length > 0) {
          return alert("Erreur : Ce CIP existe déjà dans la base de données.");
        }

        await db.execute(
          "INSERT INTO stock_articles (cip, designation, rayon_id, prix_achat, prix_vente, quantite_stock) VALUES (?,?,?,?,?, 0)",
          [f.cip, f.designation, f.rayonId || null, f.pAchat || 0, f.pVente]
        );
        alert("Produit créé avec succès !");
      }

      setF({ cip: "", designation: "", pAchat: "", pVente: "", rayonId: "" });
      chargerDonnees();
      refresh(); // Met à jour le compteur global dans StockMain
    } catch (e) {
      console.error("Erreur action produit:", e);
      alert("Erreur lors de l'enregistrement. Vérifiez les données.");
    }
  };

  const handleEdit = (prod: any) => {
    setEditingId(prod.id);
    setF({
      cip: prod.cip,
      designation: prod.designation,
      pAchat: prod.prix_achat,
      pVente: prod.prix_vente,
      rayonId: prod.rayon_id || ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setF({ cip: "", designation: "", pAchat: "", pVente: "", rayonId: "" });
  };

  // Logiciel de filtrage et pagination
  const filtered = articles.filter(a =>
    (a.designation || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.cip || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '10px' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>✨ Catalogue des Produits</h1>

      {/* --- FORMULAIRE DE CRÉATION / EDITION --- */}
      <div style={{ ...cardStyle, borderLeft: editingId ? '5px solid #f1c40f' : '5px solid #3498db' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: editingId ? '#f39c12' : '#3498db', display: 'flex', justifyContent: 'space-between' }}>
          {editingId ? "✏️ Modifier le produit" : "➕ Enregistrer un nouveau produit"}
          {editingId && <button onClick={handleCancel} style={{ ...btnSave, background: '#95a5a6', padding: '5px 15px', fontSize: '12px' }}>Annuler</button>}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '15px', marginTop: '20px' }}>
          <div>
            <label style={labelS}>CODE CIP / BARRE</label>
            <input value={f.cip} onChange={e => setF({ ...f, cip: e.target.value })} style={inputStyle} placeholder="Scanner ou saisir..." />
          </div>
          <div>
            <label style={labelS}>DÉSIGNATION COMPLÈTE (NOM DU PRODUIT)</label>
            <input value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} style={inputStyle} placeholder="Ex: PARACETAMOL..." />
          </div>
          <div>
            <label style={labelS}>RAYON / EMPLACEMENT</label>
            <select value={f.rayonId} onChange={e => setF({ ...f, rayonId: e.target.value })} style={inputStyle}>
              <option value="">-- Choisir un rayon --</option>
              {rayons.map(r => <option key={r.id} value={r.id}>{r.libelle}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelS}>PRIX D'ACHAT</label>
            <input type="number" value={f.pAchat} onChange={e => setF({ ...f, pAchat: e.target.value })} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label style={labelS}>PRIX DE VENTE PUBLIC</label>
            <input type="number" value={f.pVente} onChange={e => setF({ ...f, pVente: e.target.value })} style={{ ...inputStyle, borderColor: '#2ecc71', borderWidth: '2px' }} placeholder="0" />
          </div>
          <button onClick={handleSave} style={{ ...btnSave, background: editingId ? '#f39c12' : '#3498db' }}>
            {editingId ? "Sauvegarder Modifications" : "Créer le produit"}
          </button>
        </div>
      </div>

      {/* --- LISTE DES PRODUITS --- */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Inventaire du Catalogue ({filtered.length} produits)</h3>
          <input
            placeholder="🔍 Rechercher par nom ou CIP..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ padding: '12px', width: '350px', borderRadius: '10px', border: '1px solid #3498db', outline: 'none' }}
          />
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={tdStyle}>CIP</th>
              <th style={{ ...tdStyle, width: '30%' }}>Désignation</th>
              <th style={tdStyle}>Rayon</th>
              <th style={tdStyle}>P. Achat</th>
              <th style={tdStyle}>P. Vente</th>
              <th style={{ ...tdStyle, textAlign: 'center' }}>Stock Dispo</th>
              <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map(a => (
                <tr key={a.id} style={{ ...trStyle, background: editingId === a.id ? '#fff9db' : 'transparent' }}>
                  <td style={tdStyle}><code style={{ color: '#e67e22' }}>{a.cip}</code></td>
                  <td style={tdStyle}><strong>{a.designation}</strong></td>
                  <td style={tdStyle}><span style={rayonBadge}>{a.nom_rayon || (a.rayon_id ? `ID: ${a.rayon_id}` : 'Non classé')}</span></td>
                  <td style={tdStyle}>{a.prix_achat.toLocaleString()} F</td>
                  <td style={tdStyle}><strong>{a.prix_vente.toLocaleString()} F</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{
                      background: a.quantite_stock <= 5 ? '#fdecea' : '#e8f6ef',
                      color: a.quantite_stock <= 5 ? '#e74c3c' : '#27ae60',
                      padding: '5px', borderRadius: '5px', fontWeight: 'bold'
                    }}>
                      {a.quantite_stock}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => handleEdit(a)} style={btnEdit}>✏️ Modifier</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Aucun produit trouvé</div>
                  <div style={{ fontSize: '14px' }}>Commencez par créer votre premier produit ci-dessus</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* --- PAGINATION --- */}
        <div style={paginationStyle}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={pageBtn}>Précédent</button>
          <span>Page <strong>{currentPage}</strong> sur {totalPages || 1}</span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={pageBtn}>Suivant</button>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' };
const labelS: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px', letterSpacing: '0.5px' };
const btnSave: React.CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' };
const btnEdit: React.CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '15px', textAlign: 'left', fontSize: '14px' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid #f1f1f1' };
const rayonBadge = { background: '#f0f7ff', color: '#3498db', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' as const };
const paginationStyle: React.CSSProperties = { marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' };
const pageBtn = { padding: '8px 20px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' };