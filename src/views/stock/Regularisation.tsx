import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";

interface Rubrique {
    id: number;
    libelle: string;
    type: 'ENTREE' | 'SORTIE' | 'MIXTE';
}

interface Article {
    id: number;
    designation: string;
    cip: string;
    stock: number;
    unite: string;
}

export default function Regularisation() {
    const [activeTab, setActiveTab] = useState<"ajustement" | "rubriques" | "historique">("ajustement");

    // Data
    const [rubriques, setRubriques] = useState<Rubrique[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [historique, setHistorique] = useState<any[]>([]);

    // Form Ajustement
    const [selectedRubrique, setSelectedRubrique] = useState<Rubrique | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [quantite, setQuantite] = useState("");
    const [sens, setSens] = useState<"+" | "-">("-"); // Par défaut Sortie
    const [motif, setMotif] = useState("");
    const [searchArticle, setSearchArticle] = useState("");

    // Form Rubrique
    const [newRubrique, setNewRubrique] = useState({ libelle: "", type: "SORTIE" });

    useEffect(() => {
        const runMigration = async () => {
            const migrationKey = "regularisation_db_v1";
            if (!localStorage.getItem(migrationKey)) {
                try {
                    const db = await getDb();

                    // 1. Table Rubriques
                    await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_rubriques (
              id INT AUTO_INCREMENT PRIMARY KEY,
              libelle VARCHAR(100) NOT NULL,
              type ENUM('ENTREE', 'SORTIE', 'MIXTE') NOT NULL
            )
          `);

                    // 2. Table Régularisations
                    await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_regularisations (
              id INT AUTO_INCREMENT PRIMARY KEY,
              date_reg DATETIME DEFAULT CURRENT_TIMESTAMP,
              article_id INT,
              rubrique_id INT,
              quantite DOUBLE,
              sens ENUM('+', '-'),
              motif TEXT,
              created_by VARCHAR(50) DEFAULT 'Admin',
              FOREIGN KEY (rubrique_id) REFERENCES stock_rubriques(id),
              FOREIGN KEY (article_id) REFERENCES stock_articles(id)
            )
          `);

                    // 3. Seed Data
                    const count = await db.select<any[]>("SELECT COUNT(*) as c FROM stock_rubriques");
                    if (count[0].c === 0) {
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Péremption', 'SORTIE')");
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Casse / Détérioration', 'SORTIE')");
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Avarié', 'SORTIE')");
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Rectification Stock', 'MIXTE')");
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Don En entrant', 'ENTREE')");
                        await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Rectification Inventaire', 'MIXTE')");
                    }

                    localStorage.setItem(migrationKey, "true");
                    console.log("Migration Regularisation DB terminée");
                } catch (e) {
                    console.error("Erreur migration reg.", e);
                }
            }

            // MIGRATION V2 : DEDUPLICATION & CONTRAINTE UNIQUE
            const migrationKeyV2 = "regularisation_db_v2_dedupe";
            if (!localStorage.getItem(migrationKeyV2)) {
                try {
                    const db = await getDb();
                    console.log("🚀 Migration V2 : Suppression doublons rubriques...");

                    // 1. Identifier et supprimer les doublons (garder l'ID min)
                    // MySQL ne supporte pas toujours bien le DELETE avec self-join sur la même table sans alias complexe ou table temporaire.
                    // Approche JS pour être sûr :
                    const doublons = await db.select<any[]>(`
                        SELECT libelle, COUNT(*) as c 
                        FROM stock_rubriques 
                        GROUP BY libelle 
                        HAVING c > 1
                     `);

                    for (const d of doublons) {
                        const ids = await db.select<any[]>(`SELECT id FROM stock_rubriques WHERE libelle = ? ORDER BY id ASC`, [d.libelle]);
                        // On garde le permier (ids[0]), on supprime les autres
                        const idsToDelete = ids.slice(1).map(x => x.id);
                        if (idsToDelete.length > 0) {
                            const idsStr = idsToDelete.join(',');
                            // Mettre à jour les refs si nécessaires (regularisations) vers l'ID gardé
                            await db.execute(`UPDATE stock_regularisations SET rubrique_id = ? WHERE rubrique_id IN (${idsStr})`, [ids[0].id]);
                            // Supprimer
                            await db.execute(`DELETE FROM stock_rubriques WHERE id IN (${idsStr})`);
                            console.log(`✅ Doublons supprimés pour "${d.libelle}" (${idsToDelete.length})`);
                        }
                    }

                    // 2. Ajouter la contrainte UNIQUE
                    // On vérifie d'abord si l'index existe déjà pour éviter erreur
                    try {
                        await db.execute("ALTER TABLE stock_rubriques ADD UNIQUE INDEX idx_libelle_unique (libelle)");
                        console.log("✅ Contrainte UNIQUE ajoutée sur stock_rubriques(libelle)");
                    } catch (e) {
                        console.log("Note: Index probable déjà existant ou erreur:", e);
                    }

                    localStorage.setItem(migrationKeyV2, "true");
                } catch (e) {
                    console.error("Erreur migration v2:", e);
                }
            }

            loadData();
        };
        runMigration();
    }, []);

    const loadData = async () => {
        try {
            const db = await getDb();
            setRubriques(await db.select<Rubrique[]>("SELECT * FROM stock_rubriques ORDER BY libelle"));

            const arts = await db.select<any[]>("SELECT id, designation, cip, CAST(quantite_stock AS CHAR) as stock, unite_detail as unite FROM stock_articles ORDER BY designation");
            setArticles(arts.map(a => ({ ...a, stock: parseFloat(a.stock || "0") })));

            const hist = await db.select<any[]>(`
        SELECT r.*, art.designation, rub.libelle as rubrique, rub.type 
        FROM stock_regularisations r
        JOIN stock_articles art ON r.article_id = art.id
        JOIN stock_rubriques rub ON r.rubrique_id = rub.id
        ORDER BY r.date_reg DESC LIMIT 50
      `);
            setHistorique(hist);
        } catch (e) { console.error(e); }
    };

    const handleCreateRubrique = async () => {
        if (!newRubrique.libelle) return alert("Libellé requis");
        try {
            const db = await getDb();
            await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES (?, ?)", [newRubrique.libelle, newRubrique.type]);
            alert("Rubrique créée !");
            setNewRubrique({ libelle: "", type: "SORTIE" });
            loadData();
        } catch (e) { console.error(e); }
    };

    const handleValiderReg = async () => {
        if (!selectedArticle || !selectedRubrique || !quantite) return alert("Tout remplir SVP");
        const qty = parseFloat(quantite);
        if (isNaN(qty) || qty <= 0) return alert("Quantité invalide");

        if (sens === "-" && selectedArticle.stock < qty) return alert("Stock insuffisant pour cette sortie");

        if (!confirm(`Confirmer ${sens}${qty} ${selectedArticle.unite} pour "${selectedRubrique.libelle}" ?`)) return;

        try {
            const db = await getDb();

            // CHECK INVENTAIRE LOCK
            // On s'assure qu'on ne peut pas régulariser si un inventaire est en cours de validation (optionnel) 
            // ou si la date système est incohérente (inférieure au dernier inventaire ??? Peu probable).
            // Mais la demande est "Ne plus modifier les BL/Regul antérieurs".
            // Ici on crée du neuf. Donc c'est OK sauf si on permettait de saisir une date passée.
            // On laisse standard.

            // 1. Update Stock
            if (sens === "+") {
                await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [qty, selectedArticle.id]);
            } else {
                await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?", [qty, selectedArticle.id]);
            }

            // 2. Insert Trace
            await db.execute(`
        INSERT INTO stock_regularisations (article_id, rubrique_id, quantite, sens, motif)
        VALUES (?, ?, ?, ?, ?)
      `, [selectedArticle.id, selectedRubrique.id, qty, sens, motif]);

            alert("✅ Régularisation effectuée !");
            setSelectedArticle(null); setQuantite(""); setMotif(""); setSearchArticle("");
            loadData();
        } catch (e) { console.error(e); alert("Erreur technique"); }
    };

    // UI Helpers
    useEffect(() => {
        if (selectedRubrique) {
            if (selectedRubrique.type === "ENTREE") setSens("+");
            else if (selectedRubrique.type === "SORTIE") setSens("-");
            // Si Mixte, on garde le choix précédent ou défaut
        }
    }, [selectedRubrique]);

    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>⚖️ Régularisation de Stock</h2>
                <div style={{ background: '#ecf0f1', padding: '5px', borderRadius: '8px' }}>
                    <TabButton active={activeTab === "ajustement"} onClick={() => setActiveTab("ajustement")}>📝 Nouvel Ajustement</TabButton>
                    <TabButton active={activeTab === "rubriques"} onClick={() => setActiveTab("rubriques")}>🏷️ Gestion Rubriques</TabButton>
                    <TabButton active={activeTab === "historique"} onClick={() => setActiveTab("historique")}>📜 Historique</TabButton>
                </div>
            </header>

            {/* AJUSTEMENT */}
            {activeTab === "ajustement" && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                    <div style={cardStyle}>
                        <h3 style={{ marginTop: 0, color: '#3498db' }}>1. Type de Régularisation</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {rubriques.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedRubrique(r)}
                                    style={{
                                        padding: '12px', borderRadius: '8px', cursor: 'pointer',
                                        background: selectedRubrique?.id === r.id ? '#d6eaf8' : 'white',
                                        border: selectedRubrique?.id === r.id ? '1px solid #3498db' : '1px solid #eee',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                >
                                    <span style={{ fontWeight: 'bold' }}>{r.libelle}</span>
                                    <Badge type={r.type} />
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setActiveTab("rubriques")} style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'none', border: '1px dashed #bbb', color: '#777', cursor: 'pointer' }}>+ Créer une rubrique</button>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={{ marginTop: 0, color: '#27ae60' }}>2. Détails de l'Ajustement</h3>
                        {selectedRubrique ? (
                            <>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={labelStyle}>Article concerné</label>
                                    <input
                                        placeholder="Rechercher (Nom ou CIP)..."
                                        value={searchArticle}
                                        onChange={e => setSearchArticle(e.target.value)}
                                        style={inputStyle}
                                    />
                                    {searchArticle.length > 1 && !selectedArticle && (
                                        <div style={listStyle}>
                                            {articles.filter(a => a.designation.toLowerCase().includes(searchArticle.toLowerCase())).slice(0, 5).map(a => (
                                                <div key={a.id} onClick={() => { setSelectedArticle(a); setSearchArticle(a.designation); }} style={itemStyle}>
                                                    <div>{a.designation}</div>
                                                    <small style={{ color: '#7f8c8d' }}>Stock: {a.stock} {a.unite}</small>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedArticle && (
                                        <div style={{ background: '#f0f3f4', padding: '10px', marginTop: '5px', borderRadius: '5px', color: '#7f8c8d' }}>
                                            Stock Actuel : <strong>{selectedArticle.stock} {selectedArticle.unite}</strong>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                                    {selectedRubrique.type === 'MIXTE' && (
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>Sens</label>
                                            <select value={sens} onChange={e => setSens(e.target.value as any)} style={inputStyle}>
                                                <option value="+">➕ Entrée (Ajout)</option>
                                                <option value="-">➖ Sortie (Retrait)</option>
                                            </select>
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Quantité {sens === '+' ? 'à ajouter' : 'à retirer'}</label>
                                        <input
                                            type="number"
                                            value={quantite}
                                            onChange={e => setQuantite(e.target.value)}
                                            style={{ ...inputStyle, fontWeight: 'bold', color: sens === '+' ? '#27ae60' : '#e74c3c' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>Motif / Commentaire</label>
                                    <textarea
                                        value={motif}
                                        onChange={e => setMotif(e.target.value)}
                                        style={{ ...inputStyle, minHeight: '80px' }}
                                        placeholder="Ex: Erreur de comptage lors de l'inventaire..."
                                    />
                                </div>

                                <button onClick={handleValiderReg} style={btnPrimaryStyle}>
                                    Valider la Régularisation
                                </button>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                                ⬅️ Sélectionnez une rubrique à gauche pour commencer
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* GESTION RUBRIQUES */}
            {activeTab === "rubriques" && (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={cardStyle}>
                        <h3>Créer une nouvelle rubrique</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                placeholder="Libellé (ex: Vol, Perte...)"
                                value={newRubrique.libelle}
                                onChange={e => setNewRubrique({ ...newRubrique, libelle: e.target.value })}
                                style={{ ...inputStyle, flex: 2 }}
                            />
                            <select
                                value={newRubrique.type}
                                onChange={e => setNewRubrique({ ...newRubrique, type: e.target.value as any })}
                                style={{ ...inputStyle, flex: 1 }}
                            >
                                <option value="SORTIE">Sortie (-)</option>
                                <option value="ENTREE">Entrée (+)</option>
                                <option value="MIXTE">Mixte (+/-)</option>
                            </select>
                            <button onClick={handleCreateRubrique} style={{ ...btnPrimaryStyle, width: 'auto' }}>Créer</button>
                        </div>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        {rubriques.map(r => (
                            <div key={r.id} style={{ background: 'white', padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{r.libelle}</span>
                                <Badge type={r.type} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORIQUE */}
            {activeTab === "historique" && (
                <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8f9fa' }}>
                            <tr>
                                <th style={thStyle}>Date</th>
                                <th style={thStyle}>Rubrique</th>
                                <th style={thStyle}>Article</th>
                                <th style={thStyle}>Mouvement</th>
                                <th style={thStyle}>Motif</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historique.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={tdStyle}>{new Date(h.date_reg).toLocaleDateString()}</td>
                                    <td style={tdStyle}>{h.rubrique}</td>
                                    <td style={tdStyle}>{h.designation}</td>
                                    <td style={{ ...tdStyle, color: h.sens === '+' ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>
                                        {h.sens}{h.quantite}
                                    </td>
                                    <td style={tdStyle}>{h.motif}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// Styles & Components
const cardStyle: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555', fontSize: '14px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dcdcdc', boxSizing: 'border-box' };
const btnPrimaryStyle: React.CSSProperties = { width: '100%', padding: '12px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const listStyle: React.CSSProperties = { background: 'white', border: '1px solid #eee', marginTop: '5px', maxHeight: '150px', overflowY: 'auto' };
const itemStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '12px', textAlign: 'left', color: '#7f8c8d', fontSize: '13px' };
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: '14px' };

const TabButton = ({ active, children, onClick }: any) => (
    <button onClick={onClick} style={{ padding: '8px 15px', border: 'none', background: active ? 'white' : 'transparent', borderRadius: '6px', cursor: 'pointer', fontWeight: active ? 'bold' : 'normal', color: active ? '#2c3e50' : '#7f8c8d', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{children}</button>
);

const Badge = ({ type }: { type: string }) => {
    const colors = { ENTREE: '#27ae60', SORTIE: '#e74c3c', MIXTE: '#f39c12' };
    return (
        <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '10px', color: 'white', background: (colors as any)[type] || '#999' }}>
            {type}
        </span>
    );
};
