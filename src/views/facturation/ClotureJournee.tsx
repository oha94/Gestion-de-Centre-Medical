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

    useEffect(() => {
        chargerDonnees();
        if (currentUser) {
            checkReopenPermission(currentUser);
        } else {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                checkReopenPermission(user);
            }
        }
    }, [currentUser]);

    const checkReopenPermission = async (user: any) => {
        try {
            const db = await getDb();
            // Vérifier si l'utilisateur est admin ou a la permission spécifique
            if (user.role_nom === 'Administrateur') {
                setCanReopenDates(true);
            } else {
                // Vérifier les permissions spécifiques
                const res = await db.select<any[]>(`
                    SELECT * FROM app_permissions_roles 
                    WHERE role_id = ? AND code_permission = 'reopen_dates'
                `, [user.role_id]);
                setCanReopenDates(res.length > 0);
            }
        } catch (e) {
            console.error(e);
        }
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

            alert(`✅ Clôture effectuée avec succès !\n\nNouvelle date système : ${new Date(dateNouvelle).toLocaleDateString('fr-FR')}`);

            chargerDonnees();
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
