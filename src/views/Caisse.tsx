import React, { useState, useEffect } from "react";
import { getDb } from "../lib/db";

export default function CaisseView() {
  // --- ÉTATS DONNÉES ---
  const [patients, setPatients] = useState<any[]>([]);
  const [prestations, setPrestations] = useState<any[]>([]);

  // --- ÉTATS RECHERCHE & SÉLECTION ---
  const [searchCarnet, setSearchCarnet] = useState("");
  const [patientSelectionne, setPatientSelectionne] = useState<any>(null);
  const [panier, setPanier] = useState<any[]>([]);

  // --- ÉTATS PAIEMENT ---
  const [modePaiement, setModePaiement] = useState("CASH");

  const chargerInitial = async () => {
    try {
      const db = await getDb();

      // Charger patients avec assurance ET hospitalisation
      const resP = await db.select<any[]>(`
        SELECT p.*, 
               a.nom as nom_assurance, 
               p.taux_couverture,
               h.id as hospitalisation_id,
               h.date_entree as hospi_date_entree,
               l.nom_lit,
               c.nom as nom_chambre
        FROM patients p
        LEFT JOIN assurances a ON p.assurance_id = a.id
        LEFT JOIN admissions h ON p.id = h.patient_id AND h.statut = 'en_cours'
        LEFT JOIN lits l ON h.lit_id = l.id
        LEFT JOIN chambres c ON l.chambre_id = c.id
      `);

      const resA = await db.select<any[]>("SELECT * FROM prestations ORDER BY categorie, libelle ASC");

      setPatients(resP);
      setPrestations(resA);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { chargerInitial(); }, []);

  useEffect(() => {
    const p = patients.find(pat => pat.numero_carnet?.toLowerCase().trim() === searchCarnet.toLowerCase().trim());
    setPatientSelectionne(p || null);

    if (!p) {
      setPanier([]);
    } else {
      // Si le patient est hospitalisé, ajouter automatiquement les frais d'hospitalisation
      if (p.hospitalisation_id) {
        ajouterFraisHospitalisation(p);
      } else {
        setPanier([]);
      }
    }
  }, [searchCarnet, patients]);

  // Fonction pour ajouter les frais d'hospitalisation au panier
  const ajouterFraisHospitalisation = async (patient: any) => {
    try {
      const db = await getDb();

      // Récupérer les détails de l'hospitalisation
      const resHospi = await db.select<any[]>(`
        SELECT a.nb_jours, a.mode_tarif, 
               l.prix_journalier, l.prix_assurance, l.prix_ventile, l.prix_ventile_assurance,
               l.nom_lit, c.nom as nom_chambre
        FROM admissions a
        JOIN lits l ON a.lit_id = l.id
        JOIN chambres c ON l.chambre_id = c.id
        WHERE a.id = ? AND a.statut = 'en_cours'
      `, [patient.hospitalisation_id]);

      if (resHospi.length > 0) {
        const hospi = resHospi[0];
        const taux = patient.taux_couverture || 0;
        const useAssur = taux > 0;
        const isVentile = hospi.mode_tarif === 'VENTILE';

        const panierItems: any[] = [];

        // 1. CHAMBRE
        let prixChambreJ = 0;
        if (useAssur) {
          prixChambreJ = isVentile ? (hospi.prix_ventile_assurance || hospi.prix_ventile || 0) : (hospi.prix_assurance || hospi.prix_journalier);
        } else {
          prixChambreJ = isVentile ? (hospi.prix_ventile || hospi.prix_journalier) : hospi.prix_journalier;
        }
        const totalChambre = prixChambreJ * hospi.nb_jours;
        const partChambreAssur = useAssur ? Math.round((totalChambre * taux) / 100) : 0;

        panierItems.push({
          id: Date.now(),
          libelle: `🏥 Chambre ${isVentile ? 'Ventilée' : 'Clim'} (${hospi.nom_chambre}) - ${hospi.nb_jours}j`,
          total: totalChambre,
          useAssurance: useAssur,
          partAssureur: partChambreAssur,
          partPatient: totalChambre - partChambreAssur,
          isHospitalisation: true
        });

        // 2. AMI (Assistance Médicale)
        const prixAMIJ = useAssur ? 8000 : 4000;
        const totalAMI = prixAMIJ * hospi.nb_jours;
        const partAMIAssur = useAssur ? Math.round((totalAMI * taux) / 100) : 0; // AMI is covered? Assumed yes.
        // Wait, AMI 8000 for Assurance usually means 8000 covered or base? 
        // Logic: Tariff is 8000 if insured. Then apply coverage %? Or 8000 IS the covered part?
        // Usually: Base price changes. Then we apply %.

        panierItems.push({
          id: Date.now() + 1,
          libelle: `👩‍⚕️ AMI (${hospi.nb_jours}j x ${prixAMIJ})`,
          total: totalAMI,
          useAssurance: useAssur,
          partAssureur: partAMIAssur,
          partPatient: totalAMI - partAMIAssur,
          isHospitalisation: true
        });

        // 3. VISITE MEDICALE
        // Cash: 1000/j. Assurance: 4000/j (A partir de J2).
        let totalVisite = 0;
        let libelleVisite = "";

        if (useAssur) {
          const joursFact = Math.max(0, hospi.nb_jours - 1);
          totalVisite = joursFact * 4000;
          libelleVisite = `👨‍⚕️ Visite Médicale (${joursFact}j x 4000)`;
        } else {
          totalVisite = hospi.nb_jours * 1000;
          libelleVisite = `👨‍⚕️ Visite Médicale (${hospi.nb_jours}j x 1000)`;
        }

        if (totalVisite > 0) {
          const partVisiteAssur = useAssur ? Math.round((totalVisite * taux) / 100) : 0;
          panierItems.push({
            id: Date.now() + 2,
            libelle: libelleVisite,
            total: totalVisite,
            useAssurance: useAssur,
            partAssureur: partVisiteAssur,
            partPatient: totalVisite - partVisiteAssur,
            isHospitalisation: true
          });
        }

        // 4. KIT PERFUSION (Automatique 1 fois)
        // On récupère le prix depuis prestations ou défaut 5000
        const kitPriceRes = await db.select<any[]>("SELECT prix_standard, prix_assurance FROM prestations WHERE libelle LIKE 'Kit Perfusion%' LIMIT 1");
        let kitPrice = 5000;
        if (kitPriceRes.length > 0) {
          kitPrice = useAssur ? (kitPriceRes[0].prix_assurance || kitPriceRes[0].prix_standard) : kitPriceRes[0].prix_standard;
        }

        const partKitAssur = useAssur ? Math.round((kitPrice * taux) / 100) : 0;
        panierItems.push({
          id: Date.now() + 3,
          libelle: `💉 Kit Perfusion (Systématique)`,
          total: kitPrice,
          useAssurance: useAssur,
          partAssureur: partKitAssur,
          partPatient: kitPrice - partKitAssur,
          isHospitalisation: true
        });

        // 5. CONSOMMABLES & SOINS (admission_prestations)
        const consos = await db.select<any[]>("SELECT * FROM admission_prestations WHERE admission_id = ?", [patient.hospitalisation_id]);
        consos.forEach((c, idx) => {
          if (c.libelle.toLowerCase().includes('kit perfusion')) return; // Déjà ajouté automatiquement

          const total = c.prix_unitaire * c.quantite;
          const partAssurC = useAssur ? Math.round((total * taux) / 100) : 0;
          panierItems.push({
            id: Date.now() + 10 + idx,
            libelle: `💊 ${c.libelle} (x${c.quantite})`,
            total: total,
            useAssurance: useAssur,
            partAssureur: partAssurC,
            partPatient: total - partAssurC,
            isHospitalisation: true
          });
        });

        setPanier(panierItems);
      }
    } catch (e) {
      console.error("Erreur chargement frais hospitalisation:", e);
      setPanier([]);
    }
  };

  // --- LOGIQUE D'ASSURANCE ---
  const getTauxAssurance = () => {
    return patientSelectionne?.taux_couverture || 0;
  };

  const ajouterAuPanier = (acte: any) => {
    const taux = getTauxAssurance();
    // L'assurance est appliquée UNIQUEMENT si le patient en a une (taux > 0)
    const useAssur = taux > 0;
    const partAssur = useAssur ? Math.round((acte.prix_standard * taux) / 100) : 0;

    const item = {
      id: Date.now() + Math.random(),
      libelle: acte.libelle,
      total: acte.prix_standard,
      useAssurance: useAssur,
      partAssureur: partAssur,
      partPatient: acte.prix_standard - partAssur,
      isHospitalisation: false
    };
    setPanier([...panier, item]);
  };

  // Basculer l'assurance pour un seul item
  const basculerAssuranceItem = (id: number) => {
    const taux = getTauxAssurance();
    setPanier(panier.map(item => {
      if (item.id === id) {
        const nouveauStatut = !item.useAssurance;
        const partAssur = nouveauStatut ? Math.round((item.total * taux) / 100) : 0;
        return {
          ...item,
          useAssurance: nouveauStatut,
          partAssureur: partAssur,
          partPatient: item.total - partAssur
        };
      }
      return item;
    }));
  };

  // Appliquer l'assurance à tout le panier
  const appliquerAssuranceATout = (appliquer: boolean) => {
    const taux = getTauxAssurance();
    setPanier(panier.map(item => {
      const partAssur = appliquer ? Math.round((item.total * taux) / 100) : 0;
      return {
        ...item,
        useAssurance: appliquer,
        partAssureur: partAssur,
        partPatient: item.total - partAssur
      };
    }));
  };

  const supprimerDuPanier = (id: number) => {
    setPanier(panier.filter(i => i.id !== id));
  };

  // Totaux
  const totalFacture = panier.reduce((sum, i) => sum + i.total, 0);
  const totalAssurance = panier.reduce((sum, i) => sum + i.partAssureur, 0);
  const totalAPayer = panier.reduce((sum, i) => sum + i.partPatient, 0);

  const validerPaiement = async () => {
    if (panier.length === 0) return alert("Le panier est vide");
    try {
      const db = await getDb();
      for (const item of panier) {
        await db.execute(
          "INSERT INTO ventes (patient_id, acte_libelle, montant_total, part_patient, part_assureur, mode_paiement) VALUES (?,?,?,?,?,?)",
          [patientSelectionne.id, item.libelle, item.total, item.partPatient, item.partAssureur, modePaiement]
        );
      }
      alert("Facture encaissée !");
      setPanier([]);
      setSearchCarnet("");
    } catch (e) { console.error(e); }
  };

  // Groupement des prestations par catégorie pour l'affichage
  const prestationsParCategorie = prestations.reduce((acc: any, p: any) => {
    const cat = p.categorie || "AUTRES";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div style={{ padding: '10px' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>💰 Caisse & Facturation</h1>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* --- COLONNE GAUCHE : SÉLECTION PATIENT ET ACTES --- */}
        <div style={{ flex: 1.3 }}>
          <div style={cardStyle}>
            <h3>🔍 Identification Patient</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelS}>Code Carnet</label>
                <input
                  placeholder="N° Carnet..."
                  value={searchCarnet}
                  onChange={e => setSearchCarnet(e.target.value)}
                  style={{ ...inputStyle, border: '2px solid #3498db', fontSize: '1.1rem' }}
                />
              </div>
              <div style={{ flex: 2 }}>
                {patientSelectionne ? (
                  <div style={{ background: '#e8f6ef', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <strong style={{ color: '#2c3e50', fontSize: '1.1rem' }}>{patientSelectionne.nom_prenoms}</strong><br />
                    <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      🛡️ {patientSelectionne.nom_assurance ? `${patientSelectionne.nom_assurance} (${getTauxAssurance()}%)` : "PATIENT CASH (0%)"}
                    </span>

                    {/* INDICATEUR HOSPITALISATION */}
                    {patientSelectionne.hospitalisation_id && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: '#fff3cd',
                        border: '2px solid #f39c12',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🏥</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', color: '#f39c12', fontSize: '0.85rem' }}>
                            HOSPITALISÉ
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#7f8c8d' }}>
                            {patientSelectionne.nom_chambre} / {patientSelectionne.nom_lit}
                            {patientSelectionne.hospi_date_entree && (
                              <> • Depuis le {(() => {
                                try {
                                  const dateStr = String(patientSelectionne.hospi_date_entree).split(' ')[0];
                                  const [year, month, day] = dateStr.split('-');
                                  return `${day}/${month}/${year}`;
                                } catch {
                                  return 'N/A';
                                }
                              })()}</>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <span style={{ color: '#999' }}>En attente du numéro de carnet...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Liste des prestations groupées */}
          {patientSelectionne && (
            <div style={{ ...cardStyle, marginTop: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
              <h3>📜 Catalogue des prestations</h3>
              {Object.keys(prestationsParCategorie).map(cat => (
                <div key={cat} style={{ marginTop: '20px' }}>
                  <div style={categoryHeader}>{cat}</div>
                  <table style={tableStyle}>
                    <tbody>
                      {prestationsParCategorie[cat].map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ ...tdStyle, width: '60%' }}>{p.libelle}</td>
                          <td style={{ ...tdStyle, fontWeight: 'bold' }}>{p.prix_standard.toLocaleString()} F</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button onClick={() => ajouterAuPanier(p)} style={btnAdd}>Ajouter +</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- COLONNE DROITE : PANIER --- */}
        <div style={{ flex: 1 }}>
          <div style={{ ...cardStyle, borderTop: '5px solid #2ecc71', position: 'sticky', top: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>📝 Détails Facture</h3>
              {getTauxAssurance() > 0 && panier.length > 0 && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => appliquerAssuranceATout(true)} style={btnSmallAction}>Tout Assurer</button>
                  <button onClick={() => appliquerAssuranceATout(false)} style={btnSmallAction}>Tout Cash</button>
                </div>
              )}
            </div>

            <div style={{ marginTop: '15px', minHeight: '100px' }}>
              {panier.map(item => (
                <div key={item.id} style={{
                  ...cartItem,
                  background: item.isHospitalisation ? '#fff3cd' : 'transparent',
                  borderLeft: item.isHospitalisation ? '4px solid #f39c12' : 'none',
                  paddingLeft: item.isHospitalisation ? '12px' : '0'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {item.libelle}
                      {item.isHospitalisation && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#f39c12', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>AUTO</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                      {getTauxAssurance() > 0 ? (
                        <>Brut: {item.total.toLocaleString()} F | Assur: {item.partAssureur.toLocaleString()} F</>
                      ) : (
                        <>Prix: {item.total.toLocaleString()} F (Sans assurance)</>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2ecc71' }}>{item.partPatient.toLocaleString()} F</div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      {/* Bouton basculer assurance pour TOUS les items si le patient est assuré */}
                      {getTauxAssurance() > 0 && (
                        <button
                          onClick={() => basculerAssuranceItem(item.id)}
                          style={{ ...btnText, color: item.useAssurance ? '#3498db' : '#e67e22' }}
                        >
                          {item.useAssurance ? "✔️ Assuré" : "❌ Cash"}
                        </button>
                      )}
                      {/* Bouton supprimer UNIQUEMENT pour les prestations normales */}
                      {!item.isHospitalisation && (
                        <button onClick={() => supprimerDuPanier(item.id)} style={{ ...btnText, color: '#e74c3c' }}>Supprimer</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {panier.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Le panier est vide.</p>}
            </div>

            <div style={totalContainer}>
              <div style={totalRow}><span>Total Général :</span> <span>{totalFacture.toLocaleString()} F</span></div>
              {getTauxAssurance() > 0 && (
                <div style={totalRow}><span>Part Assurance ({getTauxAssurance()}%) :</span> <span style={{ color: '#3498db' }}>- {totalAssurance.toLocaleString()} F</span></div>
              )}
              <div style={{ ...totalRow, fontSize: '1.3rem', borderTop: '2px solid #ddd', marginTop: '10px', paddingTop: '10px' }}>
                <strong>À PERCEVOIR :</strong> <strong style={{ color: '#2ecc71' }}>{totalAPayer.toLocaleString()} F</strong>
              </div>
              {getTauxAssurance() === 0 && totalFacture > 0 && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#fef5e7', borderRadius: '6px', fontSize: '0.85rem', color: '#f39c12', textAlign: 'center' }}>
                  ⚠️ Patient sans assurance - Prix standard appliqués
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={labelS}>Moyen de règlement</label>
              <select value={modePaiement} onChange={e => setModePaiement(e.target.value)} style={inputStyle}>
                <option value="CASH">💵 ESPÈCES</option>
                <option value="WAVE">🌊 WAVE</option>
                <option value="ORANGE">🍊 ORANGE MONEY</option>
                <option value="MTN">🟡 MTN MONEY</option>
              </select>
            </div>

            <button
              disabled={panier.length === 0}
              onClick={validerPaiement}
              style={{ ...btnValidate, background: panier.length > 0 ? '#27ae60' : '#ccc' }}
            >
              🚀 Valider l'encaissement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const cardStyle: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', marginTop: '5px' };
const labelS: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d' };
const categoryHeader: React.CSSProperties = { background: '#2c3e50', color: 'white', padding: '8px 15px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '5px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '10px', fontSize: '14px' };
const btnAdd = { background: '#f0f7ff', color: '#3498db', border: '1px solid #3498db', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const };
const cartItem: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f1f1' };
const btnText = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' as const, padding: 0 };
const totalContainer: React.CSSProperties = { marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '10px', border: '1px solid #eee' };
const totalRow = { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' };
const btnValidate: React.CSSProperties = { width: '100%', padding: '15px', color: 'white', border: 'none', borderRadius: '12px', marginTop: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' };
const btnSmallAction = { background: '#eee', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '4px' };