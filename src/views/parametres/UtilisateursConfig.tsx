import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function UtilisateursConfig({ onChangeView }: { onChangeView?: (view: string) => void }) {
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [personnels, setPersonnels] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({
    nom_complet: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    role_id: "",
    telephone: "",
    actif: true,
    personnel_id: ""
  });

  useEffect(() => {
    initDb();
    chargerDonnees();
  }, []);

  const initDb = async () => {
    try {
      const db = await getDb();
      try {
        await db.execute("ALTER TABLE app_utilisateurs ADD COLUMN personnel_id INT NULL");
      } catch (e) { /* Column might exist */ }
    } catch (e) {
      console.error("Init User DB Error:", e);
    }
  };

  const chargerDonnees = async () => {
    try {
      const db = await getDb();

      // Charger les utilisateurs
      const resUsers = await db.select<any[]>(`
        SELECT u.id, u.nom_complet, u.username, u.email, u.telephone,
               u.actif, u.derniere_connexion, u.created_at,
               r.nom as role_nom, r.couleur as role_couleur
        FROM app_utilisateurs u
        LEFT JOIN app_roles r ON u.role_id = r.id
        ORDER BY u.nom_complet ASC
      `);
      setUtilisateurs(resUsers);

      // Charger les rôles
      const resRoles = await db.select<any[]>(`
        SELECT * FROM app_roles WHERE actif = TRUE ORDER BY nom ASC
      `);
      setRoles(resRoles);

      // Charger le personnel (ceux qui n'ont pas encore de compte utilisateur)
      const resPers = await db.select<any[]>(`
        SELECT p.* FROM personnel p
        WHERE p.id NOT IN (SELECT personnel_id FROM app_utilisateurs WHERE personnel_id IS NOT NULL)
        ORDER BY p.nom_prenoms ASC
      `);
      setPersonnels(resPers);

    } catch (e) {
      console.error("Erreur chargement:", e);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (field === 'personnel_id' && value) {
      const selected = personnels.find(p => p.id === parseInt(value));
      if (selected) {
        setFormData({
          ...formData,
          personnel_id: value,
          nom_complet: selected.nom_prenoms,
          telephone: selected.telephone || ""
        });
        return;
      }
    }
    setFormData({ ...formData, [field]: value });
  };

  const resetForm = () => {
    setFormData({
      nom_complet: "",
      username: "",
      email: "",
      password: "",
      confirm_password: "",
      role_id: "",
      telephone: "",
      actif: true,
      personnel_id: ""
    });
    setEditMode(false);
    setShowForm(false);
  };

  const creerUtilisateur = async () => {
    // Validations
    if (!formData.nom_complet || !formData.username || !formData.role_id) {
      return alert("❌ Nom complet, nom d'utilisateur et rôle sont obligatoires");
    }

    if (!editMode && !formData.password) {
      return alert("❌ Le mot de passe est obligatoire");
    }

    if (formData.password && formData.password !== formData.confirm_password) {
      return alert("❌ Les mots de passe ne correspondent pas");
    }

    try {
      const db = await getDb();

      if (editMode) {
        // Mise à jour
        const updates = [
          formData.nom_complet,
          formData.username,
          formData.email,
          formData.role_id,
          formData.telephone,
          formData.actif ? 1 : 0,
          formData.id
        ];

        let query = `
          UPDATE app_utilisateurs 
          SET nom_complet = ?, username = ?, email = ?, role_id = ?,
              telephone = ?, actif = ?
        `;

        // Si un nouveau mot de passe est fourni
        if (formData.password) {
          query += `, password_hash = ?`;
          updates.splice(6, 0, formData.password); // Hash en production !
        }

        query += ` WHERE id = ?`;

        await db.execute(query, updates);
        alert("✅ Utilisateur modifié avec succès !");

      } else {
        // Vérifier que le username n'existe pas déjà
        const existing = await db.select<any[]>(
          "SELECT id FROM app_utilisateurs WHERE username = ?",
          [formData.username]
        );

        if (existing.length > 0) {
          return alert("❌ Ce nom d'utilisateur existe déjà");
        }

        // Création
        await db.execute(`
          INSERT INTO app_utilisateurs 
          (nom_complet, username, email, password_hash, role_id, telephone, actif, personnel_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          formData.nom_complet,
          formData.username,
          formData.email,
          formData.password, // À hasher en production !
          formData.role_id,
          formData.telephone,
          formData.actif ? 1 : 0,
          formData.personnel_id || null
        ]);

        alert("✅ Utilisateur créé avec succès !");
      }

      resetForm();
      chargerDonnees();

    } catch (e) {
      console.error("Erreur:", e);
      alert("❌ Erreur lors de l'opération");
    }
  };

  const editerUtilisateur = (user: any) => {
    setFormData({
      id: user.id,
      nom_complet: user.nom_complet,
      username: user.username,
      email: user.email || "",
      password: "",
      confirm_password: "",
      role_id: user.role_id,
      telephone: user.telephone || "",
      actif: Boolean(user.actif)
    });
    setEditMode(true);
    setShowForm(true);
  };

  const supprimerUtilisateur = async (id: number, username: string) => {
    if (username === 'admin') {
      return alert("❌ Impossible de supprimer le compte administrateur principal");
    }

    if (!window.confirm("⚠️ Supprimer cet utilisateur ?\n\nCette action est irréversible.")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM app_utilisateurs WHERE id = ?", [id]);
      alert("✅ Utilisateur supprimé");
      chargerDonnees();
    } catch (e) {
      console.error("Erreur suppression:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  const toggleActif = async (id: number, actif: boolean) => {
    try {
      const db = await getDb();
      await db.execute(
        "UPDATE app_utilisateurs SET actif = ? WHERE id = ?",
        [actif ? 0 : 1, id]
      );
      chargerDonnees();
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>👥 Gestion des Utilisateurs</h2>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            {utilisateurs.length} utilisateur{utilisateurs.length > 1 ? 's' : ''} enregistré{utilisateurs.length > 1 ? 's' : ''}
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: '#27ae60',
              color: 'white',
              border: 'none',
              padding: '12px 25px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '15px'
            }}
          >
            ➕ Nouvel Utilisateur
          </button>
        )}
      </div>

      {/* Formulaire de création/modification */}
      {showForm && (
        <div style={{
          background: '#fff3cd',
          padding: '25px',
          borderRadius: '10px',
          marginBottom: '25px',
          border: '2px solid #ffc107'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#856404' }}>
            {editMode ? '✏️ Modifier l\'utilisateur' : '➕ Nouvel utilisateur'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {!editMode && (
              <div style={{ gridColumn: 'span 2', background: '#e8f4fd', padding: '15px', borderRadius: '8px', border: '1px solid #3498db' }}>
                <label style={{ ...labelStyle, color: '#2980b9' }}>📋 Importer depuis le personnel (Optionnel)</label>
                <select
                  value={formData.personnel_id}
                  onChange={e => handleChange('personnel_id', e.target.value)}
                  style={{ ...inputStyle, border: '1px solid #3498db' }}
                >
                  <option value="">-- Créer un compte pour un membre du personnel --</option>
                  {personnels.map(p => (
                    <option key={p.id} value={p.id}>{p.nom_prenoms} ({p.fonction})</option>
                  ))}
                </select>
                <small style={{ color: '#2980b9' }}>Sélectionnez un membre pour remplir automatiquement ses informations.</small>
              </div>
            )}

            <div>
              <label style={labelStyle}>Nom Complet *</label>
              <input
                value={formData.nom_complet}
                onChange={e => handleChange('nom_complet', e.target.value)}
                style={inputStyle}
                placeholder="Ex: Dr. Jean Kouassi"
                disabled={!!formData.personnel_id && !editMode}
              />
            </div>

            <div>
              <label style={labelStyle}>Nom d'utilisateur * (login)</label>
              <input
                value={formData.username}
                onChange={e => handleChange('username', e.target.value)}
                style={inputStyle}
                placeholder="Ex: jkouassi"
                disabled={editMode}
              />
              {editMode && (
                <small style={{ color: '#856404', fontSize: '11px' }}>
                  ⚠️ Le nom d'utilisateur ne peut pas être modifié
                </small>
              )}
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                style={inputStyle}
                placeholder="email@exemple.com"
              />
            </div>

            <div>
              <label style={labelStyle}>Téléphone</label>
              <input
                value={formData.telephone}
                onChange={e => handleChange('telephone', e.target.value)}
                style={inputStyle}
                placeholder="+225 XX XX XX XX XX"
              />
            </div>

            <div>
              <label style={labelStyle}>Mot de passe {!editMode && '*'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={e => handleChange('password', e.target.value)}
                style={inputStyle}
                placeholder={editMode ? "Laisser vide si inchangé" : "Saisir le mot de passe"}
              />
            </div>

            <div>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                value={formData.confirm_password}
                onChange={e => handleChange('confirm_password', e.target.value)}
                style={inputStyle}
                placeholder="Confirmer le mot de passe"
              />
            </div>

            <div>
              <label style={labelStyle}>Rôle *</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <select
                  value={formData.role_id}
                  onChange={e => handleChange('role_id', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Sélectionner un rôle --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nom}</option>
                  ))}
                </select>
                {onChangeView && (
                  <button
                    onClick={() => onChangeView('roles')}
                    title="Gérer les rôles"
                    style={{
                      background: '#ecf0f1', border: '1px solid #bdc3c7', borderRadius: '5px', cursor: 'pointer', padding: '0 10px'
                    }}
                  >
                    ⚙️
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.actif}
                  onChange={e => handleChange('actif', e.target.checked)}
                  style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: '#856404' }}>Compte actif</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button
              onClick={resetForm}
              style={{
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ✕ Annuler
            </button>
            <button
              onClick={creerUtilisateur}
              style={{
                background: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '10px 30px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✓ {editMode ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#2c3e50', color: 'white' }}>
              <th style={thStyle}>Utilisateur</th>
              <th style={thStyle}>Login</th>
              <th style={thStyle}>Rôle</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Dernière connexion</th>
              <th style={thStyle}>Statut</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.length > 0 ? (
              utilisateurs.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                  <td style={tdStyle}>
                    <strong>{user.nom_complet}</strong>
                  </td>
                  <td style={tdStyle}>
                    <code style={{ background: '#ecf0f1', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' }}>
                      {user.username}
                    </code>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: user.role_couleur || '#95a5a6',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {user.role_nom || 'Aucun rôle'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '13px' }}>
                      {user.email && <div>📧 {user.email}</div>}
                      {user.telephone && <div>📞 {user.telephone}</div>}
                      {!user.email && !user.telephone && <span style={{ color: '#95a5a6' }}>-</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {user.derniere_connexion ? (
                      <small>{new Date(user.derniere_connexion).toLocaleString('fr-FR')}</small>
                    ) : (
                      <small style={{ color: '#95a5a6' }}>Jamais</small>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => toggleActif(user.id, user.actif)}
                      style={{
                        background: user.actif ? '#27ae60' : '#e74c3c',
                        color: 'white',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {user.actif ? '✓ Actif' : '✕ Inactif'}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => editerUtilisateur(user)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3498db',
                        cursor: 'pointer',
                        fontSize: '18px',
                        marginRight: '8px'
                      }}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => supprimerUtilisateur(user.id, user.username)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#e74c3c',
                        cursor: 'pointer',
                        fontSize: '18px'
                      }}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
                  <div>Aucun utilisateur</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Note importante */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#d1ecf1',
        border: '1px solid #bee5eb',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0c5460'
      }}>
        <strong>💡 Note importante :</strong> Les mots de passe sont stockés en clair dans cette version V1.
        En production, ils doivent être hashés (bcrypt, Argon2, etc.).
      </div>
    </div>
  );
}

// Styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '5px',
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#555'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const thStyle: React.CSSProperties = {
  padding: '12px 10px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 'bold'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: '14px'
};