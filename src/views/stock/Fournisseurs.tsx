import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function FournisseursView() {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [f, setF] = useState({ nom: "", contact: "", tel: "", email: "", adresse: "" });
  const [search, setSearch] = useState("");

  // --- ÉTATS MODIFICATION ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ nom: "", contact: "", tel: "", email: "", adresse: "" });

  // --- PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const chargerFournisseurs = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT * FROM stock_fournisseurs ORDER BY nom ASC");
      setFournisseurs(res);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { chargerFournisseurs(); }, []);

  const ajouterFournisseur = async () => {
    if (!f.nom) return alert("Le nom du fournisseur est obligatoire");

    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO stock_fournisseurs (nom, contact_nom, telephone, email, adresse) VALUES (?,?,?,?,?)",
        [f.nom, f.contact, f.tel, f.email, f.adresse]
      );
      setF({ nom: "", contact: "", tel: "", email: "", adresse: "" });
      await chargerFournisseurs();
      alert("Fournisseur ajouté !");
    } catch (e) {
      console.error("Erreur ajout fournisseur:", e);
      alert("Erreur lors de l'ajout du fournisseur. Vérifiez que la table existe.");
    }
  };

  const supprimerFournisseur = async (id: number) => {
    if (!window.confirm("Voulez-vous supprimer ce fournisseur ?")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM stock_fournisseurs WHERE id = ?", [id]);
      await chargerFournisseurs();
      alert("Fournisseur supprimé !");
    } catch (e) {
      console.error("Erreur suppression:", e);
      alert("Erreur lors de la suppression");
    }
  };

  const ouvrirModification = (item: any) => {
    setEditingId(item.id);
    setEditData({
      nom: item.nom,
      contact: item.contact_nom || "",
      tel: item.telephone || "",
      email: item.email || "",
      adresse: item.adresse || ""
    });
  };

  const annulerModification = () => {
    setEditingId(null);
    setEditData({ nom: "", contact: "", tel: "", email: "", adresse: "" });
  };

  const sauvegarderModification = async () => {
    if (!editData.nom) return alert("Le nom est obligatoire");

    try {
      const db = await getDb();
      await db.execute(
        "UPDATE stock_fournisseurs SET nom = ?, contact_nom = ?, telephone = ?, email = ?, adresse = ? WHERE id = ?",
        [editData.nom, editData.contact, editData.tel, editData.email, editData.adresse, editingId]
      );
      setEditingId(null);
      await chargerFournisseurs();
      alert("Fournisseur modifié !");
    } catch (e) {
      console.error("Erreur modification:", e);
      alert("Erreur lors de la modification");
    }
  };

  // --- IMPRESSION PDF ---
  const imprimerListeFournisseurs = () => {
    const printContent = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Liste des Fournisseurs</title>
        <style>
          @page { size: A4; margin: 20mm; }
          @media print {
            body { margin: 0; }
          }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #2c3e50; margin: 0; font-size: 28px; }
          .header p { color: #7f8c8d; margin: 5px 0; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #3498db; color: white; padding: 10px; text-align: left; font-size: 13px; }
          td { padding: 10px; border-bottom: 1px solid #ecf0f1; font-size: 12px; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #95a5a6; font-size: 12px; }
          .total { font-weight: bold; font-size: 16px; color: #2c3e50; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏥 FOCOLARI</h1>
          <p>Gestion Hospitalière</p>
          <p style="font-size: 18px; font-weight: bold; color: #2c3e50; margin-top: 15px;">ANNUAIRE DES FOURNISSEURS</p>
        </div>

        <div class="info-box">
          <div style="display: flex; justify-content: space-between;">
            <div><strong>Date d'impression :</strong> ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div class="total"><strong>Total : ${fournisseurs.length} fournisseur(s)</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">N°</th>
              <th>Fournisseur</th>
              <th>Contact</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Adresse</th>
            </tr>
          </thead>
          <tbody>
            ${fournisseurs.map((item, index) => `
              <tr>
                <td><strong>${index + 1}</strong></td>
                <td><strong>${item.nom}</strong></td>
                <td>${item.contact_nom || '-'}</td>
                <td>${item.telephone || '-'}</td>
                <td style="font-size: 11px;">${item.email || '-'}</td>
                <td style="font-size: 11px;">${item.adresse || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Document généré automatiquement</p>
          <p>${new Date().toLocaleString('fr-FR')}</p>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const filtered = fournisseurs.filter(item =>
    item.nom.toLowerCase().includes(search.toLowerCase()) ||
    item.telephone?.includes(search)
  );

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 Gestion des Fournisseurs</h1>
        <button onClick={imprimerListeFournisseurs} style={btnPrint}>
          🖨️ Imprimer la liste
        </button>
      </div>

      {/* FORMULAIRE D'AJOUT */}
      <div style={cardStyle}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: '#3498db' }}>
          ➕ Nouveau Partenaire
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
          <div><label style={labelS}>NOM DE L'ENTREPRISE</label><input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelS}>CONTACT (NOM)</label><input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelS}>TÉLÉPHONE</label><input value={f.tel} onChange={e => setF({ ...f, tel: e.target.value })} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div><label style={labelS}>EMAIL</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelS}>ADRESSE GÉOGRAPHIQUE</label><input value={f.adresse} onChange={e => setF({ ...f, adresse: e.target.value })} style={inputStyle} /></div>
          <button onClick={ajouterFournisseur} style={btnPlus}>Enregistrer le Fournisseur</button>
        </div>
      </div>

      {/* LISTE ET RECHERCHE */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h3>Annuaire Fournisseurs ({filtered.length} trouvé{filtered.length > 1 ? 's' : ''})</h3>
          <input
            placeholder="🔍 Rechercher par nom ou téléphone..."
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid #3498db' }}
          />
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
              <th style={tdStyle}>Fournisseur</th>
              <th style={tdStyle}>Contact</th>
              <th style={tdStyle}>Téléphone</th>
              <th style={tdStyle}>Email</th>
              <th style={tdStyle}>Adresse</th>
              <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee', background: editingId === item.id ? '#fff3cd' : 'transparent' }}>
                {editingId === item.id ? (
                  // MODE ÉDITION
                  <>
                    <td style={tdStyle}>
                      <input
                        value={editData.nom}
                        onChange={e => setEditData({ ...editData, nom: e.target.value })}
                        style={inputStyle}
                        autoFocus
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={editData.contact}
                        onChange={e => setEditData({ ...editData, contact: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={editData.tel}
                        onChange={e => setEditData({ ...editData, tel: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={editData.email}
                        onChange={e => setEditData({ ...editData, email: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={editData.adresse}
                        onChange={e => setEditData({ ...editData, adresse: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={sauvegarderModification} style={btnSaveSmall}>OK</button>
                      <button onClick={annulerModification} style={btnCancelSmall}>Annuler</button>
                    </td>
                  </>
                ) : (
                  // MODE NORMAL
                  <>
                    <td style={tdStyle}><strong>{item.nom}</strong></td>
                    <td style={tdStyle}>{item.contact_nom || '-'}</td>
                    <td style={tdStyle}>{item.telephone || '-'}</td>
                    <td style={tdStyle}><small>{item.email || '-'}</small></td>
                    <td style={tdStyle}><small>{item.adresse || '-'}</small></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => ouvrirModification(item)} style={btnEdit}>Modifier</button>
                      <button onClick={() => supprimerFournisseur(item.id)} style={btnDelete}>Supprimer</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              style={pageBtn}
            >
              Précédent
            </button>
            <span style={{ padding: '5px 15px', background: '#eee', borderRadius: '5px' }}>
              Page <strong>{currentPage}</strong> / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              style={pageBtn}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const btnPlus: React.CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnPrint: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: React.CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnDelete: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' };
const btnSaveSmall: React.CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnCancelSmall: React.CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '15px' };
const pageBtn: React.CSSProperties = { padding: '8px 15px', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', background: 'white' };