const fs = require('fs');

let content = fs.readFileSync('src/views/DocumentsMain.tsx', 'utf8');

const newFunc = `function ReportMouvements({ onBack }: { onBack: () => void }) {
    const [dates, setDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const CATEGORIES = [
        { key: 'CONSULTATION', label: 'Consultations', icon: '👨‍⚕️', color: '#2980b9', match: (v: any) => /consult/i.test(v.acte_libelle) },
        { key: 'CARNET', label: 'Carnet', icon: '📋', color: '#16a085', match: (v: any) => /carnet/i.test(v.acte_libelle) },
        { key: 'LABO', label: 'Laboratoire', icon: '🔬', color: '#8e44ad', match: (v: any) => /labo|analyse|examen/i.test(v.acte_libelle) },
        { key: 'SOINS', label: 'Soins (Actes & Médicaments Hospit)', icon: '💉', color: '#27ae60', match: (v: any) => /soins?|pansement|injection|perfusion|glucos|serum|kine(?!sithé)|kiné(?!sithé)/i.test(v.acte_libelle) && !/kinesithér|réanimation|récuperation/i.test(v.acte_libelle) },
        { key: 'ECG', label: 'ECG', icon: '❤️', color: '#e74c3c', match: (v: any) => /ecg|électrocard/i.test(v.acte_libelle) },
        { key: 'KINE', label: 'Réanimation (Kiné)', icon: '🏋️', color: '#d35400', match: (v: any) => /kinesithér|réanimation|récuperation|physiothér/i.test(v.acte_libelle) },
        { key: 'PHARMACIE', label: 'Pharmacie', icon: '💊', color: '#2c3e50', match: (v: any) => v.type_vente === 'MEDICAMENT' && !/ami|visite méd|suivi/i.test(v.acte_libelle) },
        { key: 'HOSPIT', label: 'Hospitalisation (Chambre)', icon: '🏥', color: '#c0392b', match: (v: any) => v.type_vente === 'HOSPITALISATION' || /chambre|nuit|hospit/i.test(v.acte_libelle) },
        { key: 'AMI', label: 'AMI / Visite Médicale', icon: '🩺', color: '#7f8c8d', match: (v: any) => /ami|visite\\s+méd|suivi/i.test(v.acte_libelle) },
        { key: 'OPHTHALMO', label: 'Ophtalmologie', icon: '👁️', color: '#1abc9c', match: (v: any) => /ophtalm|oeil|yeux|vision|lunette/i.test(v.acte_libelle) },
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const ventes = await db.select<any[]>(\`
                SELECT v.acte_libelle, v.type_vente 
                FROM ventes v
                WHERE DATE(v.date_vente) BETWEEN ? AND ?
                AND v.type_vente != 'RECOUVREMENT'
            \`, [dates.start, dates.end]);

            const categoryMap: Record<string, { label: string, icon: string, color: string, items: Record<string, number> }> = {};
            CATEGORIES.forEach(c => {
                categoryMap[c.key] = { label: c.label, icon: c.icon, color: c.color, items: {} };
            });
            categoryMap['AUTRES'] = { label: 'Autres / Non classé', icon: '📦', color: '#333', items: {} };

            ventes.forEach(v => {
                const matchRegex = v.acte_libelle?.match(/\\(x(\\d+)\\)/);
                const q = matchRegex ? parseInt(matchRegex[1]) : 1;
                let name = (v.acte_libelle || 'Inconnu').replace(/\\(x\\d+\\)/, '').trim();

                let catKey = 'AUTRES';
                for (const cat of CATEGORIES) {
                    if (cat.match(v)) {
                        catKey = cat.key;
                        break;
                    }
                }

                if (!categoryMap[catKey].items[name]) categoryMap[catKey].items[name] = 0;
                categoryMap[catKey].items[name] += q;
            });

            const result = [];
            for (const key in categoryMap) {
                const map = categoryMap[key];
                const itemsList = Object.keys(map.items).map(itemName => ({ name: itemName, qty: map.items[itemName] })).sort((a,b) => b.qty - a.qty);
                if (itemsList.length > 0) {
                    result.push({
                        key,
                        label: map.label,
                        icon: map.icon,
                        color: map.color,
                        elements: itemsList
                    });
                }
            }

            setData(result);
        } catch (e) {
            console.error(e);
            alert("Erreur chargement rapport");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (data.length === 0) return alert("Aucune donnée à imprimer");
        
        const flatData: any[] = [];
        data.forEach(cat => {
            flatData.push({ isHeader: true, label: cat.label, icon: cat.icon, color: cat.color });
            cat.elements.forEach((el: any) => {
                flatData.push({ isItem: true, name: el.name, qty: el.qty });
            });
        });

        printReport(
            'Sorties détaillées par Catégorie',
            dates,
            ['Élément / Prestation', 'Quantité Sortie'],
            null,
            flatData,
            (r) => {
                if (r.isHeader) {
                    return \\\`
                        <tr style="background:#f8f9fa;">
                            <td colspan="2" style="font-weight:bold; color:\\\${r.color}; font-size:14px; padding:10px;">\\\${r.icon} \\\${r.label}</td>
                        </tr>
                    \\\`;
                }
                return \\\`
                    <tr>
                        <td style="padding-left:20px;">\\\${r.name}</td>
                        <td style="text-align:center; font-weight:bold;">\\\${r.qty}</td>
                    </tr>
                \\\`;
            }
        );
    };

    const exportToExcel = async () => {
        if (data.length === 0) return alert("Aucune donnée à exporter");

        try {
            const XLSX = await import('xlsx');

            const wsData = [
                ["Catégorie", "Élément / Prestation", "Quantité Sortie"]
            ];
            
            data.forEach(cat => {
                cat.elements.forEach((el: any) => {
                    wsData.push([cat.label, el.name, el.qty]);
                });
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 15 }];

            XLSX.utils.book_append_sheet(wb, ws, "Sorties");
            XLSX.writeFile(wb, \`Sorties_\${dates.start}_\${dates.end}.xlsx\`);
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'export Excel");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#34495e' }}>📊 Sorties détaillées par Catégorie</h2>
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

            {data.map((cat, i) => (
                <div key={i} style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: 0, padding: '15px', background: '#f8f9fa', borderBottom: '1px solid #eee', color: cat.color }}>
                        <span style={{ marginRight: '10px' }}>{cat.icon}</span> {cat.label}
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: 'white', color: '#7f8c8d', borderBottom: '2px solid #eee' }}>
                                <th style={{...thStyle, width: '70%'}}>Élément / Prestation</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Quantité Sortie</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cat.elements.map((el: any, j: number) => (
                                <tr key={j} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                    <td style={tdStyle}>{el.name}</td>
                                    <td style={{...tdStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '15px'}}>{el.qty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
            
            {data.length === 0 && !loading && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999', background:'white', borderRadius:'8px', border:'1px solid #eee' }}>
                    Aucune sortie trouvée pour cette période.
                </div>
            )}
        </div>
    );
}`;

const pattern = /function ReportMouvements\([^]*?\/\/ 2\. Invendus/;
if (pattern.test(content)) {
    content = content.replace(pattern, newFunc + '\\n\\n// 2. Invendus');
    fs.writeFileSync('src/views/DocumentsMain.tsx', content, 'utf8');
    console.log("SUCCESS");
} else {
    console.log("ERROR: pattern not found");
}
