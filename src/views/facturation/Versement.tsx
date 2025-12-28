import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function Versement({ currentUser }: { currentUser?: any }) {
    const [history, setHistory] = useState<any[]>([]);
    // User Selection (For Admin)
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number>(currentUser?.id || 0);

    // Form
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [observation, setObservation] = useState("");
    const [modePaiement, setModePaiement] = useState("ESPECES");

    useEffect(() => {
        loadUsers();
    }, [date]); // Reload users when date changes

    useEffect(() => {
        if (selectedUserId) {
            loadHistory();
        }
    }, [selectedUserId, date]);

    const loadUsers = async () => {
        try {
            const db = await getDb();
            // Filter users who have activity on the selected date
            const res = await db.select<any[]>(`
                SELECT DISTINCT u.id, u.nom_complet 
                FROM app_utilisateurs u
                WHERE u.id IN (SELECT user_id FROM ventes WHERE DATE(date_vente) = ?)
                OR u.id IN (SELECT user_id FROM caisse_mouvements WHERE DATE(date_mouvement) = ? AND type IN ('DECAISSEMENT', 'ENCAISSEMENT_RECOUVREMENT'))
                ORDER BY u.nom_complet
            `, [date, date]);
            setUsers(res);

            // If the previously selected user is not in the new list, reset selection (or select first)
            if (res.length > 0 && !res.find(u => u.id === selectedUserId)) {
                setSelectedUserId(res[0].id);
            } else if (res.length === 0) {
                setSelectedUserId(0);
            }
        } catch (e) { console.error(e); }
    };



    const loadHistory = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT * FROM caisse_mouvements 
                WHERE type = 'VERSEMENT' 
                AND user_id = ? 
                AND DATE(date_mouvement) = ?
                ORDER BY date_mouvement DESC
            `, [selectedUserId, date]);
            setHistory(res);
            setHistory(res);
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        if (!amount || parseFloat(amount) <= 0) return alert("Montant invalide");

        if (!confirm(`Confirmer le versement de ${parseInt(amount).toLocaleString()} F (${modePaiement}) ?`)) return;

        try {
            const db = await getDb();
            await db.execute(`
                INSERT INTO caisse_mouvements (type, montant, date_mouvement, motif, user_id, mode_paiement, reference)
                VALUES ('VERSEMENT', ?, ?, ?, ?, ?, ?)
            `, [amount, new Date().toISOString(), observation || `Versement ${modePaiement}`, selectedUserId, modePaiement, `VERS-${Date.now()}`]);

            alert("Versement enregistré !");
            setAmount("");
            setObservation("");
            loadHistory();
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'enregistrement");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Annuler ce versement ?")) return;
        try {
            const db = await getDb();
            await db.execute("DELETE FROM caisse_mouvements WHERE id = ?", [id]);
            loadHistory();
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ padding: '20px', background: '#f0f2f5', height: '100%', display: 'flex', gap: '20px' }}>

            {/* LEFT: FORM (Fixed Width & Sticky Button) */}
            <div style={{ flex: '0 0 400px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '25px', borderBottom: '1px solid #eee', background: '#fff' }}>
                    <h2 style={{ margin: 0, color: '#2980b9' }}>📥 Nouveau Versement</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '25px' }}>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e' }}>Date du versement</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #bdc3c7', fontSize: '16px' }} />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e' }}>Pour la caisse de :</label>
                        <select
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #3498db', fontWeight: 'bold', fontSize: '16px', background: '#eaf2f8' }}
                        >
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.nom_complet}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e' }}>Mode de versement</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {[
                                { value: 'ESPECES', label: 'Espèces', color: '#2ecc71', icon: '💵' },
                                { value: 'TPE', label: 'Carte (TPE)', color: '#34495e', icon: '💳' },
                                { value: 'CHEQUE', label: 'Chèque', color: '#95a5a6', icon: '📨' },
                                { value: 'VIREMENT', label: 'Virement', color: '#7f8c8d', icon: '🏦' },
                                { value: 'WAVE', label: 'Wave', img: '/src/assets/payment_logos/wave.svg' },
                                { value: 'ORANGE_MONEY', label: 'Orange Money', img: '/src/assets/payment_logos/om.svg' },
                                { value: 'MTN_MONEY', label: 'MTN MoMo', img: '/src/assets/payment_logos/mtn.svg' },
                                { value: 'MOOV_MONEY', label: 'Moov Money', img: '/src/assets/payment_logos/moov.svg' },
                            ].map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => setModePaiement(opt.value)}
                                    style={{
                                        padding: '10px',
                                        border: modePaiement === opt.value ? '2px solid #3498db' : '1px solid #eee',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        background: modePaiement === opt.value ? '#eaf2f8' : 'white',
                                        textAlign: 'center',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px' }}>
                                        {opt.img ? (
                                            <img src={opt.img} alt={opt.label} style={{ height: '35px', maxWidth: '100%', borderRadius: '8px' }} />
                                        ) : (
                                            <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2c3e50', lineHeight: '1.2' }}>{opt.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e' }}>Montant Versé</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #27ae60', fontSize: '24px', fontWeight: 'bold', color: '#27ae60', textAlign: 'right' }}
                        />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e' }}>Observation</label>
                        <textarea
                            value={observation}
                            onChange={e => setObservation(e.target.value)}
                            placeholder="Note optionnelle..."
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #bdc3c7', minHeight: '80px', fontFamily: 'inherit' }}
                        />
                    </div>
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #eee', background: '#f9f9f9' }}>
                    <button onClick={handleSave} style={{ width: '100%', padding: '18px', background: '#2980b9', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(41, 128, 185, 0.2)', transition: 'transform 0.1s' }}>
                        VALIDER LE VERSEMENT
                    </button>
                </div>
            </div>

            {/* RIGHT: HISTORY LIST (Recap removed) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Historique du {new Date(date).toLocaleDateString()}</h3>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#95a5a6', marginTop: '50px' }}>Aucun versement ce jour.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h.id} style={{ borderBottom: '1px solid #f1f1f1' }}>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: 'bold' }}>{new Date(h.date_mouvement).toLocaleTimeString().substring(0, 5)}</div>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <div>{h.motif}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#bdc3c7' }}>{h.reference}</div>
                                                {h.mode_paiement !== 'ESPECES' && <span style={{ fontSize: '0.7rem', background: '#ecf0f1', padding: '2px 5px', borderRadius: '3px', marginLeft: '5px' }}>{h.mode_paiement}</span>}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                                                {h.montant.toLocaleString()} F
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                <button onClick={() => handleDelete(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
