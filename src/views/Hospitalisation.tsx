import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../lib/db";

export default function HospitalisationView() {
  const [activeTab, setActiveTab] = useState("gestion");
  const [chambres, setChambres] = useState<any[]>([]);
  const [selectedChambre, setSelectedChambre] = useState<any>(null);
  const [lits, setLits] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [hospisEnCours, setHospisEnCours] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [totalLitsGlobal, setTotalLitsGlobal] = useState(0);

  // --- ÉTATS ADMISSION ---
  const [searchCarnet, setSearchCarnet] = useState("");
  const [patientTrouve, setPatientTrouve] = useState<any>(null);
  const [selectedLitId, setSelectedLitId] = useState("");
  const [nbJours, setNbJours] = useState(1);
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().split('T')[0]);

  // --- ÉTATS MODIFICATION ---
  const [hospiEnModif, setHospiEnModif] = useState<any>(null);
  const [modifLitId, setModifLitId] = useState("");
  const [modifNbJours, setModifNbJours] = useState(1);
  const [modifDateEntree, setModifDateEntree] = useState("");

  // --- ÉTATS LIBÉRATION ---
  const [hospiEnLiberation, setHospiEnLiberation] = useState<any>(null);
  const [dateSortie, setDateSortie] = useState(new Date().toISOString().split('T')[0]);

  // --- ÉTATS RECHERCHE ET PAGINATION ---
  const [searchHospi, setSearchHospi] = useState("");
  const [searchArchive, setSearchArchive] = useState("");
  const [pageHospi, setPageHospi] = useState(1);
  const [pageArchive, setPageArchive] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // --- ÉTATS FORMULAIRES ---
  const [nomChambre, setNomChambre] = useState("");
  const [nomLit, setNomLit] = useState("");
  const [prixLit, setPrixLit] = useState<number | string>("");

  const chargerInitial = async () => {
    try {
      const db = await getDb();

      console.log("🔄 === DÉBUT CHARGEMENT ===");

      // CORRECTION AUTOMATIQUE : Mettre la date du jour pour les admissions sans date
      await db.execute(`
        UPDATE admissions 
        SET date_entree = CURDATE() 
        WHERE statut = 'en_cours' AND (date_entree IS NULL OR date_entree = '')
      `);

      // Charger toutes les données sans toucher aux statuts
      const resC = await db.select<any[]>("SELECT * FROM chambres ORDER BY nom ASC");
      const resP = await db.select<any[]>("SELECT id, numero_carnet, nom_prenoms FROM patients");

      const resH = await db.select<any[]>(`
        SELECT a.id as admission_id, DATE(a.date_entree) as date_entree, a.nb_jours, p.nom_prenoms, p.numero_carnet, 
               l.nom_lit, l.id as lit_id, c.nom as nom_chambre, c.id as chambre_id, l.prix_journalier
        FROM admissions a
        JOIN lits l ON a.lit_id = l.id
        JOIN patients p ON a.patient_id = p.id
        JOIN chambres c ON l.chambre_id = c.id
        WHERE a.statut = 'en_cours'
      `);

      console.log(`📋 ${resH.length} admissions en cours:`, resH);

      const resA = await db.select<any[]>(`
        SELECT a.*, p.nom_prenoms, p.numero_carnet, l.nom_lit, c.nom as nom_chambre, 
               DATE(a.date_entree) as date_entree, DATE(a.date_sortie) as date_sortie
        FROM admissions a
        JOIN lits l ON a.lit_id = l.id
        JOIN patients p ON a.patient_id = p.id
        JOIN chambres c ON l.chambre_id = c.id
        WHERE a.statut = 'termine'
        ORDER BY a.date_entree DESC
      `);

      const resCount = await db.select<any[]>("SELECT COUNT(*) as total FROM lits");

      setChambres(resC);
      setPatients(resP);
      setHospisEnCours(resH);
      setArchives(resA);
      setTotalLitsGlobal(resCount[0]?.total || 0);

      console.log("✅ Données chargées");
      console.log("🔄 === FIN CHARGEMENT ===");
    } catch (e) {
      console.error("❌ ERREUR lors du chargement:", e);
    }
  };

  const chargerLits = async (chambre: any) => {
    try {
      const db = await getDb();
      console.log(`🚪 === CHARGEMENT DES LITS DE ${chambre.nom} ===`);

      // Charger les lits de base
      const resL = await db.select<any[]>(`
        SELECT l.id, l.chambre_id, l.nom_lit, l.prix_journalier, l.statut
        FROM lits l 
        WHERE l.chambre_id = ?
        ORDER BY l.nom_lit ASC
      `, [chambre.id]);

      console.log("🛏️ Lits chargés depuis DB:", resL);

      // CRUCIAL : Calculer le vrai statut basé sur hospisEnCours (état React)
      const litsAvecStatutReel = resL.map(lit => {
        // Vérifier si ce lit a une admission en cours
        const estOccupe = hospisEnCours.some(h => h.lit_id === lit.id);

        return {
          ...lit,
          statut: estOccupe ? 'occupe' : 'disponible' // Forcer le vrai statut
        };
      });

      console.log("🛏️ Lits avec statut calculé:", litsAvecStatutReel);

      // Afficher le statut de chaque lit
      litsAvecStatutReel.forEach(lit => {
        const status = lit.statut?.toLowerCase();
        console.log(`  - ${lit.nom_lit}: ${status === 'occupe' ? '🔴 OCCUPE' : '🟢 LIBRE'}`);
      });

      setLits(litsAvecStatutReel);
      setSelectedChambre(chambre);
      setSelectedLitId("");

      console.log(`🚪 === FIN CHARGEMENT ${chambre.nom} ===`);
    } catch (e) {
      console.error("❌ Erreur chargement lits:", e);
    }
  };

  useEffect(() => { chargerInitial(); }, []);

  useEffect(() => {
    if (searchCarnet.trim() === "") {
      setPatientTrouve(null);
    } else {
      const p = patients.find(pat => pat.numero_carnet?.toLowerCase().trim() === searchCarnet.toLowerCase().trim());

      if (p) {
        // Vérifier si le patient est déjà hospitalisé (par ID patient, pas par numéro carnet)
        const dejaHospitalise = hospisEnCours.some(h => h.numero_carnet === p.numero_carnet);

        if (dejaHospitalise) {
          setPatientTrouve({ ...p, dejaHospitalise: true });
        } else {
          setPatientTrouve({ ...p, dejaHospitalise: false });
        }
      } else {
        setPatientTrouve(null);
      }
    }
  }, [searchCarnet, patients, hospisEnCours]);

  const addChambre = async () => {
    if (!nomChambre) return;
    const db = await getDb();
    await db.execute("INSERT INTO chambres (nom) VALUES (?)", [nomChambre]);
    setNomChambre(""); chargerInitial();
  };

  const addLit = async () => {
    if (!nomLit || !prixLit || !selectedChambre) return;
    const db = await getDb();
    await db.execute("INSERT INTO lits (chambre_id, nom_lit, prix_journalier, statut) VALUES (?, ?, ?, 'disponible')",
      [selectedChambre.id, nomLit, prixLit]);
    setNomLit(""); setPrixLit("");
    await chargerInitial();
    await chargerLits(selectedChambre);
  };

  const validerAdmission = async () => {
    if (!patientTrouve || !selectedLitId) return alert("Veuillez sélectionner un lit !");

    // Vérifier si le patient est déjà hospitalisé
    if (patientTrouve.dejaHospitalise) {
      return alert("⚠️ Ce patient est déjà hospitalisé dans une autre chambre !");
    }

    try {
      const db = await getDb();

      console.log("🔍 Avant admission - Lit ID:", selectedLitId);

      // Enregistrement admission avec date (le statut sera calculé dynamiquement)
      await db.execute("INSERT INTO admissions (patient_id, lit_id, nb_jours, date_entree, statut) VALUES (?,?,?,?, 'en_cours')",
        [patientTrouve.id, selectedLitId, nbJours, dateEntree]);

      console.log("✅ Admission enregistrée - Le statut sera calculé automatiquement");

      alert("Admission confirmée !");

      // Rafraîchir
      setSearchCarnet("");
      setSelectedLitId("");
      setDateEntree(new Date().toISOString().split('T')[0]);
      await chargerInitial();
      if (selectedChambre) await chargerLits(selectedChambre);

      console.log("✅ Rafraîchissement terminé");
    } catch (error) {
      console.error("❌ Erreur lors de l'admission:", error);
      alert("Erreur lors de l'admission : " + error);
    }
  };

  const ouvrirModification = (hospi: any) => {
    setHospiEnModif(hospi);
    setModifLitId(hospi.lit_id.toString());
    setModifNbJours(hospi.nb_jours || 1);
    setModifDateEntree(hospi.date_entree ? hospi.date_entree.split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  const annulerModification = () => {
    setHospiEnModif(null);
    setModifLitId("");
    setModifNbJours(1);
    setModifDateEntree("");
  };

  const validerModification = async () => {
    if (!hospiEnModif || !modifLitId) return alert("Données invalides !");

    const db = await getDb();

    try {
      // Si changement de lit
      if (modifLitId !== hospiEnModif.lit_id.toString()) {
        // Libérer ancien lit
        await db.execute("UPDATE lits SET statut = 'disponible' WHERE id = ?", [hospiEnModif.lit_id]);
        // Occuper nouveau lit
        await db.execute("UPDATE lits SET statut = 'occupe' WHERE id = ?", [modifLitId]);
      }

      // Mettre à jour l'admission
      await db.execute(
        "UPDATE admissions SET lit_id = ?, nb_jours = ?, date_entree = ? WHERE id = ?",
        [modifLitId, modifNbJours, modifDateEntree, hospiEnModif.admission_id]
      );

      alert("Modification effectuée !");
      annulerModification();
      await chargerInitial();
      if (selectedChambre) await chargerLits(selectedChambre);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la modification");
    }
  };

  const ouvrirLiberation = (hospi: any) => {
    setHospiEnLiberation(hospi);
    setDateSortie(new Date().toISOString().split('T')[0]);
  };

  const annulerLiberation = () => {
    setHospiEnLiberation(null);
    setDateSortie(new Date().toISOString().split('T')[0]);
  };

  const validerLiberation = async () => {
    if (!hospiEnLiberation || !dateSortie) return alert("Date de sortie requise !");

    const db = await getDb();

    try {
      // Mettre à jour l'admission avec la date de sortie
      await db.execute(
        "UPDATE admissions SET statut = 'termine', date_sortie = ? WHERE id = ?",
        [dateSortie, hospiEnLiberation.admission_id]
      );

      alert("Patient libéré avec succès !");
      annulerLiberation();
      await chargerInitial();
      if (selectedChambre) await chargerLits(selectedChambre);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la libération");
    }
  };


  // Fonction pour obtenir tous les lits disponibles (pour la modification)
  const getLitsDisponiblesPourModif = () => {
    if (!hospiEnModif) return [];

    return lits.filter(l => {
      // Un lit est disponible pour modification si :
      // 1. C'est le lit actuel du patient OU
      // 2. Son statut n'est pas 'occupe'
      const isCurrentLit = l.id === hospiEnModif.lit_id;
      const status = l.statut?.toLowerCase();

      return isCurrentLit || status !== 'occupe';
    });
  };

  // Filtrage et pagination pour hospitalisations en cours
  const getHospisFiltrees = () => {
    let filtered = hospisEnCours;

    // Filtrer par recherche
    if (searchHospi.trim()) {
      const search = searchHospi.toLowerCase();
      filtered = filtered.filter(h =>
        h.nom_prenoms?.toLowerCase().includes(search) ||
        h.numero_carnet?.toLowerCase().includes(search) ||
        h.nom_chambre?.toLowerCase().includes(search) ||
        h.nom_lit?.toLowerCase().includes(search)
      );
    }

    // Paginer
    const startIndex = (pageHospi - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    return {
      data: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE)
    };
  };

  // Filtrage et pagination pour archives
  const getArchivesFiltrees = () => {
    let filtered = archives;

    // Filtrer par recherche
    if (searchArchive.trim()) {
      const search = searchArchive.toLowerCase();
      filtered = filtered.filter(h =>
        h.nom_prenoms?.toLowerCase().includes(search) ||
        h.numero_carnet?.toLowerCase().includes(search) ||
        h.nom_chambre?.toLowerCase().includes(search) ||
        h.nom_lit?.toLowerCase().includes(search)
      );
    }

    // Paginer
    const startIndex = (pageArchive - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    return {
      data: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE)
    };
  };

  return (
    <div style={{ padding: '10px' }}>
      {/* INDICATEURS HAUT DROITE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🏨 Hospitalisation</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={statBox}>🟢 Libres : <strong>{totalLitsGlobal - hospisEnCours.length}</strong></div>
          <div style={{ ...statBox, background: '#fdecea', color: '#e74c3c' }}>🔴 Occupés : <strong>{hospisEnCours.length}</strong></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
        <button onClick={() => setActiveTab("gestion")} style={activeTab === "gestion" ? tabActive : tabNormal}>🛠️ Gestion & Admissions</button>
        <button onClick={() => setActiveTab("liste")} style={activeTab === "liste" ? tabActive : tabNormal}>📋 Patients Hospitalisés</button>
        <button onClick={() => setActiveTab("archives")} style={activeTab === "archives" ? tabActive : tabNormal}>📂 Archives</button>
      </div>

      {activeTab === "gestion" && (
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* SIDEBAR CHAMBRES AVEC INDICATEURS */}
          <div style={{ width: '350px' }}>
            <div style={cardStyle}>
              <h3>📁 Chambres</h3>
              <div style={{ display: 'flex', gap: '5px', margin: '15px 0' }}>
                <input placeholder="Nouvelle chambre" value={nomChambre} onChange={e => setNomChambre(e.target.value)} style={inputStyle} />
                <button onClick={addChambre} style={btnPlus}>+</button>
              </div>
              {chambres.map(c => (
                <div key={c.id} onClick={() => chargerLits(c)} style={{
                  ...itemStyle,
                  background: selectedChambre?.id === c.id ? '#3498db' : '#f8f9fa',
                  color: selectedChambre?.id === c.id ? 'white' : '#333',
                  cursor: 'pointer'
                }}>
                  🚪 {c.nom}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {selectedChambre ? (
              <>
                {/* LISTE VISUELLE DES LITS */}
                <div style={cardStyle}>
                  <h3>🛏️ Lits de {selectedChambre.nom}</h3>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <input placeholder="Nom lit" value={nomLit} onChange={e => setNomLit(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="Prix/Jour" value={prixLit} onChange={e => setPrixLit(e.target.value)} style={inputStyle} />
                    <button onClick={addLit} style={btnOk}>Ajouter</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {lits.map(l => {
                      // Un lit est occupé si son statut est 'occupe'
                      const isOccupied = l.statut?.toLowerCase() === 'occupe';
                      return (
                        <div key={l.id} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: isOccupied ? '#fff5f5' : '#f0fff4' }}>
                          <strong>{l.nom_lit}</strong><br />
                          <small>{(l.prix_journalier || 0).toLocaleString()} F/j</small>
                          {isOccupied ?
                            <div style={{ color: 'red', fontSize: '0.7rem', fontWeight: 'bold' }}>🔴 INDISPONIBLE</div> :
                            <div style={{ color: 'green', fontSize: '0.7rem', fontWeight: 'bold' }}>🟢 LIBRE</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* FORMULAIRE ADMISSION AVEC DATE */}
                <div style={{ ...cardStyle, marginTop: '20px', borderLeft: '10px solid #f1c40f' }}>
                  <h3>📝 Admission dans {selectedChambre.nom}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.2fr 0.8fr 0.8fr auto', gap: '10px', alignItems: 'flex-end' }}>
                    <div><label style={labelS}>Code Carnet</label><input value={searchCarnet} onChange={e => setSearchCarnet(e.target.value)} style={inputStyle} /></div>
                    <div>
                      <label style={labelS}>Patient</label>
                      <input
                        value={patientTrouve ? patientTrouve.nom_prenoms : "..."}
                        readOnly
                        style={{
                          ...inputStyle,
                          background: patientTrouve?.dejaHospitalise ? '#fdecea' : '#eee',
                          color: patientTrouve?.dejaHospitalise ? '#e74c3c' : '#333',
                          fontWeight: patientTrouve?.dejaHospitalise ? 'bold' : 'normal'
                        }}
                      />
                      {patientTrouve?.dejaHospitalise && (
                        <small style={{ color: '#e74c3c', fontSize: '0.7rem', fontWeight: 'bold' }}>⚠️ Déjà hospitalisé</small>
                      )}
                    </div>
                    <div>
                      <label style={labelS}>Lit disponible</label>
                      <select value={selectedLitId} onChange={e => setSelectedLitId(e.target.value)} style={inputStyle}>
                        <option value="">-- Choisir lit --</option>
                        {lits.filter(l => {
                          // Un lit est disponible si son statut n'est PAS 'occupe'
                          const status = l.statut?.toLowerCase();
                          return status !== 'occupe';
                        }).map(l => (
                          <option key={l.id} value={l.id}>{l.nom_lit}</option>
                        ))}
                      </select>
                    </div>
                    <div><label style={labelS}>Date</label><input type="date" value={dateEntree} onChange={e => setDateEntree(e.target.value)} style={inputStyle} /></div>
                    <div><label style={labelS}>Nb Jours</label><input type="number" value={nbJours} onChange={e => setNbJours(parseInt(e.target.value))} style={inputStyle} min="1" /></div>
                    <button
                      onClick={validerAdmission}
                      disabled={!patientTrouve || !selectedLitId || patientTrouve?.dejaHospitalise}
                      style={{
                        ...btnOk,
                        background: (patientTrouve && selectedLitId && !patientTrouve?.dejaHospitalise) ? '#f1c40f' : '#ccc',
                        color: '#333',
                        cursor: (patientTrouve?.dejaHospitalise) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              </>
            ) : <p style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>Sélectionnez une chambre à gauche.</p>}
          </div>
        </div>
      )}

      {/* ONGLET LISTE AVEC MODIFICATION, LIBÉRATION, RECHERCHE ET PAGINATION */}
      {activeTab === "liste" && (() => {
        const hospisFiltrees = getHospisFiltrees();

        return (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>🛋️ Hospitalisations actives ({hospisFiltrees.total} résultat{hospisFiltrees.total > 1 ? 's' : ''})</h3>
              <input
                type="text"
                placeholder="🔍 Rechercher par patient, carnet, chambre..."
                value={searchHospi}
                onChange={e => { setSearchHospi(e.target.value); setPageHospi(1); }}
                style={{ ...inputStyle, width: '350px' }}
              />
            </div>

            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#2c3e50', color: 'white' }}>
                  <th style={tdStyle}>Patient</th>
                  <th style={tdStyle}>Chambre / Lit</th>
                  <th style={tdStyle}>Date d'entrée</th>
                  <th style={tdStyle}>Nb Jours</th>
                  <th style={tdStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospisFiltrees.data.map(h => (
                  <>
                    {hospiEnModif?.admission_id === h.admission_id ? (
                      // MODE MODIFICATION
                      <tr style={{ background: '#fff3cd', borderBottom: '2px solid #ffc107' }}>
                        <td style={tdStyle}>
                          <strong>{h.nom_prenoms}</strong><br />
                          <small>{h.numero_carnet}</small>
                        </td>
                        <td style={tdStyle}>
                          <select value={modifLitId} onChange={e => setModifLitId(e.target.value)} style={{ ...inputStyle, fontSize: '0.85rem' }}>
                            {getLitsDisponiblesPourModif().map(l => (
                              <option key={l.id} value={l.id}>{l.chambre_id === h.chambre_id ? l.nom_lit : `${l.nom_lit} (autre chambre)`}</option>
                            ))}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <input type="date" value={modifDateEntree} onChange={e => setModifDateEntree(e.target.value)} style={{ ...inputStyle, fontSize: '0.85rem' }} />
                        </td>
                        <td style={tdStyle}>
                          <input type="number" value={modifNbJours} onChange={e => setModifNbJours(parseInt(e.target.value))} style={{ ...inputStyle, fontSize: '0.85rem', width: '60px' }} min="1" />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={validerModification} style={btnSave}>✓</button>
                            <button onClick={annulerModification} style={btnCancel}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ) : hospiEnLiberation?.admission_id === h.admission_id ? (
                      // MODE LIBÉRATION
                      <tr style={{ background: '#fdecea', borderBottom: '2px solid #e74c3c' }}>
                        <td style={tdStyle}>
                          <strong>{h.nom_prenoms}</strong><br />
                          <small>{h.numero_carnet}</small>
                        </td>
                        <td style={tdStyle}>{h.nom_chambre} / {h.nom_lit}</td>
                        <td style={tdStyle}>
                          {(() => {
                            if (!h.date_entree) return 'Date non définie';
                            try {
                              const dateStr = String(h.date_entree).split(' ')[0];
                              const [year, month, day] = dateStr.split('-');
                              if (year && month && day) {
                                return `${day}/${month}/${year}`;
                              }
                              return 'Date invalide';
                            } catch {
                              return 'Date invalide';
                            }
                          })()}
                        </td>
                        <td style={tdStyle}>
                          <div>
                            <label style={{ ...labelS, marginBottom: '2px' }}>Date de sortie</label>
                            <input
                              type="date"
                              value={dateSortie}
                              onChange={e => setDateSortie(e.target.value)}
                              style={{ ...inputStyle, fontSize: '0.85rem', width: '140px' }}
                            />
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={validerLiberation} style={{ ...btnSave, background: '#e74c3c' }}>✓ Libérer</button>
                            <button onClick={annulerLiberation} style={btnCancel}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // MODE NORMAL
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <td style={tdStyle}>
                          <strong>{h.nom_prenoms}</strong><br />
                          <small>{h.numero_carnet}</small>
                        </td>
                        <td style={tdStyle}>{h.nom_chambre} / {h.nom_lit}</td>
                        <td style={tdStyle}>
                          {(() => {
                            if (!h.date_entree) return 'Date non définie';
                            try {
                              // Extraire juste la partie date si c'est un DATETIME
                              const dateStr = String(h.date_entree).split(' ')[0];
                              const [year, month, day] = dateStr.split('-');
                              if (year && month && day) {
                                return `${day}/${month}/${year}`;
                              }
                              return 'Date invalide';
                            } catch {
                              return 'Date invalide';
                            }
                          })()}
                        </td>
                        <td style={tdStyle}>{h.nb_jours} jour(s)</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => ouvrirModification(h)} style={btnEdit}>✏️ Modifier</button>
                            <button onClick={() => ouvrirLiberation(h)} style={btnDelete}>🚪 Libérer</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* PAGINATION HOSPITALISATIONS */}
            {hospisFiltrees.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => setPageHospi(p => Math.max(1, p - 1))}
                  disabled={pageHospi === 1}
                  style={{ ...btnEdit, opacity: pageHospi === 1 ? 0.5 : 1, cursor: pageHospi === 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Précédent
                </button>
                <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                  Page {pageHospi} sur {hospisFiltrees.totalPages}
                </span>
                <button
                  onClick={() => setPageHospi(p => Math.min(hospisFiltrees.totalPages, p + 1))}
                  disabled={pageHospi === hospisFiltrees.totalPages}
                  style={{ ...btnEdit, opacity: pageHospi === hospisFiltrees.totalPages ? 0.5 : 1, cursor: pageHospi === hospisFiltrees.totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Suivant →
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === "archives" && (() => {
        const archivesFiltrees = getArchivesFiltrees();

        return (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>📚 Archives ({archivesFiltrees.total} résultat{archivesFiltrees.total > 1 ? 's' : ''})</h3>
              <input
                type="text"
                placeholder="🔍 Rechercher par patient, carnet, chambre..."
                value={searchArchive}
                onChange={e => { setSearchArchive(e.target.value); setPageArchive(1); }}
                style={{ ...inputStyle, width: '350px' }}
              />
            </div>

            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#95a5a6', color: 'white' }}>
                  <th style={tdStyle}>Patient</th>
                  <th style={tdStyle}>Chambre / Lit</th>
                  <th style={tdStyle}>Date d'entrée</th>
                  <th style={tdStyle}>Date de sortie</th>
                  <th style={tdStyle}>Nb Jours</th>
                </tr>
              </thead>
              <tbody>
                {archivesFiltrees.data.map(h => {
                  const formatDate = (dateStr: any) => {
                    if (!dateStr) return '-';
                    try {
                      const datePart = String(dateStr).split(' ')[0];
                      const [year, month, day] = datePart.split('-');
                      if (year && month && day) {
                        return `${day}/${month}/${year}`;
                      }
                      return 'Date invalide';
                    } catch {
                      return 'Date invalide';
                    }
                  };

                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{h.nom_prenoms}</td>
                      <td style={tdStyle}>{h.nom_chambre} / {h.nom_lit}</td>
                      <td style={tdStyle}>{formatDate(h.date_entree)}</td>
                      <td style={tdStyle}>{formatDate(h.date_sortie)}</td>
                      <td style={tdStyle}>{h.nb_jours} jour(s)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PAGINATION ARCHIVES */}
            {archivesFiltrees.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => setPageArchive(p => Math.max(1, p - 1))}
                  disabled={pageArchive === 1}
                  style={{ ...btnEdit, opacity: pageArchive === 1 ? 0.5 : 1, cursor: pageArchive === 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Précédent
                </button>
                <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                  Page {pageArchive} sur {archivesFiltrees.totalPages}
                </span>
                <button
                  onClick={() => setPageArchive(p => Math.min(archivesFiltrees.totalPages, p + 1))}
                  disabled={pageArchive === archivesFiltrees.totalPages}
                  style={{ ...btnEdit, opacity: pageArchive === archivesFiltrees.totalPages ? 0.5 : 1, cursor: pageArchive === archivesFiltrees.totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Suivant →
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// --- STYLES ---
const cardStyle: CSSProperties = { background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const inputStyle: CSSProperties = { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' };
const labelS: CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '5px' };
const itemStyle: CSSProperties = { padding: '10px', borderRadius: '8px', marginBottom: '5px' };
const btnPlus = { background: '#3498db', color: 'white', border: 'none', padding: '0 15px', borderRadius: '5px', cursor: 'pointer', height: '35px' };
const btnOk = { background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnEdit = { background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' };
const btnDelete = { background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' };
const btnSave = { background: '#27ae60', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancel = { background: '#95a5a6', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const statBox: CSSProperties = { background: '#e8f6ef', color: '#27ae60', padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const tabNormal: CSSProperties = { padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#7f8c8d' };
const tabActive: CSSProperties = { ...tabNormal, color: '#3498db', borderBottom: '2px solid #3498db', fontWeight: 'bold' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tdStyle: CSSProperties = { padding: '12px', textAlign: 'left' };
