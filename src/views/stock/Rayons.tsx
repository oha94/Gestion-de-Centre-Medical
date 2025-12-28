import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function RayonsView() {
  const [rayons, setRayons] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [search, setSearch] = useState("");

  // États pour la modification simple
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");

  // --- ÉTATS POUR LA FUSION ---
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [finalName, setFinalName] = useState("");

  // --- PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const chargerRayons = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT * FROM stock_rayons ORDER BY libelle ASC");
      setRayons(res);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { chargerRayons(); }, []);

  const ajouterRayon = async () => {
    if (!nom) return alert("Veuillez saisir le libellé du rayon");
    try {
      const db = await getDb();
      await db.execute("INSERT INTO stock_rayons (libelle) VALUES (?)", [nom]);
      setNom(""); chargerRayons();
      alert("Rayon ajouté !");
    } catch (e) { alert("Ce rayon existe déjà."); }
  };

  const supprimerRayon = async (id: number) => {
    if (!window.confirm("Voulez-vous supprimer ce rayon ?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM stock_rayons WHERE id = ?", [id]);
    chargerRayons();
  };

  const sauvegarderModif = async () => {
    const db = await getDb();
    await db.execute("UPDATE stock_rayons SET libelle = ? WHERE id = ?", [editNom, editingId]);
    setEditingId(null);
    chargerRayons();
  };

  // --- LOGIQUE DE FUSION ---
  const handleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const preparerFusion = () => {
    const premierNom = rayons.find(r => r.id === selectedIds[0])?.libelle || "";
    setFinalName(premierNom);
    setShowMergeModal(true);
  };

  const executerFusion = async () => {
    if (!finalName) return alert("Le nom final ne peut pas être vide");

    try {
      const db = await getDb();

      // 1. On identifie le rayon "cible" (soit on le garde, soit on le renomme)
      const idCible = selectedIds[0];
      const autresIds = selectedIds.slice(1);

      // 2. On renomme le rayon principal avec le nom final
      await db.execute("UPDATE stock_rayons SET libelle = ? WHERE id = ?", [finalName, idCible]);

      // 3. IMPORTANT : Ici, si tes articles étaient liés aux rayons, 
      // on ferait : UPDATE stock_articles SET rayon_id = ? WHERE rayon_id IN (...)

      // 4. On supprime tous les autres rayons sélectionnés (les doublons)
      for (const idOld of autresIds) {
        await db.execute("DELETE FROM stock_rayons WHERE id = ?", [idOld]);
      }

      alert("Fusion réussie ! Les doublons ont été supprimés.");
      setShowMergeModal(false);
      setSelectedIds([]);
      chargerRayons();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la fusion. Vérifiez l'unicité du nom.");
    }
  };

  // --- IMPRESSION PDF ---
  const imprimerListeRayons = () => {
    const printContent = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Liste des Rayons</title>
        <style>
          @page { size: A4; margin: 20mm; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #2c3e50; margin: 0; font-size: 28px; }
          .header p { color: #7f8c8d; margin: 5px 0; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #3498db; color: white; padding: 12px; text-align: left; font-size: 14px; }
          td { padding: 12px; border-bottom: 1px solid #ecf0f1; font-size: 13px; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #95a5a6; font-size: 12px; }
          .total { font-weight: bold; font-size: 16px; color: #2c3e50; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏥 FOCOLARI</h1>
          <p>Gestion Hospitalière</p>
          <p style="font-size: 18px; font-weight: bold; color: #2c3e50; margin-top: 15px;">LISTE DES RAYONS / EMPLACEMENTS</p>
        </div>

        <div class="info-box">
          <div style="display: flex; justify-content: space-between;">
            <div><strong>Date d'impression :</strong> ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div class="total"><strong>Total : ${rayons.length} rayon(s)</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">N°</th>
              <th>Désignation / Emplacement</th>
            </tr>
          </thead>
          <tbody>
            ${rayons.map((r, index) => `
              <tr>
                <td><strong>${index + 1}</strong></td>
                <td>📦 ${r.libelle}</td>
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

    // Créer un iframe caché pour l'impression
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

      // Attendre que le contenu soit chargé puis imprimer
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Nettoyer l'iframe après l'impression
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const filtered = rayons.filter(r => r.libelle.toLowerCase().includes(search.toLowerCase()));

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#2c3e50' }}>📁 Gestion des Rayons</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedIds.length > 1 && (
            <button onClick={preparerFusion} style={btnMerge}>
              🔗 Fusionner les {selectedIds.length} sélectionnés
            </button>
          )}
          <button onClick={imprimerListeRayons} style={btnPrint}>
            🖨️ Imprimer la liste
          </button>
          <div style={{ background: '#3498db', color: 'white', padding: '10px 20px', borderRadius: '10px' }}>
            Total : <strong>{rayons.length}</strong>
          </div>
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT */}
      <div style={cardStyle}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: '#3498db' }}>➕ Nouveau Rayon</h3>
        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelS}>Libellé du rayon</label>
            <input placeholder="Ex: Étagère A1..." value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={ajouterRayon} style={btnPlus}>Enregistrer</button>
        </div>
      </div>

      {/* LISTE ET RECHERCHE */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h3>Liste des emplacements ({filtered.length} trouvé{filtered.length > 1 ? 's' : ''})</h3>
          <input
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid #3498db' }}
          />
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ width: '50px', padding: '15px' }}></th>
              <th style={tdStyle}>Désignation / Emplacement</th>
              <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: selectedIds.includes(r.id) ? '#f0f7ff' : 'transparent' }}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => handleSelect(r.id)} style={{ width: '18px', height: '18px' }} />
                </td>
                <td style={tdStyle}>
                  {editingId === r.id ?
                    <input value={editNom} onChange={e => setEditNom(e.target.value)} style={inputStyle} autoFocus />
                    : <strong>📦 {r.libelle}</strong>
                  }
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {editingId === r.id ? (
                    <>
                      <button onClick={sauvegarderModif} style={btnSaveSmall}>OK</button>
                      <button onClick={() => setEditingId(null)} style={btnCancelSmall}>Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(r.id); setEditNom(r.libelle); }} style={btnEdit}>Modifier</button>
                      <button onClick={() => supprimerRayon(r.id)} style={btnDelete}>Supprimer</button>
                    </>
                  )}
                </td>
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

      {/* MODAL DE FUSION */}
      {showMergeModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2>🔗 Fusionner les rayons</h2>
            <p>Vous allez fusionner plusieurs rayons. Les doublons seront supprimés et les données seront regroupées sous le nom suivant :</p>

            <label style={labelS}>Nom final à conserver</label>
            <input
              value={finalName}
              onChange={e => setFinalName(e.target.value)}
              style={{ ...inputStyle, fontSize: '1.2rem', border: '2px solid #3498db' }}
            />

            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowMergeModal(false)} style={btnCancelSmall}>Annuler</button>
              <button onClick={executerFusion} style={{ ...btnPlus, background: '#2ecc71' }}>Confirmer la Fusion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '15px', textAlign: 'left' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: 'white', padding: '30px', borderRadius: '20px', width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };

const btnPlus: React.CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnMerge: React.CSSProperties = { background: '#9b59b6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' };
const btnPrint: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit: React.CSSProperties = { background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnDelete: React.CSSProperties = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' };
const btnSaveSmall: React.CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnCancelSmall: React.CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };
const pageBtn: React.CSSProperties = { padding: '8px 15px', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', background: 'white' };