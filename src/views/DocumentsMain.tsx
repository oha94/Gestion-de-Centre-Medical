import { useState, useEffect } from 'react';
import { getDb } from '../lib/db';

// --- UTILS ---
// const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

// --- STYLES ---
const cardStyle = {
    background: 'white', padding: '25px', borderRadius: '12px',
    border: '1px solid #eee', cursor: 'pointer', textAlign: 'center' as const,
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)', transition: '0.2s',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center'
};
const inputStyle = { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', marginLeft: '5px' };
const btnActionStyle = { padding: '8px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const btnBackStyle = { padding: '8px 12px', background: '#ecf0f1', color: '#2c3e50', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const thStyle = { padding: '12px', textAlign: 'left' as const };
const tdStyle = { padding: '12px', borderBottom: '1px solid #eee' };

// --- PRINT UTILS ---
// --- PRINT UTILS ---
// We use a global state for the print preview to avoid prop drilling or portal complexity in this single file architecture
let setPrintPreview: (content: string | null) => void = () => { };

const printReport = (title: string, dates: { start: string, end: string }, columns: string[], subtitle: string | null, rows: any[], rowRenderer: (r: any, i?: number) => string) => {
    const content = `
        <div class="print-document">
            <style>
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
                .meta { margin-bottom: 20px; color: #555; text-align: center; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th { background: #f0f2f5; text-align: left; padding: 8px; border: 1px solid #ddd; }
                td { padding: 8px; border: 1px solid #ddd; }
                .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: right; }
            </style>
            <div class="header">
                <h2 style="margin:0; color: #2c3e50;">${title}</h2>
                ${subtitle ? `<h4 style="margin:5px 0; color:#555">${subtitle}</h4>` : ''}
            </div>
            <div class="meta">
                Période du <strong>${new Date(dates.start).toLocaleDateString('fr-FR')}</strong> au <strong>${new Date(dates.end).toLocaleDateString('fr-FR')}</strong>
            </div>
            <table>
                <thead>
                    <tr>
                        ${columns.map(c => `<th>${c}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((r, i) => rowRenderer(r, i)).join('')}
                </tbody>
            </table>
            <div class="footer">
                Généré le ${new Date().toLocaleString()}
            </div>
        </div>
    `;
    setPrintPreview(content);
};

function PrintOverlay({ content, onClose }: { content: string, onClose: () => void }) {
    if (!content) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 99999, overflowY: 'auto' }}>
            {/* Controls */}
            <div className="no-print" style={{
                position: 'fixed', top: '20px', right: '20px',
                background: 'white', padding: '10px',
                borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                display: 'flex', gap: '10px', zIndex: 100000
            }}>
                <button onClick={() => window.print()} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimer</button>
                <button onClick={onClose} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Fermer</button>
            </div>

            {/* Print Content */}
            <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
                <style>{`
                    @media print {
                        .no-print { display: none !important; }
                        body > *:not(#print-root) { display: none !important; }
                        #print-root { display: block !important; position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: white; }
                        @page { margin: 1cm; size: A4; }
                    }
                `}</style>
                <div id="print-root" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
        </div>
    );
}

// --- COMPONENTS ---

// 1. Mouvements
function ReportMouvements({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // Get Sales
            const salesRaw = await db.select<any[]>(`
                SELECT v.article_id, sa.designation, v.acte_libelle 
                FROM ventes v
                JOIN stock_articles sa ON v.article_id = sa.id
                WHERE DATE(v.date_vente) BETWEEN ? AND ?
            `, [dates.start, dates.end]);

            const salesMap: Record<number, { name: string, out: number }> = {};
            salesRaw.forEach(s => {
                const match = s.acte_libelle.match(/\(x(\d+)\)/);
                const q = match ? parseInt(match[1]) : 1;
                if (!salesMap[s.article_id]) salesMap[s.article_id] = { name: s.designation, out: 0 };
                salesMap[s.article_id].out += q;
            });

            // Get Entries
            const entries = await db.select<any[]>(`
                SELECT d.article_id, d.quantite 
                FROM stock_bl_details d
                JOIN stock_bons_livraison b ON d.bl_id = b.id
                WHERE DATE(b.date_bl) BETWEEN ? AND ?
            `, [dates.start, dates.end]);

            const entriesMap: Record<number, number> = {};
            entries.forEach(e => {
                entriesMap[e.article_id] = (entriesMap[e.article_id] || 0) + e.quantite;
            });

            // Merge
            const allIds = new Set([...Object.keys(salesMap), ...Object.keys(entriesMap).map(String)]);
            const result = Array.from(allIds).map(idStr => {
                const id = parseInt(idStr);
                const s = salesMap[id] || { name: '?', out: 0 };
                const entryQty = entriesMap[id] || 0;
                return { id, name: s.name, in: entryQty, out: s.out };
            });

            // Fix missing names
            const missingIds = result.filter(r => r.name === '?').map(r => r.id);
            if (missingIds.length > 0) {
                const namesRes = await db.select<any[]>(`SELECT id, designation FROM stock_articles WHERE id IN (${missingIds.join(',')})`);
                namesRes.forEach(n => {
                    const item = result.find(r => r.id === n.id);
                    if (item) item.name = n.designation;
                });
            }

            setData(result.filter(r => r.in > 0 || r.out > 0).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (e) {
            console.error(e);
            alert("Erreur chargement rapport");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        printReport(
            'Rapport Mouvements de Stock',
            dates,
            ['Article', 'Entrées (+)', 'Sorties (-)', 'Solde'],
            null,
            data,
            (r) => `
                <tr>
                    <td>${r.name}</td>
                    <td style="color:green; font-weight:bold; text-align:center">${r.in}</td>
                    <td style="color:red; font-weight:bold; text-align:center">${r.out}</td>
                    <td style="font-weight:bold; text-align:center">${r.in - r.out > 0 ? '+' : ''}${r.in - r.out}</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        if (data.length === 0) return alert("Aucune donnée à exporter");

        try {
            const XLSX = await import('xlsx');

            const wsData = [
                ["Article", "Entrées (Qté)", "Sorties (Qté)", "Solde Période"], // Headers
                ...data.map(r => [
                    r.name,
                    r.in,
                    r.out,
                    r.in - r.out
                ])
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Auto-width columns roughly
            const wscols = [
                { wch: 40 }, // Article
                { wch: 15 }, // In
                { wch: 15 }, // Out
                { wch: 15 }  // Solde
            ];
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Mouvements");
            XLSX.writeFile(wb, `Mouvements_Stock_${dates.start}_${dates.end}.xlsx`);
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'export Excel");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#34495e' }}>📊 Mouvements de Stock</h2>
            </div>

            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={btnActionStyle}>{loading ? 'Chargement...' : 'Générer Rapport'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ background: '#2c3e50', color: 'white' }}>
                        <th style={thStyle}>Article</th>
                        <th style={thStyle}>Entrées (Qté)</th>
                        <th style={thStyle}>Sorties (Qté)</th>
                        <th style={thStyle}>Solde Période</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{r.name}</td>
                            <td style={{ ...tdStyle, color: '#27ae60', fontWeight: 'bold' }}>{r.in}</td>
                            <td style={{ ...tdStyle, color: '#e74c3c', fontWeight: 'bold' }}>{r.out}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.in - r.out > 0 ? '+' : ''}{r.in - r.out}</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucune donnée pour cette période</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 2. Invendus
function ReportInvendus({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT id, designation, quantite_stock as stock, prix_achat as prix_achat
                FROM stock_articles
                WHERE id NOT IN (
                    SELECT DISTINCT article_id 
                    FROM ventes 
                    WHERE DATE(date_vente) BETWEEN ? AND ? 
                    AND article_id IS NOT NULL
                )
                ORDER BY designation ASC
            `, [dates.start, dates.end]);
            setData(res);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        const totalVal = data.reduce((acc, r) => acc + (r.stock * r.prix_achat), 0);

        printReport(
            'Rapport Articles Non Vendus (Invendus)',
            dates,
            ['Article', 'Stock Actuel', 'Valeur Stock'],
            `Valeur Totale Dormante: ${totalVal.toLocaleString()} F`,
            data,
            (r) => `
                <tr>
                    <td>${r.designation}</td>
                    <td style="text-align:center; font-weight:bold">${r.stock}</td>
                    <td style="text-align:right">${(r.stock * r.prix_achat).toLocaleString()} F</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Article", "Stock Actuel", "Valeur Stock"],
            ...data.map(r => [r.designation, r.stock, r.stock * r.prix_achat])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Invendus");
        XLSX.writeFile(wb, `Invendus_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#e74c3c' }}>⚠️ Articles Non Vendus</h2>
            </div>

            <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', border: '1px solid #fed7d7' }}>
                <label>Période du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#e74c3c' }}>{loading ? 'Recherche...' : 'Lister Invendus'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ background: '#c0392b', color: 'white' }}>
                        <th style={thStyle}>Article</th>
                        <th style={thStyle}>Stock Actuel</th>
                        <th style={thStyle}>Valeur Stock (P.A)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{r.designation}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.stock}</td>
                            <td style={tdStyle}>{(r.stock * r.prix_achat).toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Tous les articles ont été vendus sur cette période (ou erreur)</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 3. Best Sellers
function ReportBestSellers({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [filter, setFilter] = useState<'QTY' | 'REVENUE' | 'MARGIN'>('QTY');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const salesRaw = await db.select<any[]>(`
                SELECT v.article_id, sa.designation, v.acte_libelle, v.montant_total, sa.prix_achat as prix_achat
                FROM ventes v
                JOIN stock_articles sa ON v.article_id = sa.id
                WHERE DATE(v.date_vente) BETWEEN ? AND ?
            `, [dates.start, dates.end]);

            const aggregation: Record<number, { id: number, name: string, qty: number, revenue: number, cost: number }> = {};

            salesRaw.forEach(s => {
                const match = s.acte_libelle.match(/\(x(\d+)\)/);
                const q = match ? parseInt(match[1]) : 1;
                const revenue = s.montant_total || 0;
                const cost = q * (s.prix_achat || 0);

                if (!aggregation[s.article_id]) {
                    aggregation[s.article_id] = { id: s.article_id, name: s.designation, qty: 0, revenue: 0, cost: 0 };
                }
                const item = aggregation[s.article_id];
                item.qty += q;
                item.revenue += revenue;
                item.cost += cost;
            });

            let result = Object.values(aggregation).map(item => ({
                ...item,
                margin: item.revenue - item.cost,
                marginRate: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0
            }));

            // Sort
            result.sort((a, b) => {
                if (filter === 'QTY') return b.qty - a.qty;
                if (filter === 'REVENUE') return b.revenue - a.revenue;
                if (filter === 'MARGIN') return b.margin - a.margin;
                return 0;
            });

            setData(result.slice(0, 50));
        } catch (e) {
            console.error(e);
            alert("Erreur chargement rapport");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        const titleMap = { 'QTY': 'Quantité Vendue', 'REVENUE': "Chiffre d'Affaires", 'MARGIN': 'Marge Bénéficiaire' };

        printReport(
            `Top 50 Meilleurs Produits - ${titleMap[filter]}`,
            dates,
            ['Rang', 'Article', 'Qté Vendue', 'C.A.', 'Marge', '% Marge'],
            null,
            data,
            (r, i) => `
                <tr>
                    <td style="text-align:center; color:#7f8c8d">${i ? i + 1 : ''}</td>
                    <td>${r.name}</td>
                    <td style="text-align:center; font-weight:bold">${r.qty}</td>
                    <td style="text-align:right">${r.revenue.toLocaleString()} F</td>
                    <td style="text-align:right; color:${r.margin >= 0 ? 'green' : 'red'}">${r.margin.toLocaleString()} F</td>
                    <td style="text-align:right; font-size:11px">${r.marginRate.toFixed(1)}%</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Rang", "Article", "Quantité Vendue", "Chiffre d'Affaires", "Marge", "% Marge"],
            ...data.map((r, i) => [i + 1, r.name, r.qty, r.revenue, r.margin, r.marginRate.toFixed(2)])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "BestSellers");
        XLSX.writeFile(wb, `BestSellers_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#f39c12' }}>🏆 Meilleurs Produits</h2>
            </div>

            <div style={{ background: '#fffcf5', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', border: '1px solid #fdebd0' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>

                <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #f39c12' }}>
                    <option value="QTY">📅 Par Quantité Vendue</option>
                    <option value="REVENUE">💰 Par Chiffre d'Affaires</option>
                    <option value="MARGIN">📈 Par Marge Bénéficiaire</option>
                </select>

                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#f39c12' }}>{loading ? 'Calcul...' : 'Afficher Top 50'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ background: '#d35400', color: 'white' }}>
                        <th style={{ ...thStyle, width: '50px' }}>#</th>
                        <th style={thStyle}>Article</th>
                        <th style={thStyle}>Qté Total</th>
                        <th style={thStyle}>Chiffre d'Affaires</th>
                        <th style={thStyle}>Marge Estimée</th>
                        <th style={thStyle}>% Marge</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: i < 3 ? '#ffffeb' : 'transparent' }}>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#7f8c8d' }}>{i + 1}</td>
                            <td style={tdStyle}>
                                {i === 0 && '🥇 '}
                                {i === 1 && '🥈 '}
                                {i === 2 && '🥉 '}
                                {r.name}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{r.qty}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{r.revenue.toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: r.margin >= 0 ? '#27ae60' : '#c0392b' }}>{r.margin.toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontSize: '12px', color: '#7f8c8d' }}>{r.marginRate.toFixed(1)}%</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucune donnée</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 4. Instant Stock (NEW)
function ReportInstantStock({ onBack }: { onBack: () => void }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [rayons, setRayons] = useState<string[]>([]);
    const [filterRayon, setFilterRayon] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // Fetch articles with their ray (Left join)
            let res: any[] = [];
            try {
                res = await db.select<any[]>(`
                    SELECT sa.designation, sa.quantite_stock as stock, sa.prix_achat as prix_achat, r.libelle as rayon 
                    FROM stock_articles sa 
                    LEFT JOIN stock_rayons r ON sa.rayon_id = r.id 
                    ORDER BY r.libelle, sa.designation
                `);
            } catch (joinErr) {
                console.warn("Rayon join failed, fallback", joinErr);
                res = await db.select<any[]>(`SELECT designation, quantite_stock as stock, prix_achat as prix_achat, 'Non classé' as rayon FROM stock_articles ORDER BY designation`);
            }

            setData(res);
            const allRayons = Array.from(new Set(res.map(r => r.rayon || 'Non classé'))).filter(Boolean) as string[];
            setRayons(allRayons.sort());
        } catch (e) {
            console.error(e);
            alert("Erreur chargement inventaire");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const filtered = filterRayon ? data.filter(r => r.rayon === filterRayon) : data;
        if (filtered.length === 0) return alert("Rien à imprimer");

        const totalVal = filtered.reduce((acc, r) => acc + (r.stock * r.prix_achat), 0);

        printReport(
            `Etat du Stock (Instant T) - ${filterRayon || 'Tout le magasin'}`,
            { start: new Date().toISOString(), end: new Date().toISOString() },
            ['Rayon', 'Article', 'En Stock', 'Valeur'],
            `Total Articles: ${filtered.length} | Valeur Totale: ${totalVal.toLocaleString()} F`,
            filtered,
            (r) => `
                <tr>
                    <td style="color:#7f8c8d; font-size:11px">${r.rayon || '-'}</td>
                    <td>${r.designation}</td>
                    <td style="text-align:center; font-weight:bold">${r.stock}</td>
                    <td style="text-align:right">${(r.stock * r.prix_achat).toLocaleString()} F</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const filtered = filterRayon ? data.filter(r => r.rayon === filterRayon) : data;
        const totalVal = filtered.reduce((acc, r) => acc + (r.stock * r.prix_achat), 0);

        const wsData = [
            ["Rayon", "Article", "Stock Physique", "Valeur Stock"],
            ...filtered.map(r => [r.rayon || 'Non classé', r.designation, r.stock, r.stock * r.prix_achat]),
            ["", "TOTAL", "", totalVal]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "InstantStock");
        XLSX.writeFile(wb, `InstantStock.xlsx`);
    };

    const filteredData = filterRayon ? data.filter(r => r.rayon === filterRayon) : data;
    const totalVal = filteredData.reduce((acc, r) => acc + (r.stock * r.prix_achat), 0);

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#8e44ad' }}>📋 Inventaire Stock (Instant T)</h2>
            </div>

            <div style={{ background: '#f4ecf7', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', border: '1px solid #d2b4de' }}>
                <label>Filtre Rayon :</label>
                <select value={filterRayon} onChange={e => setFilterRayon(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #8e44ad', minWidth: '200px' }}>
                    <option value="">🏠 Tout le magasin</option>
                    {rayons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
                    {loading ? 'Chargement...' : `Valeur Totale : ${totalVal.toLocaleString()} F`}
                </div>
                <button onClick={handlePrint} disabled={loading} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                <button onClick={exportToExcel} disabled={loading} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', border: '1px solid #eee' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                        <tr style={{ background: '#8e44ad', color: 'white' }}>
                            <th style={thStyle}>Rayon / Emplacement</th>
                            <th style={thStyle}>Article</th>
                            <th style={thStyle}>Stock Physique</th>
                            <th style={thStyle}>Valeur (P.A)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ ...tdStyle, color: '#7f8c8d' }}>{r.rayon || 'Non classé'}</td>
                                <td style={tdStyle}>{r.designation}</td>
                                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.stock}</td>
                                <td style={tdStyle}>{(r.stock * r.prix_achat).toLocaleString()} F</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// 5. Revenue by Operator AND Mode (Accounting)
function ReportRevenueByOperator({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();

            // Fix eventual schema mismatch
            try { await db.execute("ALTER TABLE ventes ADD COLUMN part_patient DOUBLE DEFAULT 0"); } catch (e) { }
            try { await db.execute("UPDATE ventes SET part_patient = montant_total WHERE part_patient = 0"); } catch (e) { }

            // 1. Get List of Users
            const users = await db.select<any[]>("SELECT id, nom_complet, username FROM app_utilisateurs ORDER BY nom_complet");

            // 2. Get Sales Statistics (Grouped by User & Mode)
            // CA (Turnover) = part_patient
            // Recette (Cash In) = part_patient - reste_a_payer
            const salesRaw = await db.select<any[]>(`
                SELECT 
                    user_id, 
                    mode_paiement, 
                    SUM(part_patient) as ca_total,
                    SUM(part_patient - reste_a_payer) as recette_reelle
                FROM ventes 
                WHERE DATE(date_vente) BETWEEN ? AND ?
                GROUP BY user_id, mode_paiement
            `, [dates.start, dates.end]);

            // 3. Get Recoveries (Encaissements) - ALWAYS CASH IN
            const recoveriesRaw = await db.select<any[]>(`
                SELECT user_id, mode_paiement, SUM(montant) as collected
                FROM caisse_mouvements 
                WHERE type IN ('ENCAISSEMENT_RECOUVREMENT', 'RECOUVREMENT')
                AND DATE(date_mouvement) BETWEEN ? AND ?
                GROUP BY user_id, mode_paiement
            `, [dates.start, dates.end]);

            // 4. Get Decaissements
            const decaissementsRaw = await db.select<any[]>(`
                SELECT user_id, mode_paiement, SUM(montant) as total
                FROM caisse_mouvements 
                WHERE type = 'DECAISSEMENT'
                AND DATE(date_mouvement) BETWEEN ? AND ?
                GROUP BY user_id, mode_paiement
            `, [dates.start, dates.end]);

            // 5. Get Versements
            const versementsRaw = await db.select<any[]>(`
                SELECT user_id, mode_paiement, SUM(montant) as total
                FROM caisse_mouvements 
                WHERE type = 'VERSEMENT'
                AND DATE(date_mouvement) BETWEEN ? AND ?
                GROUP BY user_id, mode_paiement
            `, [dates.start, dates.end]);

            // 6. Aggregate Data (First Pass)
            let rawRows: any[] = [];

            users.forEach(u => {
                const userName = u.nom_complet || u.username || 'Inconnu';
                const userModes = new Set<string>();

                salesRaw.filter(r => r.user_id === u.id).forEach(r => userModes.add(r.mode_paiement));
                recoveriesRaw.filter(r => r.user_id === u.id).forEach(r => userModes.add(r.mode_paiement));
                decaissementsRaw.filter(r => r.user_id === u.id).forEach(r => userModes.add(r.mode_paiement));
                versementsRaw.filter(r => r.user_id === u.id).forEach(r => userModes.add(r.mode_paiement || 'ESPÈCES'));

                if (userModes.size === 0) return;

                userModes.forEach(mode => {
                    const originalMode = mode || 'INCONNU';

                    // Sales
                    const s = salesRaw.find(r => r.user_id === u.id && r.mode_paiement === mode);
                    const caVal = s ? s.ca_total : 0;
                    const recetteVenteVal = s ? s.recette_reelle : 0;

                    // Recoveries
                    const r = recoveriesRaw.find(r => r.user_id === u.id && r.mode_paiement === mode);
                    const recovVal = r ? r.collected : 0;

                    const totalEncaisse = recetteVenteVal + recovVal;

                    // Decaissements
                    const d = decaissementsRaw.find(r => r.user_id === u.id && r.mode_paiement === mode);
                    const decVal = d ? d.total : 0;

                    // Versements
                    const v = versementsRaw.find(r => r.user_id === u.id && (r.mode_paiement === mode || (!r.mode_paiement && mode.includes('ESP'))));
                    const versVal = v ? v.total : 0;

                    // UPDATED LOGIC: Filter out rows that have NO cash movement (Entrants/Sortants)
                    // The user wants "Entrants" (Receipts). Pure credit sales (Encaissements=0) must be hidden.
                    // We keep if there is any Encaissement OR Decaissement OR Versement.
                    if (totalEncaisse === 0 && decVal === 0 && versVal === 0) return;

                    let displayMode = originalMode;

                    rawRows.push({
                        userId: u.id,
                        userName: userName,
                        mode: displayMode,
                        ca: caVal,
                        encaissements: totalEncaisse,
                        decaissements: decVal,
                        versements: versVal
                    });
                });
            });

            // 7. Aggregate Second Pass (Merge lines that now share the same label, e.g. "CRÉDIT")
            const finalMap: Record<string, any> = {};

            rawRows.forEach(row => {
                const key = `${row.userId}_${row.mode}`;
                if (!finalMap[key]) {
                    finalMap[key] = {
                        userId: row.userId,
                        userName: row.userName,
                        mode: row.mode,
                        ca: 0,
                        encaissements: 0,
                        decaissements: 0,
                        versements: 0
                    };
                }
                const target = finalMap[key];
                target.ca += row.ca;
                target.encaissements += row.encaissements;
                target.decaissements += row.decaissements;
                target.versements += row.versements;
            });

            // 8. Convert to Array & Calc Solde
            const finalRows = Object.values(finalMap).map(r => {
                const solde = r.encaissements - r.decaissements;
                return {
                    ...r,
                    solde: solde,
                    ecart: solde - r.versements
                };
            });

            // Sort
            finalRows.sort((a, b) => {
                if (a.userName === b.userName) return a.mode.localeCompare(b.mode);
                return a.userName.localeCompare(b.userName);
            });

            setData(finalRows);

        } catch (e) {
            console.error(e);
            alert("Erreur chargement rapport: " + (e as any).message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        const totalCA = data.reduce((acc, r) => acc + r.ca, 0);
        const totalSolde = data.reduce((acc, r) => acc + r.solde, 0);

        printReport(
            'Récapitulatif Détaillé des Recettes',
            dates,
            ['Opérateur', 'Mode', 'CA (Ventes)', 'Encaissements', 'Sorties', 'Solde Théorique', 'Versements', 'Ecart'],
            `CA Total: ${totalCA.toLocaleString()} F | Solde Théorique: ${totalSolde.toLocaleString()} F`,
            data,
            (r) => `
                <tr>
                    <td style="font-weight:bold">${r.userName}</td>
                    <td style="font-size:11px">${r.mode}</td>
                    <td style="text-align:right; font-weight:bold;">${r.ca.toLocaleString()}</td>
                    <td style="text-align:right; color:#27ae60">${r.encaissements.toLocaleString()}</td>
                    <td style="text-align:right; color:#c0392b">${r.decaissements.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:bold; background:#f4f6f7">${r.solde.toLocaleString()}</td>
                    <td style="text-align:right; color:#2980b9">${r.versements.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:bold; color:${r.ecart > 0 ? '#e74c3c' : '#27ae60'}">${r.ecart.toLocaleString()} F</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Opérateur", "Mode", "CA (Ventes)", "Encaissements", "Sorties", "Solde Théorique", "Versements", "Ecart / Reste"],
            ...data.map(r => [r.userName, r.mode, r.ca, r.encaissements, r.decaissements, r.solde, r.versements, r.ecart])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Recettes");
        XLSX.writeFile(wb, `Recettes_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#27ae60' }}>💰 Recettes par Opérateur & Mode</h2>
            </div>

            <div style={{ background: '#e8f8f5', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', border: '1px solid #d1f2eb' }}>
                <label>Période du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#27ae60' }}>{loading ? 'Calcul...' : 'Afficher Recettes'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ background: '#16a085', color: 'white' }}>
                        <th style={thStyle}>Opérateur</th>
                        <th style={thStyle}>Mode Paiement</th>
                        <th style={{ ...thStyle, textAlign: 'right', background: '#14967c' }}>CA (Ventes)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Encaissements</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Sorties</th>
                        <th style={{ ...thStyle, textAlign: 'right', background: '#1abc9c' }}>Solde Théorique</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Versements</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Ecart / Reste</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>
                                <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{r.userName}</div>
                            </td>
                            <td style={{ ...tdStyle, color: '#555', fontSize: '12px' }}>{r.mode}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{(r.ca || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#27ae60' }}>{(r.encaissements || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#c0392b' }}>{(r.decaissements || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', background: '#f8f9fa' }}>{(r.solde || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#2980b9', fontWeight: 'bold' }}>{(r.versements || 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '14px', color: (r.ecart || 0) > 0 ? '#e74c3c' : '#27ae60' }}>
                                {(r.ecart || 0).toLocaleString()} F
                            </td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucune activité trouvée sur cette période</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

function StockDocuments() {
    const [view, setView] = useState('MENU'); // MENU, REPORT_MVT, REPORT_UNSOLD, REPORT_BEST, REPORT_INSTANT

    if (view === 'REPORT_MVT') return <ReportMouvements onBack={() => setView('MENU')} />;
    if (view === 'REPORT_UNSOLD') return <ReportInvendus onBack={() => setView('MENU')} />;
    if (view === 'REPORT_BEST') return <ReportBestSellers onBack={() => setView('MENU')} />;
    if (view === 'REPORT_INSTANT') return <ReportInstantStock onBack={() => setView('MENU')} />;

    const cards = [
        { id: 'REPORT_MVT', title: 'Mouvements de Stocks', icon: '📊', desc: 'Entrées et Sorties sur une période' },
        { id: 'REPORT_INSTANT', title: 'Inventaire Instantané', icon: '📋', desc: 'Stock actuel par rayon (Instant T)' },
        { id: 'REPORT_UNSOLD', title: 'Articles Non Vendus', icon: '⚠️', desc: 'Produits dormants sur une période' },
        { id: 'REPORT_BEST', title: 'Meilleurs Produits', icon: '🏆', desc: 'Top ventes, CA et Marges' },
    ];

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>📦 Documents de Stock</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {cards.map(c => (
                    <div key={c.id} onClick={() => setView(c.id)} style={cardStyle}>
                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>{c.icon}</div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#2c3e50', marginBottom: '5px' }}>{c.title}</div>
                        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>{c.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Sub-views placeholders
function DashboardDocuments() {
    return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
            <h2>📊 Tableau de Bord Documentaire</h2>
            <p>Sélectionnez un module dans le menu de gauche.</p>
        </div>
    );
}

// 6. Accounts Receivable (State of Client Accounts: Insurances + Personnel)
function ReportAccountsReceivable({ onBack }: { onBack: () => void }) {
    const [filterType, setFilterType] = useState<'ALL' | 'ASSURANCE' | 'PERSONNEL'>('ALL');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, [filterType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const results: any[] = [];

            // 1. Assurances Debt
            if (filterType === 'ALL' || filterType === 'ASSURANCE') {
                const assurancesRes = await db.select<any[]>(`
                    SELECT 
                        a.nom, 
                        'ASSURANCE' as type, 
                        COUNT(v.id) as count_tickets,
                        CAST(COALESCE(SUM(v.part_assureur), 0) AS CHAR) as total_debt
                    FROM ventes v
                    JOIN patients p ON v.patient_id = p.id
                    JOIN assurances a ON p.assurance_id = a.id
                    WHERE v.part_assureur > 0
                    GROUP BY a.id, a.nom
                    ORDER BY a.nom
                `);
                const parsedAssurances = assurancesRes.map(r => ({ ...r, total_debt: parseFloat(r.total_debt || "0") }));
                results.push(...parsedAssurances);
            }

            // 2. Personnel Debt
            if (filterType === 'ALL' || filterType === 'PERSONNEL') {
                const personnelRes = await db.select<any[]>(`
                    SELECT 
                        p.nom_prenoms as nom, 
                        'PERSONNEL' as type, 
                        COUNT(v.id) as count_tickets,
                        CAST(COALESCE(SUM(v.reste_a_payer), 0) AS CHAR) as total_debt
                    FROM ventes v
                    JOIN personnel p ON v.personnel_id = p.id
                    WHERE v.reste_a_payer > 0
                    GROUP BY p.id, p.nom_prenoms
                    ORDER BY p.nom_prenoms
                `);
                const parsed = personnelRes.map(r => ({ ...r, total_debt: parseFloat(r.total_debt || "0") }));
                results.push(...parsed);
            }

            setData(results.sort((a, b) => b.total_debt - a.total_debt));
        } catch (e) {
            console.error(e);
            alert("Erreur chargement comptes clients");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        const totalDebt = data.reduce((acc, r) => acc + r.total_debt, 0);

        printReport(
            'État des Comptes Clients (Créances)',
            { start: new Date().toISOString(), end: new Date().toISOString() }, // Snapshot date
            ['Client / Organisme', 'Type', 'Nb Tickets', 'Montant Dû'],
            `Total Créances: ${totalDebt.toLocaleString()} F`,
            data,
            (r) => `
                <tr>
                    <td style="font-weight:bold">${r.name || r.nom}</td>
                    <td style="color:${r.type === 'ASSURANCE' ? '#2980b9' : '#e67e22'}">${r.type}</td>
                    <td style="text-align:center">${r.count_tickets}</td>
                    <td style="text-align:right; font-weight:bold; color:#c0392b">${r.total_debt.toLocaleString()} F</td>
                </tr>
            `
        );
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Client / Organisme", "Type", "Nb Tickets Impayés", "Reste à Payer"],
            ...data.map(r => [r.nom, r.type, r.count_tickets, r.total_debt])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "ComptesClients");
        XLSX.writeFile(wb, `ComptesClients.xlsx`);
    };

    const totalDebt = data.reduce((acc, r) => acc + r.total_debt, 0);

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#c0392b' }}>📉 État des Comptes Clients</h2>
            </div>

            <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', border: '1px solid #fab1a0' }}>
                <span style={{ fontWeight: 'bold', color: '#c0392b' }}>Filtre :</span>
                <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #c0392b', minWidth: '150px' }}>
                    <option value="ALL">Tout (Assurances + Personnel)</option>
                    <option value="ASSURANCE">Assurances Uniquement</option>
                    <option value="PERSONNEL">Personnel Uniquement</option>
                </select>

                <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#2c3e50', fontSize: '15px' }}>
                    Total Créances : {totalDebt.toLocaleString()} F
                </div>

                <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#2c3e50', fontSize: '15px' }}>
                    Total Créances : {totalDebt.toLocaleString()} F
                </div>

                <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ background: '#c0392b', color: 'white' }}>
                        <th style={thStyle}>Client / Organisme</th>
                        <th style={thStyle}>Type</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Nb Tickets Impayés</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Reste à Payer</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.nom}</td>
                            <td style={tdStyle}>
                                <span style={{
                                    background: r.type === 'ASSURANCE' ? '#e3f2fd' : '#fff3e0',
                                    color: r.type === 'ASSURANCE' ? '#2980b9' : '#e67e22',
                                    padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold'
                                }}>
                                    {r.type}
                                </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.count_tickets}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#c0392b' }}>{r.total_debt.toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucune créance trouvée.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 7. Sales Journal
function ReportSalesJournal({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT v.date_vente, v.numero_ticket, v.acte_libelle, v.montant_total, v.mode_paiement, 
                       u.nom_complet as user_name,
                       CASE WHEN v.patient_id IS NOT NULL THEN (SELECT nom_prenoms FROM patients WHERE id=v.patient_id) ELSE 'Achat Direct' END as patient_name
                FROM ventes v
                LEFT JOIN app_utilisateurs u ON v.user_id = u.id
                WHERE DATE(v.date_vente) BETWEEN ? AND ?
                ORDER BY v.date_vente DESC
            `, [dates.start, dates.end]);
            setData(res);
        } catch (e) { console.error(e); alert("Erreur chargement journal ventes"); }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Rien à imprimer");
        const total = data.reduce((acc, r) => acc + r.montant_total, 0);
        printReport("Journal des Ventes", dates, ['Date', 'Ticket', 'Patient', 'Acte', 'Mode', 'Opérateur', 'Montant'], `Total Période: ${total.toLocaleString()} F`, data, r => `
            <tr>
                <td>${new Date(r.date_vente).toLocaleString()}</td>
                <td>${r.numero_ticket || '-'}</td>
                <td>${r.patient_name}</td>
                <td>${r.acte_libelle}</td>
                <td>${r.mode_paiement}</td>
                <td>${r.user_name || '-'}</td>
                <td style="text-align:right; font-weight:bold">${r.montant_total.toLocaleString()} F</td>
            </tr>
        `);
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date", "Ticket", "Patient", "Acte", "Mode", "Opérateur", "Montant"],
            ...data.map(r => [new Date(r.date_vente).toLocaleString(), r.numero_ticket, r.patient_name, r.acte_libelle, r.mode_paiement, r.user_name, r.montant_total])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Ventes");
        XLSX.writeFile(wb, `Ventes_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#2980b9' }}>🛒 Journal des Ventes</h2>
            </div>
            <div style={{ background: '#eef6fb', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={btnActionStyle}>{loading ? '...' : 'Afficher'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#3498db', color: 'white' }}><th style={thStyle}>Date</th><th style={thStyle}>Ticket</th><th style={thStyle}>Patient</th><th style={thStyle}>Acte</th><th style={thStyle}>Mode</th><th style={thStyle}>Opérateur</th><th style={thStyle}>Montant</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.date_vente).toLocaleString()}</td>
                            <td style={tdStyle}>{r.numero_ticket}</td>
                            <td style={tdStyle}>{r.patient_name}</td>
                            <td style={tdStyle}>{r.acte_libelle}</td>
                            <td style={tdStyle}>{r.mode_paiement}</td>
                            <td style={tdStyle}>{r.user_name}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{r.montant_total.toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Aucune vente.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 8. Purchase Journal (Journal des Achats)
function ReportPurchaseJournal({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT bl.date_bl, bl.numero_bl, bl.montant_total, f.nom as fournisseur_nom
                FROM stock_bons_livraison bl
                LEFT JOIN stock_fournisseurs f ON bl.fournisseur_id = f.id
                WHERE DATE(bl.date_bl) BETWEEN ? AND ?
                ORDER BY bl.date_bl DESC
            `, [dates.start, dates.end]);
            setData(res);
        } catch (e) { console.error(e); alert("Erreur chargement journal achats"); }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Rien à imprimer");
        const total = data.reduce((acc, r) => acc + r.montant_total, 0);
        printReport("Journal des Achats", dates, ['Date', 'N° BL', 'Fournisseur', 'Montant Total'], `Total Période: ${total.toLocaleString()} F`, data, r => `
            <tr>
                <td>${new Date(r.date_bl).toLocaleDateString()}</td>
                <td>${r.numero_bl}</td>
                <td>${r.fournisseur_nom || 'Inconnu'}</td>
                <td style="text-align:right; font-weight:bold">${r.montant_total.toLocaleString()} F</td>
            </tr>
        `);
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date", "N° BL", "Fournisseur", "Montant"],
            ...data.map(r => [new Date(r.date_bl).toLocaleString(), r.numero_bl, r.fournisseur_nom, r.montant_total])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Achats");
        XLSX.writeFile(wb, `Achats_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#8e44ad' }}>🚚 Journal des Achats</h2>
            </div>
            <div style={{ background: '#f5eef8', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#8e44ad' }}>{loading ? '...' : 'Afficher'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#9b59b6', color: 'white' }}><th style={thStyle}>Date</th><th style={thStyle}>N° BL</th><th style={thStyle}>Fournisseur</th><th style={thStyle}>Montant</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.date_bl).toLocaleDateString()}</td>
                            <td style={tdStyle}>{r.numero_bl}</td>
                            <td style={tdStyle}>{r.fournisseur_nom}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{r.montant_total.toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Aucun achat.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 9. Periodic Activity Report
function ReportPeriodicActivity({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date(new Date().setDate(1)).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // Sales
            const salesRes = await db.select<any[]>(`SELECT CAST(COALESCE(SUM(montant_total), 0) AS CHAR) as total FROM ventes WHERE DATE(date_vente) BETWEEN ? AND ?`, [dates.start, dates.end]);
            const sales = parseFloat(salesRes[0]?.total || "0");

            // Purchases
            const purchasesRes = await db.select<any[]>(`SELECT CAST(COALESCE(SUM(montant_total), 0) AS CHAR) as total FROM stock_bons_livraison WHERE DATE(date_bl) BETWEEN ? AND ?`, [dates.start, dates.end]);
            const purchases = parseFloat(purchasesRes[0]?.total || "0");

            // Expenses (Decaissements)
            const expensesRes = await db.select<any[]>(`SELECT CAST(COALESCE(SUM(montant), 0) AS CHAR) as total FROM caisse_mouvements WHERE type = 'DECAISSEMENT' AND DATE(date_mouvement) BETWEEN ? AND ?`, [dates.start, dates.end]);
            const expenses = parseFloat(expensesRes[0]?.total || "0");

            setStats({ sales, purchases, expenses, result: sales - purchases - expenses });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (!stats) return;
        const w = window.open('', '', 'width=800,height=600');
        if (w) {
            w.document.write(`
                <html><body>
                <h2 style="text-align:center">Rapport Périodique d'Activité</h2>
                <div style="text-align:center; margin-bottom:20px">Période du ${new Date(dates.start).toLocaleDateString()} au ${new Date(dates.end).toLocaleDateString()}</div>
                <table style="width:100%; border-collapse:collapse; margin-top:30px">
                    <tr><td style="padding:10px; border:1px solid #ccc">Total Ventes</td><td style="padding:10px; border:1px solid #ccc; text-align:right; color:green">${stats.sales.toLocaleString()} F</td></tr>
                    <tr><td style="padding:10px; border:1px solid #ccc">Total Achats</td><td style="padding:10px; border:1px solid #ccc; text-align:right; color:#d35400">${stats.purchases.toLocaleString()} F</td></tr>
                    <tr><td style="padding:10px; border:1px solid #ccc">Total Dépenses</td><td style="padding:10px; border:1px solid #ccc; text-align:right; color:red">${stats.expenses.toLocaleString()} F</td></tr>
                    <tr><td style="padding:10px; border:1px solid #ccc; font-weight:bold">RÉSULTAT NET ESTIMÉ</td><td style="padding:10px; border:1px solid #ccc; text-align:right; font-weight:bold; font-size:18px">${stats.result.toLocaleString()} F</td></tr>
                </table>
                <script>window.print();</script>
                </body></html>
            `);
            w.document.close();
        }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Rubrique", "Montant"],
            ["Total Ventes", stats.sales],
            ["Total Achats", stats.purchases],
            ["Total Dépenses", stats.expenses],
            ["RÉSULTAT NET", stats.result]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "RapportActivite");
        XLSX.writeFile(wb, `Activite_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#16a085' }}>📈 Rapport d'Activité</h2>
            </div>
            <div style={{ background: '#e8f6f3', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#16a085' }}>{loading ? '...' : 'Calculer'}</button>
                {stats && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ padding: '20px', background: 'white', border: '1px solid #eee', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Chiffre d'Affaires</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>{stats.sales.toLocaleString()} F</div>
                    </div>
                    <div style={{ padding: '20px', background: 'white', border: '1px solid #eee', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Achats Stock</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d35400' }}>{stats.purchases.toLocaleString()} F</div>
                    </div>
                    <div style={{ padding: '20px', background: 'white', border: '1px solid #eee', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Dépenses / Charges</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c0392b' }}>{stats.expenses.toLocaleString()} F</div>
                    </div>
                    <div style={{ padding: '20px', background: '#ecf0f1', border: '1px solid #bdc3c7', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#2c3e50' }}>RÉSULTAT THÉORIQUE</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>{stats.result.toLocaleString()} F</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 10. Daily Cash Journal
function ReportDailyCashJournal({ onBack }: { onBack: () => void }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();

            // Get Sales (Cash only)
            const sales = await db.select<any[]>(`
                SELECT id, date_vente as date, CONCAT('Vente Ticket #', numero_ticket) as libelle, part_patient as montant, 'IN' as sens
                FROM ventes 
                WHERE DATE(date_vente) = ? AND (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES')
            `, [date]);

            // Get Movements
            const movements = await db.select<any[]>(`
                SELECT id, date_mouvement as date, motif as libelle, montant, CASE WHEN type = 'DECAISSEMENT' THEN 'OUT' ELSE 'IN' END as sens
                FROM caisse_mouvements
                WHERE DATE(date_mouvement) = ? AND (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES')
            `, [date]);

            const merged = [...sales, ...movements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Calculate running balance
            let solde = 0;
            const finalData = merged.map(m => {
                if (m.sens === 'IN') solde += m.montant;
                else solde -= m.montant;
                return { ...m, solde };
            });

            setData(finalData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Rien à imprimer");
        const totalIn = data.filter(d => d.sens === 'IN').reduce((acc, r) => acc + r.montant, 0);
        const totalOut = data.filter(d => d.sens === 'OUT').reduce((acc, r) => acc + r.montant, 0);

        printReport(`Journal de Caisse - ${new Date(date).toLocaleDateString()}`, { start: date, end: date }, ['Heure', 'Libellé', 'Entrée', 'Sortie', 'Solde'],
            `Total Entrées: ${totalIn.toLocaleString()} | Total Sorties: ${totalOut.toLocaleString()} | Solde Fin: ${(totalIn - totalOut).toLocaleString()}`,
            data, r => `
            <tr>
                <td>${new Date(r.date).toLocaleTimeString()}</td>
                <td>${r.libelle}</td>
                <td style="text-align:right; color:green">${r.sens === 'IN' ? r.montant.toLocaleString() : ''}</td>
                <td style="text-align:right; color:red">${r.sens === 'OUT' ? r.montant.toLocaleString() : ''}</td>
                <td style="text-align:right; font-weight:bold">${r.solde.toLocaleString()}</td>
            </tr>
        `);
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Heure", "Libellé / Opération", "Entrée", "Sortie", "Solde Progressif"],
            ...data.map(r => [new Date(r.date).toLocaleTimeString(), r.libelle, r.sens === 'IN' ? r.montant : 0, r.sens === 'OUT' ? r.montant : 0, r.solde])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "JournalCaisse");
        XLSX.writeFile(wb, `JournalCaisse_${date}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#f39c12' }}>📒 Journal de Caisse</h2>
            </div>
            <div style={{ background: '#fef9e7', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Date : <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#f39c12' }}>{loading ? '...' : 'Afficher'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#d35400', color: 'white' }}><th style={thStyle}>Heure</th><th style={thStyle}>Libellé / Opération</th><th style={thStyle}>Entrée</th><th style={thStyle}>Sortie</th><th style={thStyle}>Solde Progressif</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.date).toLocaleTimeString()}</td>
                            <td style={tdStyle}>{r.libelle}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'green' }}>{r.sens === 'IN' ? r.montant.toLocaleString() : '-'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'red' }}>{r.sens === 'OUT' ? r.montant.toLocaleString() : '-'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{r.solde.toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Aucun mouvement.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 11. Cash Flow Period Report (Somme des Journaux de Caisse)
function ReportCashFlowPeriod({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date(new Date().setDate(1)).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();

            // 1. Get Daily Cash Sales
            const salesRes = await db.select<any[]>(`
                SELECT DATE(date_vente) as day, CAST(SUM(part_patient) AS CHAR) as total_sales 
                FROM ventes 
                WHERE (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES') AND DATE(date_vente) BETWEEN ? AND ? 
                GROUP BY DATE(date_vente)
            `, [dates.start, dates.end]);

            // 2. Get Daily Cash Movements (In/Out)
            const movementsRes = await db.select<any[]>(`
                SELECT DATE(date_mouvement) as day, type, CAST(SUM(montant) AS CHAR) as total 
                FROM caisse_mouvements 
                WHERE (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES') AND DATE(date_mouvement) BETWEEN ? AND ? 
                GROUP BY DATE(date_mouvement), type
            `, [dates.start, dates.end]);

            // 3. Merge Data
            const dailyStats: Record<string, { in: number, out: number }> = {};

            salesRes.forEach(s => {
                const day = s.day;
                if (!dailyStats[day]) dailyStats[day] = { in: 0, out: 0 };
                dailyStats[day].in += parseFloat(s.total_sales || "0");
            });

            movementsRes.forEach(m => {
                const day = m.day;
                if (!dailyStats[day]) dailyStats[day] = { in: 0, out: 0 };
                const val = parseFloat(m.total || "0");
                if (m.type === 'DECAISSEMENT') dailyStats[m.day].out += val;
                else dailyStats[m.day].in += val; // ENCAISSEMENT
            });

            const merged = Object.keys(dailyStats).sort().map(day => ({
                day,
                in: dailyStats[day].in,
                out: dailyStats[day].out,
                balance: dailyStats[day].in - dailyStats[day].out
            }));

            setData(merged);
        } catch (e) { console.error(e); alert("Erreur chargement récap caisse"); }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Rien à imprimer");
        const totalIn = data.reduce((acc, r) => acc + r.in, 0);
        const totalOut = data.reduce((acc, r) => acc + r.out, 0);

        printReport(`Somme des Journaux de Caisse`, dates, ['Date', 'Total Entrées', 'Total Sorties', 'Solde Journée'],
            `Total Entrées: ${totalIn.toLocaleString()} | Total Sorties: ${totalOut.toLocaleString()} | Résultat: ${(totalIn - totalOut).toLocaleString()}`,
            data, r => `
            <tr>
                <td>${new Date(r.day).toLocaleDateString()}</td>
                <td style="text-align:right; color:green">${r.in.toLocaleString()} F</td>
                <td style="text-align:right; color:red">${r.out.toLocaleString()} F</td>
                <td style="text-align:right; font-weight:bold">${r.balance > 0 ? '+' : ''}${r.balance.toLocaleString()} F</td>
            </tr>
        `);
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date", "Total Entrées", "Total Sorties", "Solde Journalier"],
            ...data.map(r => [new Date(r.day).toLocaleDateString(), r.in, r.out, r.balance])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "SommeJournaux");
        XLSX.writeFile(wb, `SommeJournaux_${dates.start}_${dates.end}.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#d35400' }}>📅 Somme des Journaux de Caisse</h2>
            </div>
            <div style={{ background: '#fdf2e9', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#e67e22' }}>{loading ? '...' : 'Afficher'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#e67e22', color: 'white' }}><th style={thStyle}>Date</th><th style={thStyle}>Total Entrées (Vente+Enc)</th><th style={thStyle}>Total Sorties (Dépenses)</th><th style={thStyle}>Solde Journalier</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.day).toLocaleDateString()}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'green' }}>{r.in.toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'red' }}>{r.out.toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{r.balance.toLocaleString()} F</td>
                        </tr>
                    ))}
                    {data.length === 0 && !loading && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Aucune donnée pour la période.</td></tr>}
                    {data.length > 0 && (
                        <tr style={{ background: '#fef9e7', fontWeight: 'bold' }}>
                            <td style={tdStyle}>TOTAL PÉRIODE</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'green' }}>{data.reduce((acc, r) => acc + r.in, 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'red' }}>{data.reduce((acc, r) => acc + r.out, 0).toLocaleString()} F</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#d35400' }}>{(data.reduce((acc, r) => acc + r.in, 0) - data.reduce((acc, r) => acc + r.out, 0)).toLocaleString()} F</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// 12. Cash Discrepancy Report (Contrôle de Caisse / Ecart)
function ReportCashDiscrepancy({ onBack }: { onBack: () => void }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [operatorId, setOperatorId] = useState<number | 'ALL'>('ALL');
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [physicalAmount, setPhysicalAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getDb().then(db => db.select<any[]>('SELECT id, nom_complet FROM app_utilisateurs').then(setUsers));
    }, []);

    const calculateTheoretical = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const userFilterSales = operatorId === 'ALL' ? '' : `AND user_id = ${operatorId}`;
            const userFilterMovs = operatorId === 'ALL' ? '' : `AND user_id = ${operatorId}`;

            // Sales (Cash)
            const salesRes = await db.select<any[]>(`
                SELECT CAST(COALESCE(SUM(part_patient), 0) AS CHAR) as total 
                FROM ventes 
                WHERE DATE(date_vente) = ? AND (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES') ${userFilterSales}
            `, [date]);
            const sales = parseFloat(salesRes[0]?.total || "0");

            // Movements
            const movsRes = await db.select<any[]>(`
                SELECT type, CAST(COALESCE(SUM(montant), 0) AS CHAR) as total 
                FROM caisse_mouvements 
                WHERE DATE(date_mouvement) = ? AND (mode_paiement LIKE 'ESP%CE' OR mode_paiement = 'ESPECES') ${userFilterMovs}
                GROUP BY type
            `, [date]);

            const inMovs = parseFloat(movsRes.find(m => m.type !== 'DECAISSEMENT')?.total || "0");
            const outMovs = parseFloat(movsRes.find(m => m.type === 'DECAISSEMENT')?.total || "0");

            setStats({ sales, inMovs, outMovs, theoretical: sales + inMovs - outMovs });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (!stats) return;
        const physical = parseFloat(physicalAmount) || 0;
        const diff = physical - stats.theoretical;
        const operatorName = operatorId === 'ALL' ? 'Tous les opérateurs' : users.find(u => u.id === operatorId)?.nom_complet || 'Inconnu';

        const w = window.open('', '', 'width=800,height=700');
        if (w) {
            w.document.write(`
                <html><body>
                <div style="text-align:center; font-family:sans-serif; padding:20px">
                    <h2>⚖️ PROCÈS-VERBAL DE CONTRÔLE DE CAISSE</h2>
                    <p>Date du contrôle : <strong>${new Date(date).toLocaleDateString()}</strong></p>
                    <p>Opérateur concerné : <strong>${operatorName}</strong></p>
                    <hr style="border:1px solid #333; margin:20px 0"/>
                    
                    <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
                        <thead>
                            <tr style="background:#eee"><th style="padding:10px; text-align:left">Désignation</th><th style="padding:10px; text-align:right">Montant</th></tr>
                        </thead>
                        <tbody>
                            <tr><td style="padding:10px; border-bottom:1px solid #ddd">Total Ventes (Espèces)</td><td style="padding:10px; border-bottom:1px solid #ddd; text-align:right">${stats.sales.toLocaleString()} F</td></tr>
                            <tr><td style="padding:10px; border-bottom:1px solid #ddd">Total Autres Entrées</td><td style="padding:10px; border-bottom:1px solid #ddd; text-align:right">${stats.inMovs.toLocaleString()} F</td></tr>
                            <tr><td style="padding:10px; border-bottom:1px solid #ddd">Total Sorties / Décaissements</td><td style="padding:10px; border-bottom:1px solid #ddd; text-align:right; color:red">-${stats.outMovs.toLocaleString()} F</td></tr>
                            <tr style="font-weight:bold; background:#f9f9f9"><td style="padding:10px; border-top:2px solid #333">SOLDE THÉORIQUE CAISSE</td><td style="padding:10px; border-top:2px solid #333; text-align:right">${stats.theoretical.toLocaleString()} F</td></tr>
                        </tbody>
                    </table>

                    <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border:2px solid #333; padding:20px">
                        <div style="font-size:18px">MONTANT PHYSIQUE CONSTATÉ :</div>
                        <div style="font-size:24px; font-weight:bold">${physical.toLocaleString()} F</div>
                    </div>

                    <div style="margin-top:20px; text-align:center; font-size:20px; font-weight:bold; color:${diff >= 0 ? 'green' : 'red'}">
                        ÉCART DE CAISSE : ${diff > 0 ? '+' : ''}${diff.toLocaleString()} F
                        <div style="font-size:12px; font-weight:normal; color:#555; margin-top:5px">
                            ${diff === 0 ? '✅ Caisse Équilibrée' : (diff > 0 ? '⚠️ Excédent de Caisse' : '⚠️ Déficit de Caisse')}
                        </div>
                    </div>

                    <div style="margin-top:50px; display:flex; justify-content:space-between; font-size:12px">
                        <div style="text-align:center; width:200px; border-top:1px solid #ccc; padding-top:5px">Signature Caissier</div>
                        <div style="text-align:center; width:200px; border-top:1px solid #ccc; padding-top:5px">Signature Responsable</div>
                    </div>
                </div>
                <script>window.print();</script>
                </body></html>
            `);
            w.document.close();
        }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const physical = parseFloat(physicalAmount) || 0;
        const diff = physical - stats.theoretical;
        const wsData = [
            ["Rubrique", "Montant"],
            ["Total Ventes (Espèces)", stats.sales],
            ["Total Autres Entrées", stats.inMovs],
            ["Total Sorties", -stats.outMovs],
            ["SOLDE THÉORIQUE", stats.theoretical],
            ["MONTANT PHYSIQUE", physical],
            ["ECART", diff]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "ControleCaisse");
        XLSX.writeFile(wb, `ControleCaisse_${date}.xlsx`);
    };

    const discrepancy = stats ? (parseFloat(physicalAmount) || 0) - stats.theoretical : 0;

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#e74c3c' }}>⚖️ Contrôle & Ecart de Caisse</h2>
            </div>
            <div style={{ background: '#fdedec', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Date : <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></label>
                <label>Opérateur :
                    <select value={operatorId} onChange={e => setOperatorId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} style={inputStyle}>
                        <option value="ALL">-- Tous --</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.nom_complet}</option>)}
                    </select>
                </label>
                <button onClick={calculateTheoretical} disabled={loading} style={{ ...btnActionStyle, background: '#e74c3c' }}>{loading ? '...' : 'Calculer Théorique'}</button>
            </div>

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Calcul Théorique</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span>Ventes (Espèces) :</span> <strong>{stats.sales.toLocaleString()} F</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span>Entrées Diverses :</span> <strong style={{ color: 'green' }}>{stats.inMovs.toLocaleString()} F</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span>Sorties / Dépenses :</span> <strong style={{ color: 'red' }}>-{stats.outMovs.toLocaleString()} F</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #eee', fontSize: '18px', fontWeight: 'bold' }}>
                            <span>SOLDE ATTENDU :</span> <span>{stats.theoretical.toLocaleString()} F</span>
                        </div>
                    </div>

                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Constat Physique</h3>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Montant compté en Caisse :</label>
                            <input
                                type="number"
                                value={physicalAmount}
                                onChange={e => setPhysicalAmount(e.target.value)}
                                style={{ width: '100%', padding: '15px', fontSize: '24px', fontWeight: 'bold', border: '2px solid #3498db', borderRadius: '8px', textAlign: 'right' }}
                                placeholder="0"
                            />
                        </div>

                        <div style={{ textAlign: 'center', padding: '15px', background: discrepancy === 0 ? '#e8f8f5' : (discrepancy > 0 ? '#fef9e7' : '#fdedec'), borderRadius: '8px', border: `1px solid ${discrepancy === 0 ? '#2ecc71' : (discrepancy > 0 ? '#f1c40f' : '#e74c3c')}` }}>
                            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>ÉCART CONSTATÉ</div>
                            <div style={{ fontSize: '30px', fontWeight: 'bold', color: discrepancy === 0 ? '#27ae60' : (discrepancy > 0 ? '#d35400' : '#c0392b') }}>
                                {discrepancy > 0 ? '+' : ''}{discrepancy.toLocaleString()} F
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px', color: '#555' }}>
                                {discrepancy === 0 ? 'PARFAIT - AUCUN ÉCART' : (discrepancy > 0 ? 'EXCÉDENT (Trop perçu)' : 'DÉFICIT (Manquant)')}
                            </div>
                        </div>

                        <button onClick={handlePrint} style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Imprimer PV de Caisse</button>
                        <button onClick={exportToExcel} style={{ width: '100%', marginTop: '10px', padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Exporter Excel (.xlsx)</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// 13. Deleted Sales Trace
function ReportDeletedSales({ onBack }: { onBack: () => void }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT vs.id, vs.vente_id, vs.patient_nom, vs.acte_libelle, 
                        CAST(vs.montant_total AS CHAR) as montant_total, 
                       vs.raison_suppression, vs.date_suppression, 
                       u.nom_complet as user_nom 
                FROM ventes_supprimees vs 
                LEFT JOIN app_utilisateurs u ON vs.user_id = u.id 
                ORDER BY vs.date_suppression DESC
            `);
            setData(res.map(r => ({ ...r, montant_total: parseFloat(r.montant_total || "0") })));
        } catch (e) { alert("Erreur chargement traces"); } finally { setLoading(false); }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date Suppr.", "Patient", "Acte", "Montant", "Motif", "Par"],
            ...data.map(r => [new Date(r.date_suppression).toLocaleString(), r.patient_nom, r.acte_libelle, r.montant_total, r.raison_suppression, r.user_nom])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "VentesSupprimees");
        XLSX.writeFile(wb, `VentesSupprimees.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#e74c3c' }}>🗑️ Traces des Ventes Supprimées {loading && <small>(Chargement...)</small>}</h2>
            </div>
            {data.length > 0 && (
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                    <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#c0392b', color: 'white' }}><th style={thStyle}>Date Suppr.</th><th style={thStyle}>Patient</th><th style={thStyle}>Acte</th><th style={thStyle}>Montant</th><th style={thStyle}>Motif</th><th style={thStyle}>Par</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.date_suppression).toLocaleString()}</td>
                            <td style={tdStyle}>{r.patient_nom}</td>
                            <td style={tdStyle}>{r.acte_libelle}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.montant_total} F</td>
                            <td style={tdStyle}>{r.raison_suppression}</td>
                            <td style={tdStyle}>{r.user_nom || 'Système'}</td>
                        </tr>
                    ))}
                    {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Aucune suppression enregistrée.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 14. Debt Modification Log (État des modifications des restes)
function ReportDebtModif({ onBack }: { onBack: () => void }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT lm.*, u.nom_complet as user_nom, v.numero_ticket 
                FROM logs_modifications lm
                LEFT JOIN app_utilisateurs u ON lm.user_id = u.id
                LEFT JOIN ventes v ON lm.record_id = v.id
                WHERE lm.table_name = 'ventes' AND lm.field_name = 'reste_a_payer'
                ORDER BY lm.date_modification DESC
            `);
            setData(res);
        } catch (e) { alert("Erreur chargement logs"); } finally { setLoading(false); }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date", "Ticket", "Ancien Solde", "Nouveau Solde", "Motif", "Par"],
            ...data.map(r => [new Date(r.date_modification).toLocaleString(), r.numero_ticket, r.old_value, r.new_value, r.motif, r.user_nom])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "ModifDettes");
        XLSX.writeFile(wb, `ModifDettes.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#8e44ad' }}>📝 Modifications des Restes à Payer {loading && <small>(Chargement...)</small>}</h2>
            </div>
            {data.length > 0 && (
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                    <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#9b59b6', color: 'white' }}><th style={thStyle}>Date</th><th style={thStyle}>Ticket</th><th style={thStyle}>Ancien Solde</th><th style={thStyle}>Nouveau Solde</th><th style={thStyle}>Delta</th><th style={thStyle}>Motif</th><th style={thStyle}>Par</th></tr></thead>
                <tbody>
                    {data.map((r, i) => {
                        const delta = parseFloat(r.old_value) - parseFloat(r.new_value);
                        return (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={tdStyle}>{new Date(r.date_modification).toLocaleString()}</td>
                                <td style={tdStyle}>{r.numero_ticket || `ID-${r.record_id}`}</td>
                                <td style={{ ...tdStyle, color: '#7f8c8d' }}>{parseFloat(r.old_value).toLocaleString()} F</td>
                                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{parseFloat(r.new_value).toLocaleString()} F</td>
                                <td style={{ ...tdStyle, color: 'green' }}>⬇ -{delta.toLocaleString()} F</td>
                                <td style={tdStyle}>{r.motif}</td>
                                <td style={tdStyle}>{r.user_nom || 'Système'}</td>
                            </tr>
                        );
                    })}
                    {data.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Aucune modification enregistrée.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 15. Deleted BL Trace
function ReportDeletedBL({ onBack }: { onBack: () => void }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT bl.*, u.nom_complet as user_nom 
                FROM stock_bl_supprimes bl 
                LEFT JOIN app_utilisateurs u ON bl.user_id = u.id 
                ORDER BY bl.date_suppression DESC
            `);
            setData(res);
        } catch (e) { alert("Erreur chargement traces BL"); } finally { setLoading(false); }
    };

    const verifierDetails = (detailsJson: string) => {
        try {
            if (!detailsJson || detailsJson === '[]') return alert("Ce BL était vide lors de la suppression.");
            const details = JSON.parse(detailsJson);
            if (!Array.isArray(details) || details.length === 0) return alert("Aucun détail archivé.");

            const w = window.open('', '', 'width=700,height=500');
            if (w) {
                w.document.write(`
                    <html><body style="font-family:sans-serif; padding:20px;">
                    <h3 style="color:#c0392b">Détails du BL Supprimé (Archive)</h3>
                    <table border="1" style="width:100%; border-collapse:collapse; border-color:#eee;">
                        <tr style="background:#f9f9f9"><th>Article</th><th>Qté</th><th>Prix HT</th><th>Total</th></tr>
                        ${details.map(d => `
                            <tr>
                                <td style="padding:8px">${d.designation || 'ID: ' + d.article_id}</td>
                                <td style="padding:8px; text-align:center; font-weight:bold">${d.quantite}</td>
                                <td style="padding:8px; text-align:right">${d.prix_achat_ht ? d.prix_achat_ht.toLocaleString() : '-'}</td>
                                <td style="padding:8px; text-align:right">${d.total_ligne ? d.total_ligne.toLocaleString() : '-'}</td>
                            </tr>`).join('')}
                    </table>
                    <div style="font-size:12px; color:#7f8c8d; margin-top:20px">
                        * Les données ci-dessus sont une copie figée au moment de la suppression.
                    </div>
                    </body></html>
                `);
            }
        } catch (e) { alert("Format d'archive illisible."); }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date Suppr.", "Numéro BL", "Fournisseur", "Montant", "Par"],
            ...data.map(r => [new Date(r.date_suppression).toLocaleString(), r.numero_bl, r.fournisseur_nom, r.montant_total, r.user_nom])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "BLSupprimes");
        XLSX.writeFile(wb, `BLSupprimes.xlsx`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#c0392b' }}>🚚 Traces des BL Supprimés {loading && <small>(Chargement...)</small>}</h2>
            </div>
            {data.length > 0 && (
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                    <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#e74c3c', color: 'white' }}><th style={thStyle}>Date Suppr.</th><th style={thStyle}>Numéro BL</th><th style={thStyle}>Fournisseur</th><th style={thStyle}>Montant</th><th style={thStyle}>Par</th><th style={thStyle}>Détails</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{new Date(r.date_suppression).toLocaleString()}</td>
                            <td style={tdStyle}>{r.numero_bl}</td>
                            <td style={tdStyle}>{r.fournisseur_nom}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{r.montant_total ? r.montant_total.toLocaleString() : 0} F</td>
                            <td style={tdStyle}>{r.user_nom || 'Système'}</td>
                            <td style={tdStyle}><button onClick={() => verifierDetails(r.details_json)} style={{ cursor: 'pointer', border: 'none', background: 'none' }}>🔍 Voir</button></td>
                        </tr>
                    ))}
                    {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Aucun BL supprimé.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// 16. Detailed Entries/Exits Report (Excel Model)
function ReportEntreesSorties({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ in: 0, out: 0, solde: 0 });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // 1. Sales (Money In: Cash + Mobile etc. Excludes unpaid Credit)
            // We calculate amount as (part_patient - reste_a_payer) to get what was actually PAID.
            const sales = await db.select<any[]>(`
                SELECT v.id, v.date_vente as date_mvt, 
                       CONCAT('Vente #', v.id, ' - ', COALESCE(p.nom_prenoms, 'Patient Passager')) as libelle,
                       (v.part_patient - v.reste_a_payer) as montant, 
                       v.mode_paiement as mode,
                       'IN' as type
                FROM ventes v
                LEFT JOIN patients p ON v.patient_id = p.id
                WHERE (v.part_patient - v.reste_a_payer) > 0 
                  AND DATE(v.date_vente) BETWEEN ? AND ?
            `, [dates.start, dates.end]);

            // 2. Movements (All modes)
            const movements = await db.select<any[]>(`
                SELECT m.id, m.date_mouvement as date_mvt, 
                       m.motif as libelle,
                       m.montant as montant, 
                       m.mode_paiement as mode,
                       CASE WHEN m.type = 'ENCAISSEMENT' THEN 'IN' ELSE 'OUT' END as type
                FROM caisse_mouvements m
                WHERE DATE(m.date_mouvement) BETWEEN ? AND ?
            `, [dates.start, dates.end]);

            // 3. Merge & Sort
            // Previous Balance Calculation is complex with mixed modes, so we reset to 0 or we need a global historical calc.
            // For now, let's keep it simple: Flow within period. 
            // If user wants historical balance, they should use Cash Control for Cash, or Bank for Bank.
            // This report is "Entrées / Sorties" (Flow).

            let runningBalance = 0;
            const all = [...sales, ...movements].sort((a, b) => new Date(a.date_mvt).getTime() - new Date(b.date_mvt).getTime());

            const finalData = all.map(item => {
                if (item.type === 'IN') runningBalance += item.montant;
                else runningBalance -= item.montant;
                return { ...item, balance: runningBalance };
            });

            setData(finalData);
            setStats({
                in: finalData.filter(d => d.type === 'IN').reduce((acc, c) => acc + c.montant, 0),
                out: finalData.filter(d => d.type === 'OUT').reduce((acc, c) => acc + c.montant, 0),
                solde: runningBalance
            });

        } catch (e) { console.error(e); alert("Erreur chargement rapport"); } finally { setLoading(false); }
    };

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Date", "Libellé", "Mode", "Entrée", "Sortie", "Solde Prog."],
            ...data.map(r => [
                new Date(r.date_mvt).toLocaleDateString() + ' ' + new Date(r.date_mvt).toLocaleTimeString(),
                r.libelle,
                r.mode,
                r.type === 'IN' ? r.montant : 0,
                r.type === 'OUT' ? r.montant : 0,
                r.balance
            ]),
            ["", "TOTAL", "", stats.in, stats.out, stats.solde]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Rapport Entrées Sorties");
        XLSX.writeFile(wb, `Rapport_Entrees_Sorties_${dates.start}_${dates.end}.xlsx`);
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Rien à imprimer");
        printReport(`Rapport Entrées / Sorties`, dates, ['Date', 'Libellé', 'Mode', 'Entrée', 'Sortie', 'Solde'],
            `Solde Période: ${stats.solde.toLocaleString()} F | Total Entrées: ${stats.in.toLocaleString()} F | Total Sorties: ${stats.out.toLocaleString()} F`,
            data, r => `
            <tr>
                <td>${new Date(r.date_mvt).toLocaleDateString()} ${new Date(r.date_mvt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${r.libelle}</td>
                <td>${r.mode || '-'}</td>
                <td style="text-align:right; color:green">${r.type === 'IN' ? r.montant.toLocaleString() : '-'}</td>
                <td style="text-align:right; color:red">${r.type === 'OUT' ? r.montant.toLocaleString() : '-'}</td>
                <td style="text-align:right; font-weight:bold">${r.balance.toLocaleString()}</td>
            </tr>
        `);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>📑 Rapport Entrées / Sorties (Tout Mode)</h2>
            </div>
            <div style={{ background: '#ecf0f1', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Du : <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} style={inputStyle} /></label>
                <label>Au : <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#3498db' }}>{loading ? '...' : 'Afficher'}</button>
                {data.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Imprimer</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel (.xlsx)</button>
                    </>
                )}
            </div>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '14px' }}>
                <div style={{ background: 'green', color: 'white', padding: '10px', borderRadius: '5px' }}>Total Entrées: <b>{stats.in.toLocaleString()} F</b></div>
                <div style={{ background: 'red', color: 'white', padding: '10px', borderRadius: '5px' }}>Total Sorties: <b>{stats.out.toLocaleString()} F</b></div>
                <div style={{ background: '#2c3e50', color: 'white', padding: '10px', borderRadius: '5px' }}>Solde Période: <b>{stats.solde.toLocaleString()} F</b></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr style={{ background: '#bdc3c7', color: '#2c3e50' }}><th style={thStyle}>Date</th><th style={thStyle}>Libellé</th><th style={thStyle}>Mode</th><th style={thStyle}>Entrée</th><th style={thStyle}>Sortie</th><th style={thStyle}>Solde Prog.</th></tr></thead>
                <tbody>
                    {data.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                            <td style={tdStyle}>{new Date(r.date_mvt).toLocaleString()}</td>
                            <td style={tdStyle}>{r.libelle}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold', color: '#555' }}>{r.mode}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'green' }}>{r.type === 'IN' ? r.montant.toLocaleString() : ''}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'red' }}>{r.type === 'OUT' ? r.montant.toLocaleString() : ''}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{r.balance.toLocaleString()}</td>
                        </tr>
                    ))}
                    {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Aucune donnée pour cette période.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

function AccountingDocuments() {
    const [view, setView] = useState('MENU'); // MENU, REPORT_REVENUE_OP, REPORT_ACCOUNTS_RECEIVABLE, REPORT_SALES, REPORT_PURCHASE, REPORT_PERIODIC, REPORT_CASH, REPORT_CASH_PERIOD, REPORT_CASH_DISCREPANCY, REPORT_DELETED, REPORT_DEBT_MODIF, REPORT_DELETED_BL, REPORT_ENTREES_SORTIES

    if (view === 'REPORT_REVENUE_OP') return <ReportRevenueByOperator onBack={() => setView('MENU')} />;
    if (view === 'REPORT_ACCOUNTS_RECEIVABLE') return <ReportAccountsReceivable onBack={() => setView('MENU')} />;
    if (view === 'REPORT_SALES') return <ReportSalesJournal onBack={() => setView('MENU')} />;
    if (view === 'REPORT_PURCHASE') return <ReportPurchaseJournal onBack={() => setView('MENU')} />;
    if (view === 'REPORT_PERIODIC') return <ReportPeriodicActivity onBack={() => setView('MENU')} />;
    if (view === 'REPORT_CASH') return <ReportDailyCashJournal onBack={() => setView('MENU')} />;
    if (view === 'REPORT_CASH_PERIOD') return <ReportCashFlowPeriod onBack={() => setView('MENU')} />;
    if (view === 'REPORT_CASH_DISCREPANCY') return <ReportCashDiscrepancy onBack={() => setView('MENU')} />;
    if (view === 'REPORT_DELETED') return <ReportDeletedSales onBack={() => setView('MENU')} />;
    if (view === 'REPORT_DEBT_MODIF') return <ReportDebtModif onBack={() => setView('MENU')} />;
    if (view === 'REPORT_DELETED_BL') return <ReportDeletedBL onBack={() => setView('MENU')} />;
    if (view === 'REPORT_ENTREES_SORTIES') return <ReportEntreesSorties onBack={() => setView('MENU')} />;

    const cards = [
        { id: 'REPORT_ENTREES_SORTIES', title: 'Rapport Entrées / Sorties', icon: '📑', desc: 'Détail mouvements avec Export Excel' },
        { id: 'REPORT_REVENUE_OP', title: 'Recettes par Opérateur', icon: '💰', desc: 'Ventes Cash et Encaissements par agent' },
        { id: 'REPORT_ACCOUNTS_RECEIVABLE', title: 'État des Comptes Clients', icon: '📉', desc: 'Dettes Assurances et Personnel' },
        { id: 'REPORT_CASH', title: 'Journal de Caisse (Jour)', icon: '📒', desc: 'Mouvements espèces journaliers (Détail)' },
        { id: 'REPORT_CASH_PERIOD', title: 'Somme Journaux Caisse', icon: '📅', desc: 'Récapitulatif espèces par jour' },
        { id: 'REPORT_CASH_DISCREPANCY', title: 'Contrôle & Ecart Caisse', icon: '⚖️', desc: 'Validation solde physique / théorique' },
        { id: 'REPORT_SALES', title: 'Journal des Ventes', icon: '🛒', desc: 'Historique exhaustif des ventes' },
        { id: 'REPORT_DELETED', title: 'Ventes Supprimées', icon: '🗑️', desc: 'Historique des annulations / suppressions' },
        { id: 'REPORT_DEBT_MODIF', title: 'Modifications Restes', icon: '📝', desc: 'Suivi des changements de dettes' },
        { id: 'REPORT_PURCHASE', title: 'Journal des Achats', icon: '🚚', desc: 'Historique des approvisionnements' },
        { id: 'REPORT_DELETED_BL', title: 'BL Supprimés', icon: '🚛', desc: 'Historique des BL supprimés' },
        { id: 'REPORT_PERIODIC', title: 'Rapport d\'Activité', icon: '📈', desc: 'Synthèse Ventes / Achats / Charges' },
    ];

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>💰 Documents Comptables</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {cards.map(c => (
                    <div key={c.id} onClick={() => setView(c.id)} style={cardStyle}>
                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>{c.icon}</div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#2c3e50', marginBottom: '5px' }}>{c.title}</div>
                        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>{c.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function DocumentsMain() {
    const [subView, setSubView] = useState('dashboard');
    const [printContent, setPrintContent] = useState<string | null>(null);

    // Wire up the global print function to this component's state
    useEffect(() => {
        setPrintPreview = setPrintContent;
        return () => { setPrintPreview = () => { }; };
    }, []);

    const sidebarStyle = {
        width: '260px', background: 'white', borderRight: '1px solid #e0e0e0',
        display: 'flex', flexDirection: 'column' as const
    };
    const menuItemStyle = (active: boolean) => ({
        padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
        background: active ? '#e3f2fd' : 'transparent', color: active ? '#1976d2' : '#546e7a',
        borderRight: active ? '3px solid #1976d2' : 'none', fontWeight: active ? '600' : '500',
        fontSize: '14px', transition: '0.2s'
    });

    return (
        <div style={{ display: 'flex', height: '100%', fontFamily: 'Inter, sans-serif', background: '#f4f6f9' }}>
            {/* Print Overlay at Root Level */}
            <PrintOverlay content={printContent!} onClose={() => setPrintContent(null)} />

            {/* LEFT SIDEBAR */}
            <div style={sidebarStyle}>
                <div style={{ padding: '25px 20px', borderBottom: '1px solid #eee' }}>
                    <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>📂 DOCUMENTS</h2>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#90a4ae' }}>Gestion centralisée</p>
                </div>
                <div style={{ flex: 1, padding: '15px 0', overflowY: 'auto' }}>
                    <div style={{ padding: '0 20px 10px 20px', fontSize: '11px', fontWeight: 'bold', color: '#b0bec5', letterSpacing: '0.5px' }}>GÉNÉRAL</div>
                    <div onClick={() => setSubView('dashboard')} style={menuItemStyle(subView === 'dashboard')}>
                        📊 Tableau de Bord
                    </div>

                    <div style={{ padding: '20px 20px 10px 20px', fontSize: '11px', fontWeight: 'bold', color: '#b0bec5', letterSpacing: '0.5px' }}>MODULES</div>
                    <div onClick={() => setSubView('stock_docs')} style={menuItemStyle(subView === 'stock_docs')}>
                        📦 Documents Stock
                    </div>
                    <div onClick={() => setSubView('accounting_docs')} style={menuItemStyle(subView === 'accounting_docs')}>
                        💰 Documents Comptable
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <div style={{ background: 'white', borderRadius: '12px', minHeight: '100%', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    {subView === 'dashboard' && <DashboardDocuments />}
                    {subView === 'stock_docs' && <StockDocuments />}
                    {subView === 'accounting_docs' && <AccountingDocuments />}
                </div>
            </div>
        </div>
    );
}
