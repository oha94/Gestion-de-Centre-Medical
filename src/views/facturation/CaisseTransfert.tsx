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

            // Personnel
            try {
                const resPers = await db.select<any[]>(`
                    SELECT id, nom_prenoms, fonction FROM personnel
                    UNION
                    SELECT u.id, u.nom_complet as nom_prenoms, r.nom as fonction FROM app_utilisateurs u
                    LEFT JOIN app_roles r ON u.role_id = r.id
                    ORDER BY nom_prenoms
                `);
                setPersonnels(resPers);
            } catch (e) { }

            // Items (Acts & Medicaments)
            let allItems: CatalogItem[] = [];
            const resPrest = await db.select<any[]>("SELECT id, libelle, categorie, CAST(prix_standard AS DOUBLE) as prix_standard FROM prestations");
            resPrest.forEach(p => {
                let cat: any = 'AUTRE';
                let color = '#95a5a6';
                let icon = '🩺';
                if (p.categorie === 'LABO') { cat = 'EXAMENS'; color = '#8e44ad'; icon = '🔬'; }
                else if (p.categorie === 'SOINS') { cat = 'ACTES MÉDICAUX'; color = '#27ae60'; icon = '💉'; }
                else if (p.categorie === 'CONSULTATION') { cat = 'CONSULTATIONS'; color = '#2980b9'; icon = '👨‍⚕️'; }
                allItems.push({ id: p.id, libelle: p.libelle, prix: p.prix_standard, type: 'ACTE', categorie: cat, color: color, icon: icon });
            });

            const resPharma = await db.select<any[]>("SELECT id, designation, CAST(prix_vente AS DOUBLE) as prix_vente, CAST(quantite_stock AS DOUBLE) as quantite_stock FROM stock_articles WHERE quantite_stock > 0");
            resPharma.forEach(p => {
                allItems.push({ id: p.id, libelle: p.designation, prix: p.prix_vente, type: 'MEDICAMENT', categorie: 'PRODUITS', stock: p.quantite_stock, color: '#e67e22', icon: '💊' });
            });
            setItems(allItems);
        } catch (e) { console.error(e); }
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
                SELECT a.id, a.date_entree, a.nb_jours, l.nom_lit, CAST(l.prix_journalier AS DOUBLE) as prix_journalier, c.nom as nom_chambre
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
        if (panier.length === 0 || !(patientSelectionne || personnelSelectionne)) return;
        try {
            const db = await getDb();
            const res = await db.execute("INSERT INTO ventes_transferts (patient_id, observation, statut) VALUES (?, ?, 'EN_ATTENTE')",
                [patientSelectionne?.id || null, observation]);
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
            setShowCartDrawer(false);
        } catch (e) { console.error(e); alert("Erreur transfert."); }
    };

    const totalNet = panier.reduce((acc, i) => acc + (i.partPatientUnitaire * i.qte), 0);
    const cardStyle = { background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f7f6', overflow: 'hidden', position: 'relative' }}>
            <div style={{ padding: '15px 25px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>📋 Caisse de Transfert (Saisie des Ventes)</h2>
                <button onClick={() => setShowCartDrawer(true)} style={{ padding: '12px 25px', background: '#34495e', color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🛒 PANIER ({panier.length}) - {totalNet.toLocaleString()} F
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {['TOUT', 'PRODUITS', 'EXAMENS', 'ACTES MÉDICAUX', 'CONSULTATIONS', 'HOSPITALISATIONS'].map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '10px 18px', borderRadius: '20px', border: 'none', background: selectedCategory === cat ? '#3498db' : 'white', color: selectedCategory === cat ? 'white' : '#7f8c8d', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>{cat}</button>
                    ))}
                    <input placeholder="🔍 Chercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, border: 'none', borderRadius: '20px', padding: '0 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
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
