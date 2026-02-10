import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

// Définition de l'interface pour une permission
interface PermissionDetail {
  menu_id: number;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export default function RolesPermissions() {
  const [roles, setRoles] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  // Changement: permissions est maintenant un tableau d'objets détaillés, pas juste des IDs
  const [permissions, setPermissions] = useState<PermissionDetail[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    couleur: "#3498db",
    actif: true,
    // Ces champs globaux restent pour la rétrocompatibilité ou comme "master switch"
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
      // 1. Add 'can_print' column to Roles if missing
      try {
        await db.execute("SELECT can_print FROM app_roles LIMIT 1");
      } catch {
        await db.execute("ALTER TABLE app_roles ADD COLUMN can_print BOOLEAN DEFAULT TRUE");
        console.log("Schema updated: 'can_print' added to app_roles.");
      }

      // 2. Add 'GESTIONNAIRE' role if missing
      const gestionnaire = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Gestionnaire'");
      if (gestionnaire.length === 0) {
        await db.execute(
          "INSERT INTO app_roles (nom, description, couleur, actif, can_delete, can_edit, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ['Gestionnaire', 'Gère les stocks et les commandes', '#e67e22', 1, 0, 1, 1]
        );
      }

      // 3. Clean up duplicates in app_role_permissions
      try {
        await db.execute(`
            DELETE t1 FROM app_role_permissions t1
            INNER JOIN app_role_permissions t2 
            WHERE t1.id > t2.id AND t1.role_id = t2.role_id AND t1.menu_id = t2.menu_id
          `);
      } catch (e) { }

      // 4. MIGRATION MAJEURE: Ajout des colonnes CRUD à la table de liaison
      try {
        await db.execute("SELECT can_create FROM app_role_permissions LIMIT 1");
      } catch {
        console.log("Migration: Ajout des colonnes granulaires à app_role_permissions...");
        await db.execute("ALTER TABLE app_role_permissions ADD COLUMN can_create BOOLEAN DEFAULT TRUE");
        await db.execute("ALTER TABLE app_role_permissions ADD COLUMN can_update BOOLEAN DEFAULT TRUE");
        await db.execute("ALTER TABLE app_role_permissions ADD COLUMN can_delete BOOLEAN DEFAULT TRUE");
        console.log("Schema updated: Granular permissions added.");
      }

      // 5. Ensure Indexes
      try {
        await db.execute("CREATE UNIQUE INDEX idx_role_menu ON app_role_permissions (role_id, menu_id)");
      } catch (e) { }

      // 6. Fix ID Auto Increment
      try {
        await db.execute("ALTER TABLE app_role_permissions MODIFY COLUMN id INTEGER NOT NULL AUTO_INCREMENT");
      } catch (e) { }

    } catch (e) {
      console.error("Schema check failed:", e);
    }
  };

  const chargerDonnees = async () => {
    try {
      const db = await getDb();
      const resRoles = await db.select<any[]>("SELECT * FROM app_roles ORDER BY nom ASC");
      setRoles(resRoles);

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
      // On récupère aussi les champs granulaires
      const res = await db.select<any[]>(`
        SELECT menu_id, can_create, can_update, can_delete 
        FROM app_role_permissions 
        WHERE role_id = ?
      `, [roleId]);

      // Conversion des 1/0 en boolean pour l'état local
      const perms: PermissionDetail[] = res.map((p: any) => ({
        menu_id: p.menu_id,
        can_create: p.can_create === 1,
        can_update: p.can_update === 1,
        can_delete: p.can_delete === 1
      }));

      setPermissions(perms);
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
    const currentVal = selectedRole[field];
    const isTruthy = currentVal === 1 || currentVal === true;
    const newValue = isTruthy ? 0 : 1;

    try {
      const db = await getDb();
      await db.execute(`UPDATE app_roles SET ${field} = ? WHERE id = ?`, [newValue, selectedRole.id]);
      const updatedRole = { ...selectedRole, [field]: newValue };
      setSelectedRole(updatedRole);
      setRoles(roles.map(r => r.id === selectedRole.id ? updatedRole : r));
    } catch (e) {
      console.error("Erreur update role option:", e);
    }
  };

  // Bascule l'accès global à un menu (équivalent à "Lecture")
  const toggleMenuAccess = async (menuId: number) => {
    if (!selectedRole) return;

    const existingPerm = permissions.find(p => p.menu_id === menuId);

    try {
      const db = await getDb();

      if (existingPerm) {
        // Suppression complète de l'accès (DELETE)
        await db.execute(
          "DELETE FROM app_role_permissions WHERE role_id = ? AND menu_id = ?",
          [selectedRole.id, menuId]
        );
        setPermissions(permissions.filter(p => p.menu_id !== menuId));
      } else {
        // Ajout de l'accès avec droits par défaut (tout à TRUE pour commencer, ou selon logique métier)
        await db.execute(
          "INSERT INTO app_role_permissions (role_id, menu_id, can_create, can_update, can_delete) VALUES (?, ?, ?, ?, ?)",
          [selectedRole.id, menuId, 1, 1, 1]
        );
        setPermissions([...permissions, { menu_id: menuId, can_create: true, can_update: true, can_delete: true }]);
      }
    } catch (e: any) {
      console.error("Erreur toggle access:", e);
      alert("❌ Erreur : " + e.message);
    }
  };

  // Bascule une permission spécifique (Create, Update, Delete)
  const toggleGranularPermission = async (menuId: number, type: 'can_create' | 'can_update' | 'can_delete') => {
    if (!selectedRole) return;
    const perm = permissions.find(p => p.menu_id === menuId);
    if (!perm) return; // Ne devrait pas arriver si UI correcte

    const newValue = !perm[type]; // Toggle

    try {
      const db = await getDb();
      await db.execute(
        `UPDATE app_role_permissions SET ${type} = ? WHERE role_id = ? AND menu_id = ?`,
        [newValue ? 1 : 0, selectedRole.id, menuId]
      );

      // Update local state
      setPermissions(permissions.map(p => {
        if (p.menu_id === menuId) {
          return { ...p, [type]: newValue };
        }
        return p;
      }));

    } catch (e) {
      console.error("Erreur granular update:", e);
    }
  };

  const creerRole = async () => {
    if (!formData.nom) return alert("❌ Le nom du rôle est obligatoire");

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
    if (nom === 'Administrateur') return alert("❌ Impossible de supprimer le rôle Administrateur");
    if (!window.confirm(`⚠️ Supprimer le rôle "${nom}" ?`)) return;

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
    }
  };

  const menusParCategorie = menus.reduce((acc: any, menu: any) => {
    const cat = menu.categorie || 'Autres';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(menu);
    return acc;
  }, {});

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>🔐 Gestion Avancée des Rôles</h2>
      <p style={{ color: '#7f8c8d', marginBottom: '20px', fontSize: '0.9em' }}>
        Définissez les accès module par module avec une granularité fine (Ajout, Modification, Suppression).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', flex: 1, minHeight: 0 }}>

        {/* COLONNE GAUCHE : LISTE DES ROLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: showForm ? '#e74c3c' : '#27ae60',
              color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}>
            {showForm ? 'Annuler' : '+ Nouveau Rôle'}
          </button>

          {showForm && (
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <input style={inputStyle} placeholder="Nom du rôle" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
              <textarea style={{ ...inputStyle, marginTop: '5px' }} placeholder="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              <button onClick={creerRole} style={{ marginTop: '10px', width: '100%', background: '#3498db', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Créer</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roles.map(role => (
              <div key={role.id} onClick={() => selectionnerRole(role)}
                style={{
                  padding: '12px',
                  background: selectedRole?.id === role.id ? '#eaf2f8' : 'white',
                  borderLeft: `4px solid ${selectedRole?.id === role.id ? '#3498db' : 'transparent'}`,
                  borderRadius: '4px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{role.nom}</div>
                  <div style={{ fontSize: '0.8em', color: '#7f8c8d' }}>{role.description}</div>
                </div>
                {role.nom !== 'Administrateur' && (
                  <span onClick={(e) => { e.stopPropagation(); supprimerRole(role.id, role.nom); }} style={{ cursor: 'pointer', fontSize: '1.2em' }}>🗑️</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* COLONE DROITE : TABLEAU DES PERMISSIONS */}
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedRole ? (
            <>
              <div style={{ padding: '20px', borderBottom: '1px solid #eee', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#2c3e50' }}>Détails des droits : <span style={{ color: '#3498db' }}>{selectedRole.nom}</span></h3>
                  <div style={{ fontSize: '0.85em', color: '#95a5a6', marginTop: '5px' }}>Configurez les accès précis pour ce rôle.</div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  {/* Global Toggles hérités (Optionnel, gardés pour compatibilité vue) */}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.9em', gap: '5px' }}>
                    <input type="checkbox" checked={!!selectedRole.can_print} onChange={() => toggleRoleOption('can_print')} /> 🖨️ Impression
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.9em', gap: '5px' }}>
                    <input type="checkbox" checked={!!selectedRole.can_delete} onChange={() => toggleRoleOption('can_delete')} /> 🗑️ Suppr. Globale
                  </label>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {Object.keys(menusParCategorie).map(categorie => (
                  <div key={categorie} style={{ marginBottom: '25px' }}>
                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #eee', paddingBottom: '5px', color: '#7f8c8d', textTransform: 'uppercase', fontSize: '0.85em', letterSpacing: '1px' }}>{categorie.replace('MODULE_', '')}</h4>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {menusParCategorie[categorie].map((menu: any) => {
                        const perm = permissions.find(p => p.menu_id === menu.id);
                        const hasAccess = !!perm;

                        return (
                          <div key={menu.id} style={{
                            display: 'flex', alignItems: 'center', padding: '10px 15px',
                            background: hasAccess ? '#fff' : '#f9f9f9',
                            border: `1px solid ${hasAccess ? '#bdc3c7' : '#eee'}`,
                            borderRadius: '6px', opacity: hasAccess ? 1 : 0.7
                          }}>
                            {/* MODULE ACTIVATION */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <label className="switch" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={hasAccess} onChange={() => toggleMenuAccess(menu.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                <span style={{ marginLeft: '10px', fontWeight: 'bold', fontSize: '1.05em' }}>{menu.icone} {menu.libelle}</span>
                              </label>
                            </div>

                            {/* GRANULAR CONTROLS - Only for specific modules/views */}
                            {hasAccess && ['PATIENTS_VIEW', 'PARAM_USERS', 'PARAM_ROLES'].includes(menu.code) && (
                              <div style={{ display: 'flex', gap: '20px', borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
                                <PermissionToggle
                                  label="Ajouter"
                                  checked={perm?.can_create}
                                  onChange={() => toggleGranularPermission(menu.id, 'can_create')}
                                  color="#27ae60"
                                />
                                <PermissionToggle
                                  label="Modifier"
                                  checked={perm?.can_update}
                                  onChange={() => toggleGranularPermission(menu.id, 'can_update')}
                                  color="#f39c12"
                                />
                                <PermissionToggle
                                  label="Supprimer"
                                  checked={perm?.can_delete}
                                  onChange={() => toggleGranularPermission(menu.id, 'can_delete')}
                                  color="#e74c3c"
                                />
                              </div>
                            )}
                            {!hasAccess && (
                              <div style={{ fontSize: '0.85em', color: '#bdc3c7', fontStyle: 'italic', paddingRight: '20px' }}>
                                Accès désactivé
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bdc3c7', flexDirection: 'column' }}>
              <div style={{ fontSize: '3em' }}>👈</div>
              <p>Sélectionnez un rôle pour configurer ses permissions</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const PermissionToggle = ({ label, checked, onChange, color }: any) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9em', color: checked ? '#333' : '#aaa' }}>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={onChange}
      style={{ accentColor: color }}
    />
    {label}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'
};