import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../../lib/db";
import { Protect } from "../../components/Protect";
import { generateTicketHTML as generateGlobalTicket } from "../../utils/ticketGenerator";

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
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

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
                       p.taux_couverture,
                       a.nom as assurance_nom,
                       COALESCE(v.personnel_nom, pers.nom_prenoms) as personnel_nom,
                       u.nom_complet as operateur_nom
                FROM ventes v
                LEFT JOIN patients p ON v.patient_id = p.id
                LEFT JOIN assurances a ON p.assurance_id = a.id
                LEFT JOIN personnel pers ON v.personnel_id = pers.id
                LEFT JOIN app_utilisateurs u ON v.user_id = u.id
                WHERE date(v.date_vente) >= date(?) AND date(v.date_vente) <= date(?)
                AND v.type_vente != 'RECOUVREMENT'
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

            // 1. Restauration stock médicaments
            if (vente.type_vente === 'MEDICAMENT' && vente.article_id) {
                const match = vente.acte_libelle.match(/\(x(\d+)\)/);
                const qte = match ? parseInt(match[1]) : 1;
                await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [qte, vente.article_id]);
            }

            // 2. Restauration hospitalisation
            // Détecter les items d'hospitalisation par type OU par libellé
            const isHospiItem = vente.type_vente === 'HOSPITALISATION' 
                || vente.acte_libelle?.includes('SÉJOUR') 
                || vente.acte_libelle?.includes('FORFAIT AMI') 
                || vente.acte_libelle?.includes('VISITE MÉDECIN')
                || vente.acte_libelle?.includes('KITS CONSOMMABLES');

            if (isHospiItem && (vente.patient_id || vente.article_id)) {
                try {
                    // Si on a l'ID précis (cas des nouvelles ventes corrigées), on l'utilise
                    if (vente.article_id && vente.type_vente === 'HOSPITALISATION') {
                        await db.execute("UPDATE admissions SET statut = 'en_cours', date_sortie = NULL WHERE id = ?", [vente.article_id]);
                    } 
                    // Sinon (Legacy), on cherche la dernière terminée, MAIS seulement si aucune n'est déjà en cours
                    else if (vente.patient_id) {
                        const activeCount = await db.select<any[]>("SELECT COUNT(*) as c FROM admissions WHERE patient_id = ? AND statut = 'en_cours'", [vente.patient_id]);
                        if (activeCount[0].c === 0) {
                            await db.execute(
                                "UPDATE admissions SET statut = 'en_cours', date_sortie = NULL WHERE patient_id = ? AND statut = 'termine' ORDER BY id DESC LIMIT 1",
                                [vente.patient_id]
                            );
                        }
                    }

                    // On s'assure que le lit est bien marqué occupé
                    const admRes = await db.select<any[]>(
                        "SELECT lit_id FROM admissions WHERE (id = ? OR patient_id = ?) AND statut = 'en_cours' ORDER BY id DESC LIMIT 1",
                        [vente.article_id || 0, vente.patient_id || 0]
                    );
                    if (admRes.length > 0 && admRes[0].lit_id) {
                        await db.execute("UPDATE lits SET statut = 'occupe' WHERE id = ?", [admRes[0].lit_id]);
                    }
                } catch (e) {
                    console.error("Erreur restauration admission:", e);
                }
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
                isSilent ? "Modification Panier" : (isHospiItem ? "Annulation Hospitalisation" : "Annulation Manuelle"),
                currentUser?.id || 0
            ]);

            await db.execute("DELETE FROM ventes WHERE id = ?", [vente.id]);
            return true;
        } catch (e) {
            console.error(e);
            alert("Erreur technique de suppression: " + (e as any).message || String(e));
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
            (v.acte_libelle?.toString().toLowerCase() || "").includes(search) ||
            (v.patient_nom?.toString().toLowerCase() || "").includes(search) ||
            (v.patient_carnet?.toString().toLowerCase() || "").includes(search) ||
            (v.numero_ticket?.toString().toLowerCase() || "").includes(search) ||
            (v.mode_paiement?.toString().toLowerCase() || "").includes(search) ||
            (v.part_patient?.toString() || "").includes(search) ||
            (v.assurance_nom?.toString().toLowerCase() || "").includes(search) ||
            (v.personnel_nom?.toString().toLowerCase() || "").includes(search)
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
        // Group purely by Ticket Number if available to avoid splitting multi-item sales
        const tKey = v.numero_ticket || `ID-${v.id}`;
        const tLabel = v.numero_ticket || `ID-${v.id}`;

        if (!acc[tKey]) {
            const { date: dateFormatted, heure } = getDisplayDate(v);
            acc[tKey] = {
                items: [],
                totalPatient: 0,
                totalCredit: 0,
                totalVente: 0,
                totalRemise: 0,
                date: parseDateSafe(v.date_vente) || parseDateSafe(v.created_at) || new Date(),
                dateFormatted,
                heure,
                patient: v.patient_nom,
                carnet: v.patient_carnet,
                mode: v.mode_paiement,
                assurance: v.assurance_nom,
                taux_couverture: v.taux_couverture,
                societe_nom: v.societe_nom,
                personnel: v.personnel_nom,
                operateur: v.operateur_nom,
                t: tLabel, // Display Label
                uniqueKey: tKey, // Internal Key
                globalRank: globalTicketMap[v.numero_ticket] || '?'
            };
        }
        acc[tKey].items.push(v);
        acc[tKey].totalPatient += v.part_patient;
        acc[tKey].totalCredit += v.part_assureur || 0;
        acc[tKey].totalVente += v.montant_total;
        acc[tKey].totalRemise += Math.max(0, v.montant_total - v.part_patient - (v.part_assureur || 0));
        return acc;
    }, {});

    const ticketList = Object.values(tickets).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- PRINTING UTILS ---
    const generateTicketHTML = (ticket: any) => {
        const payload = {
            entreprise: { nom_entreprise: 'CENTRE MÉDICAL', adresse: '', telephone: '' },
            ticketNum: ticket.t,
            dateVente: new Date(ticket.date),
            patient: {
                nom_prenoms: ticket.patient || ticket.personnel || 'Client De Passage',
                numero_carnet: ticket.carnet,
                nom_assurance: ticket.assurance,
                taux_couverture: ticket.taux_couverture
            },
            personnel: {
                nom_prenoms: ticket.personnel || ticket.operateur || '-'
            },
            caissier: currentUser?.nom_complet || 'Système',
            items: ticket.items.map((it: any) => {
                const match = it.acte_libelle ? it.acte_libelle.match(/\(x(\d+)\)/) : null;
                const qte = match ? parseInt(match[1]) : 1;
                const libelleBase = it.acte_libelle ? it.acte_libelle.replace(/\s\(x\d+\)$/, "").trim() : '';
                return {
                    libelle: libelleBase,
                    categorie: it.type_vente || 'AUTRE',
                    qte: qte,
                    prixUnitaire: it.montant_total / qte,
                    partPatientUnitaire: it.part_patient / qte // Use actual part_patient!
                };
            }),
            totalBrut: ticket.totalVente,
            totalRemise: ticket.totalRemise,
            totalPartAssureur: ticket.totalCredit,
            totalNetPatient: ticket.totalPatient,
            paiement: {
                montantVerse: ticket.totalPatient,
                rendu: 0,
                mode: ticket.mode || '-'
            },
            insForm: ticket.societe_nom ? { societeNom: ticket.societe_nom, matricule: '', numeroBon: ticket.societe_nom } : undefined
        };
        
        return generateGlobalTicket(payload as any, '80mm');
    };

    const handlePreviewTicket = (ticket: any) => {
        const html = generateTicketHTML(ticket);
        setPreviewHtml(html);
    };

    const [caissePrinter, setCaissePrinter] = useState<string | null>(null);

    useEffect(() => {
        const loadPrinter = async () => {
            try {
                const db = await getDb();
                const settings = await db.select<any[]>("SELECT * FROM app_parametres_app LIMIT 1");
                if (settings[0]?.imprimante_caisse) {
                    setCaissePrinter(settings[0].imprimante_caisse);
                }
            } catch (e) { console.error("Printer load error", e); }
        };
        loadPrinter();
    }, []);

    const printHtml = async (html: string) => {
        if (caissePrinter && caissePrinter !== "Par défaut") {
            let container: HTMLDivElement | null = null;
            try {
                const html2canvas = (await import('html2canvas')).default;
                const { invoke } = await import('@tauri-apps/api/core');

                container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '80mm'; // Receipt width
                container.style.background = 'white';
                container.innerHTML = html;
                document.body.appendChild(container);

                await new Promise(r => setTimeout(r, 100)); // Layout wait

                const canvas = await html2canvas(container, { scale: 2.5, useCORS: true });
                const imgData = canvas.toDataURL('image/png');

                const base64 = imgData.split(',')[1];
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                await invoke('print_pdf', { printerName: caissePrinter, fileContent: Array.from(bytes) });
            } catch (e) {
                console.error("Backend print error", e);
                // alert("Erreur impression backend: " + e);
            } finally {
                if (container && document.body.contains(container)) {
                    document.body.removeChild(container);
                }
            }
            return;
        }

        // Fallback
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
            doc.write(html);
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
                            <th style={thS}>Client</th>
                            <th style={thS}>Total Brut</th>
                            <th style={thS}>Remise</th>
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
                                <tr key={t.uniqueKey} style={{ borderBottom: '1px solid #eee', transition: '0.2s' }}>
                                    <td style={{ ...tdS, fontWeight: 'bold', color: '#34495e' }}>
                                        {t.t}
                                        {t.globalRank !== '?' && <div style={{ fontSize: '10px', color: '#95a5a6' }}>Ranq: #{t.globalRank}</div>}
                                    </td>
                                    <td style={tdS}>{t.dateFormatted}<br /><span style={{ fontSize: '11px', color: '#95a5a6' }}>{t.heure}</span></td>
                                    <td style={tdS}>{t.operateur || '-'}</td>
                                    <td style={tdS}>
                                        <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{t.patient || t.personnel || 'Client de passage'}</div>
                                        {t.assurance ? <span style={badgeS}>{t.assurance}</span> : null}
                                    </td>
                                    <td style={{ ...tdS, fontWeight: 'bold' }}>{t.totalVente.toLocaleString()} F</td>
                                    <td style={{ ...tdS, color: t.totalRemise > 0 ? '#e74c3c' : '#bdc3c7', fontWeight: t.totalRemise > 0 ? 'bold' : 'normal' }}>
                                        {t.totalRemise > 0 ? `-${t.totalRemise.toLocaleString()} F` : '-'}
                                    </td>
                                    <td style={{ ...tdS, color: '#27ae60', fontWeight: 'bold' }}>{t.totalPatient.toLocaleString()} F</td>
                                    <td style={tdS}>
                                        <div style={{ fontSize: '12px' }}>{t.mode}</div>
                                        {t.totalCredit > 0 && <div style={{ fontSize: '11px', color: '#e67e22', marginTop: '2px' }}>Assur: {t.totalCredit.toLocaleString()}F</div>}
                                    </td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <button onClick={() => { setSelectedTicketDetails(t); setShowDetailsModal(true); }} style={{ ...actionBtn, background: '#3498db', color: 'white' }}>
                                            📄 Voir
                                        </button>
                                    </td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                            {/* Vérification droit modification */}
                                            <Protect code="caisse_liste" action="UPDATE">
                                                <button onClick={() => modifierVenteFlow(t.t)} style={actionBtn} title="Modifier (Retour au Panier)">✏️</button>
                                            </Protect>

                                            {/* Allow if undefined or true */}
                                            {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                                <button onClick={() => handlePreviewTicket(t)} title="Imprimer Ticket (Aperçu)" style={{ ...actionBtn, background: '#e0f2fe', color: '#0284c7' }}>
                                                    🖨️
                                                </button>
                                            )}

                                            <Protect code="caisse_liste" action="DELETE">
                                                <button onClick={async () => {
                                                    // Détecter si le ticket contient des items d'hospitalisation
                                                    const hospiItems = t.items.filter((v: any) => 
                                                        v.type_vente === 'HOSPITALISATION' 
                                                        || v.acte_libelle?.includes('SÉJOUR') 
                                                        || v.acte_libelle?.includes('FORFAIT AMI') 
                                                        || v.acte_libelle?.includes('VISITE MÉDECIN')
                                                        || v.acte_libelle?.includes('KITS CONSOMMABLES')
                                                    );
                                                    const hasHospi = hospiItems.length > 0;

                                                    const confirmMsg = hasHospi 
                                                        ? `🏨 ATTENTION : VENTE LIÉE À UNE HOSPITALISATION\n\n` +
                                                          `Ce ticket contient ${hospiItems.length} élément(s) d'hospitalisation :\n` +
                                                          hospiItems.map((h: any) => `  • ${h.acte_libelle}`).join('\n') + `\n\n` +
                                                          `En supprimant cette vente :\n` +
                                                          `✅ Le dossier d'hospitalisation sera RÉOUVERT\n` +
                                                          `✅ Le lit sera remis en "occupé"\n` +
                                                          `✅ Les articles seront remis en stock\n` +
                                                          `✅ La vente sera archivée\n\n` +
                                                          `Confirmer la suppression ?`
                                                        : "🚨 ATTENTION : Suppression Définitive\n\nVoulez-vous vraiment supprimer ce ticket ?\n\n✅ Les articles seront remis en stock.\n✅ La vente sera archivée.";

                                                    if (confirm(confirmMsg)) {
                                                        let allSuccess = true;
                                                        for (const v of t.items) {
                                                            const s = await supprimerVenteAction(v, true);
                                                            if (!s) allSuccess = false;
                                                        }
                                                        if (allSuccess) {
                                                            alert(hasHospi 
                                                                ? "🏨 Vente d'hospitalisation supprimée !\n\n✅ Dossier d'hospitalisation réouvert.\n✅ Stock restauré." 
                                                                : "🗑️ Vente supprimée et stock restauré avec succès.");
                                                        }
                                                        chargerDonnees();
                                                    }
                                                }} style={{ ...actionBtn, background: '#ffebee', color: '#e74c3c' }} title="Supprimer">🗑️</button>
                                            </Protect>
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
                                <div><strong>Client / Patient:</strong> {selectedTicketDetails.patient || selectedTicketDetails.personnel || 'Client de passage'}</div>
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
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Remise</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Assurance</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Net (À Payer)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedTicketDetails.items.map((it: any) => {
                                    const remise = Math.max(0, it.montant_total - (it.part_patient || 0) - (it.part_assureur || 0));
                                    return (
                                        <tr key={it.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                                            <td style={{ padding: '8px' }}>{it.acte_libelle}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{it.montant_total.toLocaleString()}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: remise > 0 ? '#e74c3c' : '#bdc3c7' }}>{remise > 0 ? `-${remise.toLocaleString()}` : '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: '#e67e22' }}>{it.part_assureur.toLocaleString()}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', color: '#27ae60', fontWeight: 'bold' }}>{it.part_patient.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div style={{ textAlign: 'right', fontSize: '18px' }}>
                            <div>Total Brut: <strong>{selectedTicketDetails.totalVente.toLocaleString()} F</strong></div>
                            {selectedTicketDetails.totalRemise > 0 && (
                                <div style={{ color: '#e74c3c' }}>Remise: <strong>- {selectedTicketDetails.totalRemise.toLocaleString()} F</strong></div>
                            )}
                            {selectedTicketDetails.totalCredit > 0 && (
                                <div style={{ color: '#e67e22' }}>Part Assurance: <strong>{selectedTicketDetails.totalCredit.toLocaleString()} F</strong></div>
                            )}
                            <div style={{ color: '#27ae60' }}>Net à Payer: <strong>{selectedTicketDetails.totalPatient.toLocaleString()} F</strong></div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => handlePreviewTicket(selectedTicketDetails)} style={{ background: '#f1c40f', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                🖨️ Imprimer Reçu
                            </button>
                            <button onClick={() => setShowDetailsModal(false)} style={{ background: '#bdc3c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {previewHtml && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                    <div style={{ background: '#525659', borderRadius: '10px', padding: '0', width: '400px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#323639', color: 'white' }}>
                            <span style={{ fontWeight: 'bold' }}>Aperçu Ticket (80mm)</span>
                            <button onClick={() => setPreviewHtml(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                        </div>
                        <div style={{ flex: 1, background: '#e0e0e0', display: 'flex', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
                            <iframe
                                srcDoc={previewHtml}
                                style={{ 
                                    width: '80mm', 
                                    height: 'min-content', 
                                    minHeight: '120mm',
                                    border: 'none', 
                                    background: 'white', 
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                    borderRadius: '2px'
                                }}
                                title="Ticket Preview"
                            />
                        </div>
                        <div style={{ padding: '15px', background: '#323639', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setPreviewHtml(null)} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #7f8c8d', background: 'transparent', color: '#ecf0f1', cursor: 'pointer' }}>Annuler</button>
                            <button onClick={() => { printHtml(previewHtml); setPreviewHtml(null); }} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: '#27ae60', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ IMPRIMER</button>
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
