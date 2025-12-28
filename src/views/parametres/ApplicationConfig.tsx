import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function ApplicationConfig() {
  const [config, setConfig] = useState<any>({
    nom_application: "FOCOLARI",
    logo_app_url: "",
    couleur_primaire: "#3498db",
    couleur_secondaire: "#2c3e50",
    format_date: "DD/MM/YYYY",
    devise: "FCFA",
    langue: "fr",
    timezone: "Africa/Abidjan",
    activer_email: false,
    activer_sms: false,
    maintenance_mode: false
  });

  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    chargerConfig();
  }, []);

  const chargerConfig = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT * FROM app_parametres_app LIMIT 1");

      if (res.length > 0) {
        // Convertir les TINYINT en boolean
        const configData = {
          ...res[0],
          activer_email: Boolean(res[0].activer_email),
          activer_sms: Boolean(res[0].activer_sms),
          maintenance_mode: Boolean(res[0].maintenance_mode)
        };
        setConfig(configData);
        if (configData.logo_app_url) {
          setLogoPreview(configData.logo_app_url);
        }
      }
    } catch (e) {
      console.error("Erreur chargement config:", e);
    }
  };

  const handleChange = (field: string, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setConfig({ ...config, logo_app_url: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const enregistrer = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const existing = await db.select<any[]>("SELECT id FROM app_parametres_app LIMIT 1");

      if (existing.length > 0) {
        await db.execute(`
          UPDATE app_parametres_app 
          SET nom_application = ?, logo_app_url = ?, couleur_primaire = ?,
              couleur_secondaire = ?, format_date = ?, devise = ?,
              langue = ?, timezone = ?, activer_email = ?, activer_sms = ?,
              maintenance_mode = ?
          WHERE id = ?
        `, [
          config.nom_application, config.logo_app_url, config.couleur_primaire,
          config.couleur_secondaire, config.format_date, config.devise,
          config.langue, config.timezone, config.activer_email ? 1 : 0,
          config.activer_sms ? 1 : 0, config.maintenance_mode ? 1 : 0,
          existing[0].id
        ]);
      } else {
        await db.execute(`
          INSERT INTO app_parametres_app (
            nom_application, logo_app_url, couleur_primaire, couleur_secondaire,
            format_date, devise, langue, timezone, activer_email, activer_sms, maintenance_mode
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          config.nom_application, config.logo_app_url, config.couleur_primaire,
          config.couleur_secondaire, config.format_date, config.devise,
          config.langue, config.timezone, config.activer_email ? 1 : 0,
          config.activer_sms ? 1 : 0, config.maintenance_mode ? 1 : 0
        ]);
      }

      alert("✅ Configuration de l'application enregistrée !\n\n⚠️ Rechargez la page pour voir les changements.");
    } catch (e) {
      console.error("Erreur enregistrement:", e);
      alert("❌ Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🎨 Configuration de l'Application
      </h2>
      <p style={{ color: '#7f8c8d', marginBottom: '25px' }}>
        Personnalisez l'apparence et le comportement de votre application
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        {/* Paramètres principaux */}
        <div>
          {/* Info DB Config */}
          <div style={{ ...sectionStyle, borderLeft: '5px solid #e67e22', background: '#fffcf5' }}>
            <h3 style={{ ...sectionTitleStyle, color: '#d35400', borderBottomColor: '#f39c12' }}>🔌 Connexion Base de Données</h3>
            <div style={{ fontSize: '14px', color: '#555' }}>
              <p style={{ margin: '5px 0' }}><strong>Serveur (Hôte) :</strong> {JSON.parse(localStorage.getItem("db_config") || "{}").host || "Non défini"}</p>
              <p style={{ margin: '5px 0' }}><strong>Base de Données :</strong> {JSON.parse(localStorage.getItem("db_config") || "{}").database || "Non défini"}</p>

              <button
                onClick={() => {
                  if (window.confirm("Voulez-vous vraiment déconnecter la base de données ? L'application redémarrera sur l'écran de configuration.")) {
                    localStorage.removeItem("db_config");
                    window.location.reload();
                  }
                }}
                style={{
                  marginTop: '10px', padding: '8px 15px', background: '#d35400', color: 'white',
                  border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                🔄 Changer de Base de Données
              </button>
            </div>
          </div>

          <div style={{ height: '20px' }}></div>

          {/* Identité */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🏷️ Identité de l'Application</h3>

            <div>
              <label style={labelStyle}>Nom de l'Application</label>
              <input
                value={config.nom_application}
                onChange={e => handleChange('nom_application', e.target.value)}
                style={inputStyle}
                placeholder="Ex: FOCOLARI"
              />
              <small style={{ color: '#95a5a6', fontSize: '12px' }}>
                Ce nom apparaîtra dans l'en-tête et les documents
              </small>
            </div>
          </div>

          {/* Apparence */}
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3 style={sectionTitleStyle}>🎨 Apparence</h3>

            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>Couleur Primaire</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={config.couleur_primaire}
                    onChange={e => handleChange('couleur_primaire', e.target.value)}
                    style={{ width: '60px', height: '40px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '5px' }}
                  />
                  <input
                    type="text"
                    value={config.couleur_primaire}
                    onChange={e => handleChange('couleur_primaire', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="#3498db"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Couleur Secondaire</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={config.couleur_secondaire}
                    onChange={e => handleChange('couleur_secondaire', e.target.value)}
                    style={{ width: '60px', height: '40px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '5px' }}
                  />
                  <input
                    type="text"
                    value={config.couleur_secondaire}
                    onChange={e => handleChange('couleur_secondaire', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="#2c3e50"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '15px', padding: '15px', background: 'white', borderRadius: '8px' }}>
              <strong style={{ fontSize: '13px', color: '#555' }}>Aperçu des couleurs :</strong>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <div style={{
                  flex: 1,
                  height: '60px',
                  background: config.couleur_primaire,
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  Primaire
                </div>
                <div style={{
                  flex: 1,
                  height: '60px',
                  background: config.couleur_secondaire,
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  Secondaire
                </div>
              </div>
            </div>
          </div>

          {/* Régionalisation */}
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3 style={sectionTitleStyle}>🌍 Régionalisation</h3>

            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>Format de Date</label>
                <select
                  value={config.format_date}
                  onChange={e => handleChange('format_date', e.target.value)}
                  style={inputStyle}
                >
                  <option value="DD/MM/YYYY">JJ/MM/AAAA</option>
                  <option value="MM/DD/YYYY">MM/JJ/AAAA</option>
                  <option value="YYYY-MM-DD">AAAA-MM-JJ</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Devise</label>
                <select
                  value={config.devise}
                  onChange={e => handleChange('devise', e.target.value)}
                  style={inputStyle}
                >
                  <option value="FCFA">FCFA</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">Dollar ($)</option>
                </select>
              </div>
            </div>

            <div style={{ ...formGridStyle, marginTop: '15px' }}>
              <div>
                <label style={labelStyle}>Langue</label>
                <select
                  value={config.langue}
                  onChange={e => handleChange('langue', e.target.value)}
                  style={inputStyle}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Fuseau Horaire</label>
                <select
                  value={config.timezone}
                  onChange={e => handleChange('timezone', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Africa/Abidjan">Abidjan (GMT+0)</option>
                  <option value="Africa/Accra">Accra (GMT+0)</option>
                  <option value="Europe/Paris">Paris (GMT+1)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fonctionnalités */}
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3 style={sectionTitleStyle}>⚡ Fonctionnalités</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.activer_email}
                  onChange={e => handleChange('activer_email', e.target.checked)}
                  style={{ width: '18px', height: '18px', marginRight: '10px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: '#555' }}>📧 Activer les notifications par email</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.activer_sms}
                  onChange={e => handleChange('activer_sms', e.target.checked)}
                  style={{ width: '18px', height: '18px', marginRight: '10px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', color: '#555' }}>📱 Activer les notifications SMS</span>
              </label>

              <div style={{ marginTop: '10px', padding: '12px', background: '#fff3cd', borderRadius: '5px', border: '1px solid #ffc107' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.maintenance_mode}
                    onChange={e => handleChange('maintenance_mode', e.target.checked)}
                    style={{ width: '18px', height: '18px', marginRight: '10px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#856404' }}>🚧 Mode Maintenance</span>
                </label>
                <small style={{ color: '#856404', fontSize: '12px', marginLeft: '28px', display: 'block', marginTop: '5px' }}>
                  ⚠️ Les utilisateurs ne pourront plus accéder à l'application
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Logo de l'application */}
        <div>
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🖼️ Logo de l'Application</h3>

            <div style={{
              border: '2px dashed #ddd',
              borderRadius: '10px',
              padding: '20px',
              textAlign: 'center',
              background: '#f8f9fa',
              minHeight: '250px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt="Logo App"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      marginBottom: '15px'
                    }}
                  />
                  <button
                    onClick={() => {
                      setLogoPreview("");
                      setConfig({ ...config, logo_app_url: "" });
                    }}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      padding: '8px 15px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    🗑️ Supprimer
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏥</div>
                  <p style={{ color: '#7f8c8d', marginBottom: '15px', fontSize: '14px' }}>
                    Aucun logo défini
                  </p>
                </>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              style={{ display: 'none' }}
              id="logo-app-upload"
            />

            <label
              htmlFor="logo-app-upload"
              style={{
                display: 'block',
                marginTop: '15px',
                padding: '12px',
                background: '#3498db',
                color: 'white',
                textAlign: 'center',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📁 Choisir un logo
            </label>

            <p style={{
              marginTop: '15px',
              fontSize: '12px',
              color: '#95a5a6',
              lineHeight: '1.5'
            }}>
              💡 Le logo apparaîtra dans :<br />
              • La barre de navigation<br />
              • L'écran de connexion<br />
              • Les documents imprimés
            </p>
          </div>
        </div>
      </div>

      {/* Bouton Enregistrer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '2px solid #ecf0f1',
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={enregistrer}
          disabled={loading}
          style={{
            background: loading ? '#95a5a6' : '#27ae60',
            color: 'white',
            border: 'none',
            padding: '15px 40px',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          {loading ? '⏳ Enregistrement...' : '✅ Enregistrer la Configuration'}
        </button>
      </div>
    </div>
  );
}

// Styles
const sectionStyle: React.CSSProperties = {
  background: '#f8f9fa',
  padding: '20px',
  borderRadius: '10px',
  border: '1px solid #ecf0f1'
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 15px 0',
  color: '#2c3e50',
  fontSize: '16px',
  borderBottom: '2px solid #3498db',
  paddingBottom: '8px'
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '15px'
};

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