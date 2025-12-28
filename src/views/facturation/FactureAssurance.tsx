import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";

interface FactureGlobale {
    id: number;
    numero_facture: string;
    type_tiers: string;
    date_creation: string;
    periode_debut: string;
    periode_fin: string;
    montant_total: number;
    tiers_nom?: string;
}

export default function FactureAssurance({ currentUser }: { currentUser?: any }) {
    // --- STATES ---
    const [viewMode, setViewMode] = useState<'NEW' | 'HISTORY'>('NEW');

    // FILTERS
    const [typeTiers, setTypeTiers] = useState<'ASSURANCE' | 'PERSONNEL'>('ASSURANCE');
    const [entites, setEntites] = useState<any[]>([]);
    const [selectedEntiteId, setSelectedEntiteId] = useState<string>("");
    const [dateDebut, setDateDebut] = useState(new Date().toISOString().split('T')[0].substring(0, 8) + '01'); // 1st of month
    const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);

    // DATA for NEW INVOICE
    const [unbilledSales, setUnbilledSales] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);

    // DATA for HISTORY
    const [history, setHistory] = useState<FactureGlobale[]>([]);

    useEffect(() => {
        loadEntites();
    }, [typeTiers]);

    useEffect(() => {
        if (viewMode === 'HISTORY') loadHistory();
    }, [viewMode]);

    const loadEntites = async () => {
        const db = await getDb();
        if (typeTiers === 'ASSURANCE') {
            const res = await db.select<any[]>("SELECT id, nom FROM assurances ORDER BY nom");
            setEntites(res);
        } else {
            const res = await db.select<any[]>("SELECT id, nom_prenoms as nom FROM personnel ORDER BY nom_prenoms"); // Or fetch users too? keeping simple for now
            setEntites(res);
        }
        setSelectedEntiteId("");
        setUnbilledSales([]);
    };

    const searchUnbilled = async () => {
        if (!selectedEntiteId) return alert("Veuillez sélectionner une entité (Assurance ou Personnel).");
        setLoading(true);
        try {
            const db = await getDb();
            let query = "";
            let params: any[] = [];

            if (typeTiers === 'ASSURANCE') {
                // Find sales where patient has this insurance AND part_assureur > 0 AND NOT already in a bill
                // We assume 'ventes' table has part_assureur.
                // IMPORTANT: We must join patients to check insurance_id if it's not stored on vente directly
                // Usually insurance is linked to patient at moment of sale.
                // Assuming `ventes` stores snapshot or we join `patients`. Let's join `patients`.
                // Checking for "Credit" is tricky for Insurance. Usually Insurance part is always "Credit" until paid globaly.
                // We check if `id` is NOT IN `factures_globales_details`.

                query = `
                    SELECT v.*, p.nom_prenoms as nom_patient, p.numero_carnet
                    FROM ventes v
                    JOIN patients p ON v.patient_id = p.id
                    WHERE p.assurance_id = ? 
                      AND v.part_assureur > 0
                      AND DATE(v.date_vente) BETWEEN ? AND ?
                      AND v.id NOT IN (SELECT vente_id FROM factures_globales_details)
                    ORDER BY v.date_vente ASC
                `;
                params = [selectedEntiteId, dateDebut, dateFin];
            } else {
                // Personnel
                query = `
                    SELECT v.*, CASE WHEN v.patient_id IS NOT NULL THEN (SELECT nom_prenoms FROM patients WHERE id=v.patient_id) ELSE 'Achat Direct' END as nom_patient
                    FROM ventes v
                    WHERE v.personnel_id = ?
                      AND v.reste_a_payer > 0
                      AND DATE(v.date_vente) BETWEEN ? AND ?
                      AND v.id NOT IN (SELECT vente_id FROM factures_globales_details)
                    ORDER BY v.date_vente ASC
                `;
                params = [selectedEntiteId, dateDebut, dateFin];
            }

            const res = await db.select<any[]>(query, params);
            setUnbilledSales(res);
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la recherche des tickets.");
        } finally {
            setLoading(false);
        }
    };

    const generateInvoice = async () => {
        if (unbilledSales.length === 0) return;
        if (!confirm(`Générer la facture pour ${unbilledSales.length} tickets ?\nCette action est irréversible et va figer la période.`)) return;

        try {
            const db = await getDb();

            // 1. Calculate Total
            // For Assurance: total of part_assureur
            // For Personnel: total of reste_a_payer
            const total = unbilledSales.reduce((acc, v) => {
                return acc + (typeTiers === 'ASSURANCE' ? v.part_assureur : v.reste_a_payer);
            }, 0);

            // 2. Generate Number
            const year = new Date().getFullYear();
            const prefix = typeTiers === 'ASSURANCE' ? 'FAC-ASS' : 'FAC-PERS';
            // Simple random for now to avoid collision logic, or count
            const countRes = await db.select<any[]>("SELECT COUNT(*) as c FROM factures_globales");
            const nextId = (countRes[0]?.c || 0) + 1;
            const numFacture = `${prefix}-${year}-${nextId.toString().padStart(4, '0')}`;

            // 3. Insert Master
            const resMaster = await db.execute(`
                INSERT INTO factures_globales (numero_facture, type_tiers, tiers_id, periode_debut, periode_fin, montant_total)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [numFacture, typeTiers, selectedEntiteId, dateDebut, dateFin, total]);

            const masterId = resMaster.lastInsertId;

            // 4. Insert Details
            for (const v of unbilledSales) {
                const amount = typeTiers === 'ASSURANCE' ? v.part_assureur : v.reste_a_payer;
                await db.execute(`
                    INSERT INTO factures_globales_details (facture_globale_id, vente_id, montant_tiers)
                    VALUES (?, ?, ?)
                `, [masterId, v.id, amount]);
            }

            alert(`✅ Facture ${numFacture} générée avec succès !`);
            setUnbilledSales([]);
            setViewMode('HISTORY'); // Switch to history to see it
            loadHistory();

        } catch (e) {
            console.error(e);
            alert("Erreur lors de la création de la facture.");
        }
    };

    const loadHistory = async () => {
        const db = await getDb();
        const res = await db.select<FactureGlobale[]>(`
            SELECT f.*, 
                   CASE 
                     WHEN f.type_tiers = 'ASSURANCE' THEN (SELECT nom FROM assurances WHERE id = f.tiers_id)
                     ELSE (SELECT nom_prenoms FROM personnel WHERE id = f.tiers_id)
                   END as tiers_nom
            FROM factures_globales f
            ORDER BY f.date_creation DESC
            LIMIT 50
        `);
        setHistory(res);
    };

    const printInvoice = async (facture: FactureGlobale) => {
        const db = await getDb();
        const details = await db.select<any[]>(`
            SELECT d.montant_tiers, v.date_vente, v.acte_libelle, v.numero_ticket,
                   p.nom_prenoms as nom_patient, p.numero_carnet, p.numero_assure
            FROM factures_globales_details d
            JOIN ventes v ON d.vente_id = v.id
            LEFT JOIN patients p ON v.patient_id = p.id
            WHERE d.facture_globale_id = ?
            ORDER BY v.date_vente ASC
        `, [facture.id]);

        await printDocument(facture, details);
    };

    const handleExportExcel = async (facture: FactureGlobale) => {
        try {
            const db = await getDb();
            const details = await db.select<any[]>(`
                SELECT d.montant_tiers, v.date_vente, v.acte_libelle, v.numero_ticket,
                       p.nom_prenoms as nom_patient, p.numero_carnet, p.numero_assure
                FROM factures_globales_details d
                JOIN ventes v ON d.vente_id = v.id
                LEFT JOIN patients p ON v.patient_id = p.id
                WHERE d.facture_globale_id = ?
                ORDER BY v.date_vente ASC
            `, [facture.id]);

            const data = details.map(d => ({
                'Date': new Date(d.date_vente).toLocaleDateString(),
                'Ticket': d.numero_ticket || '-',
                'Patient': d.nom_patient || 'Anonyme',
                'Num Assuré': d.numero_assure,
                'Prestation': d.acte_libelle,
                'Montant': d.montant_tiers
            }));

            utilsExportToExcel(data, `Facture_${facture.numero_facture}`);
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'export Excel");
        }
    };

    const printDocument = async (facture: FactureGlobale, details: any[]) => {
        const company = await getCompanyInfo();
        const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Facture ${facture.numero_facture}</title>
                    <style>
                        @page { size: A4; margin: 0; }
                        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                        .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                        .company-sub { font-size: 10px; color: #7f8c8d; }
                        .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }

                        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                        .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                        .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                        th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                        td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                        tr:last-child td { border-bottom: none; }

                        .total-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 30px; }
                        .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #f9f9f9; border: 1px solid #eee; color: #2c3e50; margin-bottom: 5px; }
                        .amount-text { font-size: 10px; color: #999; font-style: italic; }

                        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
                        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.05); pointer-events: none; z-index: -1; font-weight: bold; }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                </head>
                <body>
                    ${facture.numero_facture === 'BROUILLON' ? '<div class="watermark">BROUILLON</div>' : ''}
                    
                    <div class="header">
                        <div>
                            <div class="company-name">${company.nom}</div>
                            <div class="company-sub">${company.adresse || ''}
${company.telephone ? 'Tel: ' + company.telephone : ''}
${company.email ? 'Email: ' + company.email : ''}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Facture Globale</div>
                            <div class="doc-title">${facture.numero_facture}</div>
                        </div>
                    </div>

                    <div class="meta-grid">
                        <div class="meta-item">
                            <label>Client / Tiers</label>
                            <span>${facture.tiers_nom} (${facture.type_tiers})</span>
                        </div>
                        <div class="meta-item">
                            <label>Date Émission</label>
                            <span>${new Date(facture.date_creation).toLocaleDateString()}</span>
                        </div>
                        <div class="meta-item">
                            <label>Période</label>
                            <span>Du ${new Date(facture.periode_debut).toLocaleDateString()} au ${new Date(facture.periode_fin).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Ticket</th>
                                <th>Patient / Assuré</th>
                                <th>Prestation</th>
                                <th style="text-align:right">Montant</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${details.map(d => `
                                <tr>
                                    <td>${new Date(d.date_vente).toLocaleDateString()}</td>
                                    <td>${d.numero_ticket || '-'}</td>
                                    <td>${d.nom_patient || 'Anonyme'}<br/><span style="color:#999; font-size:9px;">${d.numero_assure || d.numero_carnet || ''}</span></td>
                                    <td>${d.acte_libelle}</td>
                                    <td style="text-align:right">${(d.montant_tiers || 0).toLocaleString()} F</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-box">
                            TOTAL À PAYER : ${facture.montant_total.toLocaleString()} F CFA
                        </div>
                        <div class="amount-text">
                            Arrêté la présente facture à la somme de : ${facture.montant_total.toLocaleString()} Francs CFA
                        </div>
                    </div>

                    <div class="footer">
                        Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
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

    // --- RENDER ---
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', background: '#f4f6f8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* TABS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setViewMode('NEW')}
                    style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: viewMode === 'NEW' ? '#2c3e50' : '#bdc3c7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    🆕 Nouvelle Facture
                </button>
                <button
                    onClick={() => setViewMode('HISTORY')}
                    style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: viewMode === 'HISTORY' ? '#2c3e50' : '#bdc3c7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    📜 Historique Factures
                </button>
            </div>

            {viewMode === 'NEW' ? (
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column' }}>

                    {/* FILTERS */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Type</label>
                            <select value={typeTiers} onChange={e => setTypeTiers(e.target.value as any)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '150px' }}>
                                <option value="ASSURANCE">Assurance</option>
                                <option value="PERSONNEL">Personnel</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Entité / Nom</label>
                            <select value={selectedEntiteId} onChange={e => setSelectedEntiteId(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '100%' }}>
                                <option value="">-- Sélectionner --</option>
                                {entites.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Du</label>
                            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ padding: '7px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Au</label>
                            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ padding: '7px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        </div>
                        <button onClick={searchUnbilled} disabled={loading} style={{ padding: '9px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {loading ? '...' : '🔍 Rechercher'}
                        </button>
                    </div>

                    {/* RESULTS */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {unbilledSales.length > 0 ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3 style={{ margin: 0 }}>{unbilledSales.length} Tickets trouvés</h3>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>
                                        Total : {unbilledSales.reduce((acc, v) => acc + (typeTiers === 'ASSURANCE' ? v.part_assureur : v.reste_a_payer), 0).toLocaleString()} F
                                    </div>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ background: '#f8f9fa', color: '#7f8c8d' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Patient</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Prestation</th>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>Montant Total</th>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>Part {typeTiers === 'ASSURANCE' ? 'Assureur' : 'Crédit'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unbilledSales.map(v => (
                                            <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '10px' }}>{new Date(v.date_vente).toLocaleDateString()}</td>
                                                <td style={{ padding: '10px' }}>{v.nom_patient}</td>
                                                <td style={{ padding: '10px' }}>{v.acte_libelle}</td>
                                                <td style={{ padding: '10px', textAlign: 'right', color: '#ccc' }}>{v.montant_total.toLocaleString()}</td>
                                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                                                    {(typeTiers === 'ASSURANCE' ? v.part_assureur : v.reste_a_payer).toLocaleString()} F
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '50px', color: '#7f8c8d' }}>
                                Aucun ticket impayé/non-facturé sur cette période.
                            </div>
                        )}
                    </div>

                    {/* ACTIONS */}
                    {unbilledSales.length > 0 && (
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '20px', textAlign: 'right' }}>
                            <button onClick={generateInvoice} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(39, 174, 96, 0.2)' }}>
                                ✅ GÉNÉRER LA FACTURE GLOBALE
                            </button>
                        </div>
                    )}

                </div>
            ) : (
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', flex: 1, overflowY: 'auto' }}>
                    <h2 style={{ marginTop: 0 }}>Historique des Factures Globales</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#2c3e50', color: 'white' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Numéro</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date Création</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Entité</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Période</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{h.numero_facture}</td>
                                    <td style={{ padding: '12px' }}>{new Date(h.date_creation).toLocaleString()}</td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{h.tiers_nom}</div>
                                        <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{h.type_tiers}</div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        Du {new Date(h.periode_debut).toLocaleDateString()} au {new Date(h.periode_fin).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>{h.montant_total.toLocaleString()} F</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {/* Allow if undefined or true */}
                                        {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                            <>
                                                <button onClick={() => printInvoice(h)} style={{ background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' }}>🖨️ Aperçu</button>
                                                <button onClick={() => handleExportExcel(h)} style={{ background: '#107c41', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>📊 Excel</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {history.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Aucune facture générée pour l'instant.</div>}
                </div>
            )}
        </div>
    );
}
