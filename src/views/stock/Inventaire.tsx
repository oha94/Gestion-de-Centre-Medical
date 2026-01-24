import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";


// --- TYPES ---
interface Inventaire {
    id: number;
    code: string;
    libelle?: string; // NEW
    date_creation: string;
    statut: 'BROUILLON' | 'VALIDE';
    type: 'GLOBAL' | 'RAYON';
    rayon_ids?: string | null; // JSON array "[1, 2]"
    valorisation_theorique: number;
    valorisation_reelle: number;
    created_by?: string;
}

interface LigneInventaire {
    id: number;
    inventaire_id: number;
    article_id: number;
    designation: string;
    cip: string;
    stock_theorique: number;
    stock_compte: number | null;
    ecart: number;
    prix_achat: number;
    rayon_id: number; // NEW for breakdown
    rayon_libelle: string; // NEW for breakdown
}

interface Rayon {
    id: number;
    libelle: string;
}

export default function Inventaire({ currentUser }: { currentUser?: any }) {
    const [activeTab, setActiveTab] = useState<"dashboard" | "nouveau" | "saisie">("dashboard");
    const [inventaires, setInventaires] = useState<Inventaire[]>([]);
    const [rayons, setRayons] = useState<Rayon[]>([]);

    // State Creation
    const [newInvType, setNewInvType] = useState<"GLOBAL" | "RAYON">("GLOBAL");
    const [newInvLibelle, setNewInvLibelle] = useState(""); // NEW
    const [selectedRayons, setSelectedRayons] = useState<number[]>([]);

    // State Dashboard
    const [searchDate, setSearchDate] = useState("");
    const [searchLibelle, setSearchLibelle] = useState(""); // NEW
    const [currentPage, setCurrentPage] = useState(1); // NEW
    const [totalPages, setTotalPages] = useState(1); // NEW
    const ITEMS_PER_PAGE = 20;

    // State Saisie / Consultation
    const [currentInv, setCurrentInv] = useState<Inventaire | null>(null);
    const [lignes, setLignes] = useState<LigneInventaire[]>([]);
    const [filterEcart, setFilterEcart] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // State Move Product
    const [movingArticleId, setMovingArticleId] = useState<number | null>(null); // ID of article being moved
    const [targetRayonId, setTargetRayonId] = useState<string>("");

    // DB MIGRATION & REPAIR
    useEffect(() => {
        const init = async () => {
            const migrationKeyV3 = "inventaire_db_v3_libelle";
            try {
                const db = await getDb();

                // Helper to safely add columns
                const ensureColumn = async (table: string, colName: string, colDef: string) => {
                    try {
                        await db.execute(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef}`);
                    } catch (e: any) {
                        if (!JSON.stringify(e).includes("1060") && !JSON.stringify(e).includes("Duplicate column")) {
                            // Ignore
                        }
                    }
                };

                // 1. Ensure Tables Exist
                await db.execute(`CREATE TABLE IF NOT EXISTS stock_inventaires (id INT AUTO_INCREMENT PRIMARY KEY)`);
                await db.execute(`
                    CREATE TABLE IF NOT EXISTS stock_inventaire_lignes (
                      id INT AUTO_INCREMENT PRIMARY KEY,
                      inventaire_id INT,
                      FOREIGN KEY (inventaire_id) REFERENCES stock_inventaires(id) ON DELETE CASCADE
                    )
                `);

                // 2. Ensure Columns (Repair)
                await ensureColumn("stock_inventaires", "code", "VARCHAR(50) UNIQUE");
                await ensureColumn("stock_inventaires", "libelle", "VARCHAR(255) NULL"); // NEW in V3
                await ensureColumn("stock_inventaires", "date_creation", "DATETIME DEFAULT CURRENT_TIMESTAMP");
                await ensureColumn("stock_inventaires", "date_validation", "DATETIME NULL");
                await ensureColumn("stock_inventaires", "statut", "ENUM('BROUILLON', 'VALIDE') DEFAULT 'BROUILLON'");
                await ensureColumn("stock_inventaires", "type", "ENUM('GLOBAL', 'RAYON')");
                await ensureColumn("stock_inventaires", "rayon_ids", "TEXT NULL");
                await ensureColumn("stock_inventaires", "valorisation_theorique", "DOUBLE DEFAULT 0");
                await ensureColumn("stock_inventaires", "valorisation_reelle", "DOUBLE DEFAULT 0");
                await ensureColumn("stock_inventaires", "created_by", "VARCHAR(100)");

                await ensureColumn("stock_inventaire_lignes", "article_id", "INT");
                await ensureColumn("stock_inventaire_lignes", "stock_theorique", "DOUBLE");
                await ensureColumn("stock_inventaire_lignes", "stock_compte", "DOUBLE NULL");
                await ensureColumn("stock_inventaire_lignes", "ecart", "DOUBLE DEFAULT 0");
                await ensureColumn("stock_inventaire_lignes", "prix_achat", "DOUBLE DEFAULT 0");

                localStorage.setItem(migrationKeyV3, "true");

                // 3. FIX AUTO-INCREMENT (Patch v4)
                await db.execute("ALTER TABLE stock_inventaires MODIFY COLUMN id INT AUTO_INCREMENT");
                console.log("✅ Fixed stock_inventaires ID auto-increment");
                await db.execute("ALTER TABLE stock_inventaire_lignes MODIFY COLUMN id INT AUTO_INCREMENT");
                console.log("✅ Fixed stock_inventaire_lignes ID auto-increment");

            } catch (e) {
                console.error("Migration Inv Error:", e);
                alert("Erreur initialisation DB Inventaire: " + JSON.stringify(e));
            }

            await loadRayons();
            await loadDashboard();
        };
        init();
    }, []);

    const loadDashboard = async () => {
        try {
            const db = await getDb();
            let query = `SELECT * FROM stock_inventaires WHERE 1=1`;
            let countQuery = `SELECT COUNT(*) as total FROM stock_inventaires WHERE 1=1`;
            const params: any[] = [];

            if (searchDate) {
                const clause = ` AND DATE(date_creation) = ?`;
                query += clause;
                countQuery += clause;
                params.push(searchDate);
            }
            if (searchLibelle) {
                const clause = ` AND (code LIKE ? OR libelle LIKE ?)`;
                query += clause;
                countQuery += clause;
                params.push(`%${searchLibelle}%`, `%${searchLibelle}%`);
            }

            query += ` ORDER BY date_creation DESC LIMIT ? OFFSET ?`;

            // Count first
            const countRes = await db.select<any[]>(countQuery, params);
            const total = countRes[0]?.total || 0;
            setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));

            // Select params (add LIMIT/OFFSET)
            const offset = (currentPage - 1) * ITEMS_PER_PAGE;
            // params are reused but need to be careful with spread. 
            // Actually SQLite/MySQL driver binding might differ, usually we reconstruct params array.
            const queryParams = [...params, ITEMS_PER_PAGE, offset] as any[];

            const res = await db.select<Inventaire[]>(query, queryParams);
            setInventaires(res);
        } catch (e) { console.error(e); }
    };

    // Reload dashboard when filters change
    useEffect(() => { setCurrentPage(1); loadDashboard(); }, [searchDate, searchLibelle]);
    useEffect(() => { loadDashboard(); }, [currentPage]);

    const loadRayons = async () => {
        try {
            const db = await getDb();
            setRayons(await db.select<Rayon[]>("SELECT * FROM stock_rayons ORDER BY libelle"));
        } catch (e) { console.error(e); }
    };

    const getRayonLibelles = (inv: Inventaire) => {
        if (inv.type === 'GLOBAL') return 'Tous les rayons';
        if (!inv.rayon_ids) return 'Rayon Inconnu';
        try {
            const ids = JSON.parse(inv.rayon_ids) as number[];
            if (!Array.isArray(ids) || ids.length === 0) return 'Aucun rayon';
            const labels = rayons.filter(r => ids.includes(r.id)).map(r => r.libelle);
            if (labels.length > 3) return `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
            return labels.join(', ');
        } catch (e) { return 'Erreur format'; }
    };

    // ACTIONS
    const deleteInventaire = async (inv: Inventaire) => {
        if (inv.statut === 'VALIDE') {
            alert("Impossible de supprimer un inventaire validé !");
            return;
        }
        if (!confirm(`Redoutable ! Êtes-vous sûr de vouloir supprimer l'inventaire ${inv.code} ?`)) return;

        try {
            const db = await getDb();
            await db.execute("DELETE FROM stock_inventaires WHERE id = ?", [inv.id]);
            loadDashboard();
        } catch (e) { alert("Erreur suppression: " + e); }
    };

    const editInventaire = async (inv: Inventaire) => {
        if (inv.statut === 'VALIDE') return;
        const newLib = prompt("Nouveau libellé :", inv.libelle || "");
        if (newLib === null) return; // Cancelled

        try {
            const db = await getDb();
            await db.execute("UPDATE stock_inventaires SET libelle = ? WHERE id = ?", [newLib, inv.id]);
            loadDashboard();
        } catch (e) { alert("Erreur modification"); }
    };

    const createInventaire = async () => {
        try {
            const db = await getDb();
            const code = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

            if (newInvType === 'RAYON' && selectedRayons.length === 0) {
                alert("Veuillez sélectionner au moins un rayon.");
                return;
            }

            const rayonIdsJson = (newInvType === 'RAYON') ? JSON.stringify(selectedRayons) : null;

            const resHeader = await db.execute(
                `INSERT INTO stock_inventaires (code, libelle, type, rayon_ids, statut) VALUES (?, ?, ?, ?, 'BROUILLON')`,
                [code, newInvLibelle, newInvType, rayonIdsJson]
            );
            const invId = resHeader.lastInsertId as number;

            let queryArticles = `SELECT id, quantite_stock, prix_achat FROM stock_articles`;
            if (newInvType === 'RAYON' && selectedRayons.length > 0) {
                queryArticles += ` WHERE rayon_id IN (${selectedRayons.join(',')})`;
            }

            const articles = await db.select<any[]>(queryArticles);

            if (articles.length === 0) {
                alert("Aucun article trouvé pour ces critères !");
                await db.execute("DELETE FROM stock_inventaires WHERE id = ?", [invId]);
                return;
            }

            for (const art of articles) {
                await db.execute(`
                  INSERT INTO stock_inventaire_lignes (inventaire_id, article_id, stock_theorique, stock_compte, prix_achat)
                  VALUES (?, ?, ?, NULL, ?)
                `, [invId, art.id, art.quantite_stock, art.prix_achat]);
            }

            const valo = articles.reduce((acc, a) => acc + (a.quantite_stock * a.prix_achat), 0);
            await db.execute("UPDATE stock_inventaires SET valorisation_theorique = ? WHERE id = ?", [valo, invId]);

            alert(`✅ Inventaire initialisé !`);
            setNewInvLibelle("");
            setActiveTab("dashboard");
            loadDashboard();
            openInventaire(invId);
        } catch (e) {
            console.error(e);
            alert("Erreur création: " + e);
        }
    };

    const openInventaire = async (id: number) => {
        try {
            const db = await getDb();
            const inv = await db.select<Inventaire[]>(`SELECT * FROM stock_inventaires WHERE id = ?`, [id]);
            if (inv.length) {
                setCurrentInv(inv[0]);
                await loadLignes(id);
                setActiveTab("saisie");
            }
        } catch (e) { console.error(e); }
    };

    const loadLignes = async (invId: number) => {
        try {
            const db = await getDb();
            // Fetch also current Rayon Libelle for reporting
            const res = await db.select<LigneInventaire[]>(`
                SELECT l.*, a.designation, a.cip, a.rayon_id, r.libelle as rayon_libelle
                FROM stock_inventaire_lignes l
                JOIN stock_articles a ON l.article_id = a.id
                LEFT JOIN stock_rayons r ON a.rayon_id = r.id
                WHERE l.inventaire_id = ?
                ORDER BY a.designation
            `, [invId]);
            setLignes(res);
        } catch (e) { console.error(e); }
    };

    // --- ACTIONS SAISIE ---

    const updateCompte = async (ligneId: number, val: string) => {
        const newVal = val === "" ? null : parseFloat(val);
        setLignes(prev => prev.map(l => {
            if (l.id === ligneId) {
                const ecart = (newVal === null ? 0 : newVal) - l.stock_theorique;
                return { ...l, stock_compte: newVal, ecart };
            }
            return l;
        }));

        try {
            const db = await getDb();
            const ligne = lignes.find(l => l.id === ligneId);
            if (ligne) {
                const theo = ligne.stock_theorique;
                const ecart = (newVal === null ? 0 : newVal) - theo;
                await db.execute("UPDATE stock_inventaire_lignes SET stock_compte = ?, ecart = ? WHERE id = ?", [newVal, ecart, ligneId]);
            }
        } catch (e) { console.error(e); }
    };

    const moveArticle = async () => {
        if (!movingArticleId || !targetRayonId) return;
        try {
            const db = await getDb();
            const newRayonId = parseInt(targetRayonId);

            // 1. Update in DB
            await db.execute("UPDATE stock_articles SET rayon_id = ? WHERE id = ?", [newRayonId, movingArticleId]);

            // 2. Update in Local State (Find the ligne with this articleId)
            const targetRayon = rayons.find(r => r.id === newRayonId);
            setLignes(prev => prev.map(l => {
                if (l.article_id === movingArticleId) {
                    return { ...l, rayon_id: newRayonId, rayon_libelle: targetRayon?.libelle || "Inconnu" };
                }
                return l;
            }));

            alert("✅ Article déplacé !");
            setMovingArticleId(null);
            setTargetRayonId("");
        } catch (e) { console.error(e); alert("Erreur déplacement"); }
    };

    const refreshTheorique = async () => {
        if (!currentInv) return;
        if (!confirm("⚠️ Attention : Mise jour stocks théoriques depuis la base...\nContinuer ?")) return;

        try {
            const db = await getDb();
            await db.execute(`
                UPDATE stock_inventaire_lignes l
                JOIN stock_articles a ON l.article_id = a.id
                SET l.stock_theorique = a.quantite_stock,
                    l.ecart = IFNULL(l.stock_compte, 0) - a.quantite_stock
                WHERE l.inventaire_id = ?
            `, [currentInv.id]);

            await loadLignes(currentInv.id);
            alert("Stocks théoriques rafraîchis !");
        } catch (e) { console.error(e); alert("Erreur refresh"); }
    };

    const validerInventaire = async () => {
        if (!currentInv) return;
        if (!confirm("🔐 VALIDATION DÉFINITIVE\n\nMise à jour des stocks et création des lignes de régularisation.\nConfirmer ?")) return;

        try {
            const db = await getDb();
            const valoReelle = lignes.reduce((acc, l) => acc + ((l.stock_compte || 0) * l.prix_achat), 0);

            let rubricId = 0;
            const rub = await db.select<any[]>("SELECT id FROM stock_rubriques WHERE libelle LIKE 'Rectification Inventaire%' LIMIT 1");
            if (rub.length && rub[0].id) rubricId = rub[0].id as number;
            else {
                const r = await db.execute("INSERT INTO stock_rubriques (libelle, type) VALUES ('Rectification Inventaire', 'MIXTE')");
                rubricId = r.lastInsertId as number;
            }

            for (const l of lignes) {
                const compte = l.stock_compte || 0;
                if (compte !== l.stock_theorique) {
                    const ecart = l.ecart;
                    await db.execute("UPDATE stock_articles SET quantite_stock = ? WHERE id = ?", [compte, l.article_id]);
                    const sens = ecart > 0 ? '+' : '-';
                    await db.execute(`
                        INSERT INTO stock_regularisations (article_id, rubrique_id, quantite, sens, motif)
                        VALUES (?, ?, ?, ?, ?)
                     `, [l.article_id, rubricId, Math.abs(ecart), sens, `Inv. ${currentInv.code}`]);
                }
            }

            await db.execute(`
                UPDATE stock_inventaires SET statut = 'VALIDE', date_validation = NOW(), valorisation_reelle = ? 
                WHERE id = ?
            `, [valoReelle, currentInv.id]);

            alert("🎉 Inventaire Validé !");
            setActiveTab("dashboard");
            loadDashboard();
        } catch (e) { console.error(e); alert("Erreur validation"); }
    };

    // --- IMPRESSIONS ---
    const imprimerFiche = async (mode: 'AVEUGLE' | 'ECARTS') => {
        if (!currentInv) return;

        const company = await getCompanyInfo();

        const title = mode === 'AVEUGLE' ? "FICHE DE COMPTAGE (AVEUGLE)" : "FICHE DE CONTRÔLE (ÉCARTS)";
        const rayonLib = getRayonLibelles(currentInv);
        const dateStr = new Date().toLocaleDateString('fr-FR');

        let dataToPrint = lignes;
        if (mode === 'ECARTS') {
            dataToPrint = lignes.filter(l => (l.stock_compte || 0) !== l.stock_theorique);
        }

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                    .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                    .company-sub { font-size: 10px; color: #7f8c8d; }
                    .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }

                    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                    .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                    .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                    td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                    tr:last-child td { border-bottom: none; }
                    
                    .case-vide { border: 1px solid #ddd; height: 18px; width: 60px; display: inline-block; background: #fff; }
                    .footer { position: fixed; bottom: 0; left: 0;right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">${company.nom}</div>
                        <div class="company-sub">${company.adresse || ''}
${company.telephone ? 'Tel: ' + company.telephone : ''}
${company.email ? 'Email: ' + company.email : ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Document</div>
                        <div class="doc-title">${title}</div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <label>Inventaire</label>
                        <span>${currentInv.code} ${currentInv.libelle ? `(${currentInv.libelle})` : ''}</span>
                    </div>
                    <div class="meta-item">
                        <label>Date</label>
                        <span>${dateStr}</span>
                    </div>
                    <div class="meta-item">
                        <label>Rayons</label>
                        <span>${rayonLib}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>CIP</th>
                            <th>Désignation</th>
                            <th>Rayon</th>
                            ${mode === 'AVEUGLE' ? '<th>Qté Comptée</th>' : '<th>Théo.</th><th>Compté</th><th>Écart</th>'}
                        </tr>
                    </thead>
                    <tbody>
                        ${dataToPrint.map(l => `
                            <tr>
                                <td>${l.cip}</td>
                                <td>${l.designation}</td>
                                <td>${l.rayon_libelle || '-'}</td>
                                ${mode === 'AVEUGLE'
                ? `<td><div class="case-vide"></div></td>`
                : `<td style="text-align:center;">${l.stock_theorique}</td>
                                       <td style="text-align:center;"><strong>${l.stock_compte || 0}</strong></td>
                                       <td style="text-align:center; color:${l.ecart !== 0 ? 'red' : 'green'}; font-weight:bold;">${l.ecart > 0 ? '+' : ''}${l.ecart}</td>`
            }
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(content);
            doc.close();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000); // Give user time to print
        }
    };

    const imprimerRecap = async () => {
        if (!currentInv) return;

        const company = await getCompanyInfo();

        const dateStr = new Date().toLocaleDateString('fr-FR');
        const totalTheo = lignes.reduce((acc, l) => acc + (l.stock_theorique * l.prix_achat), 0);
        const totalReel = lignes.reduce((acc, l) => acc + ((l.stock_compte || 0) * l.prix_achat), 0);
        const totalGap = totalReel - totalTheo;

        // Group by Rayon
        const rayonsMap = new Map<string, { theo: number, real: number }>();
        lignes.forEach(l => {
            const key = l.rayon_libelle || "Rayon Inconnu";
            const current = rayonsMap.get(key) || { theo: 0, real: 0 };
            current.theo += (l.stock_theorique * l.prix_achat);
            current.real += ((l.stock_compte || 0) * l.prix_achat);
            rayonsMap.set(key, current);
        });

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Récapitulatif Inventaire</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                    .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                    .company-sub { font-size: 10px; color: #7f8c8d; }
                    .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }
                    
                    .kpi-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
                    .kpi-box { background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #eee; text-align: center; }
                    .kpi-label { font-size: 9px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 5px; }
                    .kpi-value { font-size: 14px; font-weight: 700; color: #2c3e50; }

                    h3 { font-size: 12px; font-weight: 600; color: #555; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; }

                    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px; }
                    th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #666; text-transform: uppercase; }
                    td { padding: 6px 8px; border-bottom: 1px solid #f9f9f9; color: #444; }
                    tr:last-child td { border-bottom: none; }
                    
                    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">${company.nom}</div>
                        <div class="company-sub">${company.adresse || ''}
${company.telephone ? 'Tel: ' + company.telephone : ''}
${company.email ? 'Email: ' + company.email : ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Document</div>
                        <div class="doc-title">RÉCAPITULATIF</div>
                    </div>
                </div>

                <div style="text-align:center; margin-bottom:20px; font-size:12px; color:#555;">
                    Inventaire <strong>${currentInv.code}</strong> ${currentInv.libelle ? `- ${currentInv.libelle}` : ''} du ${dateStr}
                </div>

                <div class="kpi-container">
                    <div class="kpi-box">
                        <div class="kpi-label">Valo. Théorique</div>
                        <div class="kpi-value" style="color: #3498db;">${totalTheo.toLocaleString()} F</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-label">Valo. Réelle</div>
                        <div class="kpi-value" style="color: #27ae60;">${totalReel.toLocaleString()} F</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-label">Écart Global</div>
                        <div class="kpi-value" style="color: ${totalGap >= 0 ? '#16a085' : '#e74c3c'};">${totalGap > 0 ? '+' : ''}${totalGap.toLocaleString()} F</div>
                    </div>
                </div>

                <h3>Détail par Rayon</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Rayon</th>
                            <th style="text-align:right;">Théorique</th>
                            <th style="text-align:right;">Réel</th>
                            <th style="text-align:right;">Écart</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from(rayonsMap.entries()).map(([name, vals]) => {
            const gap = vals.real - vals.theo;
            return `<tr>
                                <td>${name}</td>
                                <td style="text-align:right;">${vals.theo.toLocaleString()}</td>
                                <td style="text-align:right;">${vals.real.toLocaleString()}</td>
                                <td style="text-align:right; font-weight:bold; color:${gap !== 0 ? 'red' : 'green'}">${gap > 0 ? '+' : ''}${gap.toLocaleString()}</td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
                </div>
                 <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(content);
            doc.close();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000);
        }
    };

    // --- RENDERING ---
    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif', background: '#f4f6f9', minHeight: '100%' }}>

            {activeTab === "dashboard" && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ color: '#2c3e50', margin: 0 }}>📊 Inventaires</h2>
                            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                                <input
                                    type="date"
                                    value={searchDate}
                                    onChange={e => setSearchDate(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                                />
                                <input
                                    placeholder="🔍 Code ou Libellé..."
                                    value={searchLibelle}
                                    onChange={e => setSearchLibelle(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', width: '200px' }}
                                />
                                {(searchDate || searchLibelle) && <button onClick={() => { setSearchDate(""); setSearchLibelle(""); }} style={btnLink}>Effacer</button>}
                            </div>
                        </div>
                        <button onClick={() => { setNewInvType('GLOBAL'); setSelectedRayons([]); setNewInvLibelle(""); setActiveTab("nouveau"); }} style={btnPrimary}>+ Nouvel Inventaire</button>
                    </div>

                    <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#ecf0f1' }}>
                                <tr>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Code / Libellé</th>
                                    <th style={thStyle}>Type / Rayons</th>
                                    <th style={thStyle}>Statut</th>
                                    <th style={thStyle}>Valo. Théorique</th>
                                    <th style={thStyle}>Valo. Réelle</th>
                                    <th style={thStyle}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventaires.map(inv => (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={tdStyle}>{new Date(inv.date_creation).toLocaleDateString()}</td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 'bold' }}>{inv.code}</div>
                                            {inv.libelle && <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{inv.libelle}</div>}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 'bold' }}>{inv.type}</div>
                                            <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{getRayonLibelles(inv)}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                                                background: inv.statut === 'VALIDE' ? '#d4efdf' : '#fbeee6',
                                                color: inv.statut === 'VALIDE' ? '#27ae60' : '#e67e22'
                                            }}>
                                                {inv.statut}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{inv.valorisation_theorique.toLocaleString()} FCFA</td>
                                        <td style={tdStyle}>{inv.statut === 'VALIDE' ? inv.valorisation_reelle.toLocaleString() + ' FCFA' : '-'}</td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => openInventaire(inv.id)} style={{ ...btnLink, fontSize: '14px' }}>
                                                    {inv.statut === 'VALIDE' ? '👁️' : '✏️'}
                                                </button>
                                                {inv.statut === 'BROUILLON' && (
                                                    <>
                                                        <button onClick={() => editInventaire(inv)} title="Modifier Libellé" style={{ ...btnLink, textDecoration: 'none' }}>📝</button>
                                                        <button onClick={() => deleteInventaire(inv)} title="Supprimer" style={{ ...btnLink, color: '#e74c3c', textDecoration: 'none' }}>🗑️</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* PAGINATION CONTROLS */}
                        {totalPages > 1 && (
                            <div style={{ padding: '15px', display: 'flex', justifyContent: 'center', gap: '5px', background: '#f8f9fa' }}>
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ ...btnSecondary, padding: '5px 10px', opacity: currentPage === 1 ? 0.5 : 1 }}>Prev</button>
                                <span style={{ padding: '5px 10px', fontWeight: 'bold' }}>Page {currentPage} / {totalPages}</span>
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ ...btnSecondary, padding: '5px 10px', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "nouveau" && (
                <div style={{ maxWidth: '600px', margin: '40px auto', background: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>Configuration de l'inventaire</h2>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Libellé (Optionnel)</label>
                        <input
                            placeholder="Ex: Inventaire Fin d'année 2024"
                            value={newInvLibelle}
                            onChange={e => setNewInvLibelle(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <label style={labelStyle}>1. Type d'inventaire</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setNewInvType("GLOBAL")}
                                style={{
                                    ...btnOption,
                                    background: newInvType === 'GLOBAL' ? '#3498db' : '#ecf0f1',
                                    color: newInvType === 'GLOBAL' ? 'white' : '#333',
                                    opacity: newInvType === 'GLOBAL' ? 1 : 0.7
                                }}
                            >
                                <span style={{ display: 'block', fontSize: '24px', marginBottom: '5px' }}>🌍</span>
                                Global (Tout le stock)
                            </button>
                            <button
                                onClick={() => setNewInvType("RAYON")}
                                style={{
                                    ...btnOption,
                                    background: newInvType === 'RAYON' ? '#3498db' : '#ecf0f1',
                                    color: newInvType === 'RAYON' ? 'white' : '#333',
                                    opacity: newInvType === 'RAYON' ? 1 : 0.7
                                }}
                            >
                                <span style={{ display: 'block', fontSize: '24px', marginBottom: '5px' }}>📁</span>
                                Par Rayon(s)
                            </button>
                        </div>
                    </div>

                    {newInvType === 'RAYON' && (
                        <div style={{ marginBottom: '25px' }}>
                            <label style={labelStyle}>2. Sélectionner les rayons concernés</label>
                            <div style={{
                                maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px',
                                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px'
                            }}>
                                {rayons.map(r => (
                                    <label key={r.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                        background: selectedRayons.includes(r.id) ? '#eaf2f8' : 'white',
                                        borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent',
                                        borderColor: selectedRayons.includes(r.id) ? '#3498db' : 'transparent'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedRayons.includes(r.id)}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedRayons(prev => [...prev, r.id]);
                                                else setSelectedRayons(prev => prev.filter(id => id !== r.id));
                                            }}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: selectedRayons.includes(r.id) ? 'bold' : 'normal' }}>
                                            {r.libelle}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <button onClick={() => setActiveTab("dashboard")} style={btnSecondary}>Annuler</button>
                        <button onClick={createInventaire} style={{ ...btnPrimary, flex: 1 }}>
                            🚀 Commencer
                        </button>
                    </div>
                </div>
            )}

            {activeTab === "saisie" && currentInv && (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
                    {/* Move Modal */}
                    {movingArticleId && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ background: 'white', padding: '30px', borderRadius: '10px', width: '400px' }}>
                                <h3>Déplacer l'article de rayon</h3>
                                <p>Sélectionnez le nouveau rayon :</p>
                                <select value={targetRayonId} onChange={e => setTargetRayonId(e.target.value)} style={inputStyle}>
                                    <option value="">-- Choisir --</option>
                                    {rayons.map(r => <option key={r.id} value={r.id}>{r.libelle}</option>)}
                                </select>
                                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button onClick={() => { setMovingArticleId(null); setTargetRayonId(""); }} style={btnSecondary}>Annuler</button>
                                    <button onClick={moveArticle} style={btnPrimary}>Déplacer</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HEADER ACTIONS */}
                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <button onClick={() => setActiveTab("dashboard")} style={{ marginRight: '15px', border: 'none', background: 'transparent', fontSize: '16px', cursor: 'pointer' }}>⬅️ Retour</button>
                            <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#2c3e50' }}>Inventaire {currentInv.code}</span>
                            {currentInv.libelle && <span style={{ marginLeft: '10px', fontSize: '14px', color: '#3498db', fontWeight: 'bold' }}>{currentInv.libelle}</span>}
                        </div>

                        {currentInv.statut === 'BROUILLON' && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={refreshTheorique} style={{ ...btnAction, background: '#f39c12' }} title="Mettre à jour les stocks théoriques depuis la base">🔄 Rafraîchir</button>
                                {/* Allow if undefined or true */}
                                {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                    <>
                                        <button onClick={imprimerRecap} style={{ ...btnAction, background: '#8e44ad' }}>🖨️ Récapitulatif</button>
                                        <button onClick={() => utilsExportToExcel(lignes.map(l => ({
                                            'CIP': l.cip,
                                            'Désignation': l.designation,
                                            'Rayon': l.rayon_libelle,
                                            'Stock Théorique': l.stock_theorique,
                                            'Stock Compté': l.stock_compte,
                                            'Écart': l.ecart,
                                            'Prix Achat': l.prix_achat,
                                            'Valeur Stock': (l.stock_compte || 0) * l.prix_achat
                                        })), `Inventaire_${currentInv.code}`)} style={{ ...btnAction, background: '#107c41' }}>📊 Excel</button>
                                        <button onClick={() => imprimerFiche('AVEUGLE')} style={btnAction}>📄 Fiche</button>
                                        <button onClick={() => imprimerFiche('ECARTS')} style={btnAction}>⚠️ Écarts</button>
                                    </>
                                )}
                                <button onClick={validerInventaire} style={{ ...btnAction, background: '#27ae60', marginLeft: '20px' }}>✅ Valider</button>
                            </div>
                        )}
                        {/* Allow if undefined or true */}
                        {currentInv.statut === 'VALIDE' && (currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                            <>
                                <button onClick={imprimerRecap} style={{ ...btnAction, background: '#8e44ad' }}>🖨️ Récapitulatif</button>
                                <button onClick={() => utilsExportToExcel(lignes.map(l => ({
                                    'CIP': l.cip,
                                    'Désignation': l.designation,
                                    'Rayon': l.rayon_libelle,
                                    'Stock Théorique': l.stock_theorique,
                                    'Stock Compté': l.stock_compte,
                                    'Écart': l.ecart,
                                    'Prix Achat': l.prix_achat,
                                    'Valeur Stock': (l.stock_compte || 0) * l.prix_achat
                                })), `Inventaire_${currentInv.code}`)} style={{ ...btnAction, background: '#107c41', marginLeft: '10px' }}>📊 Excel</button>
                            </>
                        )}
                    </div>

                    {/* BARRE FILTRES + VALO */}
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
                        <input
                            placeholder="🔍 Rechercher un produit..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ ...inputStyle, width: '300px' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
                            <input type="checkbox" checked={filterEcart} onChange={e => setFilterEcart(e.target.checked)} />
                            <span>Afficher uniquement les écarts</span>
                        </label>

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', fontSize: '14px' }}>
                            <div style={{ background: '#e8f6f3', padding: '5px 10px', borderRadius: '5px', color: '#16a085' }}>
                                Valo. Théorique: <strong>{lignes.reduce((acc, l) => acc + (l.stock_theorique * l.prix_achat), 0).toLocaleString()}</strong>
                            </div>
                            <div style={{ background: '#fdedec', padding: '5px 10px', borderRadius: '5px', color: '#c0392b' }}>
                                Valo. Comptée: <strong>{lignes.reduce((acc, l) => acc + ((l.stock_compte || 0) * l.prix_achat), 0).toLocaleString()}</strong>
                            </div>
                        </div>
                    </div>

                    {/* TABLEAU SAISIE */}
                    <div style={{ flex: 1, overflow: 'auto', background: 'white', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                                <tr>
                                    <th style={thStyle}>Produit</th>
                                    <th style={thStyle}>Rayon</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Stock Machine</th>
                                    <th style={{ ...thStyle, textAlign: 'center', background: '#eaf2f8', borderBottom: '2px solid #3498db' }}>Qté Comptée (Réel)</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Écart</th>
                                    {currentInv.statut === 'BROUILLON' && <th style={thStyle}>Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {lignes
                                    .filter(l => l.designation.toLowerCase().includes(searchTerm.toLowerCase()) || l.cip.includes(searchTerm))
                                    .filter(l => !filterEcart || (filterEcart && (l.stock_compte || 0) !== l.stock_theorique))
                                    .map(ligne => {
                                        const ecart = ligne.ecart;
                                        const isModified = ligne.stock_compte !== null;
                                        return (
                                            <tr key={ligne.id} style={{ borderBottom: '1px solid #eee', background: isModified ? (ecart !== 0 ? '#fff5f5' : '#f0fff4') : 'white' }}>
                                                <td style={tdStyle}>
                                                    <strong>{ligne.designation}</strong><br />
                                                    <span style={{ color: '#95a5a6', fontSize: '11px' }}>{ligne.cip}</span>
                                                </td>
                                                <td style={tdStyle}>{ligne.rayon_libelle}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: '#7f8c8d' }}>{ligne.stock_theorique}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', padding: '5px' }}>
                                                    {currentInv.statut === 'BROUILLON' ? (
                                                        <input
                                                            type="number"
                                                            value={ligne.stock_compte === null ? '' : ligne.stock_compte}
                                                            onChange={e => updateCompte(ligne.id, e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    (e.currentTarget.parentElement?.parentElement?.nextElementSibling?.querySelector('input') as HTMLInputElement)?.focus();
                                                                }
                                                            }}
                                                            placeholder="..."
                                                            style={{
                                                                width: '80px', textAlign: 'center', padding: '8px', borderRadius: '5px',
                                                                border: '1px solid #bdc3c7', fontSize: '14px', fontWeight: 'bold',
                                                                background: isModified ? 'white' : '#f4f6f9'
                                                            }}
                                                        />
                                                    ) : (
                                                        <strong>{ligne.stock_compte}</strong>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {isModified && (
                                                        <span style={{
                                                            color: ecart === 0 ? '#27ae60' : (ecart < 0 ? '#e74c3c' : '#2980b9'),
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {ecart > 0 ? `+${ecart}` : ecart}
                                                        </span>
                                                    )}
                                                </td>
                                                {currentInv.statut === 'BROUILLON' && (
                                                    <td style={tdStyle}>
                                                        <button
                                                            title="Déplacer vers un autre rayon"
                                                            onClick={() => { setMovingArticleId(ligne.article_id); }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                                                        >
                                                            📦➡️
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}

// --- STYLES ---
const btnPrimary: React.CSSProperties = { background: '#2c3e50', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: '#95a5a6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const btnOption: React.CSSProperties = { flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const btnAction: React.CSSProperties = { background: '#3498db', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const btnLink: React.CSSProperties = { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline' };

const thStyle: React.CSSProperties = { padding: '15px', textAlign: 'left', color: '#7f8c8d', fontSize: '13px' };
const tdStyle: React.CSSProperties = { padding: '12px' };

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dcdcdc', boxSizing: 'border-box' };
