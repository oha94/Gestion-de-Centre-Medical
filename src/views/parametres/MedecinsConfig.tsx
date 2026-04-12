
import { useState, useEffect, CSSProperties } from "react";
import { getDb } from "../../lib/db";

export default function MedecinsConfig() {
    const [medecins, setMedecins] = useState<any[]>([]);
    const [specialites, setSpecialites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    const [form, setForm] = useState({
        id: null as number | null,
        nom_prenoms: "",
        specialite_id: "",
        telephone: "",
        sexe: "M" as "M" | "F"
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            // --- AUTO REPAIR / MIGRATION ---
            try {
                await db.execute(`
                  CREATE TABLE IF NOT EXISTS app_specialites (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom VARCHAR(100) UNIQUE NOT NULL
                  )
                `);
                await db.execute("ALTER TABLE personnel ADD COLUMN specialite_id INT NULL");
                await db.execute("ALTER TABLE personnel ADD COLUMN is_praticien TINYINT(1) DEFAULT 0");
            } catch (e) { }

            // Load Specialties for dropdown
            const resSpec = await db.select<any[]>("SELECT id, nom FROM app_specialites ORDER BY nom ASC");
            setSpecialites(resSpec);

            // Load clinical staff (is_praticien = 1)
            const resMed = await db.select<any[]>(`
                SELECT p.*, s.nom as specialite_nom 
                FROM personnel p
                LEFT JOIN app_specialites s ON p.specialite_id = s.id
                WHERE p.is_praticien = 1
                ORDER BY p.nom_prenoms ASC
            `);
            setMedecins(resMed);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.nom_prenoms.trim()) return alert("Le nom est obligatoire");
        try {
            const db = await getDb();
            if (form.id) {
                await db.execute(
                    "UPDATE personnel SET nom_prenoms=?, specialite_id=?, telephone=?, sexe=?, is_praticien=1, fonction=? WHERE id=?",
                    [form.nom_prenoms, form.specialite_id || null, form.telephone, form.sexe, "Médecin / Praticien", form.id]
                );
            } else {
                await db.execute(
                    "INSERT INTO personnel (nom_prenoms, specialite_id, telephone, sexe, is_praticien, fonction) VALUES (?, ?, ?, ?, 1, ?)",
                    [form.nom_prenoms, form.specialite_id || null, form.telephone, form.sexe, "Médecin / Praticien"]
                );
            }
            setShowModal(false);
            setForm({ id: null, nom_prenoms: "", specialite_id: "", telephone: "", sexe: "M" });
            loadData();
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'enregistrement");
        }
    };

    const handleEdit = (med: any) => {
        setForm({
            id: med.id,
            nom_prenoms: med.nom_prenoms,
            specialite_id: med.specialite_id || "",
            telephone: med.telephone || "",
            sexe: med.sexe || "M"
        });
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Voulez-vous vraiment retirer ce médecin ?")) return;
        try {
            const db = await getDb();
            // Just unflag as praticien or delete? 
            // Better to delete if they were created here specifically.
            await db.execute("DELETE FROM personnel WHERE id = ?", [id]);
            loadData();
        } catch (e) {
            console.error(e);
            alert("Impossible de supprimer ce médecin (lié à des plannings ou des ventes)");
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ color: '#2c3e50', margin: '0 0 5px 0' }}>🩺 Gestion des Médecins</h2>
                    <p style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>Enregistrez et gérez la liste des médecins du centre.</p>
                </div>
                <button 
                    onClick={() => { setForm({ id: null, nom_prenoms: "", specialite_id: "", telephone: "", sexe: "M" }); setShowModal(true); }}
                    style={{ background: '#3498db', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + Ajouter un Médecin
                </button>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                            <th style={thS}>Nom du Médecin</th>
                            <th style={thS}>Spécialité</th>
                            <th style={thS}>Téléphone</th>
                            <th style={{ ...thS, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center' }}>Chargement...</td></tr>
                        ) : medecins.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#bdc3c7' }}>Aucun médecin enregistré</td></tr>
                        ) : (
                            medecins.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid #fdfdfd' }}>
                                    <td style={tdS}><strong>{m.nom_prenoms}</strong></td>
                                    <td style={tdS}>
                                        <span style={{ background: '#e1f5fe', color: '#0288d1', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {m.specialite_nom || 'Non spécifiée'}
                                        </span>
                                    </td>
                                    <td style={tdS}>{m.telephone || '-'}</td>
                                    <td style={{ ...tdS, textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleEdit(m)}
                                            style={{ background: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', marginRight: '8px', fontSize: '12px' }}
                                        >
                                            Modifier
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(m.id)}
                                            style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Supprimer
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3 style={{ marginTop: 0 }}>{form.id ? 'Modifier Médecin' : 'Ajouter un Médecin'}</h3>
                        
                        <div style={{ display: 'grid', gap: '15px' }}>
                            <div>
                                <label style={labelS}>Nom & Prénoms</label>
                                <input 
                                    value={form.nom_prenoms} 
                                    onChange={e => setForm({...form, nom_prenoms: e.target.value})}
                                    placeholder="Ex: Dr. Moussa Traoré"
                                    style={inputStyle}
                                />
                            </div>
                            
                            <div>
                                <label style={labelS}>Spécialité</label>
                                <select 
                                    value={form.specialite_id} 
                                    onChange={e => setForm({...form, specialite_id: e.target.value})}
                                    style={inputStyle}
                                >
                                    <option value="">-- Choisir une spécialité --</option>
                                    {specialites.map(s => (
                                        <option key={s.id} value={s.id}>{s.nom}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={labelS}>Téléphone</label>
                                    <input 
                                        value={form.telephone} 
                                        onChange={e => setForm({...form, telephone: e.target.value})}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelS}>Sexe</label>
                                    <select 
                                        value={form.sexe} 
                                        onChange={e => setForm({...form, sexe: e.target.value as any})}
                                        style={inputStyle}
                                    >
                                        <option value="M">Homme</option>
                                        <option value="F">Femme</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowModal(false)} style={btnCancelSmall}>Annuler</button>
                            <button onClick={handleSave} style={{ ...btnSaveSmall, padding: '10px 20px', fontSize: '1rem' }}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const thS: CSSProperties = { padding: '15px', color: '#7f8c8d', fontSize: '0.85rem', textTransform: 'uppercase' };
const tdS: CSSProperties = { padding: '15px' };
const modalOverlay: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent: CSSProperties = { background: 'white', padding: '30px', borderRadius: '15px', width: '450px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' };
const labelS: CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '5px' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', outline: 'none' };
const btnSaveSmall: CSSProperties = { background: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnCancelSmall: CSSProperties = { background: '#95a5a6', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer' };
