import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";

export default function Decaissement({ currentUser }: { currentUser?: any }) {
    const [history, setHistory] = useState<any[]>([]);


    // Form Stats
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [motif, setMotif] = useState("");
    const [montant, setMontant] = useState("");
    const [mode, setMode] = useState("ESPECES");
    const [autorisePar, setAutorisePar] = useState("");
    const [beneficiaire, setBeneficiaire] = useState("");

    // Edit Mode
    const [editingId, setEditingId] = useState<number | null>(null);

    // Filter Stats
    const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Personnel list for autocomplete
    const [personnel, setPersonnel] = useState<any[]>([]);

    useEffect(() => {
        loadHistory();
        loadPersonnel();
    }, [filterStartDate, filterEndDate]);

    const loadPersonnel = async () => {
        const db = await getDb();
        const res = await db.select<any[]>("SELECT nom_prenoms FROM personnel ORDER BY nom_prenoms");
        setPersonnel(res);
    };

    const loadHistory = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT cm.*, u.nom_complet as caissier
                FROM caisse_mouvements cm
                LEFT JOIN app_utilisateurs u ON cm.user_id = u.id
                WHERE cm.type = 'DECAISSEMENT' 
                AND DATE(cm.date_mouvement) BETWEEN ? AND ?
                ORDER BY cm.date_mouvement DESC
            `, [filterStartDate, filterEndDate]);
            setHistory(res);
        } catch (e) {
            console.error(e);
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setDate(new Date(item.date_mouvement).toISOString().split('T')[0]);
        setMotif(item.motif);
        setMontant(item.montant.toString());
        setMode(item.mode_paiement || "ESPECES");
        setAutorisePar(item.autorise_par || "");
        setBeneficiaire(item.beneficiaire || "");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setMotif("");
        setMontant("");
        setAutorisePar("");
        setBeneficiaire("");
        setDate(new Date().toISOString().split('T')[0]);
    };

    const handleSave = async () => {
        if (!motif || !montant || !autorisePar) return alert("Veuillez remplir les champs obligatoires (Motif, Montant, Autorisé par).");
        const amount = parseFloat(montant);
        if (isNaN(amount) || amount <= 0) return alert("Montant invalide.");

        if (!confirm(editingId ? "Confirmer la modification ?" : `Confirmer le décaissement de ${amount.toLocaleString()} F ?`)) return;

        try {
            const db = await getDb();

            if (editingId) {
                // UPDATE
                await db.execute(`
                    UPDATE caisse_mouvements 
                    SET montant=?, date_mouvement=?, motif=?, mode_paiement=?, autorise_par=?, beneficiaire=?
                    WHERE id=?
                `, [amount, date, motif, mode, autorisePar, beneficiaire, editingId]);
                alert("Modification enregistrée !");
            } else {
                // INSERT
                await db.execute(`
                    INSERT INTO caisse_mouvements (type, montant, date_mouvement, motif, user_id, mode_paiement, reference, autorise_par, beneficiaire)
                    VALUES ('DECAISSEMENT', ?, ?, ?, ?, ?, ?, ?, ?)
                `, [amount, date, motif, currentUser?.id || 0, mode, `DEC-${Date.now()}`, autorisePar, beneficiaire]);
                alert("Décaissement validé !");
            }

            handleCancelEdit();
            loadHistory();
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'enregistrement.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer ce décaissement ? Cela réajustera la caisse.")) return;
        try {
            const db = await getDb();
            await db.execute("DELETE FROM caisse_mouvements WHERE id = ?", [id]);
            loadHistory();
        } catch (e) {
            console.error(e);
        }
    };

    const printTicket = async (h: any) => {
        const company = await getCompanyInfo();

        const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Bon de Décaissement ${h.reference || ''}</title>
                    <style>
                        @page { size: A4; margin: 0; }
                        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                        .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                        .company-sub { font-size: 10px; color: #7f8c8d; }
                        .doc-title { font-size: 18px; font-weight: 600; color: #c0392b; text-transform: uppercase; letter-spacing: 1px; }

                        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                        .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                        .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                        .section-title { font-size: 10px; color: #999; text-transform: uppercase; border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px; letter-spacing: 0.5px; margin-top: 20px; }
                        .content-box { font-size: 12px; margin-bottom: 15px; background: #fff; padding: 10px; border: 1px solid #f9f9f9; border-radius: 4px; min-height: 20px; }

                        .total-section { display: flex; justify-content: flex-end; margin-top: 30px; }
                        .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #fdf2f2; border: 1px solid #f1c40f; color: #c0392b; }

                        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                        .sig-box { border-top: 1px solid #eee; width: 40%; padding-top: 10px; text-align: center; font-size: 10px; color: #999; }

                        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                </head>
                <body>
                <div class="header">
                    <div>
                        <div class="company-name">${company.nom}</div>
                        <div class="company-sub">${company.adresse || ''}
${company.telephone ? 'Tel: ' + company.telephone : ''}
${company.email ? 'Email: ' + company.email : ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Bon de Décaissement</div>
                        <div class="doc-title">${h.reference || '-'}</div>
                    </div>
                </div>

                    <div class="meta-grid">
                        <div class="meta-item">
                            <label>Date</label>
                            <span>${new Date(h.date_mouvement).toLocaleString()}</span>
                        </div>
                        <div class="meta-item">
                            <label>Mode de Paiement</label>
                            <span>${h.mode_paiement}</span>
                        </div>
                         <div class="meta-item">
                            <label>Caissier</label>
                            <span>${h.caissier || currentUser?.nom_complet || 'Admin'}</span>
                        </div>
                    </div>

                    <div class="section-title">Motif / Description</div>
                    <div class="content-box">
                        ${h.motif}
                    </div>

                    <div style="display: flex; gap: 20px;">
                        <div style="flex: 1;">
                            <div class="section-title">Bénéficiaire (Reçu par)</div>
                            <div class="content-box"><strong>${h.beneficiaire || 'Non spécifié'}</strong></div>
                        </div>
                        <div style="flex: 1;">
                            <div class="section-title">Autorisé par</div>
                            <div class="content-box"><strong>${h.autorise_par}</strong></div>
                        </div>
                    </div>

                    <div class="total-section">
                        <div class="total-box">
                            MONTANT : ${h.montant.toLocaleString()} F CFA
                        </div>
                    </div>

                    <div class="signatures">
                        <div class="sig-box">Signature du Bénéficiaire</div>
                        <div class="sig-box">Signature du Responsable</div>
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

    const totalJour = history.reduce((acc, curr) => acc + curr.montant, 0);

    return (
        <div style={{ padding: '20px', background: '#f8fafc', height: '100%', display: 'flex', gap: '25px' }}>

            {/* LEFT: FORM PANEL */}
            <div style={{
                flex: '0 0 400px',
                background: 'white',
                borderRadius: '15px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                    <h2 style={{ margin: 0, color: '#e11d48', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem' }}>
                        {editingId ? "✏️ Modifier" : "📤 Nouveau Décaissement"}
                    </h2>
                </div>

                {/* Scrollable Form Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Motif / Raison</label>
                        <textarea
                            value={motif}
                            onChange={e => setMotif(e.target.value)}
                            placeholder="Description de la dépense..."
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', fontSize: '14px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Montant</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                value={montant}
                                onChange={e => setMontant(e.target.value)}
                                style={{ width: '100%', padding: '10px 10px 10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '20px', fontWeight: 'bold', color: '#e11d48' }}
                            />
                            <span style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#cbd5e1' }}>F CFA</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Bénéficiaire</label>
                        <input
                            value={beneficiaire}
                            onChange={e => setBeneficiaire(e.target.value)}
                            placeholder="Qui reçoit l'argent ?"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Autorisé par</label>
                        <input
                            list="personnel-list"
                            value={autorisePar}
                            onChange={e => setAutorisePar(e.target.value)}
                            placeholder="Responsable..."
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                        <datalist id="personnel-list">
                            {personnel.map((p, i) => <option key={i} value={p.nom_prenoms} />)}
                        </datalist>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '5px' }}>Mode de Paiement</label>
                        <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}>
                            <option value="ESPECES">Espèces</option>
                            <option value="WAVE">Wave</option>
                            <option value="ORANGE_MONEY">Orange Money</option>
                            <option value="MTN_MONEY">MTN Money</option>
                            <option value="CHEQUE">Chèque</option>
                            <option value="VIREMENT">Virement</option>
                        </select>
                    </div>
                </div>

                {/* Footer Actions (Sticky Bottom) */}
                <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                    {editingId && (
                        <button onClick={handleCancelEdit} style={{ flex: 1, padding: '12px', background: '#cbd5e1', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            ANNULER
                        </button>
                    )}
                    <button onClick={handleSave} style={{ flex: 2, padding: '12px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.3)', transition: 'all 0.2s' }}>
                        {editingId ? "ENREGISTRER MODIFS" : "VALIDER LE DÉCAISSEMENT"}
                    </button>
                </div>
            </div>

            {/* RIGHT: HISTORY PANEL */}
            <div style={{ flex: 1, background: 'white', borderRadius: '15px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header Filter */}
                <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                    <div>
                        <h2 style={{ margin: '0 0 5px 0', color: '#334155', fontSize: '1.25rem' }}>Historique</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748b' }}>
                            <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>Période du :</span>
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 5px', color: '#475569' }} />
                            <span>au</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 5px', color: '#475569' }} />
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Total Sorties</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#e11d48' }}>{totalJour.toLocaleString()} F</div>
                    </div>
                </div>

                {/* Table Content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Détails</th>
                                <th style={{ padding: '12px 15px', textAlign: 'center', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Bénéf. / Auto.</th>
                                <th style={{ padding: '12px 15px', textAlign: 'right', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Montant</th>
                                <th style={{ padding: '12px 15px', textAlign: 'center', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h, i) => (
                                <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fcfcfc' }}>
                                    <td style={{ padding: '12px 15px', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: '500', color: '#334155' }}>{new Date(h.date_mouvement).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(h.date_mouvement).toLocaleTimeString().substring(0, 5)}</div>
                                    </td>
                                    <td style={{ padding: '12px 15px', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{h.motif}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Réf: {h.reference} • <span style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>{h.mode_paiement}</span></div>
                                    </td>
                                    <td style={{ padding: '12px 15px', textAlign: 'center', verticalAlign: 'top' }}>
                                        {h.beneficiaire ? (
                                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>{h.beneficiaire}</div>
                                        ) : <em style={{ color: '#ccc' }}>-</em>}
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Par: {h.autorise_par}</div>
                                    </td>
                                    <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold', color: '#e11d48', verticalAlign: 'top' }}>
                                        -{h.montant.toLocaleString()} F
                                    </td>
                                    <td style={{ padding: '12px 15px', textAlign: 'center', verticalAlign: 'top' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                            {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                                <>
                                                    <button onClick={() => printTicket(h)} title="Imprimer" style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖨️</button>
                                                    <button onClick={() => utilsExportToExcel([{
                                                        'Date': new Date(h.date_mouvement).toLocaleDateString(),
                                                        'Heure': new Date(h.date_mouvement).toLocaleTimeString(),
                                                        'Réf': h.reference,
                                                        'Motif': h.motif,
                                                        'Bénéficiaire': h.beneficiaire,
                                                        'Autorisé Par': h.autorise_par,
                                                        'Mode': h.mode_paiement,
                                                        'Montant': h.montant
                                                    }], `Decaissement_${h.reference}`)} title="Excel" style={{ background: '#e0f2fe', color: '#107c41', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</button>
                                                </>
                                            )}
                                            <button onClick={() => handleEdit(h)} title="Modifier" style={{ background: '#fff7ed', color: '#ea580c', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                                            <button onClick={() => handleDelete(h.id)} title="Supprimer" style={{ background: '#fef2f2', color: '#dc2626', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                                        Aucun décaissement trouvé pour cette période.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
