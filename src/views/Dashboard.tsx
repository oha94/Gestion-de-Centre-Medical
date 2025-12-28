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
    patientsTotal: 0,
    stockValue: 0,
    details: {}, // Map of category -> { count, montant }
    evolution: [],
    recouvrementTotal: 0,
    decaissementTotal: 0,
    versementTotal: 0,
    audit: []
  });

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
        dateCondition = `DATE(v.date_vente) = '${dateTravail}'`;
        cmDateCondition = `DATE(date_mouvement) = '${dateTravail}'`;
      } else if (period === "SEMAINE") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        cmDateCondition = `date_mouvement >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
      } else if (period === "MOIS") {
        dateCondition = `v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
        cmDateCondition = `date_mouvement >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
      } else {
        // CUSTOM
        dateCondition = `DATE(v.date_vente) BETWEEN '${customDates.start}' AND '${customDates.end}'`;
        cmDateCondition = `DATE(date_mouvement) BETWEEN '${customDates.start}' AND '${customDates.end}'`;
      }

      // 2. Chiffre d'Affaires & Patients
      const resGlobal = await db.select<any[]>(`
        SELECT
            CAST(SUM(montant_total) AS CHAR) as ca,
            CAST(SUM(part_patient) AS CHAR) as cash,
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
        SELECT CAST(SUM(quantite_stock * prix_vente) AS CHAR) as val FROM stock_articles
      `);

      // 4. Répartition détaillée par catégorie
      const resDetails = await db.select<any[]>(`
        SELECT 
            CASE 
                WHEN v.type_vente = 'HOSPITALISATION' THEN 'HOSP'
                WHEN v.type_vente = 'MEDICAMENT' THEN 'PHARMA'
                WHEN v.acte_libelle LIKE '%CONSULTATION%' THEN 'CONSULT'
                WHEN v.acte_libelle LIKE '%SOIN%' OR v.acte_libelle LIKE '%INJECTION%' OR v.acte_libelle LIKE '%PANSEMENT%' THEN 'SOINS'
                ELSE 'LABO'
            END as cat,
            COUNT(*) as count,
            CAST(SUM(v.montant_total) AS CHAR) as montant
        FROM ventes v
        WHERE ${dateCondition}
        GROUP BY cat
      `);

      const detailsMap = resDetails.reduce((acc, curr) => {
        acc[curr.cat] = { count: curr.count, montant: parseFloat(curr.montant || "0") };
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
        SELECT v.id, v.acte_libelle, v.montant_total, v.created_at, u.nom_complet as user
        FROM ventes v
        LEFT JOIN app_utilisateurs u ON v.user_id = u.id
        ORDER BY v.created_at DESC
        LIMIT 8
      `);

      setStats({
        caTotal: parseFloat(resGlobal[0]?.ca || "0"),
        caCash: parseFloat(resGlobal[0]?.cash || "0"),
        caCredit: parseFloat(resGlobal[0]?.credit || "0"),
        patientsTotal: resGlobal[0]?.patients || 0,
        stockValue: parseFloat(resStock[0]?.val || "0"),
        details: detailsMap,
        evolution: resEvol,
        audit: resAudit,
        recouvrementTotal: parseFloat(resRecouv[0]?.total || "0"),
        decaissementTotal: parseFloat(resDecaissement[0]?.total || "0"),
        versementTotal: parseFloat(resVersement[0]?.total || "0")
      });

    } catch (e) {
      console.error("Dashboard Error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Chargement...</div>;

  const getStat = (key: string) => stats.details?.[key] || { count: 0, montant: 0 };
  const soldeTheorique = (stats.caCash + stats.recouvrementTotal) - stats.decaissementTotal;
  const ecartCaisse = (stats.versementTotal || 0) - soldeTheorique;

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', minHeight: '100%', fontFamily: '"Inter", sans-serif' }}>

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
        <KpiCard title="Chiffre d'Affaires" value={`${stats.caTotal.toLocaleString()} F`} sub={`Cash: ${stats.caCash.toLocaleString()} | Crédit: ${stats.caCredit.toLocaleString()}`} icon="💰" color="#3b82f6" onClick={() => setView('caisse')} />
        <KpiCard title="Solde Caisse" value={`${soldeTheorique.toLocaleString()} F`} sub="Cash + Recouv - Sorties" icon="🛡️" color="#10b981" />
        <KpiCard title="Versements" value={`${(stats.versementTotal || 0).toLocaleString()} F`} sub="Déclarés en caisse" icon="🏦" color="#6366f1" onClick={() => setView('versement')} />
        <KpiCard title="Écart" value={`${ecartCaisse > 0 ? '+' : ''}${ecartCaisse.toLocaleString()} F`} sub={ecartCaisse === 0 ? "Parfait" : "Différence"} icon="⚖️" color={ecartCaisse >= 0 ? "#10b981" : "#ef4444"} isAlert={ecartCaisse < 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <MiniKpi title="Recouvrement" value={stats.recouvrementTotal} color="#f59e0b" icon="💸" onClick={() => setView('recouvrement')} />
        <MiniKpi title="Décaissements" value={stats.decaissementTotal} color="#ef4444" icon="📤" onClick={() => setView('decaissement')} />
        <MiniKpi title="Valeur Stock" value={stats.stockValue} color="#8b5cf6" icon="📦" onClick={() => setView('stock')} />
        <MiniKpi title="Patients Vus" value={stats.patientsTotal} unit="" color="#ec4899" icon="👥" onClick={() => setView('patients')} />
      </div>

      {/* CHARTS AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

        {/* CHART */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1f2937' }}>📈 Évolution du Chiffre d'Affaires</h3>
          <div style={{ flex: 1, minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
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

          {/* CATEGORIES BUTTONS */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
            <ActivityChip label="Hospit." data={getStat('HOSP')} color="#8b5cf6" onClick={() => setView('hosp')} />
            <ActivityChip label="Consult." data={getStat('CONSULT')} color="#3b82f6" onClick={() => setView('consultation')} />
            <ActivityChip label="Laboratoire" data={getStat('LABO')} color="#10b981" onClick={() => setView('labo')} />
            <ActivityChip label="Soins" data={getStat('SOINS')} color="#ef4444" onClick={() => setView('infirmier')} />
            <ActivityChip label="Pharma" data={getStat('PHARMA')} color="#f59e0b" onClick={() => setView('stock')} />
          </div>
        </div>

        {/* AUDIT */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', maxHeight: '450px' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>Dernières Transactions</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
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
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {a.user?.split(' ')[0] || 'Syst.'}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>{a.montant_total.toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
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

function MiniKpi({ title, value, unit = 'F', color, icon, onClick }: any) {
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

function ActivityChip({ label, data, color, onClick }: any) {
  return (
    <div onClick={onClick} style={{ minWidth: '80px', flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center', cursor: 'pointer', transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ fontSize: '10px', fontWeight: '600', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: '700', color: color }}>{data.montant.toLocaleString()}</div>
      <div style={{ fontSize: '9px', color: '#d1d5db' }}>{data.count} actes</div>
    </div>
  )
}