import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../../lib/db";

export default function ListeVentes({ softwareDate, setView, currentUser }: { softwareDate: string, setView: (v: string) => void, currentUser?: any }) {
    const [ventes, setVentes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateDebut, setDateDebut] = useState(softwareDate);
    const [dateFin, setDateFin] = useState(softwareDate);
    const [searchTerm, setSearchTerm] = useState("");
    const [modeFilter, setModeFilter] = useState("");
    const [assuranceFilter, setAssuranceFilter] = useState("");
    const [assurances, setAssurances] = useState<any[]>([]);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedTicketDetails, setSelectedTicketDetails] = useState<any>(null);
    const [globalTicketMap, setGlobalTicketMap] = useState<Record<string, number>>({});

    useEffect(() => {
        chargerDonnees();
        chargerAssurances();
        chargerGlobalMap();
        runMigrations();
    }, [dateDebut, dateFin, softwareDate]);

    const runMigrations = async () => {
        try {
            const db = await getDb();
            // Ensure created_at exists for precise timing
            await db.execute("ALTER TABLE ventes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        } catch (e) { /* Column likely exists */ }

        try {
            const db = await getDb();
            // Ensure date_vente supports time
            await db.execute("ALTER TABLE ventes MODIFY date_vente DATETIME");
        } catch (e) { /* Ignore if not MySQL or already correct */ }
    };

    useEffect(() => {
        setDateDebut(softwareDate);
        setDateFin(softwareDate);
    }, [softwareDate]);

    const chargerAssurances = async () => {
        const db = await getDb();
        const res = await db.select<any[]>("SELECT * FROM assurances ORDER BY nom ASC");
        setAssurances(res);
    };

    const chargerGlobalMap = async () => {
        try {
            const db = await getDb();
            // Récupère l'ordre global de création des tickets
            const res = await db.select<any[]>("SELECT numero_ticket FROM ventes GROUP BY numero_ticket ORDER BY MIN(id) ASC");
            const map: Record<string, number> = {};
            res.forEach((row, index) => {
                map[row.numero_ticket] = index + 1;
            });
            setGlobalTicketMap(map);
        } catch (e) { console.error("Global map error", e); }
    };

    const chargerDonnees = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT v.*, 
                       p.nom_prenoms as patient_nom, 
                       p.numero_carnet as patient_carnet,
                       a.nom as assurance_nom,
                       pers.nom_prenoms as personnel_nom,
                       u.nom_complet as operateur_nom
                FROM ventes v
                LEFT JOIN patients p ON v.patient_id = p.id
                LEFT JOIN assurances a ON p.assurance_id = a.id
                LEFT JOIN personnel pers ON v.personnel_id = pers.id
                LEFT JOIN app_utilisateurs u ON v.user_id = u.id
                WHERE date(v.date_vente) >= date(?) AND date(v.date_vente) <= date(?)
                ORDER BY v.date_vente DESC, v.id DESC
            `, [dateDebut, dateFin]);
            setVentes(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const supprimerVenteAction = async (vente: any, isSilent = false) => {
        if (!isSilent && !confirm(`Voulez-vous vraiment annuler cette vente ?`)) return false;

        try {
            const db = await getDb();

            if (vente.type_vente === 'MEDICAMENT' && vente.article_id) {
                const match = vente.acte_libelle.match(/\(x(\d+)\)/);
                const qte = match ? parseInt(match[1]) : 1;
                await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [qte, vente.article_id]);
            }

            if (vente.type_vente === 'HOSPITALISATION' && vente.article_id) {
                await db.execute("UPDATE admissions SET statut = 'en_cours', date_sortie = NULL WHERE id = ?", [vente.article_id]);
            }

            // ARCHIVAGE AVANT SUPPRESSION
            await db.execute(`
                INSERT INTO ventes_supprimees (vente_id, patient_nom, acte_libelle, montant_total, raison_suppression, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                vente.id,
                vente.patient_nom || 'Client',
                vente.acte_libelle,
                vente.montant_total,
                isSilent ? "Modification Panier" : "Annulation Manuelle",
                currentUser?.id || 0
            ]);

            await db.execute("DELETE FROM ventes WHERE id = ?", [vente.id]);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const modifierVenteFlow = async (ticketNum: string) => {
        if (!confirm("Cette vente sera annulée et rechargée dans le panier pour modification. Confirmer ?")) return;

        const ventesAAnnuler = ventes.filter(v => v.numero_ticket === ticketNum);
        if (ventesAAnnuler.length === 0) return;

        const first = ventesAAnnuler[0];
        const payload = {
            patientId: first.patient_id,
            items: ventesAAnnuler.map(v => {
                const match = v.acte_libelle.match(/\(x(\d+)\)/);
                const qte = match ? parseFloat(match[1]) : 1;
                const libelleBase = v.acte_libelle.replace(/\s\(x\d+\)$/, "");
                return {
                    uniqueId: Date.now() + Math.random(),
                    itemId: v.article_id,
                    libelle: libelleBase,
                    type: v.type_vente,
                    prixUnitaire: v.montant_total / qte,
                    qte: qte,
                    useAssurance: v.part_assureur > 0,
                    partAssureurUnitaire: v.part_assureur / qte,
                    partPatientUnitaire: v.part_patient / qte
                };
            })
        };

        // DO NOT DELETE IMMEDIATELY - Pass ticket number to Caisse for atomic replacement
        (payload as any).oldTicketNum = ticketNum;

        /* 
        // REMOVED: Immediate deletion caused data loss if edit was cancelled
        for (const v of ventesAAnnuler) {
            await supprimerVenteAction(v, true);
        }
        */

        (window as any).editSalePayload = payload;

        alert("📥 Vente rechargée dans le panier !");
        setView("caisse");
    };

    const filtrerVentes = ventes.filter(v => {
        const search = searchTerm.toLowerCase();
        const matchSearch = (
            v.acte_libelle?.toLowerCase().includes(search) ||
            v.patient_nom?.toLowerCase().includes(search) ||
            v.patient_carnet?.toLowerCase().includes(search) ||
            v.numero_ticket?.toLowerCase().includes(search) ||
            v.mode_paiement?.toLowerCase().includes(search) ||
            v.part_patient.toString().includes(search) ||
            v.assurance_nom?.toLowerCase().includes(search) ||
            v.personnel_nom?.toLowerCase().includes(search)
        );
        const matchMode = !modeFilter || v.mode_paiement?.toLowerCase().includes(modeFilter.toLowerCase());
        const matchAssurance = !assuranceFilter || v.assurance_nom?.toLowerCase().includes(assuranceFilter.toLowerCase());
        return matchSearch && matchMode && matchAssurance;
    });

    const parseDateSafe = (raw: any): Date | null => {
        if (!raw) return null;
        let d = new Date(raw);
        if (!isNaN(d.getTime())) return d;

        if (typeof raw === 'string') {
            // Tentative format SQL "YYYY-MM-DD HH:MM:SS" -> ISO
            d = new Date(raw.replace(' ', 'T'));
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    };

    const getDisplayDate = (v: any) => {
        // Priorité absolue au timestamp système (created_at) pour l'heure exacte
        const d = parseDateSafe(v.created_at) || parseDateSafe(v.date_vente) || parseDateSafe(softwareDate) || new Date();
        return {
            date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
    };

    // Grouper par ticket pour l'affichage
    const tickets = filtrerVentes.reduce((acc: any, v) => {
        const t = v.numero_ticket || `ID-${v.id}`;
        if (!acc[t]) {
            const { date: dateFormatted, heure } = getDisplayDate(v);
            acc[t] = {
                items: [],
                totalPatient: 0,
                totalCredit: 0,
                totalVente: 0,
                date: parseDateSafe(v.date_vente) || parseDateSafe(v.created_at) || new Date(),
                dateFormatted,
                heure,
                patient: v.patient_nom,
                carnet: v.patient_carnet,
                mode: v.mode_paiement,
                assurance: v.assurance_nom,
                personnel: v.personnel_nom,
                operateur: v.operateur_nom,
                t,
                globalRank: globalTicketMap[v.numero_ticket] || '?'
            };
        }
        acc[t].items.push(v);
        acc[t].totalPatient += v.part_patient;
        acc[t].totalCredit += v.part_assureur || 0;
        acc[t].totalVente += v.montant_total;
        return acc;
    }, {});

    const ticketList = Object.values(tickets).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- PRINTING UTILS ---
    const imprimerTicketVente = (ticket: any) => {
        const dateStr = new Date(ticket.date).toLocaleString('fr-FR');

        const itemsRows = ticket.items.map((it: any) => `
            <tr>
                <td>${it.acte_libelle}</td>
                <td class="right">${it.montant_total.toLocaleString()} F</td>
            </tr>
        `).join('');

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket # ${ticket.t}</title>
                <style>
                    body { margin: 0; padding: 10px; font-family: 'Courier New', monospace; font-size: 12px; width: 300px; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .title { font-weight: bold; font-size: 16px; }
                    .subtitle { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .bold { font-weight: bold; }
                    .section { margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
                    .footer { margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; text-align: center; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    td { padding: 2px 0; vertical-align: top; }
                    .right { text-align: right; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">CENTRE MÉDICAL</div>
                    <div class="subtitle">TICKET DE CAISSE</div>
                    <div>N°: ${ticket.t}</div>
                    <div>${dateStr}</div>
                </div>
                
                <div class="section">
                    <div class="row"><span>Patient:</span> <span class="bold">${ticket.patient || 'Client De Passage'}</span></div>
                    ${ticket.carnet ? `<div class="row"><span>Carnet:</span> <span>${ticket.carnet}</span></div>` : ''}
                    ${ticket.assurance ? `<div class="row"><span>Assurance:</span> <span>${ticket.assurance}</span></div>` : ''}
                     <div class="row"><span>Mode:</span> <span>${ticket.mode || '-'}</span></div>
                     <div class="row"><span>Vendeur:</span> <span>${ticket.personnel || ticket.operateur || '-'}</span></div>
                </div>

                <div class="section">
                    <table>
                        ${itemsRows}
                    </table>
                </div>

                <div class="section">
                    <div class="row"><span class="bold">TOTAL:</span> <span class="bold" style="font-size:14px">${ticket.totalVente.toLocaleString()} F</span></div>
                    ${ticket.totalCredit > 0 ? `<div class="row"><span>Part Assurance:</span> <span>${ticket.totalCredit.toLocaleString()} F</span></div>` : ''}
                    <div class="row"><span>Part Patient:</span> <span class="bold">${ticket.totalPatient.toLocaleString()} F</span></div>
                </div>

                <div class="footer">
                    <div>Merci de votre confiance !</div>
                    <div>${currentUser?.nom_complet || ''}</div>
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

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', background: '#f8f9fa' }}>
            {/* FILTERS */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={labelS}>Rechercher (Ticket, Patient, Prix...)</label>
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputS} placeholder="🔍 Tapez ici..." />
                </div>
                <div style={{ minWidth: '150px' }}>
                    <label style={labelS}>Mode de Paiement</label>
                    <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} style={inputS}>
                        <option value="">Tous</option>
                        <option value="ESPÈCE">Espèces</option>
                        <option value="WAVE">Wave</option>
                        <option value="ORANGE">Orange Money</option>
                        <option value="MTN">MTN Money</option>
                        <option value="CRÉDIT">Crédit</option>
                    </select>
                </div>
                <div style={{ minWidth: '150px' }}>
                    <label style={labelS}>Assurance</label>
                    <select value={assuranceFilter} onChange={e => setAssuranceFilter(e.target.value)} style={inputS}>
                        <option value="">Toutes</option>
                        {assurances.map(a => (
                            <option key={a.id} value={a.nom}>{a.nom}</option>
                        ))}
                    </select>
                </div>
                <div style={{ minWidth: '130px' }}>
                    <label style={labelS}>Date Début</label>
                    <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={inputS} />
                </div>
                <div style={{ minWidth: '130px' }}>
                    <label style={labelS}>Date Fin</label>
                    <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={inputS} />
                </div>
                <button onClick={chargerDonnees} style={{ background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Actualiser</button>
            </div>

            {/* TABLE */}
            <div style={{ flex: 1, background: 'white', borderRadius: '15px', overflowY: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee', position: 'sticky', top: 0 }}>
                            <th style={thS}>N°</th>
                            <th style={thS}>Date</th>
                            <th style={thS}>Opérateur</th>
                            <th style={thS}>Assurance<br />Personnel</th>
                            <th style={thS}>Total Vente</th>
                            <th style={thS}>Net Crédit</th>
                            <th style={thS}>Net Patient</th>
                            <th style={thS}>Mode</th>
                            <th style={{ ...thS, textAlign: 'center' }}>Détails</th>
                            <th style={{ ...thS, textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} style={{ padding: '50px', textAlign: 'center', color: '#7f8c8d' }}>Chargement...</td></tr>
                        ) : ticketList.length === 0 ? (
                            <tr><td colSpan={10} style={{ padding: '50px', textAlign: 'center', color: '#7f8c8d' }}>Aucune vente.</td></tr>
                        ) : (
                            ticketList.map((t: any) => (
                                <tr key={t.t} style={{ borderBottom: '1px solid #eee', transition: '0.2s' }}>
                                    <td style={{ ...tdS, fontWeight: 'bold', color: '#34495e' }}>
                                        {t.t}
                                        {t.globalRank !== '?' && <div style={{ fontSize: '10px', color: '#95a5a6' }}>Ranq: #{t.globalRank}</div>}
                                    </td>
                                    <td style={tdS}>{t.dateFormatted}<br /><span style={{ fontSize: '11px', color: '#95a5a6' }}>{t.heure}</span></td>
                                    <td style={tdS}>{t.operateur || '-'}</td>
                                    <td style={tdS}>
                                        {t.assurance ? <span style={badgeS}>{t.assurance}</span> : '-'}<br />
                                        <span style={{ fontSize: '11px', color: '#95a5a6' }}>{t.personnel || ''}</span>
                                    </td>
                                    <td style={{ ...tdS, fontWeight: 'bold' }}>{t.totalVente.toLocaleString()} F</td>
                                    <td style={{ ...tdS, color: '#e67e22' }}>{t.totalCredit > 0 ? t.totalCredit.toLocaleString() + ' F' : '-'}</td>
                                    <td style={{ ...tdS, color: '#27ae60', fontWeight: 'bold' }}>{t.totalPatient.toLocaleString()} F</td>
                                    <td style={tdS}>{t.mode}</td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <button onClick={() => { setSelectedTicketDetails(t); setShowDetailsModal(true); }} style={{ ...actionBtn, background: '#3498db', color: 'white' }}>
                                            📄 Voir
                                        </button>
                                    </td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                            {/* Vérification droit modification */}
                                            {!!currentUser?.can_edit && (
                                                <button onClick={() => modifierVenteFlow(t.t)} style={actionBtn} title="Modifier (Retour au Panier)">✏️</button>
                                            )}

                                            {/* Allow if undefined or true */}
                                            {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                                <button onClick={() => imprimerTicketVente(t)} title="Imprimer Ticket" style={{ ...actionBtn, background: '#e0f2fe', color: '#0284c7' }}>
                                                    🖨️
                                                </button>
                                            )}{!!currentUser?.can_delete && (
                                                <button onClick={async () => {
                                                    if (confirm("🚨 ATTENTION : Suppression Définitive\n\nVoulez-vous vraiment supprimer ce ticket ?\n\n✅ Les articles seront remis en stock.\n✅ La vente sera archivée.")) {
                                                        for (const v of t.items) await supprimerVenteAction(v, true);
                                                        alert("🗑️ Vente supprimée et stock restauré avec succès.");
                                                        chargerDonnees();
                                                    }
                                                }} style={{ ...actionBtn, background: '#ffebee', color: '#e74c3c' }} title="Supprimer">🗑️</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL DETAILS */}
            {showDetailsModal && selectedTicketDetails && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', borderRadius: '15px', padding: '30px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#2c3e50' }}>Ticket #{selectedTicketDetails.t}</h2>
                                <div style={{ fontSize: '14px', color: '#7f8c8d' }}>{selectedTicketDetails.dateFormatted} à {selectedTicketDetails.heure}</div>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#e74c3c' }}>×</button>
                        </div>

                        <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div><strong>Patient:</strong> {selectedTicketDetails.patient || 'Client de passage'}</div>
                                <div><strong>Carnet:</strong> {selectedTicketDetails.carnet || '-'}</div>
                                <div><strong>Opérateur:</strong> {selectedTicketDetails.operateur}</div>
                                <div><strong>Mode:</strong> {selectedTicketDetails.mode}</div>
                            </div>
                        </div>

                        <table style={{ width: '100%', marginBottom: '20px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Libellé</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Prix Total</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Part Patient</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Part Assurance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedTicketDetails.items.map((it: any) => (
                                    <tr key={it.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                                        <td style={{ padding: '8px' }}>{it.acte_libelle}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{it.montant_total.toLocaleString()}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: '#27ae60' }}>{it.part_patient.toLocaleString()}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: '#e67e22' }}>{it.part_assureur.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ textAlign: 'right', fontSize: '18px' }}>
                            <div>Total Vente: <strong>{selectedTicketDetails.totalVente.toLocaleString()} F</strong></div>
                            <div style={{ color: '#27ae60' }}>Net Payé: <strong>{selectedTicketDetails.totalPatient.toLocaleString()} F</strong></div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => imprimerTicketVente(selectedTicketDetails)} style={{ background: '#f1c40f', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                🖨️ Imprimer Reçu
                            </button>
                            <button onClick={() => setShowDetailsModal(false)} style={{ background: '#bdc3c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const labelS: CSSProperties = { display: 'block', fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' };
const badgeS: CSSProperties = { background: '#e0f7fa', color: '#006064', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' };
const inputS: CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' };
const thS: CSSProperties = { padding: '15px', color: '#2c3e50', fontSize: '13px', fontWeight: 'bold' };
const tdS: CSSProperties = { padding: '15px', fontSize: '14px', verticalAlign: 'top' };
const actionBtn: CSSProperties = { border: 'none', background: '#f8f9fa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
