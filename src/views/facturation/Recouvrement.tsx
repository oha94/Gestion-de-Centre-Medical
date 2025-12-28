import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";

// --- INTERFACES ---

interface VenteCredit {
    id: number;
    patient_id: number | null;
    personnel_id: number | null;
    acte_libelle: string;
    montant_total: number;
    part_patient: number;
    part_assureur: number;
    reste_a_payer: number;
    statut: string;
    date_vente: string;
    nom_patient?: string;
    nom_personnel?: string;
    nom_assurance?: string;
}

interface DebiteurGroup {
    id: string; // "P-12" or "PERS-3" or "ASS-1"
    type: 'PATIENT' | 'PERSONNEL' | 'ASSURANCE';
    nom: string;
    total_dette: number;
    nb_dossiers: number;
    ventes: VenteCredit[];
}

interface RecoveryHistoryItem {
    id: number;
    type: string;
    montant: number;
    date_mouvement: string;
    motif: string;
    user_nom?: string;
    reference: string;
    mode_paiement: string;
}

export default function RecouvrementView({ currentUser }: { currentUser?: any }) {
    // STATES
    const [view, setView] = useState<'LIST' | 'HISTORY'>('LIST');

    // LIST DATA
    const [debiteurs, setDebiteurs] = useState<DebiteurGroup[]>([]);
    const [selectedDebiteur, setSelectedDebiteur] = useState<DebiteurGroup | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // PAYMENT FORM
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const [paymentMode, setPaymentMode] = useState("ESPECES");
    const [paymentRef, setPaymentRef] = useState("");

    // HISTORY DATA
    const [history, setHistory] = useState<RecoveryHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    // EDIT MODAL STATE
    const [showEditModal, setShowEditModal] = useState(false);
    const [editItem, setEditItem] = useState<RecoveryHistoryItem | null>(null);
    const [editForm, setEditForm] = useState({ reference: "", mode: "ESPECES", date: "", montant: "" });

    useEffect(() => {
        if (view === 'LIST') loadCredits();
        else loadHistory();
    }, [view]);

    // --- LOAD DATA ---

    const loadCredits = async () => {
        try {
            setLoading(true);
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT v.*, 
                       p.nom_prenoms as nom_patient, 
                       p.assurance_id as p_assur_id,
                       ass.nom as nom_assurance,
                       COALESCE(pers.nom_prenoms, u.nom_complet) as nom_personnel
                FROM ventes v
                LEFT JOIN patients p ON v.patient_id = p.id
                LEFT JOIN assurances ass ON p.assurance_id = ass.id
                LEFT JOIN personnel pers ON v.personnel_id = pers.id
                LEFT JOIN app_utilisateurs u ON v.personnel_id = u.id AND pers.id IS NULL
                WHERE v.reste_a_payer > 1 AND v.statut = 'CREDIT'
                ORDER BY v.date_vente ASC
            `);

            const groups: { [key: string]: DebiteurGroup } = {};

            res.forEach(v => {
                let key = "";
                let type: 'PATIENT' | 'PERSONNEL' | 'ASSURANCE' = 'PATIENT';
                let nom = "Inconnu";

                if (v.personnel_id) {
                    key = `PERS-${v.personnel_id}`; type = 'PERSONNEL';
                    nom = v.nom_personnel || `Personnel #${v.personnel_id}`;
                } else if (v.patient_id) {
                    key = `P-${v.patient_id}`; type = 'PATIENT';
                    nom = v.nom_patient || `Patient #${v.patient_id}`;
                    if (v.nom_assurance) nom += ` (${v.nom_assurance})`;
                } else {
                    key = `UNK-${v.id}`; nom = "Client Divers";
                }

                if (!groups[key]) {
                    groups[key] = { id: key, type, nom, total_dette: 0, nb_dossiers: 0, ventes: [] };
                }
                groups[key].total_dette += v.reste_a_payer;
                groups[key].nb_dossiers++;
                groups[key].ventes.push(v);
            });

            setDebiteurs(Object.values(groups).sort((a, b) => b.total_dette - a.total_dette));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadHistory = async () => {
        try {
            setLoading(true);
            const db = await getDb();
            const res = await db.select<RecoveryHistoryItem[]>(`
                SELECT cm.*, u.nom_complet as user_nom 
                FROM caisse_mouvements cm
                LEFT JOIN app_utilisateurs u ON cm.user_id = u.id
                WHERE cm.type = 'RECOUVREMENT'
                ORDER BY cm.date_mouvement DESC
                LIMIT 50
            `);
            setHistory(res);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // --- ACTIONS ---

    const handlePrintHistory = async (item: RecoveryHistoryItem) => {
        try {
            const db = await getDb();
            // 1. Fetch Details
            const details = await db.select<any[]>(`
                SELECT d.montant_regle, v.acte_libelle, v.date_vente, 
                       p.nom_prenoms as nom_patient, u.nom_complet as nom_personnel
                FROM caisse_recouvrements_details d
                JOIN ventes v ON d.vente_id = v.id
                LEFT JOIN patients p ON v.patient_id = p.id
                LEFT JOIN personnel pr ON v.personnel_id = pr.id
                LEFT JOIN app_utilisateurs u ON v.personnel_id = u.id
                WHERE d.caisse_mouvement_id = ?
            `, [item.id]);

            if (details.length === 0) {
                // FALLBACK FOR LEGACY DATA (No details table)
                // We create a generic item based on the main record
                const items = [{
                    date: new Date(item.date_mouvement).toLocaleDateString(),
                    libelle: item.motif || "Recouvrement (Ancien)",
                    montant: item.montant
                }];

                // Guess debtor from motif if possible, else "Incconu"
                const debiteurNom = item.motif.replace("Recouvrement : ", "").split('(')[0].trim() || "Client";

                imprimerRecuRecouvrement({
                    recovId: item.reference,
                    debiteurNom,
                    debiteurType: "HISTORIQUE",
                    items,
                    totalPaid: item.montant,
                    oldBalance: item.montant, // We don't verify balance for legacy
                    mode: item.mode_paiement,
                    ref: item.reference
                });
                return;
            }

            // 2. Guess Debtor Name from first detail
            const first = details[0];
            const debiteurNom = first.nom_patient || first.nom_personnel || "Client";

            // 3. Format Items
            const items = details.map(d => ({
                date: new Date(d.date_vente).toLocaleDateString(),
                libelle: d.acte_libelle,
                montant: d.montant_regle
            }));

            // 4. Print
            imprimerRecuRecouvrement({
                recovId: item.reference,
                debiteurNom,
                debiteurType: "HISTORIQUE",
                items,
                totalPaid: item.montant,
                oldBalance: item.montant,
                mode: item.mode_paiement,
                ref: item.reference
            });

        } catch (e) { console.error(e); alert("Erreur impression"); }
    };

    const handleEditHistory = (item: RecoveryHistoryItem) => {
        setEditItem(item);
        setEditForm({
            reference: item.reference || "",
            mode: item.mode_paiement || "ESPECES",
            date: item.date_mouvement ? new Date(item.date_mouvement).toISOString().split('T')[0] : "",
            montant: item.montant.toString()
        });
        setShowEditModal(true);
    };

    const saveEditHistory = async () => {
        if (!editItem) return;
        try {
            const db = await getDb();

            // 1. Basic Updates (Ref, Mode, Date)
            let dateSql = editItem.date_mouvement;
            if (editForm.date) {
                const originalTime = new Date(editItem.date_mouvement).toTimeString().split(' ')[0];
                dateSql = `${editForm.date} ${originalTime}`;
            }

            // 2. CHECK AMOUNT CHANGE
            const newAmount = parseFloat(editForm.montant);
            if (!isNaN(newAmount) && newAmount !== editItem.montant) {
                // AMOUNT CHANGED: COMPLEX UPDATE (Revert old, Apply new)

                // Fetch Details for Revert
                const details = await db.select<any[]>("SELECT * FROM caisse_recouvrements_details WHERE caisse_mouvement_id = ?", [editItem.id]);

                if (details.length === 0) {
                    // LEGACY RECORD (No details): Just update amount (Warning: Doesn't update debts)
                    if (!confirm("⚠️ Attention : Ce recouvrement est ancien et ne possède pas de détails liés.\nLa modification du montant ne mettra PAS à jour les dettes des tickets.\nVoulez-vous uniquement changer le montant affiché ?")) return;
                } else {
                    // MODERN RECORD: Re-distribute logic
                    if (!confirm(`⚠️ ATTENTION : Modification du Montant\n\nCela va annuler l'ancienne répartition (${editItem.montant.toLocaleString()} F) et réaffecter le nouveau montant (${newAmount.toLocaleString()} F) aux dettes du client.\n\nContinuer ?`)) return;

                    // Determine Debtor ID from first detail (needed to fetch current debts)
                    const firstSale = await db.select<any[]>("SELECT patient_id, personnel_id FROM ventes WHERE id = ?", [details[0].vente_id]);
                    if (firstSale.length === 0) return alert("Erreur : Vente d'origine introuvable.");

                    const { patient_id, personnel_id } = firstSale[0];

                    // A. REVERT OLD
                    for (const d of details) {
                        await db.execute("UPDATE ventes SET reste_a_payer = reste_a_payer + ?, statut = 'CREDIT' WHERE id = ?", [d.montant_regle, d.vente_id]);
                    }
                    await db.execute("DELETE FROM caisse_recouvrements_details WHERE caisse_mouvement_id = ?", [editItem.id]);

                    // B. APPLY NEW
                    // Fetch Debtor Debts
                    let query = `SELECT * FROM ventes WHERE reste_a_payer > 0 AND statut = 'CREDIT' `;
                    const params: any[] = [];

                    if (patient_id) { query += " AND patient_id = ?"; params.push(patient_id); }
                    else if (personnel_id) { query += " AND personnel_id = ?"; params.push(personnel_id); }
                    else { return alert("Impossible de déterminer le débiteur."); }

                    query += " ORDER BY date_vente ASC";

                    const debts = await db.select<any[]>(query, params);
                    let remain = newAmount;

                    for (const vente of debts) {
                        if (remain <= 0) break;
                        const detteVente = vente.reste_a_payer;
                        const payeSurVente = Math.min(remain, detteVente);
                        const nouveauReste = vente.reste_a_payer - payeSurVente;
                        const nouveauStatut = nouveauReste < 5 ? 'PAYE' : 'CREDIT';

                        await db.execute("UPDATE ventes SET reste_a_payer = ?, statut = ? WHERE id = ?", [nouveauReste, nouveauStatut, vente.id]);

                        await db.execute("INSERT INTO caisse_recouvrements_details (caisse_mouvement_id, vente_id, montant_regle) VALUES (?, ?, ?)", [editItem.id, vente.id, payeSurVente]);

                        remain -= payeSurVente;
                    }
                }

                // Update Movement Amount
                await db.execute("UPDATE caisse_mouvements SET montant = ? WHERE id = ?", [newAmount, editItem.id]);
            }

            // 3. Finalize Update (Ref, Mode, Date)
            await db.execute("UPDATE caisse_mouvements SET reference = ?, mode_paiement = ?, date_mouvement = ? WHERE id = ?",
                [editForm.reference, editForm.mode, dateSql, editItem.id]);

            setShowEditModal(false);
            setEditItem(null);
            loadHistory();
            alert("✅ Modification enregistrée");
        } catch (e) { console.error(e); alert("Erreur modification"); }
    };

    const handleSmartPayment = async () => {
        if (!selectedDebiteur || !paymentAmount) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Montant invalide");
        if (amount > selectedDebiteur.total_dette) return alert("Le montant dépasse la dette totale !");

        if (!confirm(`Confirmer le recouvrement de ${amount.toLocaleString()} F pour ${selectedDebiteur.nom} ?`)) return;

        try {
            const db = await getDb();
            const paidItems: { date: string, libelle: string, montant: number }[] = [];
            let remain = amount;
            const dettesInitiales = selectedDebiteur.total_dette;

            // ID Generation
            const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const randPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const recovId = `REC-${datePart}-${randPart}`;

            // 1. Insert Caisse Mouvement FIRST to get ID
            const dateParams = await db.select<any[]>("SELECT date_systeme_actuelle FROM app_parametres_app LIMIT 1");
            const dateTravail = dateParams[0]?.date_systeme_actuelle || new Date().toISOString().split('T')[0];
            const fullDate = `${dateTravail} ${new Date().toTimeString().split(' ')[0]}`;

            const resMvt = await db.execute(`
                INSERT INTO caisse_mouvements (type, montant, date_mouvement, motif, mode_paiement, reference, user_id)
                VALUES ('RECOUVREMENT', ?, ?, ?, ?, ?, ?)
            `, [amount, fullDate, `Recouvrement : ${selectedDebiteur.nom}`, paymentMode, paymentRef || recovId, currentUser?.id || null]);

            const mvtId = resMvt.lastInsertId;

            // 2. Distribute and Track Details
            for (const vente of selectedDebiteur.ventes) {
                if (remain <= 0) break;

                const detteVente = vente.reste_a_payer;
                const payeSurVente = Math.min(remain, detteVente);
                const nouveauReste = vente.reste_a_payer - payeSurVente;
                const nouveauStatut = nouveauReste < 5 ? 'PAYE' : 'CREDIT';

                // LOG DEBT MODIFICATION
                await db.execute(`
                    INSERT INTO logs_modifications (table_name, record_id, field_name, old_value, new_value, user_id, motif)
                    VALUES ('ventes', ?, 'reste_a_payer', ?, ?, ?, 'Recouvrement automatique')
                `, [vente.id, vente.reste_a_payer, nouveauReste, currentUser?.id || 0]);

                await db.execute("UPDATE ventes SET reste_a_payer = ?, statut = ? WHERE id = ?", [nouveauReste, nouveauStatut, vente.id]);

                // Track detail
                await db.execute(`
                    INSERT INTO caisse_recouvrements_details (caisse_mouvement_id, vente_id, montant_regle)
                    VALUES (?, ?, ?)
                `, [mvtId, vente.id, payeSurVente]);

                paidItems.push({
                    date: new Date(vente.date_vente).toLocaleDateString(),
                    libelle: vente.acte_libelle,
                    montant: payeSurVente
                });
                remain -= payeSurVente;
            }

            // 3. Print
            imprimerRecuRecouvrement({
                recovId, debiteurNom: selectedDebiteur.nom, debiteurType: selectedDebiteur.type,
                items: paidItems, totalPaid: amount, oldBalance: dettesInitiales,
                mode: paymentMode, ref: paymentRef
            });

            alert("✅ Recouvrement succès !");
            setSelectedDebiteur(null);
            setPaymentAmount("");
            loadCredits();

        } catch (e) { console.error(e); alert("Erreur lors du recouvrement"); }
    };

    const handleDeleteRecovery = async (item: RecoveryHistoryItem) => {
        if (!confirm(`⚠️ ANNULATION RECOUVREMENT\n\nVous êtes sur le point d'annuler le recouvrement de ${item.montant.toLocaleString()} F.\nCela va RESTAURER les dettes des tickets concernés.\n\nContinuer ?`)) return;

        try {
            const db = await getDb();

            // 1. Get details to revert
            const details = await db.select<any[]>("SELECT * FROM caisse_recouvrements_details WHERE caisse_mouvement_id = ?", [item.id]);

            if (details.length === 0) {
                // Fallback for old records without details log
                if (!confirm("⚠️ Attention : Ce recouvrement ne possède pas de détails liés (ancien système).\nLa suppression ne restaurera PAS les dettes automatiquement.\nSupprimer quand même l'écriture de caisse ?")) return;
            } else {
                // 2. Revert dents
                for (const d of details) {
                    await db.execute(`
                        UPDATE ventes 
                        SET reste_a_payer = reste_a_payer + ?, 
                            statut = 'CREDIT' 
                        WHERE id = ?
                    `, [d.montant_regle, d.vente_id]);
                }
            }

            // 3. Delete logs
            await db.execute("DELETE FROM caisse_recouvrements_details WHERE caisse_mouvement_id = ?", [item.id]);
            await db.execute("DELETE FROM caisse_mouvements WHERE id = ?", [item.id]);

            alert("✅ Recouvrement annulé et dettes restaurées.");
            loadHistory();

        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'annulation.");
        }
    };

    // --- UTILS ---

    // --- UTILS ---

    // NEW EXPORT EXCEL FUNCTION
    const handleExportExcel = async (item: RecoveryHistoryItem) => {
        try {
            const db = await getDb();
            const details = await db.select<any[]>(`
                SELECT d.montant_regle, v.acte_libelle, v.date_vente, 
                       p.nom_prenoms as nom_patient, u.nom_complet as nom_personnel
                FROM caisse_recouvrements_details d
                JOIN ventes v ON d.vente_id = v.id
                LEFT JOIN patients p ON v.patient_id = p.id
                LEFT JOIN personnel pr ON v.personnel_id = pr.id
                LEFT JOIN app_utilisateurs u ON v.personnel_id = u.id
                WHERE d.caisse_mouvement_id = ?
            `, [item.id]);

            let dataToExport = [];

            if (details.length === 0) {
                dataToExport = [{
                    'Date': new Date(item.date_mouvement).toLocaleDateString(),
                    'Libellé': item.motif || "Recouvrement (Ancien)",
                    'Montant': item.montant
                }];
            } else {
                dataToExport = details.map(d => ({
                    'Date': new Date(d.date_vente).toLocaleDateString(),
                    'Libellé': d.acte_libelle,
                    'Montant': d.montant_regle,
                    'Patient': d.nom_patient || d.nom_personnel || 'Inconnu'
                }));
            }

            utilsExportToExcel(dataToExport, `Recouvrement_${item.reference}`);

        } catch (e) {
            console.error(e);
            alert("Erreur Export Excel");
        }
    };

    const imprimerRecuRecouvrement = async (data: any) => {
        const company = await getCompanyInfo();
        const dateStr = new Date().toLocaleString('fr-FR');
        const newBalance = data.oldBalance - data.totalPaid;

        const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reçu de Paiement ${data.recovId}</title>
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

                        .total-section { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; margin-top: 20px; }
                        .total-row { display: flex; justify-content: space-between; width: 200px; font-size: 11px; }
                        .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #f9f9f9; border: 1px solid #eee; color: #2c3e50; margin-top: 10px; text-align: center; }

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
                            <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Reçu de Paiement</div>
                            <div class="doc-title">${data.recovId}</div>
                        </div>
                    </div>

                    <div class="meta-grid">
                        <div class="meta-item">
                            <label>Débiteur</label>
                            <span>${data.debiteurNom} (${data.debiteurType})</span>
                        </div>
                        <div class="meta-item">
                            <label>Date Paiement</label>
                            <span>${dateStr}</span>
                        </div>
                        <div class="meta-item">
                            <label>Mode de Paiement</label>
                            <span>${data.mode}</span>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Motif / Acte</th>
                                <th style="text-align: right;">Montant Réglé</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map((item: any) => `
                                <tr>
                                    <td>${item.date}</td>
                                    <td>${item.libelle}</td>
                                    <td style="text-align: right;">${item.montant.toLocaleString()} F</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-row">
                            <span>Dette Initiale:</span>
                            <span>${data.oldBalance.toLocaleString()} F</span>
                        </div>
                         <div class="total-row">
                            <span>Nouveau Solde:</span>
                            <span>${newBalance.toLocaleString()} F</span>
                        </div>
                        <div class="total-box">
                            TOTAL VERSÉ : ${data.totalPaid.toLocaleString()} F
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

    const filteredDebiteurs = debiteurs.filter(d => d.nom.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalGlobal = filteredDebiteurs.reduce((acc, d) => acc + d.total_dette, 0);

    return (
        <div style={{ padding: '25px', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", sans-serif', background: '#f8f9fa' }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '24px' }}>💸 Recouvrement {loading && <span style={{ fontSize: '14px', color: '#e67e22', verticalAlign: 'middle' }}>(Chargement...)</span>}</h1>
                </div>
                <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <button onClick={() => setView('LIST')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: view === 'LIST' ? '#3498db' : 'transparent', color: view === 'LIST' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold' }}>Liste Débiteurs</button>
                    <button onClick={() => setView('HISTORY')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: view === 'HISTORY' ? '#3498db' : 'transparent', color: view === 'HISTORY' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold' }}>Historique</button>
                </div>
            </div>

            {view === 'LIST' ? (
                <>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ background: 'white', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                            <span>🔍</span>
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher..." style={{ border: 'none', outline: 'none', fontSize: '16px', width: '100%' }} />
                        </div>
                        <div style={{ background: '#e74c3c', color: 'white', padding: '10px 25px', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                            Total : {totalGlobal.toLocaleString()} F
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', alignContent: 'start' }}>
                        {filteredDebiteurs.map(d => (
                            <div key={d.id} onClick={() => setSelectedDebiteur(d)} style={{ background: 'white', borderRadius: '15px', padding: '20px', cursor: 'pointer', border: '1px solid #edf2f7', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', background: d.type === 'PERSONNEL' ? '#f39c12' : d.type === 'ASSURANCE' ? '#27ae60' : '#3498db' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d' }}>{d.type}</span>
                                    <span style={{ fontSize: '11px', background: '#edf2f7', padding: '2px 8px', borderRadius: '10px' }}>{d.nb_dossiers} factures</span>
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px', color: '#2c3e50' }}>{d.nom}</div>
                                <div style={{ fontWeight: '900', fontSize: '22px', color: '#e74c3c' }}>{d.total_dette.toLocaleString()} F</div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', background: 'white', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', color: '#7f8c8d', fontSize: '13px', textAlign: 'left' }}>
                                <th style={{ padding: '12px' }}>Date</th>
                                <th style={{ padding: '12px' }}>Motif / Débiteur</th>
                                <th style={{ padding: '12px' }}>Mode</th>
                                <th style={{ padding: '12px' }}>Caissier</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>{new Date(h.date_mouvement).toLocaleString()}</td>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{h.motif}<br /><span style={{ fontSize: '11px', color: '#95a5a6' }}>{h.reference}</span></td>
                                    <td style={{ padding: '12px' }}>{h.mode_paiement}</td>
                                    <td style={{ padding: '12px' }}>{h.user_nom || 'Système'}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>{h.montant.toLocaleString()} F</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                                            {/* Allow if undefined or true */}
                                            {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                                <>
                                                    <button onClick={() => handlePrintHistory(h)} title="Imprimer Reçu" style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖨️</button>
                                                    <button onClick={() => handleExportExcel(h)} title="Excel" style={{ background: '#e0f2fe', color: '#107c41', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</button>
                                                </>
                                            )}

                                            {!!currentUser?.can_edit && (
                                                <button onClick={() => handleEditHistory(h)} title="Modifier" style={{ background: '#fff3e0', color: '#e67e22', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>✏️</button>
                                            )}

                                            {!!currentUser?.can_delete && (
                                                <button onClick={() => handleDeleteRecovery(h)} title="Supprimer" style={{ background: '#ffebee', color: '#e74c3c', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>🗑️</button>
                                            )}
                                        </div>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            }

            {/* MODAL PAIEMENT */}
            {
                selectedDebiteur && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', width: '450px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h2 style={{ margin: 0 }}>Recouvrement</h2><button onClick={() => setSelectedDebiteur(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button></div>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{selectedDebiteur.nom}</div>
                                <div style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '24px' }}>{selectedDebiteur.total_dette.toLocaleString()} F</div>
                            </div>
                            <input type="number" autoFocus value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Montant versé" style={{ width: '100%', padding: '15px', fontSize: '18px', marginBottom: '15px', border: '2px solid #3498db', borderRadius: '10px' }} />
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px' }}>
                                    <option value="ESPECES">Espèces</option>
                                    <option value="CHEQUE">Chèque</option>
                                    <option value="VIREMENT">Virement</option>
                                    <option value="MOBILE">Mobile Money</option>
                                </select>
                                <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Ref..." style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
                            </div>
                            <button onClick={handleSmartPayment} style={{ width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>CONFIRMER</button>
                        </div>
                    </div>
                )
            }
            {/* MODAL EDIT RECOVERY */}
            {
                showEditModal && editItem && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                        <div style={{ background: 'white', borderRadius: '15px', padding: '25px', width: '400px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Modifier Recouvrement</h3>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#7f8c8d' }}>Montant</label>
                                <input type="number" value={editForm.montant} onChange={e => setEditForm({ ...editForm, montant: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }} />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#7f8c8d' }}>Date</label>
                                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }} />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#7f8c8d' }}>Mode de Paiement</label>
                                <select value={editForm.mode} onChange={e => setEditForm({ ...editForm, mode: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}>
                                    <option value="ESPECES">Espèces</option>
                                    <option value="CHEQUE">Chèque</option>
                                    <option value="VIREMENT">Virement</option>
                                    <option value="MOBILE">Mobile Money</option>
                                    <option value="CB">Carte Bancaire</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#7f8c8d' }}>Référence (Non modifiable)</label>
                                <input value={editForm.reference} disabled style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #eee', background: '#f9f9f9', cursor: 'not-allowed' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button onClick={() => setShowEditModal(false)} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: '#ccc', cursor: 'pointer' }}>Annuler</button>
                                <button onClick={saveEditHistory} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: '#3498db', color: 'white', cursor: 'pointer' }}>Enregistrer</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
