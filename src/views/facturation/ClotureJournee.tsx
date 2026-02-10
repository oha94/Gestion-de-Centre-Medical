import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";
// import { ClotureService } from "../../services/ClotureService";
// import { DateTravailManager } from "../../services/DateTravailManager";

export default function ClotureJournee({ currentUser }: { currentUser?: any }) {
    const [loading, setLoading] = useState(true);
    const [dateSysteme, setDateSysteme] = useState("");
    const [dateOrdinateur, setDateOrdinateur] = useState("");
    const [dateNouvelle, setDateNouvelle] = useState("");
    // const [currentUser, setCurrentUser] = useState<any>(null); // Use prop directly or merged
    const [canReopenDates, setCanReopenDates] = useState(false);
    // const [canDecloture, setCanDecloture] = useState(false);
    const [datesCloses, setDatesCloses] = useState<string[]>([]);
    // const [historique, setHistorique] = useState<any[]>([]);
    // const [showHistorique, setShowHistorique] = useState(false);
    // const [showDeclotureModal, setShowDeclotureModal] = useState(false);
    // const [declotureRaison, setDeclotureRaison] = useState("");
    // const [joursDecloturableMax, setJoursDecloturableMax] = useState(7);

    // RAPPORT STATE
    const [rapport, setRapport] = useState({
        totalGlobal: 0,
        totalRecette: 0,
        parCategorie: {} as Record<string, any>,
        modes: [] as any[]
    });

    const checkReopenPermission = async (user: any) => {
        try {
            const db = await getDb();
            if (user.role_nom === 'Administrateur') {
                setCanReopenDates(true);
            } else {
                const res = await db.select<any[]>(`
                    SELECT * FROM app_permissions_roles 
                    WHERE role_id = ? AND code_permission = 'reopen_dates'
                `, [user.role_id]);
                setCanReopenDates(res.length > 0);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        chargerDonnees();
        // Permission Check inside useEffect
        if (currentUser) checkReopenPermission(currentUser);
        else {
            const stored = localStorage.getItem('currentUser');
            if (stored) checkReopenPermission(JSON.parse(stored));
        }
    }, [currentUser]);

    // Separate useEffect for report refresh when dateSysteme changes
    useEffect(() => {
        if (dateSysteme) chargerRapport();
    }, [dateSysteme]);

    const chargerRapport = async () => {
        try {
            const db = await getDb();
            // Fetch Sales
            const ventes = await db.select<any[]>(`
                SELECT 
                    v.id, v.montant_total, v.part_patient, v.part_assureur, 
                    v.mode_paiement, v.type_vente, v.acte_libelle,
                    p.categorie as prestation_category
                FROM ventes v
                LEFT JOIN prestations p ON (v.type_vente = 'ACTE' AND v.article_id = p.id)
                WHERE date(v.date_vente) = date(?) AND v.type_vente != 'RECOUVREMENT'
            `, [dateSysteme]);

            let totalGlobal = 0;
            let totalRecette = 0;
            const parCategorie: Record<string, any> = {};
            const modesMap: Record<string, number> = {};

            ventes.forEach(v => {
                const total = v.montant_total || 0;
                const rec = v.part_patient || 0;
                const modeRaw = v.mode_paiement || 'INCONNU';

                // Basic mode extraction (heuristic)
                let modeSimp = 'AUTRE';
                if (modeRaw.toUpperCase().includes('ESPÈCE') || modeRaw.toUpperCase().includes('CASH')) modeSimp = 'ESPÈCE';
                else if (modeRaw.toUpperCase().includes('WAVE')) modeSimp = 'WAVE';
                else if (modeRaw.toUpperCase().includes('ORANGE')) modeSimp = 'ORANGE';
                else if (modeRaw.toUpperCase().includes('MTN')) modeSimp = 'MTN';
                else if (modeRaw.toUpperCase().includes('CHÈQUE')) modeSimp = 'CHÈQUE';
                else if (modeRaw.toUpperCase().includes('CRÉDIT') || modeRaw.toUpperCase().includes('CREDIT')) modeSimp = 'CRÉDIT';

                totalGlobal += total;
                totalRecette += rec;

                // Category Logic
                let catKey = 'AUTRE';
                let catLabel = 'Autre';

                if (v.type_vente === 'MEDICAMENT') { catKey = 'PHARMA'; catLabel = '💊 Pharmacie'; }
                else if (v.type_vente === 'HOSPITALISATION') { catKey = 'HOSPIT'; catLabel = '🏥 Hospitalisation'; }
                else if (v.type_vente === 'ACTE') {
                    const pCat = (v.prestation_category || '').toUpperCase();
                    if (pCat.includes('CONSUL')) { catKey = 'CONSULT'; catLabel = '👨‍⚕️ Consultation'; }
                    else if (pCat.includes('LABO') || pCat.includes('EXAMEN')) { catKey = 'LABO'; catLabel = '🔬 Laboratoire / Examens'; }
                    else if (pCat.includes('SOIN') || pCat.includes('ACTE')) { catKey = 'SOINS'; catLabel = '💉 Soins Infirmiers / Actes'; }
                    else if (v.acte_libelle.toUpperCase().includes('ECOGRAPH')) { catKey = 'ECHO'; catLabel = '🖥️ Echographie/Radio'; }
                }

                if (!parCategorie[catKey]) {
                    parCategorie[catKey] = { label: catLabel, total: 0, recette: 0, count: 0, modes: {} };
                }

                parCategorie[catKey].total += total;
                parCategorie[catKey].recette += rec;
                parCategorie[catKey].count += 1;

                if (!parCategorie[catKey].modes[modeSimp]) parCategorie[catKey].modes[modeSimp] = 0;
                parCategorie[catKey].modes[modeSimp] += rec; // Track ACTUAL CASH RECIEVED per mode

                if (!modesMap[modeSimp]) modesMap[modeSimp] = 0;
                modesMap[modeSimp] += rec;
            });

            // Format modes for chart/list
            const modesList = Object.entries(modesMap).map(([m, t]) => ({ mode: m, total: t }));

            setRapport({
                totalGlobal,
                totalRecette, // Only what patients paid
                parCategorie,
                modes: modesList
            });

        } catch (e) { console.error("Erreur rapport", e); }
    };

    const chargerDonnees = async () => {
        setLoading(true);
        try {
            const db = await getDb();

            // Charger la date système
            const resConfig = await db.select<any[]>("SELECT date_systeme_actuelle FROM app_parametres_app LIMIT 1");
            const dateSys = resConfig[0]?.date_systeme_actuelle || new Date().toISOString().split('T')[0];
            setDateSysteme(dateSys);

            // Date de l'ordinateur
            const dateOrd = new Date().toISOString().split('T')[0];
            setDateOrdinateur(dateOrd);

            // Par défaut, proposer le jour suivant
            const dateSuivante = new Date(dateSys);
            dateSuivante.setDate(dateSuivante.getDate() + 1);
            setDateNouvelle(dateSuivante.toISOString().split('T')[0]);

            // Charger les dates déjà clôturées
            const resClotures = await db.select<any[]>(`
                SELECT date_cloture FROM clotures_journalieres
                ORDER BY date_cloture DESC
            `);
            setDatesCloses(resClotures.map(c => c.date_cloture));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const effectuerCloture = async () => {
        if (!dateNouvelle) {
            alert("⚠️ Veuillez sélectionner une date");
            return;
        }

        // Vérifier si la date est antérieure à une date déjà clôturée
        const isReopening = datesCloses.some(d => new Date(dateNouvelle) <= new Date(d));

        if (isReopening && !canReopenDates) {
            alert("❌ Accès refusé !\n\nVous n'avez pas la permission de revenir à une date déjà clôturée.\n\nContactez un administrateur.");
            return;
        }

        if (isReopening) {
            if (!confirm(`⚠️ ATTENTION : RÉOUVERTURE DE DATE\n\nVous allez revenir à une date déjà clôturée : ${new Date(dateNouvelle).toLocaleDateString('fr-FR')}\n\nCette action est exceptionnelle et sera enregistrée.\n\nConfirmez-vous ?`)) {
                return;
            }
        }

        if (!confirm(`Êtes-vous sûr de vouloir clôturer la journée du ${new Date(dateSysteme).toLocaleDateString('fr-FR')} ?\n\nNouvelle date système : ${new Date(dateNouvelle).toLocaleDateString('fr-FR')}\n\nCette action est irréversible.`)) {
            return;
        }

        try {
            const db = await getDb();

            // Vérifier si cette date a déjà été clôturée
            const existingCloture = await db.select<any[]>(`
                SELECT * FROM clotures_journalieres WHERE date_cloture = ?
            `, [dateSysteme]);

            // Insérer la clôture seulement si elle n'existe pas déjà
            if (existingCloture.length === 0) {
                await db.execute(`
                    INSERT INTO clotures_journalieres (
                        date_cloture, date_systeme_suivante, user_id
                    )
                    VALUES (?, ?, ?)
                `, [
                    dateSysteme,
                    dateNouvelle,
                    currentUser?.id || null
                ]);
            }

            // Mettre à jour la date système
            await db.execute(`
                UPDATE app_parametres_app 
                SET date_systeme_actuelle = ?, derniere_cloture = ?
            `, [dateNouvelle, dateSysteme]);

            alert(`✅ Clôture effectuée avec succès !\n\nNouvelle date système : ${new Date(dateNouvelle).toLocaleDateString('fr-FR')}\n\nL'application va se recharger...`);

            // Recharger l'application pour mettre à jour toutes les vérifications
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (e) {
            console.error(e);
            alert("❌ Erreur lors de la clôture");
        }
    };

    const dateDifferente = dateSysteme !== dateOrdinateur;

    return (
        <div style={{ padding: '30px', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8f9fa', overflow: 'auto' }}>
            {/* CARD PRINCIPALE */}
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔒</div>
                    <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '2rem' }}>Clôture de Journée</h1>
                </div>

                {/* ALERTE DIFFÉRENCE DATE */}
                {dateDifferente && (
                    <div style={{ background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ fontSize: '2rem' }}>⚠️</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#856404', marginBottom: '5px' }}>
                                    Attention : Différence de date détectée
                                </div>
                                <div style={{ color: '#856404', fontSize: '0.9rem' }}>
                                    La date système est différente de la date de l'ordinateur.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ALERTE PERMISSION */}
                {!canReopenDates && (
                    <div style={{ background: '#e3f2fd', border: '2px solid #2196f3', borderRadius: '12px', padding: '15px', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontSize: '1.5rem' }}>🔒</div>
                            <div style={{ fontSize: '0.85rem', color: '#1976d2' }}>
                                <strong>Info :</strong> Vous ne pouvez pas revenir à une date déjà clôturée. Seuls les administrateurs peuvent réouvrir des dates.
                            </div>
                        </div>
                    </div>
                )}

                {/* RAPPORT JOURNALIER */}
                <div style={{ marginBottom: '40px', background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, color: '#2c3e50' }}>📊 Rapport Journalier : {new Date(dateSysteme).toLocaleDateString()}</h2>
                        <button onClick={chargerRapport} style={{ padding: '8px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Actualiser 🔄</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                        <div style={{ padding: '15px', background: '#27ae60', color: 'white', borderRadius: '10px' }}>
                            <div style={{ opacity: 0.8 }}>Recette Totale</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{rapport.totalRecette.toLocaleString()} F</div>
                            <div style={{ fontSize: '0.8rem' }}>(Part Patient uniquement)</div>
                        </div>
                        <div style={{ padding: '15px', background: '#2980b9', color: 'white', borderRadius: '10px' }}>
                            <div style={{ opacity: 0.8 }}>Total Vendu</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{rapport.totalGlobal.toLocaleString()} F</div>
                            <div style={{ fontSize: '0.8rem' }}>(Inclus Assurances)</div>
                        </div>
                        <div style={{ padding: '15px', background: '#d35400', color: 'white', borderRadius: '10px' }}>
                            <div style={{ opacity: 0.8 }}>Montant Espèces</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{rapport.modes.find(m => m.mode === 'ESPÈCE') ? (rapport.modes.find(m => m.mode === 'ESPÈCE') as any).total.toLocaleString() : '0'} F</div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', color: '#7f8c8d' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Catégorie</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Nombre</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Total Vente</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Part Patient (Recette)</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Détails Paiement</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(rapport.parCategorie).map(([key, cat]: [string, any]) => (
                                <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>
                                        <strong>{cat.label}</strong>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{cat.count}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{cat.total.toLocaleString()} F</td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: '#27ae60', fontWeight: 'bold' }}>{cat.recette.toLocaleString()} F</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontSize: '0.9rem' }}>
                                        {Object.entries(cat.modes).map(([mode, montant]: [string, any]) => (
                                            <span key={mode} style={{ display: 'inline-block', marginLeft: '10px', background: '#f1f2f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                {mode}: <strong>{montant.toLocaleString()}</strong>
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {Object.keys(rapport.parCategorie).length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucune vente aujourd'hui</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* DATES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px', marginBottom: '40px' }}>
                    <div style={{ background: '#e3f2fd', padding: '30px', borderRadius: '15px', border: '3px solid #2196f3' }}>
                        <div style={{ fontSize: '0.9rem', color: '#1976d2', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase' }}>📅 Date Système Actuelle</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px' }}>
                            {new Date(dateSysteme).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '1rem', color: '#1976d2', fontWeight: 'bold' }}>
                            {new Date(dateSysteme).toLocaleDateString('fr-FR', { weekday: 'long' })}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#1976d2', marginTop: '15px', padding: '10px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '8px' }}>
                            ℹ️ Journée de travail en cours
                        </div>
                    </div>

                    <div style={{ background: '#fff9c4', padding: '30px', borderRadius: '15px', border: '3px solid #ffc107' }}>
                        <div style={{ fontSize: '0.9rem', color: '#f57c00', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase' }}>📆 Nouvelle Date</div>
                        <input
                            type="date"
                            value={dateNouvelle}
                            onChange={e => setDateNouvelle(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '15px',
                                fontSize: '1.3rem',
                                fontWeight: 'bold',
                                border: '2px solid #ffc107',
                                borderRadius: '10px',
                                background: 'white',
                                textAlign: 'center'
                            }}
                        />
                        <div style={{ fontSize: '0.85rem', color: '#f57c00', marginTop: '15px', padding: '10px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px' }}>
                            📌 Choisissez la prochaine journée
                        </div>
                    </div>

                    <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '15px', border: '2px solid #e0e0e0' }}>
                        <div style={{ fontSize: '0.9rem', color: '#7f8c8d', fontWeight: 'bold', marginBottom: '15px', textTransform: 'uppercase' }}>💻 Date Ordinateur</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px' }}>
                            {new Date(dateOrdinateur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '1rem', color: '#7f8c8d', fontWeight: 'bold' }}>
                            {new Date(dateOrdinateur).toLocaleDateString('fr-FR', { weekday: 'long' })}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '15px', padding: '10px', background: 'rgba(127, 140, 141, 0.1)', borderRadius: '8px' }}>
                            🖥️ Référence système
                        </div>
                    </div>
                </div>

                {/* BOUTON CLÔTURE */}
                <button
                    onClick={effectuerCloture}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '20px',
                        background: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    🔒 CLÔTURER ET PASSER AU JOUR SUIVANT
                </button>

                <div style={{ marginTop: '20px', textAlign: 'center', color: '#7f8c8d', fontSize: '0.9rem' }}>
                    Cette action passera la date système au jour suivant
                </div>
            </div>
        </div>
    );
}
