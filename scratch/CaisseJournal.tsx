// 10. Daily Cash Journal - Par Catégories, Assurances, Personnel, Décaissements
function ReportDailyCashJournal({ onBack }: { onBack: () => void }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const [categories, setCategories] = useState<any[]>([]);
    const [decaissements, setDecaissements] = useState<any[]>([]);
    const [assurances, setAssurances] = useState<any[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [paiements, setPaiements] = useState<any[]>([]);
    const [rawVentes, setRawVentes] = useState<any[]>([]);

    const CATEGORIES = [
        { key: 'CONSULTATION', label: 'Consultations', icon: '👨‍⚕️', color: '#2980b9', match: (v: any) => /consult/i.test(v.acte_libelle) },
        { key: 'CARNET', label: 'Carnet', icon: '📋', color: '#16a085', match: (v: any) => /carnet/i.test(v.acte_libelle) },
        { key: 'LABO', label: 'Laboratoire', icon: '🔬', color: '#8e44ad', match: (v: any) => /labo|analyse|examen/i.test(v.acte_libelle) },
        { key: 'SOINS', label: 'Soins (Actes & Médicaments Hospit)', icon: '💉', color: '#27ae60', match: (v: any) => /soins?|pansement|injection|perfusion|glucos|serum|kine(?!sithé)|kiné(?!sithé)/i.test(v.acte_libelle) && !/kinesithér|réanimation|récuperation/i.test(v.acte_libelle) },
        { key: 'ECG', label: 'ECG', icon: '❤️', color: '#e74c3c', match: (v: any) => /ecg|électrocard/i.test(v.acte_libelle) },
        { key: 'KINE', label: 'Réanimation (Kiné)', icon: '🏋️', color: '#d35400', match: (v: any) => /kinesithér|réanimation|récuperation|physiothér/i.test(v.acte_libelle) },
        { key: 'PHARMACIE', label: 'Pharmacie', icon: '💊', color: '#2c3e50', match: (v: any) => v.type_vente === 'MEDICAMENT' && !/ami|visite méd|suivi/i.test(v.acte_libelle) },
        { key: 'HOSPIT', label: 'Hospitalisation (Chambre)', icon: '🏥', color: '#c0392b', match: (v: any) => v.type_vente === 'HOSPITALISATION' || /chambre|nuit|hospit/i.test(v.acte_libelle) },
        { key: 'AMI', label: 'AMI / Visite Médicale', icon: '🩺', color: '#7f8c8d', match: (v: any) => /ami|visite\s+méd|suivi/i.test(v.acte_libelle) },
        { key: 'OPHTHALMO', label: 'Ophtalmologie', icon: '👁️', color: '#1abc9c', match: (v: any) => /ophtalm|oeil|yeux|vision|lunette/i.test(v.acte_libelle) },
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // 1. Charger Ventes
            const ventes = await db.select<any[]>(`
                SELECT 
                    v.acte_libelle, v.type_vente, v.montant_total, v.part_patient, v.part_assureur,
                    (v.montant_total - v.part_patient - COALESCE(v.part_assureur,0)) as remise,
                    v.statut, v.mode_paiement, v.societe_nom, v.personnel_nom, p.taux_couverture
                FROM ventes v
                LEFT JOIN patients p ON v.patient_id = p.id
                WHERE DATE(v.date_vente) = ? AND v.montant_total > 0
            `, [date]);

            const ventesNorm = ventes.map(v => ({
                ...v,
                montant_total: parseFloat(v.montant_total) || 0,
                part_patient:  parseFloat(v.part_patient)  || 0,
                part_assureur: parseFloat(v.part_assureur) || 0,
                remise:        Math.max(0, parseFloat(v.remise) || 0),
            }));
            setRawVentes(ventesNorm);

            // -- GROUP 1: CATEGORIES (existantes) --
            const grouped = CATEGORIES.map(cat => {
                const matched = ventesNorm.filter(cat.match);
                const nombre = matched.length;
                const montant = matched.reduce((s, v) => s + v.part_patient, 0); // Net recu
                const remise = matched.reduce((s, v) => s + v.remise, 0);
                const brut = matched.reduce((s, v) => s + v.montant_total, 0);
                return { ...cat, nombre, montant, remise, brut };
            });
            const allMatched = new Set<any>();
            CATEGORIES.forEach(cat => ventesNorm.filter(cat.match).forEach(v => allMatched.add(v)));
            const autres = ventesNorm.filter(v => !allMatched.has(v));
            if (autres.length > 0) {
                grouped.push({
                    key: 'AUTRE', label: 'Autres Prestations', icon: '📌', color: '#95a5a6',
                    nombre: autres.length,
                    montant: autres.reduce((s, v) => s + v.part_patient, 0),
                    remise: autres.reduce((s, v) => s + v.remise, 0),
                    brut: autres.reduce((s, v) => s + v.montant_total, 0)
                });
            }
            setCategories(grouped.filter(g => g.nombre > 0));

            // -- GROUP 2: DECAISSEMENTS --
            const decaiss = await db.select<any[]>(`
                SELECT motif, montant, mode_paiement, reference 
                FROM caisse_mouvements 
                WHERE type = 'DECAISSEMENT' AND DATE(date_mouvement) = ?
            `, [date]);
            setDecaissements(decaiss.map(d => ({ ...d, montant: parseFloat(d.montant) || 0 })));

            // -- GROUP 3: ASSURANCES --
            const assurGroup: Record<string, any> = {};
            ventesNorm.filter(v => v.part_assureur > 0).forEach(v => {
                const nom = v.societe_nom || 'Assurance Non Spécifiée';
                if (!assurGroup[nom]) assurGroup[nom] = { nom, taux: v.taux_couverture || '-', brut: 0, assurance: 0, patient: 0 };
                assurGroup[nom].brut += v.montant_total;
                assurGroup[nom].assurance += v.part_assureur;
                assurGroup[nom].patient += v.part_patient;
            });
            setAssurances(Object.values(assurGroup));

            // -- GROUP 4: PERSONNEL --
            const persGroup: Record<string, any> = {};
            ventesNorm.filter(v => v.personnel_nom).forEach(v => {
                const nom = v.personnel_nom;
                if (!persGroup[nom]) persGroup[nom] = { nom, actes: 0, brut: 0, remise: 0, paye: 0 };
                persGroup[nom].actes += 1;
                persGroup[nom].brut += v.montant_total;
                persGroup[nom].remise += v.remise;
                persGroup[nom].paye += v.part_patient;
            });
            setPersonnel(Object.values(persGroup));

            // -- GROUP 5: MOYENS DE PAIEMENTS --
            const encaiss = await db.select<any[]>(`
                SELECT mode_paiement, montant 
                FROM caisse_mouvements 
                WHERE type = 'ENCAISSEMENT' AND DATE(date_mouvement) = ?
            `, [date]);

            const modesMap: Record<string, number> = {};
            const addPaiement = (modeStr: string, val: number) => {
                if (val <= 0) return;
                const m = modeStr.replace(/\(Ref:.*?\)/g, '').trim().toUpperCase();
                modesMap[m] = (modesMap[m] || 0) + val;
            };

            ventesNorm.forEach(v => addPaiement(v.mode_paiement || 'ESPÈCE', v.part_patient));
            encaiss.forEach(e => addPaiement(e.mode_paiement || 'ESPÈCE', parseFloat(e.montant) || 0));

            setPaiements(Object.entries(modesMap).map(([mode, montant]) => ({ mode, montant })).sort((a,b) => b.montant - a.montant));

        } catch (e) {
            console.error(e);
            alert("Erreur lors du calcul du journal détaillé.");
        } finally {
            setLoading(false);
        }
    };

    const totalNombre = categories.reduce((s, c) => s + c.nombre, 0);
    const totalMontant = categories.reduce((s, c) => s + c.montant, 0);
    const totalRemise = categories.reduce((s, c) => s + c.remise, 0);
    const totalBrut = categories.reduce((s, c) => s + c.brut, 0);

    const totalDecaiss = decaissements.reduce((s, d) => s + d.montant, 0);
    const totalEncaissePaiements = paiements.reduce((s, p) => s + p.montant, 0);

    const handlePrint = () => {
        if (categories.length === 0 && decaissements.length === 0) return alert("Rien à imprimer");
        const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const w = window.open('', '', 'width=900,height=800');
        if (w) {
            w.document.write(`
                <html><head><meta charset="UTF-8"><title>Journal de Caisse Détail - ${dateFormatted}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; padding: 20px; color: #2c3e50; }
                    h2 { text-align: center; font-size: 16px; margin-bottom: 5px; color: #2c3e50; }
                    .subtitle { text-align: center; color: #7f8c8d; margin-bottom: 20px; font-size: 12px; }
                    .section-title { background: #34495e; color: white; padding: 6px 10px; font-size: 12px; font-weight: bold; margin-top: 20px; border-radius: 4px 4px 0 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th { background: #ecf0f1; color: #2c3e50; padding: 6px 8px; text-align: left; font-size: 11px; border: 1px solid #bdc3c7; }
                    td { padding: 6px 8px; border: 1px solid #ecf0f1; font-size: 11px; }
                    th.right, td.right { text-align: right; }
                    tr:nth-child(even) td { background: #fdfdfd; }
                    .total-row td { font-weight: bold; background: #eaf4ff !important; border-top: 2px solid #3498db; }
                    .kpi-container { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 15px; }
                    .kpi-box { flex: 1; border: 1px solid #bdc3c7; padding: 10px; text-align: center; border-radius: 6px; background: #fcfcfc; }
                    .kpi-val { font-size: 18px; font-weight: bold; margin-top: 5px; }
                    .alert-text { color: #e74c3c; }
                    .success-text { color: #27ae60; }
                </style></head><body>
                <h2>📒 JOURNAL DE CAISSE GLOBAL</h2>
                <div class="subtitle">${dateFormatted}</div>
                
                <div class="kpi-container">
                    <div class="kpi-box"><div>TOTAL ACTES</div><div class="kpi-val">${totalNombre}</div></div>
                    <div class="kpi-box"><div>CA BRUT</div><div class="kpi-val">${totalBrut.toLocaleString()} F</div></div>
                    <div class="kpi-box"><div>TOTAL REMISES</div><div class="kpi-val alert-text">- ${totalRemise.toLocaleString()} F</div></div>
                    <div class="kpi-box" style="border-color: #27ae60; background: #eaabff;">
                        <div class="success-text">NET PATIENTS (CAISSE)</div><div class="kpi-val success-text">${totalMontant.toLocaleString()} F</div>
                    </div>
                </div>

                <!-- Section 1 : VENTES PAR CATEGORIE -->
                <div class="section-title">1. VENTES PAR CATÉGORIES (RECETTES)</div>
                <table>
                    <thead><tr>
                        <th>Catégorie</th><th class="right">Nbre</th><th class="right">Montant Brut (F)</th><th class="right">Remises (F)</th><th class="right">Montant Net Payé (F)</th>
                    </tr></thead>
                    <tbody>
                        ${categories.map(c => `
                            <tr>
                                <td>${c.label}</td>
                                <td class="right">${c.nombre}</td>
                                <td class="right">${c.brut.toLocaleString()}</td>
                                <td class="right alert-text">${c.remise > 0 ? c.remise.toLocaleString() : '-'}</td>
                                <td class="right" style="font-weight:bold">${c.montant.toLocaleString()}</td>
                            </tr>`).join('')}
                        <tr class="total-row">
                            <td>TOTAL CATÉGORIES</td>
                            <td class="right">${totalNombre}</td>
                            <td class="right">${totalBrut.toLocaleString()}</td>
                            <td class="right alert-text">${totalRemise.toLocaleString()}</td>
                            <td class="right success-text">${totalMontant.toLocaleString()} F</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Section 5 : MOYENS DE PAIEMENTS -->
                <div class="section-title" style="background: #27ae60;">2. RÉCAPITULATIF DES MOYENS DE PAIEMENT (INCLUANT CAISSE LIBRE)</div>
                <table>
                    <thead><tr><th>Moyen de Paiement</th><th class="right">Montant Encaissé (F)</th></tr></thead>
                    <tbody>
                        ${paiements.map(p => `
                            <tr>
                                <td><strong>${p.mode}</strong></td>
                                <td class="right">${p.montant.toLocaleString()} F</td>
                            </tr>`).join('')}
                        ${paiements.length === 0 ? '<tr><td colspan="2" style="text-align:center">Aucun paiement enregistré</td></tr>' : ''}
                        <tr class="total-row">
                            <td>TOTAL ENCAISSEMENTS GLOBAUX</td>
                            <td class="right success-text">${totalEncaissePaiements.toLocaleString()} F</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Section 2 : DECAISSEMENTS -->
                <div class="section-title" style="background: #e74c3c;">3. DÉCAISSEMENTS (DÉPENSES)</div>
                <table>
                    <thead><tr><th>Motif / Libellé</th><th>Réf / Destinataire</th><th>Mode Paiement</th><th class="right">Montant (F)</th></tr></thead>
                    <tbody>
                        ${decaissements.map(d => `
                            <tr>
                                <td>${d.motif || '-'}</td>
                                <td>${d.reference || '-'}</td>
                                <td>${d.mode_paiement || 'ESPÈCE'}</td>
                                <td class="right alert-text">${d.montant.toLocaleString()} F</td>
                            </tr>`).join('')}
                        ${decaissements.length === 0 ? '<tr><td colspan="4" style="text-align:center">Aucun décaissement enregistré</td></tr>' : ''}
                        ${decaissements.length > 0 ? `
                        <tr class="total-row">
                            <td colspan="3">TOTAL DÉCAISSEMENTS</td>
                            <td class="right alert-text">- ${totalDecaiss.toLocaleString()} F</td>
                        </tr>` : ''}
                    </tbody>
                </table>

                <!-- Section 3 : ASSURANCES -->
                <div class="section-title" style="background: #8e44ad;">4. PRISE EN CHARGE ASSURANCES (JOURNÉE)</div>
                <table>
                    <thead><tr><th>Nom Assurance</th><th class="right">Taux</th><th class="right">Montant Brut (F)</th><th class="right" style="color:#8e44ad">Part Assurance (F)</th><th class="right">Part Patient (F)</th></tr></thead>
                    <tbody>
                        ${assurances.map(a => `
                            <tr>
                                <td>${a.nom}</td><td class="right">${a.taux}%</td>
                                <td class="right">${a.brut.toLocaleString()}</td>
                                <td class="right" style="color:#8e44ad; font-weight:bold">${a.assurance.toLocaleString()}</td>
                                <td class="right">${a.patient.toLocaleString()}</td>
                            </tr>`).join('')}
                        ${assurances.length === 0 ? '<tr><td colspan="5" style="text-align:center">Aucune activité sous assurance</td></tr>' : ''}
                    </tbody>
                </table>

                <!-- Section 4 : PERSONNEL -->
                <div class="section-title" style="background: #f39c12;">5. RÈGLEMENTS PERSONNEL (AVEC REMISES)</div>
                <table>
                    <thead><tr><th>Nom Employé</th><th class="right">Actes Réalisés</th><th class="right">Montant Brut (F)</th><th class="right alert-text">Remise Accordée (F)</th><th class="right">Montant Payé (F)</th></tr></thead>
                    <tbody>
                        ${personnel.map(p => `
                            <tr>
                                <td>${p.nom}</td><td class="right">${p.actes}</td>
                                <td class="right">${p.brut.toLocaleString()}</td>
                                <td class="right alert-text">${p.remise > 0 ? p.remise.toLocaleString() : '-'}</td>
                                <td class="right hover-bold">${p.paye.toLocaleString()}</td>
                            </tr>`).join('')}
                        ${personnel.length === 0 ? '<tr><td colspan="5" style="text-align:center">Aucun acte enregistré pour le personnel interne</td></tr>' : ''}
                    </tbody>
                </table>
                
                <div style="margin-top:40px; border-top:1px dashed #ccc; padding-top:10px; display:flex; justify-content:space-between; color:#7f8c8d; font-size:10px;">
                    <div>Généré par le Système Médical Informatique</div>
                    <div>Signature du Caissier / Manager : ..................................</div>
                </div>

                <script>window.print();</script>
                </body></html>
            `);
            w.document.close();
        }
    };

    const exportToExcel = async () => {
        // ... (Export kept simple for now or omitted, but let's keep basic export for categories)
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const wsData = [
            [`Journal de Caisse du ${date}`], [],
            ["Catégorie", "Nombre", "Remises", "Montant Net"]
        ];
        categories.forEach(c => wsData.push([c.label, c.nombre, c.remise, c.montant]));
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Journal");
        XLSX.writeFile(wb, \`JournalCaisse_\${date}.xlsx\`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={onBack} style={btnBackStyle}>⬅ Retour</button>
                <h2 style={{ margin: 0, color: '#f39c12' }}>📒 Journal de Caisse Poussé</h2>
            </div>
            
            <div style={{ background: '#fef9e7', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <label>Date : <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></label>
                <button onClick={loadData} disabled={loading} style={{ ...btnActionStyle, background: '#f39c12' }}>{loading ? '...' : 'Afficher Détails'}</button>
                {categories.length > 0 && (
                    <>
                        <button onClick={handlePrint} style={{ ...btnActionStyle, background: '#2c3e50' }}>🖨️ PDF / Impression Détaillée</button>
                        <button onClick={exportToExcel} style={{ ...btnActionStyle, background: '#27ae60' }}>📊 Excel Bref</button>
                    </>
                )}
            </div>

            {categories.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* SECTION 1: KPIS & Modes Paiement side by side */}
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #eee', padding: '15px' }}>
                            <h3 style={{ marginTop: 0, color: '#27ae60', borderBottom: '2px solid #27ae60', paddingBottom: '10px' }}>💵 Moyens de Paiements (Entrées)</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <tbody>
                                    {paiements.map(p => (
                                        <tr key={p.mode} style={{ borderBottom: '1px solid #f1f2f6' }}>
                                            <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{p.mode}</td>
                                            <td style={{ padding: '8px 0', textAlign: 'right', color: '#2c3e50' }}>{p.montant.toLocaleString()} F</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: '#eaf4ff' }}>
                                        <td style={{ padding: '10px 0', fontWeight: 'bold' }}>TOTAL GLOBAL</td>
                                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', color: '#27ae60', fontSize: '16px' }}>{totalEncaissePaiements.toLocaleString()} F</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #eee', padding: '15px' }}>
                            <h3 style={{ marginTop: 0, color: '#e74c3c', borderBottom: '2px solid #e74c3c', paddingBottom: '10px' }}>📉 Décaissements (Sorties)</h3>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e74c3c', textAlign: 'center', margin: '20px 0' }}>
                                - {totalDecaiss.toLocaleString()} F
                            </div>
                            <div style={{ textAlign: 'center', color: '#7f8c8d' }}>{decaissements.length} Sortie(s) de caisse validée(s)</div>
                        </div>
                    </div>

                    {/* SECTION 2 : Ventes par Catégories */}
                    <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
                        <h3 style={{ margin: 0, padding: '15px', color: '#34495e', background: '#f8f9fa', borderRadius: '8px 8px 0 0' }}>1️⃣ Ventes Par Catégories (Recettes)</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#2c3e50', color: 'white' }}>
                                    <th style={{ ...thStyle, width: '40%' }}>Catégorie</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Nombre</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Remises</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Montant Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c, i) => (
                                    <tr key={c.key} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                        <td style={{ ...tdStyle }}><span style={{ fontSize: '20px', marginRight: '10px' }}>{c.icon}</span><span style={{ fontWeight: '600', color: c.color }}>{c.label}</span></td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ background: c.color, color: 'white', borderRadius: '12px', padding: '2px 10px', fontWeight: 'bold', fontSize: '13px' }}>{c.nombre}</span></td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: c.remise > 0 ? '#e74c3c' : '#bdc3c7' }}>{c.remise > 0 ? \`- \${c.remise.toLocaleString()} F\` : '-'}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#2c3e50' }}>{c.montant.toLocaleString()} F</td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#eaf4ff', borderTop: '2px solid #2980b9' }}>
                                    <td style={{ ...tdStyle, fontWeight: 'bold', fontSize: '15px', color: '#2c3e50' }}>TOTAL CATÉGORIES</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>{totalNombre}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#e74c3c', fontSize: '15px' }}>{totalRemise > 0 ? \`- \${totalRemise.toLocaleString()} F\` : '-'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#27ae60' }}>{totalMontant.toLocaleString()} F</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* SECTION 3 : Assurances & Personnel side by side */}
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
                            <h3 style={{ margin: 0, padding: '15px', color: 'white', background: '#8e44ad', borderRadius: '8px 8px 0 0' }}>🏥 Parts Assurances Imputées</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead><tr style={{ background: '#fafafa', color: '#333' }}><th style={thStyle}>Assurance</th><th style={{...thStyle, textAlign:'right'}}>Part Assur.</th></tr></thead>
                                <tbody>
                                    {assurances.map(a => (
                                        <tr key={a.nom} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={tdStyle}>{a.nom}</td>
                                            <td style={{...tdStyle, textAlign:'right', fontWeight:'bold', color:'#8e44ad'}}>{a.assurance.toLocaleString()} F</td>
                                        </tr>
                                    ))}
                                    {assurances.length === 0 && <tr><td colSpan={2} style={{...tdStyle, textAlign:'center'}}>Aucune donnée</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
                            <h3 style={{ margin: 0, padding: '15px', color: 'white', background: '#f39c12', borderRadius: '8px 8px 0 0' }}>🧑‍⚕️ Personnel (Remises)</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead><tr style={{ background: '#fafafa', color: '#333' }}><th style={thStyle}>Employé</th><th style={{...thStyle, textAlign:'right'}}>Remises</th></tr></thead>
                                <tbody>
                                    {personnel.map(p => (
                                        <tr key={p.nom} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={tdStyle}>{p.nom} ({p.actes} actes)</td>
                                            <td style={{...tdStyle, textAlign:'right', fontWeight:'bold', color:'#e74c3c'}}>{p.remise > 0 ? p.remise.toLocaleString()+' F' : '-'}</td>
                                        </tr>
                                    ))}
                                    {personnel.length === 0 && <tr><td colSpan={2} style={{...tdStyle, textAlign:'center'}}>Aucune donnée</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {categories.length === 0 && !loading && rawVentes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#bdc3c7', fontSize: '16px' }}>
                    Aucune activité enregistrée. Cliquez sur "Afficher Détails".
                </div>
            )}
            {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>Analyse des opérations en cours...</div>}
        </div>
    );
}

