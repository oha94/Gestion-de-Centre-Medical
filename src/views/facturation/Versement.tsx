
import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function Versement({ currentUser }: { currentUser?: any }) {
    const [history, setHistory] = useState<any[]>([]);

    // Form
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [observation, setObservation] = useState("");

    // Paiement 1
    const [amount, setAmount] = useState("");
    const [modePaiement, setModePaiement] = useState("ESPECES");

    // Paiement 2
    const [useSecondPayment, setUseSecondPayment] = useState(false);
    const [amount2, setAmount2] = useState("");
    const [modePaiement2, setModePaiement2] = useState("WAVE");

    useEffect(() => {
        if (currentUser?.id) {
            loadHistory();
        }
    }, [currentUser, date]);

    const loadHistory = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
SELECT * FROM caisse_mouvements 
                WHERE type = 'VERSEMENT' 
                AND user_id = ?
    AND DATE(date_mouvement) = ?
        ORDER BY date_mouvement DESC
            `, [currentUser?.id || 0, date]);
            setHistory(res);
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        const mt1 = parseFloat(amount) || 0;
        const mt2 = useSecondPayment ? (parseFloat(amount2) || 0) : 0;

        if (mt1 <= 0 && mt2 <= 0) return alert("Montant invalide");
        if (!currentUser?.id) return alert("Erreur: Aucun utilisateur connecté identifié.");

        const total = mt1 + mt2;
        let msg = `Confirmer le versement total de ${total.toLocaleString()} F ?\n\n`;
        if (mt1 > 0) msg += `- ${mt1.toLocaleString()} F en ${modePaiement} \n`;
        if (mt2 > 0) msg += `- ${mt2.toLocaleString()} F en ${modePaiement2} \n`;

        if (!confirm(msg)) return;

        try {
            const db = await getDb();
            const timestamp = date + ' ' + new Date().toLocaleTimeString('fr-FR', { hour12: false });

            // Versement 1
            if (mt1 > 0) {
                await db.execute(`
                    INSERT INTO caisse_mouvements(type, montant, date_mouvement, motif, user_id, mode_paiement, reference)
VALUES('VERSEMENT', ?, ?, ?, ?, ?, ?)
                `, [mt1, timestamp, observation || `Versement ${modePaiement} `, currentUser.id, modePaiement, `VERS - ${Date.now()} -1`]);
            }

            // Versement 2
            if (mt2 > 0) {
                await db.execute(`
                    INSERT INTO caisse_mouvements(type, montant, date_mouvement, motif, user_id, mode_paiement, reference)
VALUES('VERSEMENT', ?, ?, ?, ?, ?, ?)
                `, [mt2, timestamp, observation || `Versement ${modePaiement2} `, currentUser.id, modePaiement2, `VERS - ${Date.now()} -2`]);
            }

            alert("Versement enregistré !");
            setAmount("");
            setAmount2("");
            setUseSecondPayment(false);
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

    const PAYMENT_OPTIONS = [
        { value: 'ESPECES', label: 'Espèces', color: '#2ecc71', icon: '💵' },
        { value: 'TPE', label: 'Carte (TPE)', color: '#34495e', icon: '💳' },
        { value: 'CHEQUE', label: 'Chèque', color: '#95a5a6', icon: '📨' },
        { value: 'VIREMENT', label: 'Virement', color: '#7f8c8d', icon: '🏦' },
        { value: 'WAVE', label: 'Wave', img: '/src/assets/payment_logos/wave.svg' },
        { value: 'ORANGE_MONEY', label: 'Orange Money', img: '/src/assets/payment_logos/om.svg' },
        { value: 'MTN_MONEY', label: 'MTN MoMo', img: '/src/assets/payment_logos/mtn.svg' },
        { value: 'MOOV_MONEY', label: 'Moov Money', img: '/src/assets/payment_logos/moov.svg' },
    ];

    const renderPaymentSelector = (selected: string, onSelect: (val: string) => void) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {PAYMENT_OPTIONS.map(opt => (
                <div
                    key={opt.value}
                    onClick={() => onSelect(opt.value)}
                    style={{
                        padding: '8px',
                        border: selected === opt.value ? '2px solid #3498db' : '1px solid #eee',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: selected === opt.value ? '#eaf2f8' : 'white',
                        textAlign: 'center',
                        transition: '0.2s',
                        opacity: selected === opt.value ? 1 : 0.7
                    }}
                >
                    <div style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
                        {opt.img ? (
                            <img src={opt.img} alt={opt.label} style={{ height: '25px', maxWidth: '100%', borderRadius: '4px' }} />
                        ) : (
                            <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div style={{ padding: '20px', background: '#f0f2f5', height: '100%', display: 'flex', gap: '20px' }}>

            {/* LEFT: FORM (Fixed Width & Sticky Button) */}
            <div style={{ flex: '0 0 450px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #eee', background: '#fff' }}>
                    <h2 style={{ margin: 0, color: '#2980b9' }}>📥 Nouveau Versement</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                    <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#34495e', fontSize: '0.9rem' }}>Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#34495e', fontSize: '0.9rem' }}>Caisse de :</label>
                            <div style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8f9fa', color: '#7f8c8d' }}>
                                👤 {currentUser?.nom_complet || 'Utilisateur'}
                            </div>
                        </div>
                    </div>

                    {/* BLOC 1er PAIEMENT */}
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #eee' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#2c3e50' }}>1er Moyen de paiement</label>
                        {renderPaymentSelector(modePaiement, setModePaiement)}
                        <div style={{ marginTop: '10px' }}>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="Montant 1"
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #bdc3c7', fontSize: '18px', fontWeight: 'bold', color: '#333', textAlign: 'right' }}
                            />
                        </div>
                    </div>

                    {/* BLOC 2eme PAIEMENT (OPTIONNEL) */}
                    {useSecondPayment ? (
                        <div style={{ marginBottom: '20px', padding: '15px', background: '#ebf5fb', borderRadius: '10px', border: '1px dashed #3498db' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', color: '#3498db' }}>2ème Moyen de paiement</label>
                                <button onClick={() => { setUseSecondPayment(false); setAmount2("") }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}>❌ Supprimer</button>
                            </div>
                            {renderPaymentSelector(modePaiement2, setModePaiement2)}
                            <div style={{ marginTop: '10px' }}>
                                <input
                                    type="number"
                                    value={amount2}
                                    onChange={e => setAmount2(e.target.value)}
                                    placeholder="Montant 2"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #3498db', fontSize: '18px', fontWeight: 'bold', color: '#3498db', textAlign: 'right' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <button onClick={() => setUseSecondPayment(true)} style={{ background: '#eaf2f8', color: '#3498db', border: '1px dashed #3498db', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
                                + Ajouter un 2ème moyen de paiement
                            </button>
                        </div>
                    )}


                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#34495e', fontSize: '0.9rem' }}>Observation</label>
                        <textarea
                            value={observation}
                            onChange={e => setObservation(e.target.value)}
                            placeholder="Note optionnelle..."
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #bdc3c7', minHeight: '60px', fontFamily: 'inherit' }}
                        />
                    </div>
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #eee', background: '#f9f9f9' }}>
                    <div style={{ textAlign: 'right', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        Total: {((parseFloat(amount) || 0) + (useSecondPayment ? parseFloat(amount2) || 0 : 0)).toLocaleString()} F
                    </div>
                    <button onClick={handleSave} style={{ width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(39, 174, 96, 0.2)', transition: 'transform 0.1s' }}>
                        VALIDER LE VERSEMENT
                    </button>
                </div>
            </div>

            {/* RIGHT: HISTORY LIST */}
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
                                                {h.mode_paiement && <span style={{ fontSize: '0.7rem', background: '#ecf0f1', padding: '2px 5px', borderRadius: '3px', marginLeft: '5px' }}>{h.mode_paiement}</span>}
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
