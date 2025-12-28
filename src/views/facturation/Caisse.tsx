import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../../lib/db";

const pulseStyle = `
@keyframes pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(230, 126, 34, 0.7); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(230, 126, 34, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(230, 126, 34, 0); }
}
`;

// TYPES
type CartItem = {
    uniqueId: number;
    itemId: number;
    libelle: string;
    type: 'ACTE' | 'MEDICAMENT' | 'HOSPITALISATION';
    categorie?: string;
    prixUnitaire: number;
    qte: number;
    stock?: number;
    partAssureurUnitaire: number;
    partPatientUnitaire: number;
    useAssurance: boolean;
};

type CatalogItem = {
    id: number;
    libelle: string;
    prix: number;
    type: 'ACTE' | 'MEDICAMENT' | 'HOSPITALISATION';
    categorie: 'PRODUITS' | 'EXAMENS' | 'ACTES MÉDICAUX' | 'CONSULTATIONS' | 'HOSPITALISATIONS' | 'AUTRE';
    stock?: number;
    color?: string;
    icon?: string;
    article_parent_id?: number;
    coefficient_conversion?: number;
};

export default function Caisse({ softwareDate, currentUser }: { softwareDate?: string, currentUser?: any }) {
    // DATA STATES
    const [patients, setPatients] = useState<any[]>([]);
    const [personnels, setPersonnels] = useState<any[]>([]);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [admissions, setAdmissions] = useState<any[]>([]);
    const [entreprise, setEntreprise] = useState<any>(null);
    const [allSocietes, setAllSocietes] = useState<any[]>([]);
    const [assurances, setAssurances] = useState<any[]>([]);
    const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
    const [showTransferPanel, setShowTransferPanel] = useState(false);

    // UI STATES
    const [searchQuery, setSearchQuery] = useState("");
    const [selectionType, setSelectionType] = useState<"PATIENT" | "PERSONNEL">("PATIENT");
    const [patientSelectionne, setPatientSelectionne] = useState<any>(null);
    const [personnelSelectionne, setPersonnelSelectionne] = useState<any>(null);

    const [selectedCategory, setSelectedCategory] = useState<string>("TOUT");
    const [searchTerm, setSearchTerm] = useState("");
    const [showCartDrawer, setShowCartDrawer] = useState(false);
    const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);

    // INSURANCE STATES (Detailed)
    const [insForm, setInsForm] = useState({
        assuranceId: "",
        societeId: "",
        matricule: "",
        nomSalarie: "",
        telAssurance: "",
        numeroBon: "",
        taux: 80
    });

    // CART STATES
    const [panier, setPanier] = useState<CartItem[]>([]);

    // PAIEMENT STATES
    const [paymentStrategy, setPaymentStrategy] = useState<'COMPTANT' | 'CREDIT_TOTAL' | 'PARTIEL'>('COMPTANT');
    const [modePaiement1, setModePaiement1] = useState("CASH");
    const [montantVerse1, setMontantVerse1] = useState<number>(0);
    const [modePaiement2, setModePaiement2] = useState("AUCUN");
    const [montantVerse2, setMontantVerse2] = useState<number>(0);

    // --- INITIALISATION ---
    const [saleToReplace, setSaleToReplace] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const loadedPatients = await chargerDonnees();

            // CHECK FOR EDIT PAYLOAD
            const payload = (window as any).editSalePayload;
            if (payload) {
                console.log("📥 Loading sale for edit:", payload);
                if (payload.items) {
                    setPanier(payload.items);
                    setShowCartDrawer(true); // Open cart to show it loaded
                }

                if (payload.patientId && loadedPatients) {
                    const found = loadedPatients.find((p: any) => p.id === payload.patientId);
                    if (found) {
                        setPatientSelectionne(found);
                        setSelectionType("PATIENT");
                    }
                }
                delete (window as any).editSalePayload;
            }
        };

        init();
        const interval = setInterval(checkTransfers, 5000);
        return () => clearInterval(interval);
    }, []);

    const remplacerAncienneVente = async (ticketNum: string) => {
        try {
            const db = await getDb();
            // 1. Récupérer les items pour restaurer le stock
            const items = await db.select<any[]>("SELECT * FROM ventes WHERE numero_ticket = ?", [ticketNum]);

            for (const v of items) {
                if (v.type_vente === 'MEDICAMENT' && v.article_id) {
                    // Restaurer le stock
                    const match = v.acte_libelle.match(/\(x(\d+)\)/);
                    const qte = match ? parseInt(match[1]) : 1;
                    await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [qte, v.article_id]);
                }
                if (v.type_vente === 'HOSPITALISATION' && v.article_id) {
                    // Remettre en cours
                    await db.execute("UPDATE admissions SET statut = 'en_cours', date_sortie = NULL WHERE id = ?", [v.article_id]);
                }
            }

            // 2. Supprimer l'ancienne vente
            await db.execute("DELETE FROM ventes WHERE numero_ticket = ?", [ticketNum]);
            return true;
        } catch (e) {
            console.error("Erreur remplacement vente:", e);
            return false;
        }
    };

    const checkTransfers = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT t.*, p.nom_prenoms as patient_nom 
                FROM ventes_transferts t 
                LEFT JOIN patients p ON t.patient_id = p.id
                WHERE t.statut = 'EN_ATTENTE'
            `);
            setIncomingTransfers(res);
        } catch (e) { }
    };

    const chargerDonnees = async () => {
        let patientsList: any[] = [];
        try {
            const db = await getDb();

            // Patients
            const resP = await db.select<any[]>(`
                SELECT p.id, p.nom_prenoms, p.numero_carnet, p.assurance_id, p.telephone,
                       p.societe_id, p.numero_assure, p.nom_salarie, p.telephone_assurance,
                       CAST(p.taux_couverture AS DOUBLE) as taux_couverture,
                       a.nom as nom_assurance
                FROM patients p LEFT JOIN assurances a ON p.assurance_id = a.id
            `);
            setPatients(resP);
            patientsList = resP;
            setPatients(resP);
            // return resP; // MOVED TO END

            // Personnel
            try {
                const resPers = await db.select<any[]>(`
                    SELECT id, nom_prenoms, fonction, 'MANUEL' as origine FROM personnel
                    UNION
                    SELECT u.id, u.nom_complet COLLATE utf8mb4_unicode_ci as nom_prenoms, 
                           r.nom COLLATE utf8mb4_unicode_ci as fonction, 
                           'USER' COLLATE utf8mb4_unicode_ci as origine 
                    FROM app_utilisateurs u
                    LEFT JOIN app_roles r ON u.role_id = r.id
                    ORDER BY nom_prenoms
                `);
                setPersonnels(resPers);
            } catch (e) { /* Table might not exist yet */ }

            // Items
            let allItems: CatalogItem[] = [];
            const resPrest = await db.select<any[]>(`
                SELECT id, libelle, categorie, CAST(prix_standard AS DOUBLE) as prix_standard 
                FROM prestations
            `);
            resPrest.forEach(p => {
                let cat: any = 'AUTRE';
                let color = '#95a5a6';
                let icon = '🩺';
                if (p.categorie === 'LABO') { cat = 'EXAMENS'; color = '#8e44ad'; icon = '🔬'; }
                else if (p.categorie === 'SOINS') { cat = 'ACTES MÉDICAUX'; color = '#27ae60'; icon = '💉'; }
                else if (p.categorie === 'CONSULTATION') { cat = 'CONSULTATIONS'; color = '#2980b9'; icon = '👨‍⚕️'; }
                allItems.push({ id: p.id, libelle: p.libelle, prix: p.prix_standard, type: 'ACTE', categorie: cat, color: color, icon: icon });
            });

            const resPharma = await db.select<any[]>(`
                SELECT id, designation, CAST(prix_vente AS DOUBLE) as prix_vente, 
                       CAST(quantite_stock AS DOUBLE) as quantite_stock,
                       article_parent_id, coefficient_conversion
                FROM stock_articles
                ORDER BY designation
            `);
            resPharma.forEach(p => {
                allItems.push({
                    id: p.id,
                    libelle: p.designation,
                    prix: p.prix_vente,
                    type: 'MEDICAMENT',
                    categorie: 'PRODUITS',
                    stock: p.quantite_stock,
                    color: p.quantite_stock > 0 ? '#e67e22' : '#e74c3c',
                    icon: '💊',
                    article_parent_id: p.article_parent_id,
                    coefficient_conversion: p.coefficient_conversion
                });
            });
            setItems(allItems);

            // Entreprise info
            const resEnt = await db.select<any[]>("SELECT * FROM app_parametres_entreprise LIMIT 1");
            if (resEnt.length > 0) setEntreprise(resEnt[0]);

            // Societes
            const resSoc = await db.select<any[]>("SELECT * FROM societes WHERE statut = 'actif'");
            setAllSocietes(resSoc);

            // Assurances
            const resAssur = await db.select<any[]>("SELECT * FROM assurances");
            setAssurances(resAssur);

            // Migrations express (if manual command failed)
            try {
                await db.execute("ALTER TABLE patients ADD COLUMN societe_id INTEGER");
            } catch (e) { }
            try {
                await db.execute("ALTER TABLE patients ADD COLUMN nom_salarie TEXT");
            } catch (e) { }
            try {
                await db.execute("ALTER TABLE patients ADD COLUMN telephone_assurance TEXT");
            } catch (e) { }
            try {
                await db.execute("ALTER TABLE ventes ADD COLUMN numero_bon TEXT");
            } catch (e) { }
            try {
                await db.execute("ALTER TABLE ventes ADD COLUMN societe_nom TEXT");
            } catch (e) { }

        } catch (e) { console.error(e); }

        return patientsList;
    };

    // --- SELECTION LOGIC ---
    useEffect(() => {
        if (selectionType === 'PATIENT') {
            const p = patients.find(pat => pat.numero_carnet?.toLowerCase().trim() === searchQuery.toLowerCase().trim());
            setPatientSelectionne(p || null);
            setPersonnelSelectionne(null);
            if (p) {
                chargerAdmissionsPatient(p.id);
                // --- AUTO-FILL INSURANCE ---
                if (p.assurance_id) {
                    setInsForm({
                        assuranceId: p.assurance_id.toString(),
                        societeId: p.societe_id?.toString() || "",
                        matricule: p.numero_assure || "",
                        nomSalarie: p.nom_salarie || "",
                        telAssurance: p.telephone_assurance || p.telephone || "",
                        numeroBon: "",
                        taux: p.taux_couverture || 80
                    });
                } else {
                    setInsForm({
                        assuranceId: "", societeId: "", matricule: "",
                        nomSalarie: "", telAssurance: p.telephone || "", numeroBon: "", taux: 80
                    });
                }
            }
            else setAdmissions([]);
        } else {
            const p = personnels.find(pers => pers.nom_prenoms.toLowerCase().includes(searchQuery.toLowerCase().trim()) && searchQuery.length > 2);
            setPersonnelSelectionne(p || null);
            setPatientSelectionne(null);
            setAdmissions([]);
        }
    }, [searchQuery, patients, personnels, selectionType]);

    const chargerAdmissionsPatient = async (patientId: number) => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
            SELECT a.id, a.date_entree, a.nb_jours, l.nom_lit, 
                   CAST(l.prix_journalier AS DOUBLE) as prix_journalier, c.nom as nom_chambre
            FROM admissions a JOIN lits l ON a.lit_id = l.id JOIN chambres c ON l.chambre_id = c.id
            WHERE a.patient_id = ? AND a.statut = 'en_cours'
          `, [patientId]);
            setAdmissions(res);
        } catch (e) { console.error(e); }
    };



    // SMART ADD TO CART (Auto-Deconditionnement)
    const handleAddToCart = async (item: CatalogItem) => {
        if (item.type === 'MEDICAMENT') {
            const currentStock = item.stock || 0;

            if (currentStock > 0) {
                ajouterAuPanier(item);
                return;
            }

            if (currentStock <= 0) {
                if (item.article_parent_id && item.coefficient_conversion) {
                    try {
                        const db = await getDb();
                        const resParent = await db.select<any[]>("SELECT CAST(quantite_stock AS CHAR) as stock, designation FROM stock_articles WHERE id = ?", [item.article_parent_id]);

                        if (resParent.length > 0 && parseFloat(resParent[0].stock) > 0) {
                            if (!confirm(`⚠️ Stock "${item.libelle}" épuisé.\n\n⚡ Ouvrir automatiquement 1 boîte de "${resParent[0].designation}" pour continuer la vente ?`)) return;

                            await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock - 1 WHERE id = ?", [item.article_parent_id]);
                            await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [item.coefficient_conversion, item.id]);

                            const numeroOp = `AUTO-${Date.now()}`;
                            await db.execute(`
                                INSERT INTO stock_deconditionnements (
                                  numero_operation, date_operation, 
                                  article_source_id, quantite_source,
                                  article_destination_id, quantite_destination,
                                  ratio_conversion, statut, created_by
                                ) VALUES (?, NOW(), ?, 1, ?, ?, ?, 'Auto-Vente', ?)
                            `, [numeroOp, item.article_parent_id, item.id, item.coefficient_conversion, item.coefficient_conversion, currentUser?.username || 'System']);

                            await chargerDonnees();
                            alert(`✅ Boîte ouverte ! Stock ajouté : +${item.coefficient_conversion}`);

                            // Simulate add with updated stock
                            ajouterAuPanier({ ...item, stock: (item.stock || 0) + (item.coefficient_conversion || 0) });

                        } else {
                            alert(`❌ RUPTURE TOTALE !\n\nNi "${item.libelle}", ni le produit parent "${resParent[0]?.designation || 'Boîte'}" ne sont disponibles.`);
                        }
                    } catch (e) {
                        console.error(e);
                        alert("Erreur lors du déconditionnement automatique.");
                    }
                } else {
                    alert(`❌ RUPTURE DE STOCK !\n"${item.libelle}" n'est plus disponible.`);
                }
            }
        } else {
            ajouterAuPanier(item);
        }
    };

    // AJOUTER AU PANIER AVEC REGROUPEMENT
    const ajouterAuPanier = (item: CatalogItem, initialQte: number = 1) => {
        if (item.type === 'MEDICAMENT' && (item.stock || 0) <= 0) return alert("❌ Stock épuisé !");

        setPanier(prev => {
            const index = prev.findIndex(p => p.itemId === item.id && p.type === item.type);
            if (index > -1) {
                const updated = [...prev];
                updated[index].qte += 1;
                return updated;
            } else {
                const ligne: CartItem = {
                    uniqueId: Date.now() + Math.random(),
                    itemId: item.id,
                    libelle: item.libelle,
                    type: item.type,
                    categorie: item.categorie,
                    prixUnitaire: item.prix,
                    qte: initialQte,
                    stock: item.stock,
                    partAssureurUnitaire: 0,
                    partPatientUnitaire: item.prix,
                    useAssurance: false
                };
                return [...prev, ligne];
            }
        });
    };

    const modifierQuantite = (uniqueId: number, qte: number) => {
        if (qte < 0) return;
        setPanier(prev => prev.map(item => {
            if (item.uniqueId === uniqueId) {
                if (item.type === 'MEDICAMENT' && item.stock !== undefined && qte > item.stock) {
                    alert(`Stock insuffisant (${item.stock} dispo)`);
                    return { ...item, qte: item.stock };
                }
                return { ...item, qte };
            }
            return item;
        }));
    };

    const toggleAssuranceItem = (uniqueId: number) => {
        if (!patientSelectionne || !patientSelectionne.assurance_id) {
            alert("⚠️ Ce patient n'a pas d'assurance configurée.");
            return;
        }

        setPanier(prev => prev.map(item => {
            if (item.uniqueId === uniqueId) {
                const newUseAssurance = !item.useAssurance;
                const taux = patientSelectionne.taux_couverture || 0;
                const partAssurU = (newUseAssurance) ? Math.round(item.prixUnitaire * taux / 100) : 0;
                return {
                    ...item,
                    useAssurance: newUseAssurance,
                    partAssureurUnitaire: partAssurU,
                    partPatientUnitaire: item.prixUnitaire - partAssurU
                };
            }
            return item;
        }));
    };

    // CALCULS
    const totalBrut = panier.reduce((acc, i) => acc + (i.prixUnitaire * i.qte), 0);
    const totalPartAssureur = panier.reduce((acc, i) => acc + (i.partAssureurUnitaire * i.qte), 0);
    const totalNetPatient = panier.reduce((acc, i) => acc + (i.partPatientUnitaire * i.qte), 0);

    const validerPaiement = async () => {
        const totalVerse = (montantVerse1 || 0) + (montantVerse2 || 0);

        // Les confirmations sont maintenant gérées par l'aperçu du reçu
        let finalMode = paymentStrategy === 'CREDIT_TOTAL' ? 'CRÉDIT' : modePaiement1;
        if (modePaiement1 === 'CASH') finalMode = 'ESPÈCE';
        if (modePaiement2 !== 'AUCUN' && montantVerse2 > 0) {
            const mode2Label = modePaiement2 === 'CASH' ? 'ESPÈCE' : modePaiement2;
            finalMode = `${finalMode} + ${mode2Label}`;
        }

        try {
            const db = await getDb();

            // CAS REMPLACEMENT / MODIFICATION
            if (saleToReplace) {
                console.log("♻️ Remplacement de la vente:", saleToReplace);
                await remplacerAncienneVente(saleToReplace);
            }

            const ratioPaiement = (totalNetPatient === 0) ? 1 : (totalVerse / totalNetPatient);

            // Génération du numéro de ticket
            const datePart = (softwareDate || new Date().toISOString().split('T')[0]).replace(/-/g, '').slice(2);
            const randomPart = Math.floor(Math.random() * 999).toString().padStart(3, '0');
            const ticketNum = `TKT-${datePart}-${randomPart}`;

            for (const item of panier) {
                const totalItemDue = item.partPatientUnitaire * item.qte;
                const paye = Math.min(totalItemDue, totalItemDue * ratioPaiement);
                const reste = totalItemDue - paye;
                const statut = (reste < 5) ? 'PAYE' : 'CREDIT';

                await db.execute(`
                    INSERT INTO ventes (
                        patient_id, personnel_id, acte_libelle, montant_total, 
                        part_patient, part_assureur, mode_paiement, statut, 
                        reste_a_payer, type_vente, article_id, date_vente,
                        numero_bon, societe_nom, numero_ticket, user_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    patientSelectionne?.id || null,
                    personnelSelectionne?.id || null,
                    `${item.libelle} (x${item.qte})`,
                    item.prixUnitaire * item.qte,
                    item.partPatientUnitaire * item.qte,
                    item.partAssureurUnitaire * item.qte,
                    finalMode, statut, reste, item.type,
                    (item.type === 'MEDICAMENT' ? item.itemId : null),
                    (softwareDate || new Date().toISOString().split('T')[0]) + " " + new Date().toTimeString().split(' ')[0],
                    insForm.numeroBon,
                    allSocietes.find(s => s.id.toString() === insForm.societeId)?.nom_societe || null,
                    ticketNum,
                    currentUser?.id || null
                ]);

                if (item.type === 'MEDICAMENT') {
                    await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?", [item.qte, item.itemId]);
                }

                if (item.type === 'HOSPITALISATION') {
                    // Libérer la chambre et mettre à jour le nombre de jours final
                    await db.execute(`
                        UPDATE admissions 
                        SET statut = 'termine', 
                            nb_jours = ?, 
                            date_sortie = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `, [item.qte, item.itemId]);
                }
            }

            // Imprimer le ticket automatiquement
            imprimerTicketCaisse(ticketNum, finalMode);

            alert("✅ Vente enregistrée !");
            setPanier([]);
            setShowPaymentDrawer(false);
            setShowCartDrawer(false);
            setSearchQuery("");
            setPaymentStrategy("COMPTANT");
            setModePaiement1("CASH");
            setMontantVerse1(0);
            setModePaiement2("AUCUN");
            setMontantVerse2(0);
            setSaleToReplace(null); // Reset replacement state
            chargerDonnees();
        } catch (e) { console.error(e); alert("Erreur."); }
    };

    const imprimerTicketCaisse = (ticketNum: string, modeP: string) => {
        const dateVente = new Date();
        const content = `
            <div style="font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 10px; font-size: 12px;">
                <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <div style="font-weight: bold; font-size: 16px;">CENTRE MÉDICAL</div>
                    <div style="font-size: 11px;">TICKET DE CAISSE</div>
                    <div style="font-size: 10px; margin-top: 5px;">N° ${ticketNum}</div>
                    <div style="font-size: 10px;">${dateVente.toLocaleString('fr-FR')}</div>
                </div>
                
                <div style="margin-bottom: 10px; font-size: 11px;">
                    <div><strong>Patient:</strong> ${patientSelectionne?.nom_prenoms || personnelSelectionne?.nom_prenoms || 'Client Passage'}</div>
                    ${patientSelectionne ? `<div><strong>N° Carnet:</strong> ${patientSelectionne.numero_carnet}</div>` : ''}
                    ${currentUser ? `<div><strong>Opérateur:</strong> ${currentUser.nom_complet}</div>` : ''}
                </div>
                
                <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; margin: 10px 0;">
                    <table style="width: 100%; font-size: 11px;">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Article</th>
                                <th style="text-align: center;">Qte</th>
                                <th style="text-align: right;">Prix</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${panier.map(item => `
                                <tr>
                                    <td style="text-align: left;">${item.libelle}</td>
                                    <td style="text-align: center;">${item.qte}</td>
                                    <td style="text-align: right;">${(item.partPatientUnitaire * item.qte).toLocaleString()} F</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin: 10px 0; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; margin: 3px 0;">
                        <span>Total Brut:</span>
                        <strong>${totalBrut.toLocaleString()} F</strong>
                    </div>
                    ${totalPartAssureur > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin: 3px 0; color: #3498db;">
                            <span>Part Assurance:</span>
                            <strong>-${totalPartAssureur.toLocaleString()} F</strong>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; border-top: 2px solid #000; padding-top: 5px;">
                        <span><strong>NET À PAYER:</strong></span>
                        <strong>${totalNetPatient.toLocaleString()} F</strong>
                    </div>
                </div>
                
                <div style="margin: 10px 0; font-size: 11px; border-top: 1px dashed #000; padding-top: 8px;">
                    <div><strong>Mode de paiement:</strong> ${modeP}</div>
                    <div><strong>Versé:</strong> ${(montantVerse1 + montantVerse2).toLocaleString()} F</div>
                    ${(montantVerse1 + montantVerse2) > totalNetPatient ? `<div><strong>Monnaie:</strong> ${((montantVerse1 + montantVerse2) - totalNetPatient).toLocaleString()} F</div>` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 15px; font-size: 10px; border-top: 2px dashed #000; padding-top: 10px;">
                    <div>Merci de votre visite !</div>
                    <div style="margin-top: 5px;">Conservez ce ticket</div>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ticket ${ticketNum}</title>
                    <style>
                        @media print {
                            body { margin: 0; padding: 0; }
                        }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => window.close(), 500);">
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const recupererTransfert = async (transferId: number) => {
        try {
            const db = await getDb();
            const items = await db.select<any[]>("SELECT * FROM ventes_transferts_items WHERE transfert_id = ?", [transferId]);
            const trans = incomingTransfers.find(t => t.id === transferId);

            if (trans && trans.patient_id) {
                const pat = patients.find(p => p.id === trans.patient_id);
                if (pat) {
                    setSelectionType('PATIENT');
                    setSearchQuery(pat.numero_carnet);
                }
            }

            const newItems: CartItem[] = items.map(it => ({
                uniqueId: Date.now() + Math.random(),
                itemId: it.item_id,
                libelle: it.libelle,
                type: it.type as any,
                prixUnitaire: it.prix_unitaire,
                qte: it.qte,
                useAssurance: it.use_assurance === 1,
                partAssureurUnitaire: it.part_assureur_unitaire,
                partPatientUnitaire: it.part_patient_unitaire
            }));

            setPanier(newItems);
            // Marquer comme 'TRAITE' pour ne plus l'afficher
            await db.execute("UPDATE ventes_transferts SET statut = 'TRAITE' WHERE id = ?", [transferId]);
            setShowTransferPanel(false);
            setShowCartDrawer(true);
            checkTransfers();
            alert("📥 Vente récupérée !");
        } catch (e) { console.error(e); }
    };

    const getQtyInCatalog = (itemId: number, type: string) => panier.find(i => i.itemId === itemId && i.type === type)?.qte || 0;

    const selectionValidee = patientSelectionne || personnelSelectionne;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ecf0f1', overflow: 'hidden', position: 'relative' }}>

            {/* HEADER TOOLBAR & PATIENT SEARCH */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 11, gap: '20px' }}>

                {/* 1. SEARCH CATALOG */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '250px' }}>
                    <span style={{ fontSize: '1rem' }}>🔍</span>
                    <input
                        placeholder="Chercher article..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: 'none', background: '#f8f9fa', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', width: '100%', outline: 'none' }}
                    />
                </div>

                {/* 2. PATIENT SELECTION (CENTERED - NEW) */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', background: '#ecf0f1', borderRadius: '6px', padding: '3px' }}>
                        <button onClick={() => setSelectionType('PATIENT')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: selectionType === 'PATIENT' ? '#3498db' : 'transparent', color: selectionType === 'PATIENT' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>👤 Patient</button>
                        <button onClick={() => setSelectionType('PERSONNEL')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: selectionType === 'PERSONNEL' ? '#e67e22' : 'transparent', color: selectionType === 'PERSONNEL' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>👔 Personnel</button>
                    </div>

                    <div style={{ position: 'relative', width: '300px' }}>
                        <input
                            placeholder={selectionType === 'PATIENT' ? "N° Carnet / Nom Patient..." : "Nom du Personnel..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd',
                                fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center',
                                background: selectionValidee ? (selectionType === 'PATIENT' ? '#eafaf1' : '#fef5e7') : 'white'
                            }}
                        />
                        {selectionValidee && (
                            <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#27ae60' }}>
                                ✅
                            </div>
                        )}
                    </div>

                    {patientSelectionne && (
                        <div style={{ borderLeft: '2px solid #ddd', paddingLeft: '10px', fontSize: '0.8rem', lineHeight: '1.1' }}>
                            <div style={{ fontWeight: 'bold' }}>{patientSelectionne.nom_prenoms}</div>
                            {patientSelectionne.nom_assurance && <div style={{ color: '#27ae60' }}>🛡️ {patientSelectionne.nom_assurance} ({patientSelectionne.taux_couverture}%)</div>}
                        </div>
                    )}
                    {personnelSelectionne && (
                        <div style={{ borderLeft: '2px solid #ddd', paddingLeft: '10px', fontSize: '0.8rem', lineHeight: '1.1' }}>
                            <div style={{ fontWeight: 'bold', color: '#e67e22' }}>{personnelSelectionne.nom_prenoms}</div>
                            <div style={{ color: '#7f8c8d' }}>{personnelSelectionne.fonction}</div>
                        </div>
                    )}
                </div>

                {/* 3. ACTIONS RIGHT */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setShowTransferPanel(true)}
                        style={{
                            padding: '8px 15px', background: incomingTransfers.length > 0 ? '#e67e22' : '#ecf0f1', color: incomingTransfers.length > 0 ? 'white' : '#7f8c8d', border: 'none', borderRadius: '6px',
                            fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem',
                            animation: incomingTransfers.length > 0 ? 'pulse 2s infinite' : 'none'
                        }}
                    >
                        🔔 Transferts ({incomingTransfers.length})
                    </button>
                    <button
                        onClick={() => setShowCartDrawer(true)}
                        style={{
                            padding: '8px 15px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '6px',
                            fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem'
                        }}
                    >
                        <span>🛒 Panier ({panier.length})</span>
                        <span style={{ background: '#e74c3c', borderRadius: '4px', padding: '2px 6px', fontSize: '0.8rem' }}>{totalNetPatient.toLocaleString()} F</span>
                    </button>
                </div>
            </div>

            {/* MAIN BODY: CATALOG */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {[
                        { id: 'TOUT', label: '🏠 Tout' },
                        { id: 'PRODUITS', label: '💊 Phar.' },
                        { id: 'EXAMENS', label: '🔬 Exam.' },
                        { id: 'ACTES MÉDICAUX', label: '💉 Actes' },
                        { id: 'CONSULTATIONS', label: '👨‍⚕️ Consult.' },
                        { id: 'HOSPITALISATIONS', label: '🏥 Hospit.' }
                    ].map(cat => (
                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                            style={{
                                padding: '8px 15px', borderRadius: '6px', border: 'none',
                                background: selectedCategory === cat.id ? '#3498db' : 'white',
                                color: selectedCategory === cat.id ? 'white' : '#7f8c8d',
                                fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.85rem'
                            }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', alignContent: 'start', gap: '15px' }}>
                    {(selectedCategory === 'TOUT' || selectedCategory === 'HOSPITALISATIONS') && admissions.map(adm => {
                        const count = getQtyInCatalog(adm.id, 'HOSPITALISATION');
                        return (
                            <div key={'adm' + adm.id} onClick={() => {
                                if (count === 0) {
                                    ajouterAuPanier({
                                        id: adm.id,
                                        libelle: `Séjour ${adm.nom_chambre} / ${adm.nom_lit}`,
                                        prix: adm.prix_journalier,
                                        type: 'HOSPITALISATION',
                                        categorie: 'HOSPITALISATIONS',
                                        color: '#c0392b',
                                        icon: '🛏️'
                                    }, adm.nb_jours);
                                }
                            }} style={{ ...cardStyle, padding: '10px', borderLeft: '4px solid #c0392b', background: count > 0 ? '#fadbd8' : 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '1.4rem' }}>🛏️</span>{count > 0 && <span style={badgeStyle}>✅</span>}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', margin: '4px 0' }}>Séjour {adm.nom_chambre}</div>
                                <div style={{ fontSize: '0.75rem', color: '#7f8c8d' }}>{adm.nb_jours} jours</div>
                                <div style={{ fontWeight: 'bold', marginTop: 'auto', color: '#c0392b', fontSize: '0.9rem' }}>{(adm.nb_jours * adm.prix_journalier).toLocaleString()} F</div>
                            </div>
                        );
                    })}
                    {items.filter(i => (selectedCategory === 'TOUT' || i.categorie === selectedCategory) && i.libelle.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                        const count = getQtyInCatalog(item.id, item.type);
                        return (
                            <div key={item.type + item.id}
                                onClick={() => handleAddToCart(item)}
                                style={{
                                    ...cardStyle,
                                    padding: '10px', // More compact padding
                                    background: count > 0 ? '#e8f8f5' : 'white',
                                    borderLeft: `4px solid ${item.color}`,
                                    border: (item.stock || 0) <= 0 && item.type === 'MEDICAMENT' ? '1px solid #e74c3c' : (count > 0 ? `1px solid ${item.color}` : '1px solid #eee'),
                                    position: 'relative'
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <div style={{ fontSize: '1.4rem' }}>{item.icon}</div>
                                    {count > 0 && <div style={{ ...badgeStyle, fontSize: '0.75rem', padding: '2px 6px' }}>{count}</div>}
                                </div>

                                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#2c3e50', margin: '4px 0', lineHeight: '1.2', height: '34px', overflow: 'hidden' }}>{item.libelle}</div>

                                {item.type === 'MEDICAMENT' && (
                                    <div style={{
                                        marginBottom: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                                        color: (item.stock || 0) > 0 ? '#27ae60' : '#c0392b',
                                        background: (item.stock || 0) > 0 ? '#e8f8f5' : '#fadbd8',
                                        padding: '1px 6px', borderRadius: '4px', display: 'inline-block'
                                    }}>
                                        Stock: {item.stock}
                                    </div>
                                )}

                                <div style={{ fontWeight: 'bold', marginTop: 'auto', fontSize: '0.9rem', color: '#34495e', textAlign: 'right' }}>{item.prix.toLocaleString()} F</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- DRAWER PANIER --- */}
            <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '550px', background: 'white',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.2)', transform: showCartDrawer ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 20, display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', background: '#2c3e50', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>🛒 Panier ({panier.length} articles)</h2>
                    <button onClick={() => setShowCartDrawer(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
                </div>

                <div style={{ padding: '15px', background: '#f8f9fa', borderBottom: '1px solid #eee', fontSize: '0.9rem', color: '#555' }}>
                    {selectionValidee ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Client : <strong>{patientSelectionne?.nom_prenoms || personnelSelectionne?.nom_prenoms}</strong></span>
                            <span style={{ color: '#27ae60' }}>OK</span>
                        </div>
                    ) : (
                        <div style={{ color: '#e74c3c', fontStyle: 'italic' }}>⚠️ Aucun patient sélectionné (Voir barre du haut)</div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {panier.map(item => (
                        <div key={item.uniqueId} style={{ padding: '15px', borderBottom: '1px solid #f1f1f1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold' }}>{item.libelle}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>{item.prixUnitaire.toLocaleString()} F / unité</div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '20px' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#95a5a6' }}>Qte:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.qte}
                                        onChange={e => modifierQuantite(item.uniqueId, parseInt(e.target.value) || 0)}
                                        style={{ width: '60px', padding: '5px', borderRadius: '5px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold' }}
                                    />
                                </div>

                                <div style={{ fontWeight: 'bold', width: '80px', textAlign: 'right' }}>
                                    {(item.prixUnitaire * item.qte).toLocaleString()}
                                </div>

                                <button onClick={() => setPanier(p => p.filter(i => i.uniqueId !== item.uniqueId))} style={{ marginLeft: '15px', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                            </div>

                            {patientSelectionne?.taux_couverture > 0 && (
                                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={item.useAssurance} onChange={() => toggleAssuranceItem(item.uniqueId)} />
                                        <span style={{ fontSize: '0.8rem', color: '#3498db' }}>Prise en charge {patientSelectionne.nom_assurance}</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ padding: '25px', background: 'white', borderTop: '2px solid #eee' }}>
                    <div style={{ fontSize: '0.9rem', color: '#7f8c8d', display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>Montant Brut</span>
                        <span>{totalBrut.toLocaleString()} F</span>
                    </div>
                    {totalPartAssureur > 0 && (
                        <div style={{ fontSize: '0.9rem', color: '#27ae60', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span>Prise en charge Assurances</span>
                            <span>-{totalPartAssureur.toLocaleString()} F</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '1.8rem', fontWeight: 'bold', color: '#2c3e50', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                        <span>A PAYER</span>
                        <span>{totalNetPatient.toLocaleString()} F</span>
                    </div>
                    <button
                        disabled={panier.length === 0 || !selectionValidee}
                        onClick={() => setShowPaymentDrawer(true)}
                        style={{ width: '100%', padding: '20px', background: panier.length && selectionValidee ? '#27ae60' : '#bdc3c7', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(39, 174, 96, 0.3)' }}
                    >
                        PROCÉDER AU RÈGLEMENT
                    </button>
                </div>
            </div>

            {/* --- DRAWER PAIEMENT --- */}
            <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '500px', background: 'white',
                zIndex: 30, transition: 'transform 0.4s ease', transform: showPaymentDrawer ? 'translateX(0)' : 'translateX(100%)',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', padding: '30px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '20px' }}>
                    <button onClick={() => setShowPaymentDrawer(false)} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer' }}>🔙</button>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Règlement Facture</h1>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginBottom: '20px' }}>
                    <div style={{ background: '#2c3e50', color: 'white', padding: '20px', borderRadius: '15px', textAlign: 'center', marginBottom: '20px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' }}>NET À PERCEVOIR</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{totalNetPatient.toLocaleString()} <small style={{ fontSize: '0.9rem' }}>F CFA</small></div>
                    </div>

                    <div style={{ marginBottom: '15px', padding: '12px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #ddd' }}>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#2c3e50', fontSize: '0.9rem' }}>TYPE DE RÈGLEMENT</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    setPaymentStrategy('COMPTANT');
                                    setModePaiement1('CASH');
                                    setMontantVerse1(totalNetPatient);
                                    setModePaiement2('AUCUN');
                                    setMontantVerse2(0);
                                }}
                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd', background: paymentStrategy === 'COMPTANT' ? '#2ecc71' : 'white', color: paymentStrategy === 'COMPTANT' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                                💵 Comptant
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentStrategy('CREDIT_TOTAL');
                                    setModePaiement1('CASH'); // irrelevant for CREDIT_TOTAL but reset
                                    setMontantVerse1(0);
                                    setModePaiement2('AUCUN');
                                    setMontantVerse2(0);
                                }}
                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd', background: paymentStrategy === 'CREDIT_TOTAL' ? '#e67e22' : 'white', color: paymentStrategy === 'CREDIT_TOTAL' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                                💳 Crédit Total
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentStrategy('PARTIEL');
                                    setModePaiement1('CASH');
                                    setMontantVerse1(totalNetPatient / 2);
                                    setModePaiement2('AUCUN');
                                    setMontantVerse2(0);
                                }}
                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd', background: paymentStrategy === 'PARTIEL' ? '#3498db' : 'white', color: paymentStrategy === 'PARTIEL' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                                📉 Partiel
                            </button>
                        </div>
                    </div>

                    {paymentStrategy !== 'CREDIT_TOTAL' && (
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontWeight: 'bold', color: '#7f8c8d', fontSize: '0.8rem' }}>
                                {paymentStrategy === 'COMPTANT' ? 'MOYEN DE PAIEMENT' : '1ER MOYEN (ACOMPTE)'}
                            </label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <select value={modePaiement1} onChange={e => setModePaiement1(e.target.value)} style={{ ...inputS, padding: '10px', fontSize: '1rem' }}>
                                    <option value="CASH">💵 Espèces</option>
                                    <option value="WAVE">🌊 Wave</option>
                                    <option value="ORANGE">🍊 Orange Money</option>
                                    <option value="MTN">🟡 MTN Money</option>
                                    <option value="CHEQUE">🏦 Chèque</option>
                                </select>
                                <input
                                    type="number"
                                    value={montantVerse1 || ''}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setMontantVerse1(val);
                                        if (modePaiement2 !== 'AUCUN') {
                                            setMontantVerse2(Math.max(0, totalNetPatient - val));
                                        }
                                    }}
                                    style={{ ...inputS, padding: '10px', fontSize: '1rem' }}
                                    placeholder="Montant"
                                />
                            </div>
                        </div>
                    )}

                    {paymentStrategy !== 'CREDIT_TOTAL' && (
                        <div style={{ marginBottom: '25px', padding: '15px', border: '2px dashed #bddcff', borderRadius: '12px', background: '#f0f8ff' }}>
                            <label style={{ fontWeight: 'bold', color: '#2980b9', fontSize: '0.8rem' }}>2ÈME MOYEN (PAIEMENT MIXTE)</label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <select value={modePaiement2} onChange={e => {
                                    setModePaiement2(e.target.value);
                                    if (e.target.value !== 'AUCUN') {
                                        setMontantVerse2(Math.max(0, totalNetPatient - (montantVerse1 || 0)));
                                    } else {
                                        setMontantVerse2(0);
                                    }
                                }} style={{ ...inputS, padding: '10px', fontSize: '1rem' }}>
                                    <option value="AUCUN">Aucun</option>
                                    <option value="CASH">💵 Espèces</option>
                                    <option value="WAVE">🌊 Wave</option>
                                    <option value="ORANGE">🍊 Orange Money</option>
                                    <option value="MTN">🟡 MTN Money</option>
                                </select>
                                <input
                                    disabled={modePaiement2 === 'AUCUN'}
                                    type="number"
                                    value={montantVerse2 || ''}
                                    onChange={e => setMontantVerse2(parseFloat(e.target.value) || 0)}
                                    style={{ ...inputS, padding: '10px', fontSize: '1rem', background: modePaiement2 === 'AUCUN' ? '#eee' : 'white' }}
                                    placeholder="Montant"
                                />
                            </div>
                        </div>
                    )}

                    <div style={{
                        textAlign: 'center', padding: '15px', borderRadius: '12px',
                        background: paymentStrategy === 'CREDIT_TOTAL' ? '#eef7ff' : (totalNetPatient - (montantVerse1 + montantVerse2) > 0) ? '#fff5f5' : '#f5fff5'
                    }}>
                        {paymentStrategy === 'CREDIT_TOTAL' ? (
                            <div>
                                <div style={{ color: '#3498db', fontWeight: 'bold', fontSize: '1.1rem' }}>📝 À ENREGISTRER EN CRÉDIT</div>
                                <div style={{ fontSize: '1.8rem', color: '#3498db', fontWeight: 'bold' }}>{totalNetPatient.toLocaleString()} F</div>
                            </div>
                        ) : (totalNetPatient - (montantVerse1 + montantVerse2)) > 0 ? (
                            <div>
                                <div style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.1rem' }}>⚠️ RESTE À PAYER (DETTE)</div>
                                <div style={{ fontSize: '1.8rem', color: '#e74c3c', fontWeight: 'bold' }}>{(totalNetPatient - (montantVerse1 + montantVerse2)).toLocaleString()} F</div>
                            </div>
                        ) : (
                            <div style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '1.1rem' }}>✅ COMPTE SOLDÉ</div>
                        )}
                    </div>
                </div>

                <button onClick={() => setShowReceiptPreview(true)} style={{ width: '100%', padding: '18px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 16px rgba(44, 62, 80, 0.3)' }}>
                    VALIDER
                </button>
            </div>

            {/* --- APERCU RECU --- */}
            {
                showReceiptPreview && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                        <div style={{ background: 'white', width: '400px', maxHeight: '90vh', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Aperçu du Reçu (80mm)</h3>
                                <button onClick={() => setShowReceiptPreview(false)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
                            </div>

                            <div id="receipt-content" style={{ flex: 1, overflowY: 'auto', padding: '20px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.4' }}>
                                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{entreprise?.nom_entreprise || 'CENTRE MEDICAL'}</div>
                                    <div>{entreprise?.adresse}</div>
                                    <div>Tel: {entreprise?.telephone}</div>
                                    <div style={{ margin: '10px 0', borderBottom: '1px dashed #000' }}></div>
                                    <div style={{ fontWeight: 'bold' }}>REÇU DE CAISSE</div>
                                    <div>Date: {new Date().toLocaleString()}</div>
                                    <div style={{ margin: '10px 0', borderBottom: '1px dashed #000' }}></div>
                                </div>

                                <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                                    <strong>Patient:</strong> {patientSelectionne?.nom_prenoms || 'Client Passage'}<br />
                                    <strong>Caissier:</strong> {personnelSelectionne?.nom_prenoms || 'Système'}
                                    {panier.some(i => i.useAssurance) && (
                                        <div style={{ marginTop: '5px', border: '1px solid #000', padding: '5px' }}>
                                            <strong>ASSURANCE:</strong> {assurances.find(a => a.id.toString() === insForm.assuranceId)?.nom}<br />
                                            {insForm.societeId && <><strong>SOCIÉTÉ:</strong> {allSocietes.find(s => s.id.toString() === insForm.societeId)?.nom_societe}<br /></>}
                                            <strong>MATRICULE:</strong> {insForm.matricule}<br />
                                            {insForm.nomSalarie && <><strong>SALARIÉ:</strong> {insForm.nomSalarie}<br /></>}
                                            {insForm.numeroBon && <><strong>N° BON:</strong> {insForm.numeroBon}<br /></>}
                                            <strong>TAUX:</strong> {insForm.taux}%
                                        </div>
                                    )}
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                                    <thead style={{ borderBottom: '1px solid #000' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Désignation</th>
                                            <th style={{ textAlign: 'right' }}>Qte</th>
                                            <th style={{ textAlign: 'right' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {panier.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ paddingTop: '5px' }}>{item.libelle}</td>
                                                <td style={{ textAlign: 'right' }}>{item.qte}</td>
                                                <td style={{ textAlign: 'right' }}>{(item.partPatientUnitaire * item.qte).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ borderTop: '1px dashed #000', paddingTop: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>TOTAL BRUT:</span>
                                        <span>{totalBrut.toLocaleString()} F</span>
                                    </div>
                                    {totalPartAssureur > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>PART ASSURANCE:</span>
                                            <span>-{totalPartAssureur.toLocaleString()} F</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '5px', borderTop: '1px solid #000' }}>
                                        <span>NET À PAYER:</span>
                                        <span>{totalNetPatient.toLocaleString()} F</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                                        <span>VERSÉ:</span>
                                        <span>{((montantVerse1 || 0) + (montantVerse2 || 0)).toLocaleString()} F</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: totalNetPatient - ((montantVerse1 || 0) + (montantVerse2 || 0)) > 0 ? 'red' : 'black' }}>
                                        <span>RESTE:</span>
                                        <span>{(totalNetPatient - ((montantVerse1 || 0) + (montantVerse2 || 0))).toLocaleString()} F</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: '15px', textAlign: 'center', fontStyle: 'italic', fontSize: '11px' }}>
                                    Merci de votre confiance !
                                </div>
                            </div>

                            <div style={{ padding: '15px', background: '#f8f9fa', display: 'flex', gap: '10px' }}>
                                <button onClick={() => setShowReceiptPreview(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                                    Annuler
                                </button>
                                <button
                                    onClick={async () => {
                                        await validerPaiement();
                                        const hasAssurance = panier.some(i => i.useAssurance);
                                        imprimerRecu(hasAssurance ? 2 : 1);
                                        setShowReceiptPreview(false);
                                    }}
                                    style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#27ae60', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    IMPRIMER & VALIDER
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- PANNEAU TRANSFERTS --- */}
            {
                showTransferPanel && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 110, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ background: 'white', width: '600px', borderRadius: '20px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
                            <div style={{ padding: '20px', background: '#e67e22', color: 'white', display: 'flex', justifyContent: 'space-between', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
                                <h2 style={{ margin: 0 }}>🔔 Transferts en attente</h2>
                                <button onClick={() => setShowTransferPanel(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                {incomingTransfers.length === 0 && <div style={{ textAlign: 'center', color: '#7f8c8d' }}>Aucun transfert pour le moment.</div>}
                                {incomingTransfers.map(tr => (
                                    <div key={tr.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{tr.patient_nom || 'Client Passage'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>{new Date(tr.date_transfert).toLocaleString()}</div>
                                            {tr.observation && <div style={{ fontSize: '0.85rem', color: '#34495e', fontStyle: 'italic' }}>"{tr.observation}"</div>}
                                        </div>
                                        <button onClick={() => recupererTransfert(tr.id)} style={{ padding: '10px 15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Récupérer 📥</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* BACKDROP */}
            <style>{pulseStyle}</style>
            {(showCartDrawer || showPaymentDrawer || showTransferPanel) && <div onClick={() => { if (!showPaymentDrawer) { setShowCartDrawer(false); setShowTransferPanel(false); } setShowPaymentDrawer(false); }} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, background: 'rgba(0,0,0,0.4)', zIndex: 15 }} />}
        </div >
    );
}

// Helper pour l'impression
const imprimerRecu = (copies: number) => {
    const content = document.getElementById('receipt-content')?.innerHTML;
    if (!content) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
            <html>
                <head>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; margin: 0; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { font-size: 12px; }
                        .center { text-align: center; }
                    </style>
                </head>
                <body>
                    ${content}
                    ${copies > 1 ? '<div style="page-break-before: always;"></div>' + content : ''}
                    <script>
                window.onload = () => {
                            window.print();
                    setTimeout(() => {window.frameElement.remove(); }, 1000);
                };
                    </script>
                </body>
            </html>
            `);
    doc.close();
};

const cardStyle: CSSProperties = { padding: '15px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '140px', transition: 'transform 0.2s', background: 'white' };
const badgeStyle: CSSProperties = { background: '#27ae60', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' };
const inputS: CSSProperties = { flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1.1rem' };

