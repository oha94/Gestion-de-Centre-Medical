import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import { DateTravailManager } from "../services/DateTravailManager";

interface Planning {
    id?: number;
    medecin_id: number;
    date_jour: string;
    shift: string;
    notes: string;
    heure_debut?: string;
    heure_fin?: string;
    medecin_nom?: string;
}

interface Personnel {
    id: number;
    nom_prenoms: string;
    fonction: string;
}

export default function AgendaView() {
    const [plannings, setPlannings] = useState<Planning[]>([]);
    const [personnels, setPersonnels] = useState<Personnel[]>([]);
    const [selectedDate, setSelectedDate] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [currentPlanning, setCurrentPlanning] = useState<Partial<Planning>>({
        shift: 'MATIN',
        heure_debut: '',
        heure_fin: ''
    });

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const today = await DateTravailManager.getDateTravail();
        setSelectedDate(today);
        await loadData(today);
    };

    const loadData = async (date: string) => {
        try {
            const db = await getDb();
            
            // Load Doctors/Praticiens
            const resPers = await db.select<Personnel[]>(`
                SELECT p.id, p.nom_prenoms, COALESCE(s.nom, p.fonction) as fonction 
                FROM personnel p
                LEFT JOIN app_specialites s ON p.specialite_id = s.id
                WHERE p.is_praticien = 1 OR p.fonction LIKE '%Médecin%' OR p.fonction LIKE '%Kiné%'
            `);
            setPersonnels(resPers);

            // Load Planning for the week around selected date
            const resPlan = await db.select<any[]>(`
                SELECT p.*, COALESCE(pers.nom_prenoms, u.nom_complet) as medecin_nom
                FROM planning_medecins p
                LEFT JOIN personnel pers ON p.medecin_id = pers.id
                LEFT JOIN app_utilisateurs u ON p.medecin_id = u.id
                WHERE p.date_jour BETWEEN DATE_SUB(?, INTERVAL 3 DAY) AND DATE_ADD(?, INTERVAL 7 DAY)
                ORDER BY p.date_jour ASC, p.shift ASC
            `, [date, date]);
            setPlannings(resPlan);
        } catch (e) {
            console.error(e);
        } finally {
        }
    };

    const handleSave = async () => {
        if (!currentPlanning.medecin_id || !currentPlanning.date_jour || !currentPlanning.shift) {
            return alert("Veuillez remplir tous les champs obligatoires");
        }
        try {
            const db = await getDb();
            if (currentPlanning.id) {
                await db.execute(
                    "UPDATE planning_medecins SET medecin_id=?, date_jour=?, shift=?, notes=?, heure_debut=?, heure_fin=? WHERE id=?",
                    [currentPlanning.medecin_id, currentPlanning.date_jour, currentPlanning.shift, currentPlanning.notes || '', currentPlanning.heure_debut || '', currentPlanning.heure_fin || '', currentPlanning.id]
                );
            } else {
                await db.execute(
                    "INSERT INTO planning_medecins (medecin_id, date_jour, shift, notes, heure_debut, heure_fin) VALUES (?, ?, ?, ?, ?, ?)",
                    [currentPlanning.medecin_id, currentPlanning.date_jour, currentPlanning.shift, currentPlanning.notes || '', currentPlanning.heure_debut || '', currentPlanning.heure_fin || '']
                );
            }
            setShowModal(false);
            loadData(selectedDate);
        } catch (e) {
            alert("Erreur lors de l'enregistrement");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer cette garde ?")) return;
        try {
            const db = await getDb();
            await db.execute("DELETE FROM planning_medecins WHERE id=?", [id]);
            loadData(selectedDate);
        } catch (e) {
            alert("Erreur suppression");
        }
    };

    const getShiftColor = (shift: string) => {
        switch (shift) {
            case 'MATIN': return '#3498db';
            case 'SOIR': return '#e67e22';
            case 'NUIT': return '#2c3e50';
            case 'GARDE': return '#e74c3c';
            default: return '#7f8c8d';
        }
    };

    // Logic to group plannings by date for a calendar view or list
    const days = [];
    if (selectedDate) {
        try {
            const baseDate = new Date(selectedDate);
            if (!isNaN(baseDate.getTime())) {
                for (let i = -1; i < 6; i++) {
                    const d = new Date(baseDate);
                    d.setDate(baseDate.getDate() + i);
                    days.push(d.toISOString().split('T')[0]);
                }
            }
        } catch (e) {
            console.error("Invalid base date in Agenda:", selectedDate);
        }
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#2c3e50' }}>📅 Agenda & Gardes Médicales</h1>
                    <p style={{ margin: 0, color: '#7f8c8d' }}>Gestion du planning et des présences</p>
                </div>
                <button 
                    onClick={() => { setCurrentPlanning({ date_jour: selectedDate, shift: 'MATIN' }); setShowModal(true); }}
                    style={{ background: '#27ae60', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                >
                    + Programmer une Garde
                </button>
            </div>

            <div style={{ background: 'white', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <span>📅 Aller à la date :</span>
                <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => { setSelectedDate(e.target.value); loadData(e.target.value); }}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {days.map(day => {
                    const dayPlannings = plannings.filter(p => p.date_jour === day);
                    const isToday = day === new Date().toISOString().split('T')[0];
                    
                    return (
                        <div key={day} style={{ background: 'white', borderRadius: '12px', border: isToday ? '2px solid #3498db' : '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <div style={{ background: isToday ? '#3498db' : '#f8f9fa', padding: '12px', color: isToday ? 'white' : '#2c3e50', borderBottom: '1px solid #eee', fontWeight: 'bold', textAlign: 'center' }}>
                                {(() => {
                                    try {
                                        const dateObj = new Date(day);
                                        return isNaN(dateObj.getTime()) ? day : dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                                    } catch(e) { return day; }
                                })()}
                                {isToday && " (Aujourd'hui)"}
                            </div>
                            <div style={{ padding: '15px', minHeight: '150px' }}>
                                {dayPlannings.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#bdc3c7', marginTop: '40px', fontSize: '0.9rem' }}>Aucun planning</div>
                                ) : (
                                    dayPlannings.map(p => (
                                        <div key={p.id} style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px', borderLeft: `4px solid ${getShiftColor(p.shift)}`, background: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{p.medecin_nom}</div>
                                                <div style={{ fontSize: '0.85rem', color: getShiftColor(p.shift), fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {p.shift}
                                                    {(p.heure_debut || p.heure_fin) && (
                                                        <span style={{ fontSize: '0.8rem', color: '#2c3e50', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
                                                            🕒 {p.heure_debut || '?'} - {p.heure_fin || '?'}
                                                        </span>
                                                    )}
                                                </div>
                                                {p.notes && <div style={{ fontSize: '0.75rem', color: '#7f8c8d', fontStyle: 'italic', marginTop: '3px' }}>{p.notes}</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => { setCurrentPlanning(p); setShowModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                                                <button onClick={() => handleDelete(p.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ marginTop: 0 }}>{currentPlanning.id ? 'Modifier la Garde' : 'Nouvelle Garde'}</h2>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Date</label>
                            <input 
                                type="date" 
                                value={currentPlanning.date_jour} 
                                onChange={e => setCurrentPlanning({...currentPlanning, date_jour: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Médecin / Praticien</label>
                            <select 
                                value={currentPlanning.medecin_id} 
                                onChange={e => setCurrentPlanning({...currentPlanning, medecin_id: parseInt(e.target.value)})}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            >
                                <option value="">-- Choisir un praticien --</option>
                                {personnels.map(p => (
                                    <option key={p.id} value={p.id}>{p.nom_prenoms} ({p.fonction})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Heure Début</label>
                                <input 
                                    type="time" 
                                    value={currentPlanning.heure_debut} 
                                    onChange={e => setCurrentPlanning({...currentPlanning, heure_debut: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Heure Fin</label>
                                <input 
                                    type="time" 
                                    value={currentPlanning.heure_fin} 
                                    onChange={e => setCurrentPlanning({...currentPlanning, heure_fin: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Notes / Consignes particuliers</label>
                            <textarea 
                                value={currentPlanning.notes} 
                                onChange={e => setCurrentPlanning({...currentPlanning, notes: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: 'none' }}>Annuler</button>
                            <button onClick={handleSave} style={{ padding: '10px 25px', borderRadius: '8px', border: 'none', background: '#2c3e50', color: 'white', fontWeight: 'bold' }}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
