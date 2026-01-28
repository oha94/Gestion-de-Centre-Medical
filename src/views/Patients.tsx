import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../lib/db";
import { exportToExcel as utilsExportToExcel } from "../lib/exportUtils";

import { useAuth, usePermission } from "../contexts/AuthContext";

export default function PatientsView() {
  const { user } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermission('patients');
  // currentUser was used for printing PDF signature (currentUser.nom_complet)
  // We can use 'user' from context for that.
  const [patients, setPatients] = useState<any[]>([]);
  const [f, setF] = useState({ carnet: "", nom: "", sexe: "Homme", dateN: "", tel1: "", tel2: "", ville: "", spref: "", village: "" });
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showPopupModif, setShowPopupModif] = useState(false);
  const [search, setSearch] = useState("");
  const [historique, setHistorique] = useState<any[]>([]);

  // --- HISTORIQUE PASSAGES ---
  const [viewMode, setViewMode] = useState<'PATIENTS' | 'VISITS'>('PATIENTS');
  const [visits, setVisits] = useState<any[]>([]);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // --- ÉTATS ASSURANCES ---
  const [assurances, setAssurances] = useState<any[]>([]);
  const [showPopupAssurance, setShowPopupAssurance] = useState(false);
  const [selectedAssuranceId, setSelectedAssuranceId] = useState("");
  const [numeroAssure, setNumeroAssure] = useState("");
  const [tauxCouverture, setTauxCouverture] = useState(80);

  // --- ÉTATS DÉTAILS OPÉRATION ---
  const [showPopupDetails, setShowPopupDetails] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any>(null);

  const chargerPatients = async () => {
    const db = await getDb();
    const res = await db.select<any[]>("SELECT * FROM patients ORDER BY date_creation DESC");
    setPatients(res);
  };

  const chargerAssurances = async () => {
    const db = await getDb();
    const res = await db.select<any[]>("SELECT * FROM assurances ORDER BY nom ASC");
    setAssurances(res);
  };

  useEffect(() => {
    chargerPatients();
    chargerAssurances();
  }, []);

  useEffect(() => {
    if (viewMode === 'VISITS') loadVisits();
  }, [viewMode, visitDate]);

  const loadVisits = async () => {
    const db = await getDb();
    const res = await db.select<any[]>(`
        SELECT DISTINCT p.*, MAX(v.date_vente) as last_visit, COUNT(v.id) as nb_actes, CAST(SUM(v.montant_total) AS DOUBLE) as total_spend
        FROM patients p
        JOIN ventes v ON p.id = v.patient_id
        WHERE DATE(v.date_vente) = ?
        GROUP BY p.id
        ORDER BY last_visit DESC
      `, [visitDate]);
    setVisits(res);
  };

  const enregistrer = async () => {
    if (!f.carnet || !f.nom) return alert("Le numéro de carnet et le nom sont obligatoires");
    const db = await getDb();
    await db.execute(
      "INSERT INTO patients (numero_carnet, nom_prenoms, sexe, date_naissance, telephone, telephone2, ville, sous_prefecture, village) VALUES (?,?,?,?,?,?,?,?,?)",
      [f.carnet, f.nom, f.sexe, f.dateN, f.tel1, f.tel2, f.ville, f.spref, f.village]
    );
    setF({ carnet: "", nom: "", sexe: "Homme", dateN: "", tel1: "", tel2: "", ville: "", spref: "", village: "" });
    chargerPatients();
    alert("Patient enregistré avec succès");
  };

  const voirPatient = async (p: any) => {
    setSelectedPatient(p);
    const db = await getDb();

    // Charger l'historique des ventes avec les détails d'assurance
    const resH = await db.select<any[]>(`
      SELECT v.*, a.nom as nom_assurance
      FROM ventes v
      LEFT JOIN patients pat ON v.patient_id = pat.id
      LEFT JOIN assurances a ON pat.assurance_id = a.id
      WHERE v.patient_id = ? 
      ORDER BY v.date_vente DESC
    `, [p.id]);
    setHistorique(resH);
  };

  const sauvegarderModifs = async () => {
    const db = await getDb();
    await db.execute(
      "UPDATE patients SET numero_carnet=?, nom_prenoms=?, sexe=?, date_naissance=?, telephone=?, telephone2=?, ville=?, sous_prefecture=?, village=? WHERE id=?",
      [
        selectedPatient.numero_carnet,
        selectedPatient.nom_prenoms,
        selectedPatient.sexe,
        selectedPatient.date_naissance,
        selectedPatient.telephone,
        selectedPatient.telephone2,
        selectedPatient.ville,
        selectedPatient.sous_prefecture,
        selectedPatient.village,
        selectedPatient.id
      ]
    );
    setShowPopupModif(false);
    chargerPatients();
    alert("Dossier mis à jour avec succès");
  };

  const supprimerPatient = async () => {
    if (!selectedPatient) return;
    if (!window.confirm("⚠️ Êtes-vous sûr de vouloir supprimer ce patient ? Cette action est irréversible.")) return;

    try {
      const db = await getDb();
      const ventes = await db.select<any[]>("SELECT COUNT(*) as c FROM ventes WHERE patient_id = ?", [selectedPatient.id]);
      if (ventes[0].c > 0) {
        return alert("❌ Impossible de supprimer ce patient car il a des ventes associées.");
      }
      await db.execute("DELETE FROM patients WHERE id = ?", [selectedPatient.id]);
      setSelectedPatient(null);
      chargerPatients();
      alert("✅ Patient supprimé.");
    } catch (e: any) {
      console.error(e);
      alert("Erreur suppression: " + e.message);
    }
  };

  const ouvrirPopupAssurance = () => {
    // Pré-remplir si le patient a déjà une assurance
    if (selectedPatient.assurance_id) {
      setSelectedAssuranceId(selectedPatient.assurance_id.toString());
      setNumeroAssure(selectedPatient.numero_assure || "");
      setTauxCouverture(selectedPatient.taux_couverture || 80);
    } else {
      setSelectedAssuranceId("");
      setNumeroAssure("");
      setTauxCouverture(80);
    }
    setShowPopupAssurance(true);
  };

  const attribuerAssurance = async () => {
    if (!selectedAssuranceId) {
      return alert("Veuillez sélectionner une assurance");
    }

    const db = await getDb();
    await db.execute(
      "UPDATE patients SET assurance_id = ?, numero_assure = ?, taux_couverture = ? WHERE id = ?",
      [selectedAssuranceId, numeroAssure, tauxCouverture, selectedPatient.id]
    );

    // Rafraîchir les données du patient
    const updatedPatient = await db.select<any[]>("SELECT * FROM patients WHERE id = ?", [selectedPatient.id]);
    setSelectedPatient(updatedPatient[0]);

    setShowPopupAssurance(false);
    chargerPatients();
    alert("Assurance attribuée avec succès");
  };

  const retirerAssurance = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer l'assurance de ce patient ?")) return;

    const db = await getDb();
    await db.execute(
      "UPDATE patients SET assurance_id = NULL, numero_assure = NULL, taux_couverture = NULL WHERE id = ?",
      [selectedPatient.id]
    );

    // Rafraîchir les données du patient
    const updatedPatient = await db.select<any[]>("SELECT * FROM patients WHERE id = ?", [selectedPatient.id]);
    setSelectedPatient(updatedPatient[0]);

    chargerPatients();
    alert("Assurance retirée avec succès");
  };

  const voirDetails = (operation: any) => {
    setSelectedOperation(operation);
    setShowPopupDetails(true);
  };

  const imprimerPDF = async () => {
    if (!selectedOperation) return;

    const formatDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch {
      }
    };

    const company = await getCompanyInfo();

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reçu de Paiement - ${selectedPatient.numero_carnet}</title>
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
          .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
          .company-sub { font-size: 10px; color: #7f8c8d; }
          .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }
          
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
          .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
          .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 20px; }
          th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
          td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
          tr:last-child td { border-bottom: none; }

          .totals-section { margin-top: 30px; display: flex; flex-direction: column; align-items: flex-end; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; width: 250px; }
          .total-final { font-weight: 700; font-size: 14px; color: #27ae60; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; }

          .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
          
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
          .badge-assure { background: #e8f5e9; color: #2e7d32; }
          .badge-cash { background: #fff3cd; color: #856404; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${company.nom}</div>
            <div class="company-sub">${company.adresse || ''}</div>
            <div class="company-sub">${company.telephone || ''}</div>
            <div class="company-sub">${company.email || ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Document</div>
            <div class="doc-title">REÇU PAIEMENT</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
             <label>Patient</label>
             <span>${selectedPatient.nom_prenoms} (${selectedPatient.numero_carnet})</span>
          </div>
          <div class="meta-item">
             <label>Date</label>
             <span>${formatDate(selectedOperation.date_vente)}</span>
          </div>
          <div class="meta-item">
             <label>${selectedOperation.nom_assurance ? 'Assurance' : 'Statut'}</label>
             <span>${selectedOperation.nom_assurance || '<span class="badge badge-cash">CASH</span>'}</span>
          </div>
          <div class="meta-item">
             <label>Paiement</label>
             <span>${selectedOperation.mode_paiement || 'Espèces'}</span>
          </div>
        </div>

        <h3 style="font-size: 12px; color: #555; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px;">Détails de la Prestation</h3>
        <table>
          <thead>
            <tr>
              <th>Acte / Prestation</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${selectedOperation.acte_libelle}</td>
              <td style="text-align: right;"><strong>${selectedOperation.montant_total.toLocaleString()} F</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>Montant Brut</span>
            <span>${selectedOperation.montant_total.toLocaleString()} F</span>
          </div>
          ${selectedOperation.part_assureur > 0 ? `
          <div class="total-row">
            <span>Part Assurance</span>
            <span style="color: #3498db;">- ${selectedOperation.part_assureur.toLocaleString()} F</span>
          </div>
          ` : ''}
          <div class="total-row total-final">
            <span>RÉGLÉ PAR LE PATIENT</span>
            <span>${selectedOperation.part_patient.toLocaleString()} F</span>
          </div>
        </div>

        <div style="margin-top: 60px; text-align: right; padding-right: 20px;">
           <div style="margin-bottom: 40px; font-size: 10px; font-weight: bold; color: #999;">SIGNATURE / CACHET</div>
           <div style="border-bottom: 1px solid #eee; width: 150px; display: inline-block;"></div>
        </div>

        <div class="footer">
          Imprimé le ${new Date().toLocaleString('fr-FR')} par ${user?.nom_complet || 'Système'}
          <br/>Centre Médical Focolari - Application de Gestion
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
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(content);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  };

  const filtered = patients.filter(p =>
    p.nom_prenoms.toLowerCase().includes(search.toLowerCase()) ||
    p.numero_carnet.includes(search)
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Trouver le nom de l'assurance du patient
  const getAssuranceNom = (assuranceId: number) => {
    const assurance = assurances.find(a => a.id === assuranceId);
    return assurance ? assurance.nom : "N/A";
  };

  return (
    <div style={{ padding: '10px' }}>
      {!selectedPatient ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1>👥 Gestion des Patients</h1>
            <div style={{ background: '#3498db', color: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              Total Patients : <strong>{patients.length}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setViewMode('PATIENTS')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: viewMode === 'PATIENTS' ? '#2c3e50' : '#ecf0f1', color: viewMode === 'PATIENTS' ? 'white' : '#2c3e50', cursor: 'pointer', fontWeight: 'bold' }}>👥 Base Patients</button>
            <button onClick={() => setViewMode('VISITS')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: viewMode === 'VISITS' ? '#2c3e50' : '#ecf0f1', color: viewMode === 'VISITS' ? 'white' : '#2c3e50', cursor: 'pointer', fontWeight: 'bold' }}>📅 Historique des Passages</button>
          </div>

          {viewMode === 'VISITS' ? (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <h3>Passages du :</h3>
                <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                <button onClick={loadVisits} style={btnSmall}>Actualiser</button>
              </div>

              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#34495e', color: 'white' }}>
                    <th style={tdStyle}>Heure</th>
                    <th style={tdStyle}>Patient</th>
                    <th style={tdStyle}>Actes</th>
                    <th style={tdStyle}>Montant</th>
                    <th style={tdStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length > 0 ? visits.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{new Date(v.last_visit).toLocaleTimeString().substring(0, 5)}</td>
                      <td style={tdStyle}><strong>{v.nom_prenoms}</strong><br /><small>{v.numero_carnet}</small></td>
                      <td style={tdStyle}>{v.nb_actes} acte(s)</td>
                      <td style={tdStyle}>{v.total_spend.toLocaleString()} F</td>
                      <td style={tdStyle}><button onClick={() => voirPatient(v)} style={btnSmall}>Voir Dossier</button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>Aucun patient reçu à cette date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div style={cardStyle}>
                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🆕 Nouvelle Inscription</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', marginBottom: '15px', marginTop: '15px' }}>
                  <div style={inputGroup}><label style={labelS}>N° Carnet</label><input value={f.carnet} onChange={e => setF({ ...f, carnet: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>Nom et Prénoms</label><input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>Sexe</label><select value={f.sexe} onChange={e => setF({ ...f, sexe: e.target.value })} style={inputStyle}><option value="Homme">Homme</option><option value="Femme">Femme</option></select></div>
                  <div style={inputGroup}><label style={labelS}>Date de Naissance</label><input type="date" value={f.dateN} onChange={e => setF({ ...f, dateN: e.target.value })} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  <div style={inputGroup}><label style={labelS}>Téléphone 1</label><input value={f.tel1} onChange={e => setF({ ...f, tel1: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>Téléphone 2</label><input value={f.tel2} onChange={e => setF({ ...f, tel2: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>Ville</label><input value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>S/Préfecture</label><input value={f.spref} onChange={e => setF({ ...f, spref: e.target.value })} style={inputStyle} /></div>
                  <div style={inputGroup}><label style={labelS}>Village</label><input value={f.village} disabled={!canCreate} onChange={e => setF({ ...f, village: e.target.value })} style={inputStyle} /></div>
                </div>
                {canCreate && (
                  <button onClick={enregistrer} style={{ ...btnStyle, marginTop: '20px', backgroundColor: '#2ecc71', width: '200px', fontWeight: 'bold' }}>Enregistrer Patient</button>
                )}
                {!canCreate && (
                  <div style={{ marginTop: '20px', color: '#e74c3c', fontStyle: 'italic' }}>🚫 Vous n'avez pas les droits pour créer un patient.</div>
                )}
              </div>

              <div style={{ ...cardStyle, marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                  <h3>Base des Patients ({filtered.length} trouvés)</h3>
                  <input placeholder="🔍 Rechercher par nom ou carnet..." onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', width: '350px', borderRadius: '8px', border: '1px solid #3498db' }} />
                </div>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: '#2c3e50', color: 'white' }}>
                      <th style={tdStyle}>N° Carnet</th>
                      <th style={tdStyle}>Nom & Prénoms</th>
                      <th style={tdStyle}>Téléphone</th>
                      <th style={tdStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={tdStyle}><strong>{p.numero_carnet}</strong></td>
                        <td style={tdStyle}>{p.nom_prenoms}</td>
                        <td style={tdStyle}>{p.telephone}</td>
                        <td style={tdStyle}><button onClick={() => voirPatient(p)} style={btnSmall}>Voir le patient</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={pageBtn}>Précédent</button>
                  <span style={{ padding: '5px 15px', background: '#eee', borderRadius: '5px' }}>Page <strong>{currentPage}</strong> / {totalPages || 1}</span>
                  <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={pageBtn}>Suivant</button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, borderTop: '5px solid #3498db' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>📂 Dossier Médical : {selectedPatient.nom_prenoms}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {canDelete && (
                <button onClick={supprimerPatient} style={{ background: '#c0392b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Supprimer</button>
              )}
              <button onClick={() => setSelectedPatient(null)} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Fermer</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #dee2e6' }}>
            <div><span style={labelTag}>IDENTITÉ</span><br /><strong>{selectedPatient.numero_carnet}</strong><br />{selectedPatient.nom_prenoms} ({selectedPatient.sexe})</div>
            <div><span style={labelTag}>CONTACTS</span><br />📞 {selectedPatient.telephone}<br />📱 {selectedPatient.telephone2 || 'N/A'}</div>
            <div><span style={labelTag}>LOCALISATION</span><br />📍 {selectedPatient.ville}<br />🏠 {selectedPatient.sous_prefecture} / {selectedPatient.village}</div>
          </div>

          {/* SECTION ASSURANCE */}
          <div style={{ marginTop: '20px', background: selectedPatient.assurance_id ? '#e8f8f5' : '#fef5e7', padding: '20px', borderRadius: '12px', border: selectedPatient.assurance_id ? '2px solid #27ae60' : '2px solid #f39c12' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ ...labelTag, color: selectedPatient.assurance_id ? '#27ae60' : '#f39c12' }}>
                  {selectedPatient.assurance_id ? '✓ ASSURÉ' : '⚠ SANS ASSURANCE'}
                </span>
                {selectedPatient.assurance_id && (
                  <div style={{ marginTop: '10px' }}>
                    <strong style={{ fontSize: '16px' }}>{getAssuranceNom(selectedPatient.assurance_id)}</strong><br />
                    <small style={{ color: '#7f8c8d' }}>N° Assuré : {selectedPatient.numero_assure || 'N/A'}</small><br />
                    <small style={{ color: '#7f8c8d' }}>Taux de couverture : <strong>{selectedPatient.taux_couverture || 0}%</strong></small>
                  </div>
                )}
                {!selectedPatient.assurance_id && (
                  <div style={{ marginTop: '10px', color: '#7f8c8d' }}>
                    Ce patient n'a pas d'assurance attribuée
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {canUpdate && (
                  <button
                    onClick={ouvrirPopupAssurance}
                    style={{
                      background: selectedPatient.assurance_id ? '#3498db' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {selectedPatient.assurance_id ? '✏️ Modifier l\'assurance' : '➕ Attribuer une assurance'}
                  </button>
                )}
                {selectedPatient.assurance_id && canUpdate && (
                  <button
                    onClick={retirerAssurance}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ Retirer
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            {canUpdate && (
              <button onClick={() => setShowPopupModif(true)} style={{ background: '#f1c40f', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✎ Modifier les informations du patient</button>
            )}
          </div>

          <h3 style={{ marginTop: '40px', borderBottom: '2px solid #3498db', paddingBottom: '10px', color: '#2c3e50' }}>📜 Historique des Opérations</h3>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#ecf0f1' }}>
                <th style={tdStyle}>Date</th>
                <th style={tdStyle}>Acte / Prestation</th>
                <th style={tdStyle}>Montant Total</th>
                <th style={tdStyle}>Part Patient</th>
                <th style={tdStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {historique.length > 0 ? historique.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #f1f1f1' }}>
                  <td style={tdStyle}>
                    {(() => {
                      try {
                        const date = new Date(h.date_vente);
                        return date.toLocaleDateString('fr-FR');
                      } catch {
                        return 'Invalid Date';
                      }
                    })()}
                  </td>
                  <td style={tdStyle}>
                    {h.acte_libelle}
                    {h.part_assureur > 0 && (
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#d4edda', color: '#155724', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        🛡️ Assuré
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}><strong>{h.montant_total.toLocaleString()} F</strong></td>
                  <td style={tdStyle}><strong style={{ color: '#27ae60' }}>{h.part_patient.toLocaleString()} F</strong></td>
                  <td style={tdStyle}>
                    <button onClick={() => voirDetails(h)} style={{ ...btnSmall, fontSize: '0.85rem' }}>
                      👁️ Détails
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Aucun historique pour ce patient</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )
      }

      {/* POP-UP DE MODIFICATION INTEGRALE */}
      {
        showPopupModif && (
          <div style={overlayStyle}>
            <div style={{ ...popupStyle, width: '800px' }}>
              <h2 style={{ borderBottom: '2px solid #f1c40f', paddingBottom: '10px' }}>Mettre à jour le dossier patient</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '15px', marginTop: '20px' }}>
                <div style={inputGroup}><label style={labelS}>N° Carnet</label><input value={selectedPatient.numero_carnet} onChange={e => setSelectedPatient({ ...selectedPatient, numero_carnet: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>Nom et Prénoms</label><input value={selectedPatient.nom_prenoms} onChange={e => setSelectedPatient({ ...selectedPatient, nom_prenoms: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>Sexe</label><select value={selectedPatient.sexe} onChange={e => setSelectedPatient({ ...selectedPatient, sexe: e.target.value })} style={inputStyle}><option value="Homme">Homme</option><option value="Femme">Femme</option></select></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div style={inputGroup}><label style={labelS}>Date de Naissance</label><input type="date" value={selectedPatient.date_naissance} onChange={e => setSelectedPatient({ ...selectedPatient, date_naissance: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>Téléphone 1</label><input value={selectedPatient.telephone} onChange={e => setSelectedPatient({ ...selectedPatient, telephone: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>Téléphone 2</label><input value={selectedPatient.telephone2} onChange={e => setSelectedPatient({ ...selectedPatient, telephone2: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div style={inputGroup}><label style={labelS}>Ville</label><input value={selectedPatient.ville} onChange={e => setSelectedPatient({ ...selectedPatient, ville: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>S/Préfecture</label><input value={selectedPatient.sous_prefecture} onChange={e => setSelectedPatient({ ...selectedPatient, sous_prefecture: e.target.value })} style={inputStyle} /></div>
                <div style={inputGroup}><label style={labelS}>Village</label><input value={selectedPatient.village} onChange={e => setSelectedPatient({ ...selectedPatient, village: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ marginTop: '30px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <button onClick={sauvegarderModifs} style={{ background: '#2ecc71', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Confirmer les modifications</button>
                <button onClick={() => setShowPopupModif(false)} style={{ marginLeft: '15px', padding: '12px 20px', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </div>
        )
      }

      {/* POP-UP ATTRIBUTION ASSURANCE */}
      {
        showPopupAssurance && (
          <div style={overlayStyle}>
            <div style={{ ...popupStyle, width: '600px' }}>
              <h2 style={{ borderBottom: '2px solid #27ae60', paddingBottom: '10px', color: '#27ae60' }}>
                {selectedPatient.assurance_id ? '✏️ Modifier l\'assurance' : '➕ Attribuer une assurance'}
              </h2>

              <div style={{ marginTop: '20px' }}>
                <div style={inputGroup}>
                  <label style={labelS}>Assurance *</label>
                  <select
                    value={selectedAssuranceId}
                    onChange={e => setSelectedAssuranceId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">-- Sélectionner une assurance --</option>
                    {assurances.map(a => (
                      <option key={a.id} value={a.id}>{a.nom}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                  <div style={inputGroup}>
                    <label style={labelS}>Numéro d'assuré</label>
                    <input
                      value={numeroAssure}
                      onChange={e => setNumeroAssure(e.target.value)}
                      style={inputStyle}
                      placeholder="Ex: ASS-2025-001"
                    />
                  </div>
                  <div style={inputGroup}>
                    <label style={labelS}>Taux de couverture (%)</label>
                    <input
                      type="number"
                      value={tauxCouverture}
                      onChange={e => setTauxCouverture(parseInt(e.target.value))}
                      style={inputStyle}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '30px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <button
                  onClick={attribuerAssurance}
                  style={{
                    background: '#27ae60',
                    color: 'white',
                    padding: '12px 30px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Confirmer
                </button>
                <button
                  onClick={() => setShowPopupAssurance(false)}
                  style={{
                    marginLeft: '15px',
                    padding: '12px 20px',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* POP-UP DÉTAILS OPÉRATION */}
      {
        showPopupDetails && selectedOperation && (
          <div style={overlayStyle}>
            <div style={{ ...popupStyle, width: '700px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#2c3e50', margin: 0 }}>📄 Détails de l'opération</h2>
                <button
                  onClick={() => setShowPopupDetails(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#95a5a6'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <span style={labelTag}>PATIENT</span><br />
                    <strong>{selectedPatient.nom_prenoms}</strong><br />
                    <small style={{ color: '#7f8c8d' }}>{selectedPatient.numero_carnet}</small>
                  </div>
                  <div>
                    <span style={labelTag}>DATE</span><br />
                    <strong>
                      {(() => {
                        try {
                          const date = new Date(selectedOperation.date_vente);
                          return date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } catch {
                          return 'N/A';
                        }
                      })()}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '10px' }}>Prestation</h3>
                <div style={{ background: 'white', padding: '15px', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '5px' }}>
                    {selectedOperation.acte_libelle}
                  </div>
                  {selectedOperation.nom_assurance && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ background: '#d4edda', color: '#155724', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        🛡️ {selectedOperation.nom_assurance}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: '#ecf0f1', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Montant Total Brut</span>
                  <strong>{selectedOperation.montant_total.toLocaleString()} F</strong>
                </div>
                {selectedOperation.part_assureur > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#3498db' }}>
                    <span>Part Assurance</span>
                    <strong>- {selectedOperation.part_assureur.toLocaleString()} F</strong>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '15px',
                  paddingTop: '15px',
                  borderTop: '2px solid #bdc3c7',
                  fontSize: '18px'
                }}>
                  <strong>Part Patient</strong>
                  <strong style={{ color: '#27ae60' }}>{selectedOperation.part_patient.toLocaleString()} F</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
                  <span>Mode de paiement</span>
                  <strong>{selectedOperation.mode_paiement}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={imprimerPDF}
                  style={{
                    background: '#e74c3c',
                    color: 'white',
                    padding: '12px 25px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  🖨️ Imprimer en PDF
                </button>
                <button
                  onClick={() => utilsExportToExcel([{
                    'Date': new Date(selectedOperation.date_vente).toLocaleDateString(),
                    'Patient': selectedOperation.nom_prenoms,
                    'Prestation': selectedOperation.acte_libelle,
                    'Montant Total': selectedOperation.montant_total,
                    'Part Patient': selectedOperation.part_patient,
                    'Part Assurance': selectedOperation.part_assureur
                  }], `Patient_Recu_${selectedOperation.id}`)}
                  style={{
                    background: '#2ecc71',
                    color: 'white',
                    padding: '12px 25px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  📊 Excel
                </button>
                <button
                  onClick={() => setShowPopupDetails(false)}
                  style={{
                    background: '#95a5a6',
                    color: 'white',
                    padding: '12px 25px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

// STYLES CSS
const cardStyle: React.CSSProperties = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' };
const inputGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const labelS: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' };
const labelTag: React.CSSProperties = { fontSize: '10px', color: '#3498db', fontWeight: 'bold', letterSpacing: '1px' };
const btnStyle: React.CSSProperties = { padding: '12px 20px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.3s' };
const btnSmall: React.CSSProperties = { background: '#3498db', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' };
const pageBtn: React.CSSProperties = { padding: '8px 15px', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', background: 'white' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tdStyle: React.CSSProperties = { padding: '15px', textAlign: 'left' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(44, 62, 80, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const popupStyle: React.CSSProperties = { background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' };