import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

interface Personnel {
    id: number;
    nom_prenoms: string;
    telephone: string;
    sexe: 'M' | 'F';
    quartier: string;
    fonction: string;
    date_creation: string;
}

export default function PersonnelConfig() {
    const [personnels, setPersonnels] = useState<Personnel[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [current, setCurrent] = useState<Partial<Personnel>>({});
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        initDb();
    }, []);

    const initDb = async () => {
        try {
            const db = await getDb();
            // Migration: Create personnel table
            await db.execute(`
                CREATE TABLE IF NOT EXISTS personnel (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom_prenoms VARCHAR(255) NOT NULL,
                    telephone VARCHAR(50),
                    sexe ENUM('M', 'F'),
                    quartier VARCHAR(255),
                    fonction VARCHAR(255),
                    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add personnel_id to ventes if not exists
            try {
                await db.execute("ALTER TABLE ventes ADD COLUMN personnel_id INT NULL");
            } catch (e) { /* Column might exist */ }

            loadPersonnel();
        } catch (e) {
            console.error("Init Personnel DB Error:", e);
        }
    };

    const loadPersonnel = async () => {
        try {
            const db = await getDb();
            // Union of manual personnel and system users
            const res = await db.select<Personnel[]>(`
                SELECT id, nom_prenoms, telephone, sexe, quartier, fonction, date_creation, 'MANUEL' as origine
                FROM personnel
                UNION
                SELECT u.id, u.nom_complet COLLATE utf8mb4_unicode_ci as nom_prenoms, 
                       u.telephone COLLATE utf8mb4_unicode_ci as telephone, 
                       'M' as sexe, '' as quartier, 
                       r.nom COLLATE utf8mb4_unicode_ci as fonction, 
                       u.created_at as date_creation, 'USER' as origine
                FROM app_utilisateurs u
                LEFT JOIN app_roles r ON u.role_id = r.id
                ORDER BY nom_prenoms
            `);
            setPersonnels(res);
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        if (!current.nom_prenoms) return alert("Nom et prénoms obligatoires");
        try {
            const db = await getDb();
            if (current.id) {
                await db.execute(
                    "UPDATE personnel SET nom_prenoms=?, telephone=?, sexe=?, quartier=?, fonction=? WHERE id=?",
                    [current.nom_prenoms, current.telephone, current.sexe, current.quartier, current.fonction, current.id]
                );
            } else {
                await db.execute(
                    "INSERT INTO personnel (nom_prenoms, telephone, sexe, quartier, fonction) VALUES (?, ?, ?, ?, ?)",
                    [current.nom_prenoms, current.telephone, current.sexe, current.quartier, current.fonction]
                );
            }
            setShowModal(false);
            setCurrent({});
            loadPersonnel();
        } catch (e) { alert("Erreur lors de l'enregistrement"); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer ce membre du personnel ?")) return;
        try {
            const db = await getDb();
            await db.execute("DELETE FROM personnel WHERE id=?", [id]);
            loadPersonnel();
        } catch (e) { alert("Impossible de supprimer : peut-être lié à des ventes"); }
    };

    const filtered = personnels.filter(p =>
        p.nom_prenoms.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.fonction.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '0px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>👥 Gestion du Personnel</h2>
                <button
                    onClick={() => { setCurrent({ sexe: 'M' }); setShowModal(true); }}
                    style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + Nouveau Personnel
                </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input
                    placeholder="🔍 Rechercher par nom ou fonction..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
            </div>

            <div style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8f9fa' }}>
                        <tr>
                            <th style={thS}>Nom & Prénoms</th>
                            <th style={thS}>Fonction</th>
                            <th style={thS}>Téléphone</th>
                            <th style={thS}>Sexe</th>
                            <th style={thS}>Quartier</th>
                            <th style={thS}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f1f1' }}>
                                <td style={tdS}>
                                    <strong>{p.nom_prenoms}</strong>
                                    {(p as any).origine === 'USER' && (
                                        <span style={{ marginLeft: '10px', background: '#3498db', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💻 SYSTEME
                                        </span>
                                    )}
                                </td>
                                <td style={tdS}>
                                    <div style={{ fontWeight: (p as any).origine === 'USER' ? 'bold' : 'normal', color: (p as any).origine === 'USER' ? '#2980b9' : 'inherit' }}>
                                        {p.fonction || 'Utilisateur Système'}
                                    </div>
                                </td>
                                <td style={tdS}>{p.telephone || '-'}</td>
                                <td style={tdS}>{p.sexe === 'M' ? '♂️ Homme' : '♀️ Femme'}</td>
                                <td style={tdS}>{p.quartier || '-'}</td>
                                <td style={tdS}>
                                    <button onClick={() => { setCurrent(p); setShowModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✏️</button>
                                    <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '10px' }}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3>{current.id ? 'Modifier Personnel' : 'Ajouter un Personnel'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={lbl}>Nom & Prénoms</label>
                                <input style={inp} value={current.nom_prenoms || ''} onChange={e => setCurrent({ ...current, nom_prenoms: e.target.value })} />
                            </div>
                            <div>
                                <label style={lbl}>Fonction</label>
                                <select style={inp} value={current.fonction || ''} onChange={e => setCurrent({ ...current, fonction: e.target.value })}>
                                    <option value="">-- Sélectionner --</option>
                                    <option value="Médecin Généraliste">Médecin Généraliste</option>
                                    <option value="Médecin Spécialiste">Médecin Spécialiste</option>
                                    <option value="Infirmier(e)">Infirmier(e)</option>
                                    <option value="Aide-Soignant(e)">Aide-Soignant(e)</option>
                                    <option value="Sage-Femme">Sage-Femme</option>
                                    <option value="Pharmacien(ne)">Pharmacien(ne)</option>
                                    <option value="Préparateur en Pharmacie">Préparateur en Pharmacie</option>
                                    <option value="Laborantin(e)">Laborantin(e)</option>
                                    <option value="Réceptionniste">Réceptionniste</option>
                                    <option value="Caissier(e)">Caissier(e)</option>
                                    <option value="Comptable">Comptable</option>
                                    <option value="Technicien de Surface">Technicien de Surface</option>
                                    <option value="Agent de Sécurité">Agent de Sécurité</option>
                                    <option value="Administrateur">Administrateur</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Téléphone</label>
                                <input style={inp} value={current.telephone || ''} onChange={e => setCurrent({ ...current, telephone: e.target.value })} />
                            </div>
                            <div>
                                <label style={lbl}>Sexe</label>
                                <select style={inp} value={current.sexe} onChange={e => setCurrent({ ...current, sexe: e.target.value as any })}>
                                    <option value="M">Masculin</option>
                                    <option value="F">Féminin</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Quartier (Habitation)</label>
                                <input style={inp} value={current.quartier || ''} onChange={e => setCurrent({ ...current, quartier: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer' }}>Annuler</button>
                            <button onClick={handleSave} style={{ padding: '10px 25px', borderRadius: '8px', border: 'none', background: '#2c3e50', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const thS: React.CSSProperties = { padding: '15px', textAlign: 'left', color: '#7f8c8d', fontSize: '0.85rem', textTransform: 'uppercase' };
const tdS: React.CSSProperties = { padding: '15px', color: '#2c3e50' };
const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent: React.CSSProperties = { background: 'white', padding: '30px', borderRadius: '15px', width: '500px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#95a5a6', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' };
