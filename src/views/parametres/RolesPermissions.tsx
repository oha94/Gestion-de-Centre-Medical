import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function RolesPermissions() {
  const [roles, setRoles] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [permissions, setPermissions] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    couleur: "#3498db",
    actif: true,
    can_delete: true,
    can_edit: true,
    can_print: true
  });

  useEffect(() => {
    checkAndMigrateSchema().then(() => chargerDonnees());
  }, []);

  const checkAndMigrateSchema = async () => {
    try {
      const db = await getDb();
      // 1. Add 'can_print' column if missing
      try {
        await db.execute("SELECT can_print FROM app_roles LIMIT 1");
      } catch {
        await db.execute("ALTER TABLE app_roles ADD COLUMN can_print BOOLEAN DEFAULT TRUE");
        console.log("Schema updated: 'can_print' added.");
      }

      // 2. Add 'GESTIONNAIRE' role if missing
      const gestionnaire = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Gestionnaire'");
      if (gestionnaire.length === 0) {
        await db.execute(
          "INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ['Gestionnaire', 'Gère les stocks et les commandes', '#e67e22', 1, 0, 1, 1]
        );
        console.log("Role 'Gestionnaire' created.");
      }
      // 3. Clean up duplicates in app_role_permissions
      await db.execute(`
        DELETE t1 FROM app_role_permissions t1
        INNER JOIN app_role_permissions t2 
        WHERE t1.id > t2.id AND t1.role_id = t2.role_id AND t1.menu_id = t2.menu_id
      `);

      // 4. Ensure Unique Index
      try {
        await db.execute("CREATE UNIQUE INDEX idx_role_menu ON app_role_permissions (role_id, menu_id)");
      } catch (e) {
        // Ignore if exists
      }

      // 5. FIX: Ensure ID is AUTO_INCREMENT (Common fatal error 1364)
      try {
        // Step A: Ensure ID is a Key (Primary) - Required before Auto Increment
        try {
          await db.execute("ALTER TABLE app_role_permissions ADD PRIMARY KEY (id)");
        } catch (e: any) {
          // Ignore if already exists (error 1068 or similar)
        }

        // Step B: Now set Auto Increment
        await db.execute("ALTER TABLE app_role_permissions MODIFY COLUMN id INTEGER NOT NULL AUTO_INCREMENT");
      } catch (e) {
        // Might fail if not MySQL or already correct
        console.warn("Auto-increment fix skipped/failed:", e);
      }
    } catch (e) {
      console.error("Schema check failed:", e);
    }
  };

  const chargerDonnees = async () => {
    try {
      const db = await getDb();

      // Charger les rôles
      const resRoles = await db.select<any[]>("SELECT * FROM app_roles ORDER BY nom ASC");
      setRoles(resRoles);

      // Charger les menus
      const resMenus = await db.select<any[]>(`
        SELECT * FROM app_menus 
        WHERE actif = TRUE 
        ORDER BY categorie ASC, ordre ASC
      `);
      setMenus(resMenus);

    } catch (e) {
      console.error("Erreur chargement:", e);
    }
  };

  const chargerPermissions = async (roleId: number) => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT menu_id FROM app_role_permissions WHERE role_id = ?
      `, [roleId]);

      setPermissions(res.map((p: any) => p.menu_id));
    } catch (e) {
      console.error("Erreur chargement permissions:", e);
    }
  };

  const selectionnerRole = async (role: any) => {
    setSelectedRole(role);
    await chargerPermissions(role.id);
  };

  const toggleRoleOption = async (field: 'can_delete' | 'can_edit' | 'can_print') => {
    if (!selectedRole) return;

    // Handle both 1/0 and true/false
    const currentVal = selectedRole[field];
    const isTruthy = currentVal === 1 || currentVal === true;
    const newValue = isTruthy ? 0 : 1;

    try {
      const db = await getDb();
      await db.execute(`UPDATE app_roles SET ${field} = ? WHERE id = ?`, [newValue, selectedRole.id]);

      // Update local state
      const updatedRole = { ...selectedRole, [field]: newValue };
      setSelectedRole(updatedRole);

      // Update list state
      setRoles(roles.map(r => r.id === selectedRole.id ? updatedRole : r));

    } catch (e) {
      console.error("Erreur update role option:", e);
    }
  };

  const togglePermission = async (menuId: number) => {
    if (!selectedRole) return;

    try {
      const db = await getDb();

      if (permissions.includes(menuId)) {
        // Retirer la permission
        await db.execute(
          "DELETE FROM app_role_permissions WHERE role_id = ? AND menu_id = ?",
          [selectedRole.id, menuId]
        );
        setPermissions(permissions.filter(id => id !== menuId));
      } else {
        // Ajouter la permission
        await db.execute(
          "INSERT INTO app_role_permissions (role_id, menu_id) VALUES (?, ?)",
          [selectedRole.id, menuId]
        );
        setPermissions([...permissions, menuId]);
      }
    } catch (e: any) {
      console.error("Erreur toggle permission:", e);
      alert("❌ Erreur lors de la modification de la permission : " + e.message);
    }
  };

  const creerRole = async () => {
    if (!formData.nom) {
      return alert("❌ Le nom du rôle est obligatoire");
    }

    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [formData.nom, formData.description, formData.couleur, formData.actif ? 1 : 0, formData.can_delete ? 1 : 0, formData.can_edit ? 1 : 0, formData.can_print ? 1 : 0]
      );

      alert("✅ Rôle créé avec succès !");
      setShowForm(false);
      setFormData({ nom: "", description: "", couleur: "#3498db", actif: true, can_delete: true, can_edit: true, can_print: true });
      chargerDonnees();
    } catch (e) {
      console.error("Erreur création rôle:", e);
      alert("❌ Erreur lors de la création du rôle");
    }
  };

  const supprimerRole = async (id: number, nom: string) => {
    if (nom === 'Administrateur') {
      return alert("❌ Impossible de supprimer le rôle Administrateur");
    }

    if (!window.confirm(`⚠️ Supprimer le rôle "${nom}" ?\n\nLes utilisateurs avec ce rôle perdront leurs accès.`)) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM app_role_permissions WHERE role_id = ?", [id]);
      await db.execute("DELETE FROM app_roles WHERE id = ?", [id]);
      alert("✅ Rôle supprimé");

      if (selectedRole?.id === id) {
        setSelectedRole(null);
        setPermissions([]);
      }

      chargerDonnees();
    } catch (e) {
      console.error("Erreur suppression:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  const toutCocher = async () => {
    if (!selectedRole) return;

    try {
      const db = await getDb();

      // Supprimer toutes les permissions existantes
      await db.execute("DELETE FROM app_role_permissions WHERE role_id = ?", [selectedRole.id]);

      // Ajouter toutes les permissions
      for (const menu of menus) {
        await db.execute(
          "INSERT INTO app_role_permissions (role_id, menu_id) VALUES (?, ?)",
          [selectedRole.id, menu.id]
        );
      }

      setPermissions(menus.map(m => m.id));
      alert("✅ Toutes les permissions accordées !");
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const toutDecocher = async () => {
    if (!selectedRole) return;

    if (!window.confirm("⚠️ Retirer toutes les permissions ?")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM app_role_permissions WHERE role_id = ?", [selectedRole.id]);
      setPermissions([]);
      alert("✅ Toutes les permissions retirées");
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  // Grouper les menus par catégorie
  const menusParCategorie = menus.reduce((acc: any, menu: any) => {
    const cat = menu.categorie || 'Autres';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(menu);
    return acc;
  }, {});

  return (
    <div>
      <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
        🔐 Rôles & Permissions
      </h2>
      <p style={{ color: '#7f8c8d', marginBottom: '25px' }}>
        Créez des rôles et attribuez les menus accessibles pour chaque rôle
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
        {/* Liste des rôles */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>📋 Rôles</h3>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '8px 15px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ➕ Nouveau
              </button>
            )}
          </div>

          {/* Formulaire création rôle */}
          {showForm && (
            <div style={{
              background: '#e8f6ef',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '2px solid #27ae60'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>Nouveau Rôle</h4>

              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Nom *</label>
                <input
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  style={inputStyle}
                  placeholder="Ex: Gestionnaire"
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                  placeholder="Description du rôle..."
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.actif}
                    onChange={e => setFormData({ ...formData, actif: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginRight: '10px' }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#27ae60' }}>Rôle activé</span>
                </label>
              </div>

              <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.can_delete}
                    onChange={e => setFormData({ ...formData, can_delete: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginRight: '5px' }}
                  />
                  <span style={{ fontSize: '13px', color: '#e74c3c' }}>Droit de suppression</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.can_edit}
                    onChange={e => setFormData({ ...formData, can_edit: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginRight: '5px' }}
                  />
                  <span style={{ fontSize: '13px', color: '#e67e22' }}>Droit de modification</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.can_print}
                    onChange={e => setFormData({ ...formData, can_print: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginRight: '5px' }}
                  />
                  <span style={{ fontSize: '13px', color: '#2980b9' }}>Droit d'impression</span>
                </label>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Couleur</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="color"
                    value={formData.couleur}
                    onChange={e => setFormData({ ...formData, couleur: e.target.value })}
                    style={{ width: '50px', height: '35px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.couleur}
                    onChange={e => setFormData({ ...formData, couleur: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ nom: "", description: "", couleur: "#3498db", actif: true, can_delete: true, can_edit: true, can_print: true });
                  }}
                  style={{
                    background: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={creerRole}
                  style={{
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    flex: 1
                  }}
                >
                  Créer
                </button>
              </div>
            </div>
          )}

          {/* Liste des rôles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => selectionnerRole(role)}
                style={{
                  padding: '12px',
                  background: selectedRole?.id === role.id ? '#e8f6ef' : 'white',
                  border: `2px solid ${selectedRole?.id === role.id ? '#27ae60' : '#ecf0f1'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: '0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: role.couleur
                      }}
                    />
                    <strong style={{ color: '#2c3e50' }}>{role.nom}</strong>
                    {!role.actif && <span style={{ fontSize: '10px', background: '#e74c3c', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>INACTIF</span>}
                  </div>
                  {role.description && (
                    <small style={{ color: '#7f8c8d', fontSize: '11px' }}>
                      {role.description}
                    </small>
                  )}
                  <div style={{ marginTop: '5px', fontSize: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {!role.can_delete && <span style={{ color: '#e74c3c' }}>🚫 Pas de suppression</span>}
                    {!role.can_edit && <span style={{ color: '#e67e22' }}>🚫 Pas de modif</span>}
                    {!role.can_print && <span style={{ color: '#2980b9' }}>🚫 Pas d'impression</span>}
                  </div>
                </div>

                {role.nom !== 'Administrateur' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      supprimerRole(role.id, role.nom);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e74c3c',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '4px'
                    }}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div>
          {selectedRole ? (
            <>
              <div style={{
                background: selectedRole.couleur,
                color: 'white',
                padding: '15px 20px',
                borderRadius: '10px 10px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>
                    Permissions : {selectedRole.nom}
                  </h3>
                  <small style={{ opacity: 0.9 }}>
                    {permissions.length} / {menus.length} menu{menus.length > 1 ? 's' : ''} autorisé{menus.length > 1 ? 's' : ''}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={toutCocher}
                    style={{
                      background: 'rgba(255,255,255,0.3)',
                      color: 'white',
                      border: '1px solid white',
                      padding: '8px 15px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ☑️ Tout cocher
                  </button>
                  <button
                    onClick={toutDecocher}
                    style={{
                      background: 'rgba(255,255,255,0.3)',
                      color: 'white',
                      border: '1px solid white',
                      padding: '8px 15px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ☐ Tout décocher
                  </button>
                </div>
              </div>

              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '0 0 10px 10px',
                border: '1px solid #ecf0f1',
                borderTop: 'none'
              }}>
                {/* GLOBAL OPTIONS */}
                <div style={{ marginBottom: '20px', background: '#fdfdfe', padding: '15px', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '14px', textTransform: 'uppercase', borderBottom: '2px solid #ecf0f1', paddingBottom: '5px' }}>
                    Options Générales
                  </h4>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selectedRole.can_delete} onChange={() => toggleRoleOption('can_delete')} style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }} />
                      <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Suppression</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selectedRole.can_edit} onChange={() => toggleRoleOption('can_edit')} style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }} />
                      <span style={{ color: '#e67e22', fontWeight: 'bold' }}>Modification</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selectedRole.can_print} onChange={() => toggleRoleOption('can_print')} style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }} />
                      <span style={{ color: '#2980b9', fontWeight: 'bold' }}>Impression</span>
                    </label>
                  </div>
                </div>

                {Object.keys(menusParCategorie).map(categorie => (
                  <div key={categorie} style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      margin: '0 0 12px 0',
                      color: '#2c3e50',
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      borderBottom: '2px solid #ecf0f1',
                      paddingBottom: '8px'
                    }}>
                      {categorie}
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                      {menusParCategorie[categorie].map((menu: any) => (
                        <label
                          key={menu.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            background: permissions.includes(menu.id) ? '#e8f6ef' : '#f8f9fa',
                            border: `2px solid ${permissions.includes(menu.id) ? '#27ae60' : '#ecf0f1'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: '0.2s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(menu.id)}
                            onChange={() => togglePermission(menu.id)}
                            style={{
                              width: '18px',
                              height: '18px',
                              marginRight: '10px',
                              cursor: 'pointer'
                            }}
                          />
                          <span style={{ fontSize: '20px', marginRight: '8px' }}>{menu.icone}</span>
                          <span style={{ fontWeight: permissions.includes(menu.id) ? 'bold' : 'normal', color: '#2c3e50' }}>
                            {menu.libelle} <span style={{ fontSize: '10px', color: '#95a5a6', marginLeft: '5px' }}>({menu.code})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{
              background: '#f8f9fa',
              padding: '60px 20px',
              borderRadius: '10px',
              textAlign: 'center',
              color: '#95a5a6'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '15px' }}>🔐</div>
              <h3 style={{ margin: '0 0 10px 0' }}>Sélectionnez un rôle</h3>
              <p style={{ margin: 0 }}>Choisissez un rôle à gauche pour gérer ses permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{
        marginTop: '25px',
        padding: '15px',
        background: '#d1ecf1',
        border: '1px solid #bee5eb',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0c5460'
      }}>
        <strong>💡 Comment ça marche :</strong><br />
        1. Sélectionnez un rôle dans la liste de gauche<br />
        2. Cochez les menus auxquels ce rôle doit avoir accès<br />
        3. Les permissions sont enregistrées automatiquement<br />
        4. Les utilisateurs ayant ce rôle verront uniquement les menus cochés
      </div>
    </div>
  );
}

// Styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '5px',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#555'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  fontSize: '13px',
  boxSizing: 'border-box'
};