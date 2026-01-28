import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import { DateTravailManager } from "../services/DateTravailManager";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardView({ setView }: { setView: (v: string) => void }) {
  const [period, setPeriod] = useState<"JOUR" | "SEMAINE" | "MOIS" | "CUSTOM">("JOUR");
  const [customDates, setCustomDates] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    caTotal: 0,
    caCash: 0,
    caCredit: 0,
    diffCaSolde: 0, // NOUVEAU: CA Total - Solde Caisse
    pharmaDayVente: 0,
    pharmaDayAchat: 0,
    pharmaDayMarge: 0,
    patientsTotal: 0,
    stockValue: 0,
    details: {}, // Map of category -> { count, montant, cash, credit }
    evolution: [],
    recouvrementTotal: 0,
    decaissementTotal: 0,
    versementTotal: 0,
    audit: []
  });

  /* ---------------------- DETAILS MODAL LOGIC ---------------------- */
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    chargerDonnees();
  }, [period, customDates]);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      let dateCondition = "";
      let cmDateCondition = "";

      // 1. Définir la période
      if (period === "JOUR") {
        const dateTravail = await DateTravailManager.getDateTravail();
        dateCondition = `DATE(v.date_vente) = '${dateTravail}' AND v.type_vente != 'RECOUVREMENT'`;
        cmDateCondition = `DATE(date_mouvement) = '${dateTravail}'`;
      } else if (period === "SEMAINE") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND v.type_vente != 'RECOUVREMENT'`;
        cmDateCondition = `date_mouvement >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
      } else if (period === "MOIS") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND v.type_vente != 'RECOUVREMENT'`;
        cmDateCondition = `date_mouvement >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
      } else {
        // CUSTOM
        dateCondition = `DATE(v.date_vente) BETWEEN '${customDates.start}' AND '${customDates.end}' AND v.type_vente != 'RECOUVREMENT'`;
        cmDateCondition = `DATE(date_mouvement) BETWEEN '${customDates.start}' AND '${customDates.end}'`;
      }

      // 2. Chiffre d'Affaires & Patients
      const resGlobal = await db.select<any[]>(`
        SELECT
            CAST(SUM(montant_total) AS CHAR) as ca,
            CAST(SUM(part_patient - reste_a_payer) AS CHAR) as cash,
            CAST(SUM(part_assureur + reste_a_payer) AS CHAR) as credit,
            COUNT(DISTINCT patient_id) as patients
        FROM ventes v
        WHERE ${dateCondition}
      `);

      // 2b. Recouvrement
      const resRecouv = await db.select<any[]>(`
        SELECT CAST(SUM(montant) AS CHAR) as total
        FROM caisse_mouvements
        WHERE type = 'RECOUVREMENT' AND ${cmDateCondition}
      `);

      // 2c. Décaissements
      const resDecaissement = await db.select<any[]>(`
        SELECT CAST(SUM(montant) AS CHAR) as total 
        FROM caisse_mouvements 
        WHERE type = 'DECAISSEMENT' AND ${cmDateCondition}
      `);

      // 2d. Versements
      const resVersement = await db.select<any[]>(`
        SELECT CAST(SUM(montant) AS CHAR) as total 
        FROM caisse_mouvements 
        WHERE type = 'VERSEMENT' AND ${cmDateCondition}
      `);

      // 3. Valeur Stock Actuelle (Toujours temps réel)
      const resStock = await db.select<any[]>(`
        SELECT 
          CAST(SUM(IFNULL(quantite_stock, 0) * IFNULL(prix_achat, 0)) AS CHAR) as val_achat,
          CAST(SUM(IFNULL(quantite_stock, 0) * IFNULL(prix_vente, 0)) AS CHAR) as val_vente,
          COUNT(*) as count 
        FROM stock_articles
      `);

      console.log("DEBUG STOCK REFETCH:", resStock);

      const stockAchat = parseFloat(resStock[0]?.val_achat || "0");
      const stockVente = parseFloat(resStock[0]?.val_vente || "0");

      // 4. Répartition détaillée par catégorie
      const resDetails = await db.select<any[]>(`
        SELECT 
            CASE 
                WHEN v.type_vente = 'HOSPITALISATION' THEN 'HOSP'
                WHEN v.type_vente = 'MEDICAMENT' THEN 'PHARMA'
                WHEN v.acte_libelle LIKE '%CONSULTATION%' OR v.acte_libelle LIKE '%VISITE%' OR v.acte_libelle LIKE '%GENERALISTE%' THEN 'CONSULT'
                WHEN v.acte_libelle LIKE '%SOIN%' OR v.acte_libelle LIKE '%INJECTION%' OR v.acte_libelle LIKE '%PANSEMENT%' THEN 'SOINS'
                ELSE 'LABO'
            END as cat,
            COUNT(*) as count,
            CAST(SUM(v.montant_total) AS CHAR) as montant,
            CAST(SUM(v.part_patient - v.reste_a_payer) AS CHAR) as cash,
            CAST(SUM(v.part_assureur + v.reste_a_payer) AS CHAR) as credit
        FROM ventes v
        WHERE ${dateCondition}
        GROUP BY cat
      `);

      // ... (Pharma Calculation and other code remains same) ...

      // 5. ... (Bottom of function) ...



      // 4b. Calcul Financier Pharmacie (Vente, Achat, Marge)
      const resPharmaSales = await db.select<any[]>(`
          SELECT
          v.acte_libelle,
          v.montant_total,
          a.prix_achat
          FROM ventes v
          LEFT JOIN stock_articles a ON v.article_id = a.id
          WHERE v.type_vente = 'MEDICAMENT' AND ${dateCondition}
          `);

      let pVente = 0;
      let pAchat = 0;

      resPharmaSales.forEach(sale => {
        const montantVente = parseFloat(sale.montant_total || 0);
        pVente += montantVente;

        // Extraction quantité "(x3)"
        const match = sale.acte_libelle.match(/\(x(\d+)\)/);
        const qte = match ? parseInt(match[1]) : 1;
        const prixAchat = parseFloat(sale.prix_achat || 0);

        pAchat += (qte * prixAchat);
      });

      console.log("PHARMA FINANCIER:", { pVente, pAchat, marge: pVente - pAchat });

      const detailsMap = resDetails.reduce((acc, curr) => {
        acc[curr.cat] = {
          count: curr.count,
          montant: parseFloat(curr.montant || "0"),
          cash: parseFloat(curr.cash || "0"),
          credit: parseFloat(curr.credit || "0")
        };
        return acc;
      }, {});

      // 5. Graphique Evolution
      let queryEvol = "";
      if (period === "JOUR") {
        queryEvol = `
            SELECT DATE_FORMAT(v.date_vente, '%H:00') as label, CAST(SUM(v.montant_total) AS CHAR) as value 
            FROM ventes v WHERE ${dateCondition} GROUP BY label ORDER BY label ASC
         `;
      } else {
        queryEvol = `
            SELECT DATE_FORMAT(v.date_vente, '%d/%m') as label, CAST(SUM(v.montant_total) AS CHAR) as value 
            FROM ventes v WHERE ${dateCondition} GROUP BY label ORDER BY v.date_vente ASC
         `;
      }
      const resEvol = await db.select<any[]>(queryEvol);

      // 6. Audit Trail
      const resAudit = await db.select<any[]>(`
          SELECT v.id, v.acte_libelle, v.montant_total, v.date_vente, u.nom_complet as user
          FROM ventes v
          LEFT JOIN app_utilisateurs u ON v.user_id = u.id
          ORDER BY v.date_vente DESC
          LIMIT 8
          `);

      setStats({
        caTotal: parseFloat(resGlobal[0]?.ca || "0"),
        caCash: parseFloat(resGlobal[0]?.cash || "0"),
        caCredit: parseFloat(resGlobal[0]?.credit || "0"),
        diffCaSolde: 0, // Sera calculé juste après
        patientsTotal: resGlobal[0]?.patients || 0,
        stockValue: stockVente,
        stockAchat: stockAchat,
        stockVente: stockVente,
        stockMarge: stockVente - stockAchat,
        pharmaDayVente: pVente,
        pharmaDayAchat: pAchat,
        pharmaDayMarge: pVente - pAchat,
        details: detailsMap,
        evolution: resEvol,
        audit: resAudit,
        recouvrementTotal: parseFloat(resRecouv[0]?.total || "0"),
        decaissementTotal: parseFloat(resDecaissement[0]?.total || "0"),
        versementTotal: parseFloat(resVersement[0]?.total || "0"),
        stockCount: resStock[0]?.count || 0
      });

    } catch (e) {
      console.error("Dashboard Error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Chargement...</div>;



  const fetchDetails = async (category: string) => {
    setSelectedDetail(category);
    setLoadingDetails(true);
    setDetailData([]);

    try {
      const db = await getDb();

      // Cas Spécial: Stock Pharmacie
      if (category === 'STOCK_PHARMA') {
        const query = `
          SELECT
          designation as libelle,
          quantite_stock as qte,
          prix_vente as prix,
          (quantite_stock * prix_vente) as total
          FROM stock_articles
          ORDER BY designation ASC
          `;
        const res = await db.select<any[]>(query);
        setDetailData(res);
        setLoadingDetails(false);
        return;
      }

      let dateCondition = "";

      // Réutiliser la logique de date (idéalement à extraire, mais dupliqué ici pour la rapidité)
      if (period === "JOUR") {
        const dateTravail = await DateTravailManager.getDateTravail();
        dateCondition = `DATE(v.date_vente) = '${dateTravail}'`;
      } else if (period === "SEMAINE") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
      } else if (period === "MOIS") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
      } else {
        dateCondition = `DATE(v.date_vente) BETWEEN '${customDates.start}' AND '${customDates.end}'`;
      }

      // Filtre catégorie
      let catCondition = "";
      switch (category) {
        case 'CONSULT': catCondition = "v.acte_libelle LIKE '%CONSULTATION%'"; break;
        case 'HOSP': catCondition = "v.type_vente = 'HOSPITALISATION'"; break;
        case 'PHARMA': catCondition = "v.type_vente = 'MEDICAMENT'"; break;
        case 'SOINS': catCondition = "(v.acte_libelle LIKE '%SOIN%' OR v.acte_libelle LIKE '%INJECTION%' OR v.acte_libelle LIKE '%PANSEMENT%')"; break;
        case 'LABO': catCondition = "(v.type_vente != 'HOSPITALISATION' AND v.type_vente != 'MEDICAMENT' AND v.acte_libelle NOT LIKE '%CONSULTATION%' AND v.acte_libelle NOT LIKE '%SOIN%' AND v.acte_libelle NOT LIKE '%INJECTION%' AND v.acte_libelle NOT LIKE '%PANSEMENT%')"; break;
        default: catCondition = "1=1";
      }

      const query = `
          SELECT
          v.id,
          v.date_vente,
          v.acte_libelle,
          v.montant_total,
          v.part_patient,
          (v.part_assureur + v.reste_a_payer) as credit,
          p.nom_prenoms as patient,
          u.nom_complet as user
          FROM ventes v
          LEFT JOIN patients p ON v.patient_id = p.id
          LEFT JOIN app_utilisateurs u ON v.user_id = u.id
          WHERE ${dateCondition} AND ${catCondition}
          ORDER BY v.date_vente DESC
          `;

      const res = await db.select<any[]>(query);
      setDetailData(res);
    } catch (e) {
      console.error("Error fetching details", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedDetail(null);
    setDetailData([]);
  };

  const getLabel = (cat: string) => {
    switch (cat) {
      case 'CONSULT': return 'Consultations';
      case 'HOSP': return 'Hospitalisations';
      case 'PHARMA': return 'Pharmacie (Ventes)';
      case 'LABO': return 'Laboratoire';
      case 'SOINS': return 'Soins Infirmiers';
      case 'STOCK_PHARMA': return 'Stock Pharmacie (Détails)';
      default: return 'Détails';
    }
  };

  /* ------------------------------------------------------------------- */

  const getStat = (key: string) => stats.details?.[key] || { count: 0, montant: 0, cash: 0, credit: 0 };
  // Solde Caisse = Cash Vente - Décaissements (Exclut Recouvrements sur demande user)
  const soldeTheorique = stats.caCash - stats.decaissementTotal;

  // ECART CAISSE = Solde Théorique (Systeme) - Versements Déclarés (Physique)
  // Positive = Manque en caisse (Theft/Loss). Negative = Trop perçu.
  const ecartCaisse = soldeTheorique - stats.versementTotal;

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', minHeight: '100%', fontFamily: '"Inter", sans-serif', position: 'relative' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '20px', fontWeight: 'bold' }}>Tableau de Bord</h1>
          <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: '13px' }}>Aperçu Global</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {period === "CUSTOM" && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', padding: '5px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <input type="date" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} style={dateInput} />
              <span style={{ color: '#9ca3af' }}>➝</span>
              <input type="date" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} style={dateInput} />
            </div>
          )}

          <div style={{ background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex' }}>
            {(["JOUR", "SEMAINE", "MOIS", "CUSTOM"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: period === p ? '#3b82f6' : 'transparent',
                  color: period === p ? 'white' : '#6b7280',
                  fontSize: '12px', fontWeight: '600', transition: '0.2s'
                }}
              >
                {p === "CUSTOM" ? "📅 PÉRIODE" : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <KpiCard title="Chiffre d'Affaires" value={`${stats.caTotal.toLocaleString()} Fr`} sub={`Cash: ${stats.caCash.toLocaleString()} | Crédit: ${stats.caCredit.toLocaleString()}`} icon="💰" color="#3b82f6" onClick={() => setView('caisse')} />
        <KpiCard title="Solde Caisse" value={`${soldeTheorique.toLocaleString()} Fr`} sub="Ventes Cash - Sorties" icon="🛡️" color="#10b981" />
        <KpiCard title="Versements" value={`${(stats.versementTotal || 0).toLocaleString()} Fr`} sub="Déclarés en caisse" icon="🏦" color="#6366f1" onClick={() => setView('versement')} />
        <KpiCard title="ECART DE CAISSE" value={`${ecartCaisse.toLocaleString()} Fr`} sub="Solde Theo - Versements" icon="⚖️" color={ecartCaisse > 0 ? "#ef4444" : "#10b981"} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <MiniKpi title="Recouvrement" value={stats.recouvrementTotal} color="#f59e0b" icon="💸" onClick={() => setView('recouvrement')} />
        <MiniKpi title="Décaissements" value={stats.decaissementTotal} color="#ef4444" icon="📤" onClick={() => setView('decaissement')} />

        {/* STOCK DETAIL CUSTOM CARD */}
        <div onClick={() => setView('stock')} style={{ background: 'white', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '5px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>📦</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Valeur Stock</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280' }}>
            <span>Achat:</span>
            <span style={{ fontWeight: '600', color: '#374151' }}>{(stats.stockAchat || 0).toLocaleString()} Fr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280' }}>
            <span>Vente:</span>
            <span style={{ fontWeight: '600', color: '#374151' }}>{(stats.stockVente || 0).toLocaleString()} Fr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px', paddingTop: '4px', borderTop: '1px dashed #e5e7eb' }}>
            <span style={{ fontWeight: '600', color: '#8b5cf6' }}>Marge:</span>
            <span style={{ fontWeight: 'bold', color: '#8b5cf6' }}>{(stats.stockMarge || 0).toLocaleString()} Fr</span>
          </div>
        </div>

        <MiniKpi title="Patients Vus" value={stats.patientsTotal} unit="" color="#ec4899" icon="👥" onClick={() => setView('patients')} />
      </div>

      {/* CHARTS AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* LEFT COLUMN: STATS RAPIDES + CHART */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* STATS RAPIDES */}
          {/* STATS RAPIDES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>

            {/* CONSULTATIONS */}
            <div onClick={() => fetchDetails('CONSULT')} style={{ cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px' }}>🩺</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{getStat('CONSULT').count}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Consultations</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cpt:</span> <span style={{ fontWeight: '600' }}>{getStat('CONSULT').cash.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crédit:</span> <span style={{ fontWeight: '600', color: '#f59e0b' }}>{getStat('CONSULT').credit.toLocaleString()}</span></div>
              </div>
            </div>

            {/* HOSPITALISATIONS */}
            <div onClick={() => fetchDetails('HOSP')} style={{ cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px' }}>🏥</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{getStat('HOSP').count}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Hospitalisations</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cpt:</span> <span style={{ fontWeight: '600' }}>{getStat('HOSP').cash.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crédit:</span> <span style={{ fontWeight: '600', color: '#f59e0b' }}>{getStat('HOSP').credit.toLocaleString()}</span></div>
              </div>
            </div>

            {/* PHARMACIE (Standard) - Using stock count but pointing to sales ? No, keeping consistent with others */}
            <div onClick={() => fetchDetails('PHARMA')} style={{ cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px' }}>💊</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{getStat('PHARMA').count}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Pharmacie</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cpt:</span> <span style={{ fontWeight: '600' }}>{getStat('PHARMA').cash.toLocaleString()} Fr</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crédit:</span> <span style={{ fontWeight: '600', color: '#f59e0b' }}>{getStat('PHARMA').credit.toLocaleString()} Fr</span></div>
              </div>
            </div>

            {/* LABO */}
            <div onClick={() => fetchDetails('LABO')} style={{ cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px' }}>🧪</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{getStat('LABO').count}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Examens Labo</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cpt:</span> <span style={{ fontWeight: '600' }}>{getStat('LABO').cash.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crédit:</span> <span style={{ fontWeight: '600', color: '#f59e0b' }}>{getStat('LABO').credit.toLocaleString()}</span></div>
              </div>
            </div>

            {/* SOINS */}
            <div onClick={() => fetchDetails('SOINS')} style={{ cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px' }}>🩹</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{getStat('SOINS').count}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Actes Infirmiers</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cpt:</span> <span style={{ fontWeight: '600' }}>{getStat('SOINS').cash.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crédit:</span> <span style={{ fontWeight: '600', color: '#f59e0b' }}>{getStat('SOINS').credit.toLocaleString()}</span></div>
              </div>
            </div>
            {/* INDICATEUR STOCK PHARMACIE */}
            {/* INDICATEUR PHARMA FINANCIER */}
            <div onClick={() => fetchDetails('STOCK_PHARMA')} style={{ cursor: 'pointer', background: '#fef3c7', padding: '10px 15px', borderRadius: '12px', border: '1px solid #fcd34d', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>💊</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>Pharmacie</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#b45309' }}>Vente:</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{(stats.pharmaDayVente || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#b45309' }}>Achat:</span>
                  <span style={{ fontWeight: 'bold', color: '#4b5563' }}>{(stats.pharmaDayAchat || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #fcd34d', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#92400e' }}>Marge:</span>
                  <span style={{ fontWeight: 'bold', color: (stats.pharmaDayMarge >= 0 ? '#059669' : '#dc2626') }}>
                    {(stats.pharmaDayMarge || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CHART */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1f2937' }}>📈 Évolution du Chiffre d'Affaires</h3>
            <div style={{ flex: 1, minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.evolution}>
                  <defs>
                    <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: DETAILS TABLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* TABLEAU DETAILLE */}
          <div style={{ background: 'white', padding: '0', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '12px 15px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#374151' }}>Détails par Service</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', color: '#6b7280', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', fontWeight: '600' }}>Service</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'center' }}>Nbr</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'right', color: '#10b981' }}>Comptant</th>
                    <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'right', color: '#f59e0b' }}>Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: 'CONSULT', l: 'Consultation', c: '#3b82f6' },
                    { k: 'HOSP', l: 'Hospitalisation', c: '#8b5cf6' },
                    { k: 'SOINS', l: 'Infirmerie', c: '#ef4444' },
                    { k: 'PHARMA', l: 'Pharmacie', c: '#f59e0b' },
                    { k: 'LABO', l: 'Laboratoire', c: '#10b981' },
                  ].map(row => {
                    const s = getStat(row.k);
                    return (
                      <tr key={row.k} onClick={() => fetchDetails(row.k)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '500', color: row.c }}>{row.l}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600' }}>{s.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{s.montant.toLocaleString()} Fr</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{s.cash.toLocaleString()} Fr</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{s.credit.toLocaleString()} Fr</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER AUDIT */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>Dernières Transactions</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0', maxHeight: '300px' }}>
            {stats.audit.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>Aucune activité récente</div>
            ) : (
              stats.audit.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 15px', borderBottom: '1px solid #f3f4f6', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px' }}>
                    {a.acte_libelle ? a.acte_libelle.substring(0, 2).toUpperCase() : '??'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.acte_libelle}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(a.date_vente).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {a.user?.split(' ')[0] || 'Syst.'}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>{a.montant_total.toLocaleString()} Fr</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DETAILS MODAL */}
      {selectedDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(3px)'
        }} onClick={closeDetails}>
          <div style={{
            background: 'white', width: '90%', maxWidth: '800px', height: '80%',
            borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>{getLabel(selectedDetail)}</h2>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {selectedDetail === 'STOCK_PHARMA' ? 'Liste complète des articles en stock' : 'Détails des transactions sur la période'}
                </div>
              </div>
              <button onClick={closeDetails} style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {loadingDetails ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Chargement des détails...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr>
                      {selectedDetail === 'STOCK_PHARMA' ? (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Article</th>
                          <th style={{ textAlign: 'center', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Quantité</th>
                          <th style={{ textAlign: 'right', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Prix Unitaire</th>
                          <th style={{ textAlign: 'right', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Valeur Totale</th>
                        </>
                      ) : (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Date</th>
                          <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Patient</th>
                          <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Acte/Libellé</th>
                          <th style={{ textAlign: 'right', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Montant</th>
                          <th style={{ textAlign: 'right', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Cash</th>
                          <th style={{ textAlign: 'right', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Crédit</th>
                          <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontWeight: '600' }}>Vendeur</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.length === 0 ? (
                      <tr><td colSpan={selectedDetail === 'STOCK_PHARMA' ? 4 : 7} style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>Aucune donnée trouvée</td></tr>
                    ) : (
                      detailData.map((d: any, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          {selectedDetail === 'STOCK_PHARMA' ? (
                            <>
                              <td style={{ padding: '10px 20px', color: '#111827' }}>{d.libelle}</td>
                              <td style={{ padding: '10px 20px', textAlign: 'center', color: '#374151' }}>{d.qte}</td>
                              <td style={{ padding: '10px 20px', textAlign: 'right', color: '#374151' }}>{parseFloat(d.prix).toLocaleString()} Fr</td>
                              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{parseFloat(d.total).toLocaleString()} Fr</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '10px 20px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                {new Date(d.date_vente).toLocaleDateString()} <small>{new Date(d.date_vente).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                              </td>
                              <td style={{ padding: '10px 20px', color: '#111827', fontWeight: '500' }}>{d.patient || '-'}</td>
                              <td style={{ padding: '10px 20px', color: '#374151' }}>{d.acte_libelle}</td>
                              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{parseFloat(d.montant_total).toLocaleString()} Fr</td>
                              <td style={{ padding: '10px 20px', textAlign: 'right', color: '#10b981' }}>{parseFloat(d.part_patient).toLocaleString()} Fr</td>
                              <td style={{ padding: '10px 20px', textAlign: 'right', color: '#ef4444' }}>{parseFloat(d.credit).toLocaleString()} Fr</td>
                              <td style={{ padding: '10px 20px', color: '#6b7280', fontSize: '12px' }}>{d.user}</td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '15px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total lignes: <b>{detailData.length}</b></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// STYLES & SUB-COMPONENTS
const dateInput: React.CSSProperties = { border: 'none', fontSize: '13px', fontWeight: '500', color: '#374151', outline: 'none' };

function KpiCard({ title, value, sub, icon, color, onClick, isAlert }: any) {
  return (
    <div onClick={onClick} style={{ background: 'white', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: '16px' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: isAlert ? '#ef4444' : '#111827' }}>{value}</div>
      <div style={{ fontSize: '11px', color: isAlert ? '#f87171' : '#9ca3af', marginTop: '4px' }}>{sub}</div>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color }}></div>
    </div>
  );
}

function MiniKpi({ title, value, unit = 'Fr', color, icon, onClick }: any) {
  return (
    <div onClick={onClick} style={{ background: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>{value.toLocaleString()} <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'normal' }}>{unit}</span></div>
      </div>
    </div>
  );
}