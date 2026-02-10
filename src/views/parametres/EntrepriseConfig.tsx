import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function EntrepriseConfig() {
  const [entreprise, setEntreprise] = useState<any>({
    nom_entreprise: "",
    sigle: "",
    adresse: "",
    ville: "",
    pays: "Côte d'Ivoire",
    telephone: "",
    telephone2: "",
    email: "",
    site_web: "",
    nif: "",
    rccm: "",
    registre_commerce: "",
    logo_url: "",
    slogan: "",
    description: ""
  });

  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [societes, setSocietes] = useState<any[]>([]);

  useEffect(() => {
    chargerEntreprise();
    chargerSocietes();
    ensureColumnExists();
  }, []);

  const ensureColumnExists = async () => {
    try {
      const db = await getDb();
      // Try to add the column. If it exists, it will throw an error which we catch.
      await db.execute("ALTER TABLE app_parametres_entreprise ADD COLUMN id_famille_personnel INTEGER;");
      console.log("✅ Column id_famille_personnel added.");
    } catch (e: any) {
      // Ignore "duplicate column name" error (code 1 or similar depending on SQLite wrapper)
      console.log("ℹ️ Column check:", e);
    }
  };

  const chargerSocietes = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT * FROM societes WHERE statut = 'actif'");
      setSocietes(res);
    } catch (e) {
      console.error("Erreur chargement societes", e);
    }
  };

  const chargerEntreprise = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT * FROM app_parametres_entreprise LIMIT 1");

      if (res.length > 0) {
        setEntreprise(res[0]);
        if (res[0].logo_url) {
          setLogoPreview(res[0].logo_url);
        }
      }
    } catch (e) {
      console.error("Erreur chargement entreprise:", e);
    }
  };

  const handleChange = (field: string, value: string) => {
    setEntreprise({ ...entreprise, [field]: value });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setEntreprise({ ...entreprise, logo_url: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const enregistrer = async () => {
    if (!entreprise.nom_entreprise) {
      alert("⚠️ Le nom de l'entreprise est obligatoire.");
      return;
    }



    setLoading(true);
    try {
      const db = await getDb();


      // Vérifier si un enregistrement existe
      const existing = await db.select<any[]>("SELECT id FROM app_parametres_entreprise LIMIT 1");

      if (existing.length > 0) {
        // Update
        await db.execute(`
          UPDATE app_parametres_entreprise 
          SET nom_entreprise = ?, sigle = ?, adresse = ?, ville = ?, pays = ?,
              telephone = ?, telephone2 = ?, email = ?, site_web = ?,
              nif = ?, rccm = ?, registre_commerce = ?, logo_url = ?,
              slogan = ?, description = ?, id_famille_personnel = ?
          WHERE id = ?
        `, [
          entreprise.nom_entreprise, entreprise.sigle, entreprise.adresse,
          entreprise.ville, entreprise.pays, entreprise.telephone,
          entreprise.telephone2, entreprise.email, entreprise.site_web,
          entreprise.nif, entreprise.rccm, entreprise.registre_commerce,
          entreprise.logo_url, entreprise.slogan, entreprise.description,
          entreprise.id_famille_personnel || null,
          existing[0].id
        ]);
      } else {
        // Insert
        await db.execute(`
          INSERT INTO app_parametres_entreprise (
            nom_entreprise, sigle, adresse, ville, pays, telephone, telephone2,
            email, site_web, nif, rccm, registre_commerce, logo_url, slogan, description, id_famille_personnel
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          entreprise.nom_entreprise, entreprise.sigle, entreprise.adresse,
          entreprise.ville, entreprise.pays, entreprise.telephone,
          entreprise.telephone2, entreprise.email, entreprise.site_web,
          entreprise.nif, entreprise.rccm, entreprise.registre_commerce,
          entreprise.logo_url, entreprise.slogan, entreprise.description,
          entreprise.id_famille_personnel || null
        ]);
      }

      alert("✅ Informations de l'entreprise enregistrées avec succès !");
    } catch (e) {
      console.error("Erreur enregistrement:", e);
      alert("❌ Erreur lors de l'enregistrement : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🏢 Informations de l'Entreprise
      </h2>
      <p style={{ color: '#7f8c8d', marginBottom: '25px' }}>
        Ces informations apparaîtront sur tous les documents officiels (factures, bons, rapports)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        {/* Formulaire principal */}
        <div>
          {/* Section Identité */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>📋 Identité</h3>
            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>Nom de l'entreprise *</label>
                <input
                  value={entreprise.nom_entreprise || ""}
                  onChange={e => handleChange('nom_entreprise', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Centre Médical FOCOLARI"
                />
              </div>

              <div>
                <label style={labelStyle}>Sigle</label>
                <input
                  value={entreprise.sigle || ""}
                  onChange={e => handleChange('sigle', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: CMF"
                />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Slogan</label>
              <input
                value={entreprise.slogan || ""}
                onChange={e => handleChange('slogan', e.target.value)}
                style={inputStyle}
                placeholder="Ex: Votre santé, notre priorité"
              />
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={entreprise.description || ""}
                onChange={e => handleChange('description', e.target.value)}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="Décrivez votre établissement..."
              />
            </div>
          </div>

          {/* Section Coordonnées */}
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3 style={sectionTitleStyle}>📍 Coordonnées</h3>
            <div>
              <label style={labelStyle}>Adresse complète</label>
              <textarea
                value={entreprise.adresse || ""}
                onChange={e => handleChange('adresse', e.target.value)}
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                placeholder="Ex: 123 Boulevard de la République, Cocody"
              />
            </div>

            <div style={{ ...formGridStyle, marginTop: '15px' }}>
              <div>
                <label style={labelStyle}>Ville</label>
                <input
                  value={entreprise.ville || ""}
                  onChange={e => handleChange('ville', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Abidjan"
                />
              </div>

              <div>
                <label style={labelStyle}>Pays</label>
                <input
                  value={entreprise.pays || ""}
                  onChange={e => handleChange('pays', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ ...formGridStyle, marginTop: '15px' }}>
              <div>
                <label style={labelStyle}>Téléphone principal *</label>
                <input
                  value={entreprise.telephone || ""}
                  onChange={e => handleChange('telephone', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: +225 07 XX XX XX XX"
                />
              </div>

              <div>
                <label style={labelStyle}>Téléphone 2</label>
                <input
                  value={entreprise.telephone2 || ""}
                  onChange={e => handleChange('telephone2', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: +225 05 XX XX XX XX"
                />
              </div>
            </div>

            <div style={{ ...formGridStyle, marginTop: '15px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={entreprise.email || ""}
                  onChange={e => handleChange('email', e.target.value)}
                  style={inputStyle}
                  placeholder="contact@focolari.ci"
                />
              </div>

              <div>
                <label style={labelStyle}>Site web</label>
                <input
                  value={entreprise.site_web || ""}
                  onChange={e => handleChange('site_web', e.target.value)}
                  style={inputStyle}
                  placeholder="www.focolari.ci"
                />
              </div>
            </div>
          </div>

          {/* Section Légale */}
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3 style={sectionTitleStyle}>⚖️ Informations Légales</h3>
            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>NIF / CC</label>
                <input
                  value={entreprise.nif || ""}
                  onChange={e => handleChange('nif', e.target.value)}
                  style={inputStyle}
                  placeholder="Numéro d'Identification Fiscale"
                />
              </div>

              <div>
                <label style={labelStyle}>RCCM</label>
                <input
                  value={entreprise.rccm || ""}
                  onChange={e => handleChange('rccm', e.target.value)}
                  style={inputStyle}
                  placeholder="Registre du Commerce"
                />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Registre de Commerce</label>
              <input
                value={entreprise.registre_commerce || ""}
                onChange={e => handleChange('registre_commerce', e.target.value)}
                style={inputStyle}
                placeholder="Numéro du registre"
              />
            </div>
          </div>

          {/* Section Configuration RH / Famille */}
          <div style={{ ...sectionStyle, marginTop: '20px', borderLeft: '4px solid #e67e22' }}>
            <h3 style={{ ...sectionTitleStyle, borderBottom: '2px solid #e67e22' }}>👪 Configuration Famille Personnel</h3>
            <p style={{ fontSize: '12px', color: '#7f8c8d' }}>
              Sélectionnez la Société qui regroupe les membres de la famille du personnel.
              Les patients appartenant à cette société bénéficieront automatiquement des tarifs préférentiels.
            </p>
            <div>
              <label style={labelStyle}>Société "Famille Personnel"</label>
              <select
                value={entreprise.id_famille_personnel || ""}
                onChange={e => handleChange('id_famille_personnel', e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Aucune sélection --</option>
                {societes.map(s => (
                  <option key={s.id} value={s.id}>{s.nom_societe}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section Logo */}
        <div>
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🎨 Logo de l'Entreprise</h3>

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
                    alt="Logo"
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
                      setEntreprise({ ...entreprise, logo_url: "" });
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
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🖼️</div>
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
              id="logo-upload"
            />

            <label
              htmlFor="logo-upload"
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
              💡 Conseils :<br />
              • Format PNG ou JPG<br />
              • Dimensions : 500x500px<br />
              • Fond transparent (PNG)
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
          {loading ? '⏳ Enregistrement...' : '✅ Enregistrer les Informations'}
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