import Database from "@tauri-apps/plugin-sql";


let dbInstance: Database | null = null;
let dbUrlLoaded: string = "";

export const getDb = async () => {
  const configStr = localStorage.getItem("db_config");
  if (!configStr) {
    throw new Error("DB_NOT_CONFIGURED");
  }
  const config = JSON.parse(configStr);
  const dbUrl = `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

  if (dbInstance && dbUrlLoaded === dbUrl) {
    return dbInstance;
  }

  dbInstance = await Database.load(dbUrl);
  dbUrlLoaded = dbUrl;
  return dbInstance;
};

// Helper to get company info for prints
export const getCompanyInfo = async () => {
  try {
    const db = await getDb();
    const res = await db.select<any[]>(`SELECT nom_entreprise, adresse, telephone, email, logo_url FROM app_parametres_entreprise LIMIT 1`);
    if (res.length > 0) {
      return {
        nom: res[0].nom_entreprise || 'CENTRE MÉDICAL FOCOLARI',
        adresse: res[0].adresse || 'Pharmacie & Logistique',
        telephone: res[0].telephone || '',
        email: res[0].email || '',
        logo: res[0].logo_url || ''
      };
    }
    return { nom: 'CENTRE MÉDICAL FOCOLARI', adresse: 'Pharmacie & Logistique', telephone: '', email: '', logo: '' };
  } catch (e) {
    console.error("Error fetching company info:", e);
    return { nom: 'CENTRE MÉDICAL FOCOLARI', adresse: 'Pharmacie & Logistique', telephone: '', email: '', logo: '' };
  }
};