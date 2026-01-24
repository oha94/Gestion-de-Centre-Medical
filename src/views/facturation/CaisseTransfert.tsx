import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

// TYPES (reused from Caisse)
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
};

export default function CaisseTransfertView() {
    // DATA STATES
    const [patients, setPatients] = useState<any[]>([]);
    const [personnels, setPersonnels] = useState<any[]>([]);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [admissions, setAdmissions] = useState<any[]>([]);

    // UI STATES
    const [searchQuery, setSearchQuery] = useState("");
    const [selectionType, setSelectionType] = useState<"PATIENT" | "PERSONNEL">("PATIENT");
    const [patientSelectionne, setPatientSelectionne] = useState<any>(null);
    const [personnelSelectionne, setPersonnelSelectionne] = useState<any>(null);

    const [selectedCategory, setSelectedCategory] = useState<string>("TOUT");
    const [searchTerm, setSearchTerm] = useState("");
    const [showCartDrawer, setShowCartDrawer] = useState(false);
    const [observation, setObservation] = useState("");

    // CART STATES
    const [panier, setPanier] = useState<CartItem[]>([]);


    useEffect(() => {
        chargerDonnees();
    }, []);

    const chargerDonnees = async () => {
        let allItems: CatalogItem[] = [];
        const db = await getDb();

        // 1. Patients
        try {
            console.log("CaisseTransfert: Loading Patients...");
            const resP = await db.select<any[]>(`
                SELECT p.id, p.nom_prenoms, p.numero_carnet, p.assurance_id, p.telephone,
                       p.societe_id, p.numero_assure, p.nom_salarie, p.telephone_assurance,
                       CAST(p.taux_couverture AS CHAR) as taux_couverture,
                       a.nom as nom_assurance
                FROM patients p LEFT JOIN assurances a ON p.assurance_id = a.id
            `);
            setPatients(resP);
            console.log("CaisseTransfert: Patients loaded", resP.length);
        } catch (e) { console.error("Error loading patients:", e); }

        // 2. Personnel
        try {
            const resPers = await db.select<any[]>(`
                SELECT id, nom_prenoms, fonction FROM personnel
                UNION
                SELECT u.id, u.nom_complet COLLATE utf8mb4_unicode_ci as nom_prenoms, r.nom COLLATE utf8mb4_unicode_ci as fonction FROM app_utilisateurs u
                LEFT JOIN app_roles r ON u.role_id = r.id
                ORDER BY nom_prenoms
            `);
            setPersonnels(resPers);
        } catch (e) { console.warn("Error loading personnel (non-critical):", e); }

        // 3. Prestations (Items)
        try {
            console.log("CaisseTransfert: Loading Prestations...");
            const resPrest = await db.select<any[]>("SELECT id, libelle, categorie, CAST(prix_standard AS CHAR) as prix_standard FROM prestations");
            resPrest.forEach(p => {
                let cat: any = 'AUTRE';
                let color = '#95a5a6';
                let icon = '🩺';

                const catUpper = p.categorie?.toUpperCase() || '';

                if (catUpper.includes('LABO')) { cat = 'EXAMENS'; color = '#8e44ad'; icon = '🔬'; }
                else if (catUpper === 'SOINS') { cat = 'ACTES MÉDICAUX'; color = '#27ae60'; icon = '💉'; }
                else if (catUpper === 'CONSULTATION') { cat = 'CONSULTATIONS'; color = '#2980b9'; icon = '👨‍⚕️'; }

                allItems.push({ id: p.id, libelle: p.libelle, prix: Number(p.prix_standard), type: 'ACTE', categorie: cat, color: color, icon: icon });
            });
            console.log("CaisseTransfert: Prestations loaded", resPrest.length);
        } catch (e) { console.error("Error loading prestations:", e); }

        // 4. Pharma (Items)
        try {
            console.log("CaisseTransfert: Loading Pharma...");
            // Removed WHERE quantite_stock > 0 to match Caisse.tsx and ensure visibility even if stock issues
            const resPharma = await db.select<any[]>("SELECT id, designation, CAST(prix_vente AS CHAR) as prix_vente, CAST(quantite_stock AS CHAR) as quantite_stock FROM stock_articles");
            resPharma.forEach(p => {
                allItems.push({ id: p.id, libelle: p.designation, prix: Number(p.prix_vente), type: 'MEDICAMENT', categorie: 'PRODUITS', stock: Number(p.quantite_stock), color: '#e67e22', icon: '💊' });
            });
            console.log("CaisseTransfert: Pharma loaded", resPharma.length);
        } catch (e) { console.error("Error loading pharma:", e); }

        // Finalize Items
        setItems(allItems);
        console.log("CaisseTransfert: Total items set", allItems.length);
    };

    // SELECTION & AUTO-FILL
    useEffect(() => {
        if (selectionType === 'PATIENT') {
            const p = patients.find(pat => pat.numero_carnet?.toLowerCase().trim() === searchQuery.toLowerCase().trim());
            setPatientSelectionne(p || null);
            setPersonnelSelectionne(null);
            if (p) {
                chargerAdmissionsPatient(p.id);
            } else setAdmissions([]);
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
                SELECT a.id, a.date_entree, a.nb_jours, l.nom_lit, CAST(l.prix_journalier AS CHAR) as prix_journalier, c.nom as nom_chambre
                FROM admissions a JOIN lits l ON a.lit_id = l.id JOIN chambres c ON l.chambre_id = c.id
                WHERE a.patient_id = ? AND a.statut = 'en_cours'
            `, [patientId]);
            setAdmissions(res);
        } catch (e) { }
    };

    const ajouterAuPanier = (item: CatalogItem, initialQte: number = 1) => {
        setPanier(prev => {
            const index = prev.findIndex(p => p.itemId === item.id && p.type === item.type);
            if (index > -1) {
                const updated = [...prev];
                updated[index].qte += 1;
                return updated;
            } else {
                const ligne: CartItem = {
                    uniqueId: Date.now() + Math.random(),
                    itemId: item.id, libelle: item.libelle, type: item.type,
                    categorie: item.categorie, prixUnitaire: item.prix, qte: initialQte,
                    partAssureurUnitaire: 0, partPatientUnitaire: item.prix, useAssurance: false
                };
                return [...prev, ligne];
            }
        });
    };

    const toggleAssuranceItem = (uniqueId: number) => {
        if (!patientSelectionne?.assurance_id) return alert("Pas d'assurance");
        setPanier(prev => prev.map(item => {
            if (item.uniqueId === uniqueId) {
                const newVal = !item.useAssurance;
                const partAssur = newVal ? Math.round(item.prixUnitaire * (patientSelectionne.taux_couverture || 0) / 100) : 0;
                return { ...item, useAssurance: newVal, partAssureurUnitaire: partAssur, partPatientUnitaire: item.prixUnitaire - partAssur };
            }
            return item;
        }));
    };

    const transfererVente = async () => {
        // Logic: If patient selected, use ID. If not, use searchQuery as manual name.
        const nomManuel = (!patientSelectionne && !personnelSelectionne && selectionType === 'PATIENT' && searchQuery.trim().length > 1) ? searchQuery.trim() : null;

        if (panier.length === 0 || !(patientSelectionne || personnelSelectionne || nomManuel)) {
            alert("Veuillez sélectionner un patient ou saisir un nom valide pour le transfert.");
            return;
        }

        try {
            const db = await getDb();
            // Store name if manual, otherwise ID handle it.
            // If patient is selected, we could also store name for backup, but ID is enough.
            const res = await db.execute("INSERT INTO ventes_transferts (patient_id, nom_patient, observation, statut) VALUES (?, ?, ?, 'EN_ATTENTE')",
                [patientSelectionne?.id || null, nomManuel, observation]);
            const transferId = res.lastInsertId;

            for (const item of panier) {
                await db.execute(`
                    INSERT INTO ventes_transferts_items (transfert_id, item_id, libelle, type, prix_unitaire, qte, use_assurance, part_assureur_unitaire, part_patient_unitaire)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [transferId, item.itemId, item.libelle, item.type, item.prixUnitaire, item.qte, item.useAssurance ? 1 : 0, item.partAssureurUnitaire, item.partPatientUnitaire]);
            }

            alert("✅ Vente transférée à la caisse principale !");
            setPanier([]);
            setSearchQuery("");
            setObservation("");
            setPatientSelectionne(null); // Reset selection
            setShowCartDrawer(false);
        } catch (e) { console.error(e); alert("Erreur transfert."); }
    };

    const totalNet = panier.reduce((acc, i) => acc + (i.partPatientUnitaire * i.qte), 0);
    const cardStyle = { background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f7f6', overflow: 'hidden', position: 'relative' }}>
            {/* HEADER TOOLBAR: CAISSE TRANSFERT */}
            <div style={{ background: 'white', padding: '12px 20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 11, display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* LINE 1: SELECTION INPUTS & ACTIONS (CSS GRID to Stop Overlap) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr min-content', gap: '20px', alignItems: 'center' }}>

                    {/* LEFT: TITLE & TOGGLES */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1.1rem', marginRight: '10px' }}>📋 Transfert</div>
                        <div style={{ display: 'flex', background: '#f1f2f6', borderRadius: '8px', padding: '4px' }}>
                            <button onClick={() => setSelectionType('PATIENT')} style={{ padding: '8px 15px', border: 'none', borderRadius: '6px', background: selectionType === 'PATIENT' ? '#3498db' : 'transparent', color: selectionType === 'PATIENT' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}>👤 Patient</button>
                            <button onClick={() => setSelectionType('PERSONNEL')} style={{ padding: '8px 15px', border: 'none', borderRadius: '6px', background: selectionType === 'PERSONNEL' ? '#e67e22' : 'transparent', color: selectionType === 'PERSONNEL' ? 'white' : '#7f8c8d', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}>👔 Personnel</button>
                        </div>
                    </div>

                    {/* CENTER: SEARCH BAR (MAIN FOCUS) */}
                    <div style={{ position: 'relative', width: '100%', maxWidth: '600px', justifySelf: 'center' }}>
                        <input
                            placeholder={selectionType === 'PATIENT' ? "Rechercher Patient / Nom..." : "Rechercher Personnel..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 20px', borderRadius: '30px', border: '2px solid #e0e0e0',
                                fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s',
                                background: (patientSelectionne || personnelSelectionne || (searchQuery.length > 2 && !patientSelectionne)) ? '#e8f8f5' : '#f9f9f9',
                                borderColor: (patientSelectionne || personnelSelectionne) ? '#2ecc71' : '#e0e0e0'
                            }}
                        />
                        {(patientSelectionne || personnelSelectionne) && <span style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>✅</span>}
                    </div>

                    {/* RIGHT: GLOBAL ACTIONS */}
                    <div style={{ display: 'flex', gap: '15px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setShowCartDrawer(true)} style={{ padding: '10px 20px', background: '#34495e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(44, 62, 80, 0.3)' }}>
                            <span>🛒 Panier ({panier.length})</span>
                            <span style={{ background: '#e74c3c', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>{totalNet.toLocaleString()} F</span>
                        </button>
                    </div>
                </div>

                {/* LINE 2: INFO BANNER (If Selected or Manual Name) */}
                {(patientSelectionne || personnelSelectionne || (selectionType === 'PATIENT' && searchQuery.length > 2 && !patientSelectionne && !personnelSelectionne)) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '30px', padding: '10px 15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: `5px solid ${patientSelectionne ? '#3498db' : (personnelSelectionne ? '#e67e22' : '#95a5a6')}` }}>
                        <div>
                            <span style={{ color: '#7f8c8d', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {patientSelectionne ? 'Patient Identifié' : (personnelSelectionne ? 'Personnel Identifié' : 'Nom Manuel (Transfert Libre)')}
                            </span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50' }}>
                                {patientSelectionne?.nom_prenoms || personnelSelectionne?.nom_prenoms || searchQuery}
                            </div>
                        </div>
                        {patientSelectionne && (
                            <>
                                <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '30px' }}>
                                    <span style={{ color: '#7f8c8d', fontSize: '0.8rem' }}>N° CARNET</span>
                                    <div style={{ fontWeight: 'bold' }}>{patientSelectionne.numero_carnet || 'N/A'}</div>
                                </div>
                                {patientSelectionne.nom_assurance && (
                                    <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div>
                                            <span style={{ color: '#7f8c8d', fontSize: '0.8rem' }}>ASSURANCE</span>
                                            <div style={{ fontWeight: 'bold', color: '#27ae60' }}>{patientSelectionne.nom_assurance}</div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {!patientSelectionne && !personnelSelectionne && (
                            <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '30px', fontStyle: 'italic', color: '#7f8c8d' }}>
                                Ce nom sera transmis à la caisse
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingBottom: '5px' }}>

                    {/* SEARCH INPUT (LEFT FIXED) */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '0 10px', width: '250px' }}>
                        <span style={{ fontSize: '1rem' }}>🔍</span>
                        <input
                            placeholder="Chercher article..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ border: 'none', padding: '10px', fontSize: '0.9rem', width: '100%', outline: 'none' }}
                        />
                    </div>

                    <div style={{ width: '1px', height: '30px', background: '#ddd', margin: '0 10px' }}></div>

                    {/* CATEGORIES (RIGHT FLEX SCROLL) */}
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', flex: 1 }}>
                        {['TOUT', 'PRODUITS', 'EXAMENS', 'ACTES MÉDICAUX', 'CONSULTATIONS', 'HOSPITALISATIONS'].map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '8px 15px', borderRadius: '6px', border: 'none',
                                    background: selectedCategory === cat ? '#3498db' : 'white',
                                    color: selectedCategory === cat ? 'white' : '#7f8c8d',
                                    fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.85rem'
                                }}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', alignContent: 'start' }}>
                    {(selectedCategory === 'TOUT' || selectedCategory === 'HOSPITALISATIONS') && admissions.map(adm => (
                        <div key={'adm' + adm.id} onClick={() => ajouterAuPanier({ id: adm.id, libelle: `Hosp. ${adm.nom_chambre}`, prix: adm.prix_journalier, type: 'HOSPITALISATION', categorie: 'HOSPITALISATIONS' }, adm.nb_jours)} style={{ ...cardStyle, borderLeft: '5px solid #c0392b' }}>
                            <div style={{ fontWeight: 'bold' }}>{adm.nom_chambre} / {adm.nom_lit}</div>
                            <div style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>{adm.nb_jours} jours</div>
                            <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#c0392b' }}>{adm.prix_journalier.toLocaleString()} F/j</div>
                        </div>
                    ))}
                    {items.filter(i => (selectedCategory === 'TOUT' || i.categorie === selectedCategory) && i.libelle.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                        <div key={item.type + item.id} onClick={() => ajouterAuPanier(item)} style={{ ...cardStyle, borderLeft: `5px solid ${item.color || '#ddd'}` }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{item.icon}</div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', height: '40px', overflow: 'hidden' }}>{item.libelle}</div>
                            <div style={{ textAlign: 'right', fontWeight: 'bold', marginTop: '10px' }}>{item.prix.toLocaleString()} F</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* DRAWER PANIER (Mini simplified version for transfer) */}
            {showCartDrawer && (
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '450px', background: 'white', boxShadow: '-5px 0 20px rgba(0,0,0,0.1)', zIndex: 30, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '20px', background: '#2c3e50', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
                        <h2 style={{ margin: 0 }}>🛒 Panier de Saisie</h2>
                        <button onClick={() => setShowCartDrawer(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
                    </div>

                    <div style={{ padding: '20px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                            <button onClick={() => setSelectionType('PATIENT')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '5px', background: selectionType === 'PATIENT' ? '#3498db' : '#ddd', color: selectionType === 'PATIENT' ? 'white' : 'inherit' }}>👤 Patient</button>
                            <button onClick={() => setSelectionType('PERSONNEL')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '5px', background: selectionType === 'PERSONNEL' ? '#e67e22' : '#ddd', color: selectionType === 'PERSONNEL' ? 'white' : 'inherit' }}>👔 Personnel</button>
                        </div>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Scanner carnet ou chercher nom..." style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                        {(patientSelectionne || personnelSelectionne) && <div style={{ fontSize: '0.9rem', marginTop: '10px', fontWeight: 'bold', color: '#27ae60' }}>✅ {patientSelectionne?.nom_prenoms || personnelSelectionne?.nom_prenoms}</div>}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {panier.map(item => (
                            <div key={item.uniqueId} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold', flex: 1 }}>{item.libelle}</span>
                                    <input type="number" value={item.qte} onChange={e => setPanier(p => p.map(i => i.uniqueId === item.uniqueId ? { ...i, qte: parseInt(e.target.value) || 1 } : i))} style={{ width: '50px' }} />
                                    <span style={{ width: '80px', textAlign: 'right' }}>{(item.prixUnitaire * item.qte).toLocaleString()}</span>
                                    <button onClick={() => setPanier(p => p.filter(i => i.uniqueId !== item.uniqueId))} style={{ background: 'none', border: 'none', color: 'red' }}>✕</button>
                                </div>
                                {patientSelectionne?.assurance_id && (
                                    <label style={{ fontSize: '0.8rem', color: '#3498db', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={item.useAssurance} onChange={() => toggleAssuranceItem(item.uniqueId)} /> Prise en charge {patientSelectionne.nom_assurance}
                                    </label>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '20px', borderTop: '2px solid #eee' }}>
                        <textarea placeholder="Observation éventuelle..." value={observation} onChange={e => setObservation(e.target.value)} style={{ width: '100%', height: '60px', marginBottom: '10px', padding: '10px' }} />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px' }}>Total: {totalNet.toLocaleString()} F</div>
                        <button disabled={panier.length === 0 || !(patientSelectionne || personnelSelectionne)} onClick={transfererVente} style={{ width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 TRANSFÉRER À LA CAISSE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
