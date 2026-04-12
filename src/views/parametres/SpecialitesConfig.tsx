import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

export default function SpecialitesConfig() {
  const [specialites, setSpecialites] = useState<any[]>([]);
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      // Tentative de création si absente (Auto-réparation)
      try {
        await db.execute("CREATE TABLE IF NOT EXISTS app_specialites (id INT AUTO_INCREMENT PRIMARY KEY, nom VARCHAR(100) NOT NULL)");
      } catch (e) { }

      const res = await db.select<any[]>("SELECT id, nom FROM app_specialites ORDER BY nom ASC");
      setSpecialites(res);
    } catch (e: any) {
      console.error(e);
      // alert("Erreur chargement : " + (e.message || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  const ajouter = async () => {
    if (!nom.trim()) return;
    try {
      const db = await getDb();
      await db.execute("INSERT INTO app_specialites (nom) VALUES (?)", [nom.trim()]);
      setNom("");
      charger();
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'ajout : " + (e.message || JSON.stringify(e)));
    }
  };

  const supprimer = async (id: number) => {
    if (!window.confirm("Supprimer cette spécialité ? Cela ne supprimera pas les actes déjà enregistrés.")) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM app_specialites WHERE id = ?", [id]);
      charger();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ color: '#2c3e50', margin: '0 0 5px 0' }}>Spécialités Médicales</h2>
        <p style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>Gérez la liste des spécialités disponibles pour les types de consultation.</p>
      </div>

      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#34495e' }}>Nom de la spécialité</label>
          <input 
            value={nom} 
            onChange={e => setNom(e.target.value)}
            placeholder="Ex: Ophtalmologie, Kinésithérapie..."
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
          />
        </div>
        <button 
          onClick={ajouter}
          style={{ background: '#3498db', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Ajouter
        </button>
      </div>

      <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '12px' }}>Nom</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center' }}>Chargement...</td></tr>
            ) : specialites.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: '#bdc3c7' }}>Aucune spécialité enregistrée</td></tr>
            ) : (
              specialites.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #fdfdfd' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.nom}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button 
                      onClick={() => supprimer(s.id)}
                      style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
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
    </div>
  );
}
