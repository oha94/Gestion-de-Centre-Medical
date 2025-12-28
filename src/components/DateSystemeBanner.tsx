import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

export default function DateSystemeBanner({ onClotureComplete }: { onClotureComplete?: () => void }) {
    const [dateSysteme, setDateSysteme] = useState("");
    const [dateOrdinateur, setDateOrdinateur] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        chargerDates();
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) setCurrentUser(JSON.parse(storedUser));

        // Rafraîchir toutes les 30 secondes
        const interval = setInterval(chargerDates, 30000);
        return () => clearInterval(interval);
    }, []);

    const chargerDates = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>("SELECT date_systeme_actuelle FROM app_parametres_app LIMIT 1");
            const dateSys = res[0]?.date_systeme_actuelle || new Date().toISOString().split('T')[0];
            setDateSysteme(dateSys);
            setDateOrdinateur(new Date().toISOString().split('T')[0]);
        } catch (e) {
            console.error(e);
        }
    };

    const cloturerJournee = async () => {
        if (!confirm(`Clôturer la journée du ${new Date(dateSysteme).toLocaleDateString('fr-FR')} et passer au ${new Date(dateOrdinateur).toLocaleDateString('fr-FR')} ?`)) {
            return;
        }

        setLoading(true);
        try {
            const db = await getDb();

            // Vérifier si cette date a déjà été clôturée
            const existingCloture = await db.select<any[]>(`
                SELECT * FROM clotures_journalieres WHERE date_cloture = ?
            `, [dateSysteme]);

            // Enregistrer la clôture seulement si elle n'existe pas déjà
            if (existingCloture.length === 0) {
                await db.execute(`
                    INSERT INTO clotures_journalieres (
                        date_cloture, date_systeme_suivante, user_id
                    )
                    VALUES (?, ?, ?)
                `, [dateSysteme, dateOrdinateur, currentUser?.id || null]);
            }

            // Mettre à jour la date système
            await db.execute(`
                UPDATE app_parametres_app 
                SET date_systeme_actuelle = ?, derniere_cloture = ?
            `, [dateOrdinateur, dateSysteme]);

            alert(`✅ Journée clôturée !\n\nNouvelle date : ${new Date(dateOrdinateur).toLocaleDateString('fr-FR')}`);

            chargerDates();
            if (onClotureComplete) onClotureComplete();
        } catch (e) {
            console.error(e);
            alert("❌ Erreur lors de la clôture");
        } finally {
            setLoading(false);
        }
    };

    const dateDifferente = dateSysteme !== dateOrdinateur;

    return (
        <div style={{
            background: dateDifferente ? '#fff3cd' : '#e8f5e9',
            padding: '15px 25px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `3px solid ${dateDifferente ? '#ffc107' : '#4caf50'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>📅</span>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Date Système</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50' }}>
                            {new Date(dateSysteme).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                {dateDifferente && (
                    <>
                        <div style={{ fontSize: '1.8rem', color: '#95a5a6' }}>→</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>💻</span>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Aujourd'hui</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50' }}>
                                    {new Date(dateOrdinateur).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div>
                {dateDifferente ? (
                    <button
                        onClick={cloturerJournee}
                        disabled={loading}
                        style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            padding: '15px 30px',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)',
                            transition: 'all 0.2s',
                            minWidth: '200px'
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        🔒 {loading ? 'Clôture en cours...' : 'CLÔTURER LA JOURNÉE'}
                    </button>
                ) : (
                    <div style={{
                        color: '#27ae60',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        padding: '10px 20px',
                        background: 'rgba(39, 174, 96, 0.1)',
                        borderRadius: '8px'
                    }}>
                        ✅ Journée en cours
                    </div>
                )}
            </div>
        </div>
    );
}
