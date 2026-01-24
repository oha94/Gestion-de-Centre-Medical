import { useState, useEffect } from 'react';
import { getDb, getCompanyInfo } from '../../lib/db';
import { exportToExcel } from '../../lib/exportUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Commande({ currentUser }: { currentUser?: any }) {
    const [activeTab, setActiveTab] = useState<'SMART' | 'MANUAL' | 'HISTORY'>('SMART');
    const [cart, setCart] = useState<any[]>([]); // { id, designation, stock, qty, price, reason }
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<any[]>([]);

    // --- NEW STATES FOR ENHANCEMENTS ---
    const [fournisseurs, setFournisseurs] = useState<any[]>([]);
    const [orderMeta, setOrderMeta] = useState({
        fournisseurId: '',
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });
    const [history, setHistory] = useState<any[]>([]);
    const [showGraphModal, setShowGraphModal] = useState(false);
    const [selectedProductStats, setSelectedProductStats] = useState<any>(null); // { name, data: [] }

    // History Filters
    const [historySearch, setHistorySearch] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState(new Date().toISOString().slice(0, 8) + '01'); // Beginning of current month
    const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]); // Today

    // Smart Filters
    const [smartConfig, setSmartConfig] = useState({
        rupture: true, // Stock <= 0
        seuil: false,   // Stock <= 5
        surstock: false, // Stock > 4 (User request "les stocks superieurs a 4")
        critical: false, // Stock < 2 (User request "les stocks inferiurs a 2")
        restock: false, // Sold yesterday
        restockPeriod: 1
    });

    useEffect(() => {
        runMigrations();
        loadFournisseurs();
    }, []);

    useEffect(() => {
        if (activeTab === 'MANUAL') loadProducts();
        if (activeTab === 'HISTORY') loadHistory();
    }, [activeTab]);

    const runMigrations = async () => {
        const db = await getDb();
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS commandes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    numero_commande VARCHAR(50),
                    fournisseur_id INT,
                    date_commande DATETIME,
                    statut VARCHAR(50),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS commande_details (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    commande_id INT,
                    article_id INT,
                    quantite_demandee INT,
                    prix_achat_estime DOUBLE
                )
            `);
        } catch (e) { console.error("Migration error", e); }
    };

    const loadFournisseurs = async () => {
        try {
            const db = await getDb();
            const res = await db.select<any[]>("SELECT * FROM stock_fournisseurs ORDER BY nom ASC");
            setFournisseurs(res);
        } catch (e) { console.error(e); }
    };

    const loadProducts = async () => {
        const db = await getDb();
        console.log("Loading products with CAST...");
        const res = await db.select<any[]>("SELECT id, designation, CAST(quantite_stock AS CHAR) as quantite_stock, CAST(prix_achat AS CHAR) as prix_achat FROM stock_articles ORDER BY designation ASC");
        setProducts(res.map(p => ({ ...p, quantite_stock: parseFloat(p.quantite_stock || "0"), prix_achat: parseFloat(p.prix_achat || "0") })));
    };

    const loadHistory = async () => {
        const db = await getDb();

        let query = `
            SELECT c.*, f.nom as fournisseur_nom,
                   (SELECT COUNT(*) FROM commande_details cd WHERE cd.commande_id = c.id) as items_count
            FROM commandes c
            LEFT JOIN stock_fournisseurs f ON c.fournisseur_id = f.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (historyStartDate) {
            query += " AND DATE(c.date_commande) >= ?";
            params.push(historyStartDate);
        }
        if (historyEndDate) {
            query += " AND DATE(c.date_commande) <= ?";
            params.push(historyEndDate);
        }
        if (historySearch) {
            query += " AND (c.numero_commande LIKE ? OR f.nom LIKE ?)";
            params.push(`%${historySearch}%`, `%${historySearch}%`);
        }

        query += " ORDER BY c.date_commande DESC";

        const res = await db.select<any[]>(query, params);
        setHistory(res);
    };

    // Reload history when filters change (debounced for text could be better, but direct effect is simple for now)
    useEffect(() => {
        if (activeTab === 'HISTORY') loadHistory();
    }, [historyStartDate, historyEndDate, historySearch]);

    const loadProductStats = async (articleId: number, articleName: string) => {
        try {
            const db = await getDb();
            // Get sales for last 6 months grouped by month
            // MySQL/MariaDB syntax
            await db.select<any[]>(`
                SELECT DATE_FORMAT(v.date_vente, '%Y-%m') as date_mois, SUM(1) as qty_approx
                FROM ventes v
                WHERE v.article_id = ? 
                  AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY date_mois
                ORDER BY date_mois ASC
            `, [articleId]);

            // Note: Since 'quantite' is embedded in text, using accurate Sum is hard in pure SQL without a parser function. 
            // We use COUNT(*) as approximation or we would need to fetch all and JS parse.
            // For now, let's just fetch all rows and parse in JS for accuracy.
            const resRaw = await db.select<any[]>(`
                SELECT v.date_vente, v.acte_libelle
                FROM ventes v
                WHERE v.article_id = ? 
                  AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            `, [articleId]);

            const map: Record<string, number> = {};
            resRaw.forEach(r => {
                const month = r.date_vente.substring(0, 7); // YYYY-MM
                const match = r.acte_libelle.match(/\(x(\d+)\)/);
                const q = match ? parseInt(match[1]) : 1;
                map[month] = (map[month] || 0) + q;
            });

            const data = Object.keys(map).sort().map(k => ({
                name: k,
                ventes: map[k]
            }));

            setSelectedProductStats({ name: articleName, data });
            setShowGraphModal(true);
        } catch (e) { console.error(e); }
    };

    const runSmartAnalysis = async () => {
        setLoading(true);
        setCart([]);
        try {
            const db = await getDb();
            let proposals: any = {};

            // 1. Rupture (Stock <= 0)
            if (smartConfig.rupture) {
                const res = await db.select<any[]>(`
                    SELECT id, designation, CAST(quantite_stock AS CHAR) as quantite_stock, CAST(prix_achat AS CHAR) as prix_achat 
                    FROM stock_articles 
                    WHERE quantite_stock <= 0
                `);
                res.forEach(p => {
                    proposals[p.id] = { ...p, reason: 'Rupture (<=0)', suggested: 10 };
                });
            }

            // 2. Critical (Stock < 2) - User Request
            if (smartConfig.critical) {
                const res = await db.select<any[]>(`
                    SELECT id, designation, CAST(quantite_stock AS CHAR) as quantite_stock, CAST(prix_achat AS CHAR) as prix_achat 
                    FROM stock_articles 
                    WHERE quantite_stock > 0 AND quantite_stock < 2
                `);
                res.forEach(p => {
                    if (!proposals[p.id]) proposals[p.id] = { ...p, reason: 'Critique (<2)', suggested: 5 };
                });
            }

            // 3. Seuil (Stock <= 5)
            if (smartConfig.seuil) {
                const res = await db.select<any[]>(`
                    SELECT id, designation, CAST(quantite_stock AS CHAR) as quantite_stock, CAST(prix_achat AS CHAR) as prix_achat 
                    FROM stock_articles 
                    WHERE quantite_stock > 0 AND quantite_stock <= 5
                `);
                res.forEach(p => {
                    if (!proposals[p.id]) proposals[p.id] = { ...p, reason: 'Seuil Bas (<=5)', suggested: 5 };
                });
            }

            // 4. Surstock (Stock > 4) - User Request (To visualize surplus?)
            // Usually we don't order surplus, but user asked to "voir les stocks superieurs a 4". 
            // Maybe as a filter to check? If they check it, maybe they want to see them even if suggested is 0?
            // Or maybe they meant "Commande pour atteindre > 4"? 
            // Assuming user wants to SEE items with stock > 4 to potentially order IF they sell well?
            // Or maybe just to list them. I will list them with 0 suggested so user can decide.
            if (smartConfig.surstock) {
                const res = await db.select<any[]>(`
                    SELECT id, designation, CAST(quantite_stock AS CHAR) as quantite_stock, CAST(prix_achat AS CHAR) as prix_achat 
                    FROM stock_articles 
                    WHERE quantite_stock > 4
                `);
                res.forEach(p => {
                    if (!proposals[p.id]) proposals[p.id] = { ...p, reason: 'Stock Confort (>4)', suggested: 0 };
                });
            }

            // 5. Restocking (Sales based)
            if (smartConfig.restock) {
                const resSales = await db.select<any[]>(`
                    SELECT v.article_id, v.acte_libelle, sa.designation, CAST(sa.quantite_stock AS CHAR) as quantite_stock, CAST(sa.prix_achat AS CHAR) as prix_achat
                    FROM ventes v
                    JOIN stock_articles sa ON v.article_id = sa.id
                    WHERE v.date_vente >= DATE_SUB(CURDATE(), INTERVAL ${smartConfig.restockPeriod} DAY)
                      AND v.article_id IS NOT NULL
                `);

                const salesMap: Record<number, number> = {};

                resSales.forEach(row => {
                    const match = row.acte_libelle.match(/\(x(\d+)\)/);
                    const qteSold = match ? parseInt(match[1]) : 1;
                    if (!salesMap[row.article_id]) salesMap[row.article_id] = 0;
                    salesMap[row.article_id] += qteSold;

                    if (!proposals[row.article_id]) {
                        proposals[row.article_id] = {
                            id: row.article_id,
                            designation: row.designation,
                            quantite_stock: row.quantite_stock,
                            prix_achat: row.prix_achat,
                            reason: `Vendu ${qteSold} récemment`,
                            suggested: 0
                        };
                    }
                });

                Object.keys(salesMap).forEach(key => {
                    const id = parseInt(key);
                    const totalSold = salesMap[id];
                    const p = proposals[id];
                    if (p) {
                        const qtyToOrder = Math.max(1, totalSold);
                        if (p.reason.includes('Vendu')) {
                            p.reason = `Vendu ${totalSold} récemment`;
                            p.suggested = qtyToOrder;
                        } else {
                            p.reason += ` + Vendu ${totalSold}`;
                            p.suggested = Math.max(p.suggested, qtyToOrder);
                        }
                    }
                });
            }

            setCart(Object.values(proposals).map((p: any) => ({
                id: p.id,
                designation: p.designation,
                stock: p.quantite_stock,
                qty: p.suggested || 0, // Map 'suggested' to 'qty'
                price: p.prix_achat || 0, // Map 'prix_achat' to 'price'
                reason: p.reason
            })));

        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'analyse");
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: any) => {
        if (cart.find(c => c.id === product.id)) return;
        setCart([...cart, {
            id: product.id,
            designation: product.designation,
            stock: product.quantite_stock,
            qty: 1,
            price: product.prix_achat || 0,
            reason: 'Manuel'
        }]);
    };

    const updateItem = (id: number, field: string, val: any) => {
        setCart(cart.map(c => c.id === id ? { ...c, [field]: val } : c));
    };

    const removeItem = (id: number) => {
        setCart(cart.filter(c => c.id !== id));
    };

    // --- ACTIONS ---
    const saveOrder = async () => {
        if (!orderMeta.fournisseurId) return alert("Veuillez sélectionner un fournisseur.");
        if (cart.length === 0) return alert("Le panier est vide.");

        if (!confirm("Enregistrer cette commande ?")) return;

        try {
            const db = await getDb();
            const num = `CMD-${Date.now()}`;
            const fullDate = `${orderMeta.date} ${orderMeta.heure}`;

            const res = await db.execute(
                "INSERT INTO commandes (numero_commande, fournisseur_id, date_commande, statut) VALUES (?, ?, ?, 'BROUILLON')",
                [num, orderMeta.fournisseurId, fullDate]
            );
            const cmdId = res.lastInsertId;

            for (const item of cart) {
                if (item.qty > 0) {
                    await db.execute(
                        "INSERT INTO commande_details (commande_id, article_id, quantite_demandee, prix_achat_estime) VALUES (?, ?, ?, ?)",
                        [cmdId, item.id, item.qty, item.price]
                    );
                }
            }

            // Fetch minimal info for printing the just-saved order
            // We construct the 'order' object manually to avoid re-fetching immediately or missing data
            const savedOrder = {
                id: cmdId,
                numero_commande: num,
                date_commande: fullDate,
                statut: 'BROUILLON',
                fournisseur_nom: fournisseurs.find(f => f.id.toString() === orderMeta.fournisseurId)?.nom
            };

            if (confirm("✅ Commande enregistrée ! Voulez-vous l'imprimer maintenant ?")) {
                printHistoryOrder(savedOrder);
            }

            setCart([]);
            setActiveTab('HISTORY');
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'enregistrement");
        }
    };

    const deleteOrder = async (id: number) => {
        if (!confirm("Supprimer définitivement cette commande ?")) return;
        try {
            const db = await getDb();
            await db.execute("DELETE FROM commandes WHERE id = ?", [id]);
            await db.execute("DELETE FROM commande_details WHERE commande_id = ?", [id]);
            loadHistory();
        } catch (e) { console.error(e); }
    };

    const editOrder = async (cmd: any) => {
        if (!confirm("Recharger cette commande dans le panier ? (Le panier actuel sera perdu)")) return;
        try {
            const db = await getDb();
            const details = await db.select<any[]>(`
                SELECT cd.*, a.designation, CAST(a.quantite_stock AS DOUBLE) as stock
                FROM commande_details cd
                JOIN stock_articles a ON cd.article_id = a.id
                WHERE cd.commande_id = ?
            `, [cmd.id]);

            setOrderMeta({
                fournisseurId: cmd.fournisseur_id,
                date: cmd.date_commande.split(' ')[0],
                heure: new Date(cmd.date_commande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            });

            setCart(details.map(d => ({
                id: d.article_id,
                designation: d.designation,
                stock: d.stock,
                qty: d.quantite_demandee,
                price: d.prix_achat_estime,
                reason: 'Chargé depuis historique'
            })));

            setActiveTab('MANUAL'); // Switch to Edit view
        } catch (e) { console.error(e); }
    };

    const printOrder = async () => {
        const company = await getCompanyInfo();
        const totalHT = cart.reduce((acc, c) => acc + (c.qty * c.price), 0);
        // Use '_blank' for target to avoid issues with empty target name in some environments
        const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bon de Commande (Brouillon)</title>
            <style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                .company-sub { font-size: 10px; color: #7f8c8d; white-space: pre-line; }
                .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }

                .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                tr:last-child td { border-bottom: none; }

                .total-section { display: flex; justify-content: flex-end; margin-top: 20px; }
                .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #f9f9f9; border: 1px solid #eee; color: #2c3e50; }
                
                .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.05); z-index: -1; font-weight: bold; }
                .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body>
            <div class="watermark">BROUILLON</div>
            <div class="header">
                <div>
                     <div class="company-name">${company.nom}</div>
                    <div class="company-sub">${company.adresse || ''}
${company.telephone ? 'Tel: ' + company.telephone : ''}
${company.email ? 'Email: ' + company.email : ''}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Document</div>
                    <div class="doc-title">BON DE COMMANDE</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Fournisseur</label>
                    <span>${fournisseurs.find(f => f.id.toString() === orderMeta.fournisseurId)?.nom || 'Non spécifié'}</span>
                </div>
                <div class="meta-item">
                    <label>Date Prévue</label>
                    <span>${orderMeta.date} à ${orderMeta.heure}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Désignation</th>
                        <th style="text-align: center;">Qté</th>
                        <th style="text-align: right;">P.U. Est.</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${cart.map(c => `
                        <tr>
                            <td>${c.designation}</td>
                            <td style="text-align: center;"><strong>${c.qty}</strong></td>
                            <td style="text-align: right;">${c.price.toLocaleString()}</td>
                            <td style="text-align: right;">${(c.qty * c.price).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-box">
                    TOTAL ESTIMÉ : ${totalHT.toLocaleString()} F CFA
                </div>
            </div>

            <div class="footer">
                Imprimé le ${new Date().toLocaleString('fr-FR')} (Brouillon) par ${currentUser?.nom_complet || 'Admin'}
            </div>
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
            iframe.contentWindow?.focus();
            setTimeout(() => {
                iframe.contentWindow?.print();
                document.body.removeChild(iframe);
            }, 500);
        }
    };

    const printHistoryOrder = async (order: any) => {
        try {
            // 1. Fetch Data
            const db = await getDb();
            const details = await db.select<any[]>(`
                SELECT cd.*, a.designation
                FROM commande_details cd
                JOIN stock_articles a ON cd.article_id = a.id
                WHERE cd.commande_id = ?
            `, [order.id]);

            const totalHT = details.reduce((acc, c) => acc + (c.quantite_demandee * c.prix_achat_estime), 0);
            const dateStr = new Date(order.date_commande).toLocaleString('fr-FR');

            // 2. Generate HTML with Elegant A4 Design
            const content = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Bon de Commande ${order.numero_commande}</title>
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

                            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                            th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                            td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                            tr:last-child td { border-bottom: none; }

                            .total-section { display: flex; justify-content: flex-end; margin-top: 20px; }
                            .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #f9f9f9; border: 1px solid #eee; color: #2c3e50; }

                            .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #f5f5f5; padding-top: 10px; }
                        </style>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                    </head>
                    <body>
                        <div class="header">
                            <div>
                                <div class="company-name">CENTRE MÉDICAL FOCOLARI</div>
                                <div class="company-sub">Pharmacie & Logistique</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Bon de Commande</div>
                                <div class="doc-title">${order.numero_commande}</div>
                            </div>
                        </div>

                        <div class="meta-grid">
                            <div class="meta-item">
                                <label>Fournisseur</label>
                                <span>${order.fournisseur_nom || 'Non spécifié'}</span>
                            </div>
                            <div class="meta-item">
                                <label>Date Commande</label>
                                <span>${dateStr}</span>
                            </div>
                            <div class="meta-item">
                                <label>Statut</label>
                                <span>${order.statut}</span>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Désignation</th>
                                    <th style="text-align: center;">Qté</th>
                                    <th style="text-align: right;">P.U. Est.</th>
                                    <th style="text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.map(c => `
                                <tr>
                                    <td>${c.designation}</td>
                                    <td style="text-align: center;"><strong>${c.quantite_demandee}</strong></td>
                                    <td style="text-align: right;">${c.prix_achat_estime.toLocaleString()} F</td>
                                    <td style="text-align: right;">${(c.quantite_demandee * c.prix_achat_estime).toLocaleString()} F</td>
                                </tr>
                            `).join('')}
                            </tbody>
                        </table>

                        <div class="total-section">
                            <div class="total-box">
                                TOTAL : ${totalHT.toLocaleString()} F CFA
                            </div>
                        </div>

                        <div class="footer">
                            Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Utilisateur'}
                        </div>
                    </body>
                </html>
            `;

            // 3. Create Invisible Iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            // 4. Print
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(content);
                doc.close();
                iframe.contentWindow?.focus();
                setTimeout(() => {
                    iframe.contentWindow?.print();
                    document.body.removeChild(iframe);
                }, 500);
            }

        } catch (e) {
            console.error("Error printing history order", e);
            alert("Erreur lors de l'impression");
        }
    };

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button onClick={() => setActiveTab('SMART')} style={tabStyle(activeTab === 'SMART', '#667eea')}>✨ Assistant Intelligent</button>
                <button onClick={() => setActiveTab('MANUAL')} style={tabStyle(activeTab === 'MANUAL', '#3182ce')}>✋ Saisie Manuelle</button>
                <button onClick={() => setActiveTab('HISTORY')} style={tabStyle(activeTab === 'HISTORY', '#e67e22')}>📜 Historique</button>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>

                {activeTab === 'HISTORY' ? (
                    <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '20px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Historique des Commandes</h3>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Rech. N° ou Fournisseur..."
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                    style={{ ...inputStyle, width: '200px' }}
                                />
                                <input
                                    type="date"
                                    value={historyStartDate}
                                    onChange={e => setHistoryStartDate(e.target.value)}
                                    style={{ ...inputStyle, width: 'auto' }}
                                />
                                <span style={{ color: '#aaa' }}>à</span>
                                <input
                                    type="date"
                                    value={historyEndDate}
                                    onChange={e => setHistoryEndDate(e.target.value)}
                                    style={{ ...inputStyle, width: 'auto' }}
                                />
                                <button onClick={loadHistory} style={{ ...actionBtn('#3182ce'), padding: '8px 15px' }}>Actualiser</button>
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>N°</th>
                                    <th style={{ padding: '10px' }}>Date</th>
                                    <th style={{ padding: '10px' }}>Fournisseur</th>
                                    <th style={{ padding: '10px' }}>Articles</th>
                                    <th style={{ padding: '10px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(h => (
                                    <tr key={h.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{h.numero_commande}</td>
                                        <td style={{ padding: '10px' }}>{new Date(h.date_commande).toLocaleString()}</td>
                                        <td style={{ padding: '10px' }}>{h.fournisseur_nom || '-'}</td>
                                        <td style={{ padding: '10px' }}>{h.items_count}</td>
                                        <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                                            {/* Allow if undefined or true */}
                                            {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                                <button onClick={() => printHistoryOrder(h)} style={{ cursor: 'pointer', border: 'none', background: '#3498db', color: 'white', padding: '5px 10px', borderRadius: '5px' }}>🖨️</button>
                                            )}
                                            <button onClick={() => editOrder(h)} style={{ cursor: 'pointer', border: 'none', background: '#f6ad55', color: 'white', padding: '5px 10px', borderRadius: '5px' }}>✏️ Modifier</button>
                                            <button onClick={() => deleteOrder(h.id)} style={{ cursor: 'pointer', border: 'none', background: '#e74c3c', color: 'white', padding: '5px 10px', borderRadius: '5px' }}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <>
                        {/* LEFT: CONFIG/SEARCH */}
                        <div style={{ width: '320px', background: 'white', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                            {/* META INPUTS */}
                            <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#64748b' }}>INFO COMMANDE</div>
                                <select
                                    value={orderMeta.fournisseurId}
                                    onChange={e => setOrderMeta({ ...orderMeta, fournisseurId: e.target.value })}
                                    style={inputStyle}
                                >
                                    <option value="">-- Choisir Fournisseur --</option>
                                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                                </select>
                                <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                    <input type="date" value={orderMeta.date} onChange={e => setOrderMeta({ ...orderMeta, date: e.target.value })} style={inputStyle} />
                                    <input type="time" value={orderMeta.heure} onChange={e => setOrderMeta({ ...orderMeta, heure: e.target.value })} style={inputStyle} />
                                </div>
                            </div>

                            {activeTab === 'SMART' ? (
                                <>
                                    <h4 style={{ margin: '10px 0 5px 0' }}>Critères Intelligents</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <Checkbox label="🚨 En Rupture (Stock <= 0)" checked={smartConfig.rupture} onChange={(c: boolean) => setSmartConfig({ ...smartConfig, rupture: c })} color="#feb2b2" />
                                        <Checkbox label="🔥 Critique (Stock < 2)" checked={smartConfig.critical} onChange={(c: boolean) => setSmartConfig({ ...smartConfig, critical: c })} color="#fbd38d" />
                                        <Checkbox label="⚠️ Seuil Bas (Stock <= 5)" checked={smartConfig.seuil} onChange={(c: boolean) => setSmartConfig({ ...smartConfig, seuil: c })} color="#faf089" />
                                        <Checkbox label="📦 Surstock (Stock > 4)" checked={smartConfig.surstock} onChange={(c: boolean) => setSmartConfig({ ...smartConfig, surstock: c })} color="#9ae6b4" />

                                        <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                            <Checkbox label="📅 Réassort selon Ventes" checked={smartConfig.restock} onChange={(c: boolean) => setSmartConfig({ ...smartConfig, restock: c })} color="#bee3f8" />
                                            {smartConfig.restock && (
                                                <select
                                                    value={smartConfig.restockPeriod}
                                                    onChange={e => setSmartConfig({ ...smartConfig, restockPeriod: parseInt(e.target.value) })}
                                                    style={{ ...inputStyle, marginTop: '5px', fontSize: '12px' }}
                                                >
                                                    <option value={1}>Hier (24h)</option>
                                                    <option value={7}>7 Jours</option>
                                                    <option value={30}>30 Jours</option>
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={runSmartAnalysis} disabled={loading} style={actionBtn('#667eea')}>
                                        {loading ? 'Analyse...' : 'GÉNÉRER PROPOSITION'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h4 style={{ margin: '10px 0' }}>Catalogue Produits</h4>
                                    <input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {products.filter(p => p.designation.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                                            <div key={p.id} onClick={() => addToCart(p)} style={{ padding: '8px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '13px' }}>
                                                <div style={{ fontWeight: 'bold' }}>{p.designation}</div>
                                                <div style={{ color: '#7f8c8d' }}>Stock: {p.quantite_stock}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RIGHT: CART */}
                        <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>🛒 Panier de Commande</h3>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50' }}>
                                    Total: {cart.reduce((a, c) => a + (c.qty * c.price), 0).toLocaleString()} F
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={thStyle}>Produit</th>
                                            <th style={thStyle}>Stock</th>
                                            <th style={thStyle}>Raison</th>
                                            <th style={thStyle}>Qté</th>
                                            <th style={thStyle}>P.U.</th>
                                            <th style={thStyle}>Total</th>
                                            <th style={thStyle}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cart.map(item => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ ...tdStyle, cursor: 'pointer', color: '#3182ce', textDecoration: 'underline' }} onClick={() => loadProductStats(item.id, item.designation)}>
                                                    {item.designation}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', color: item.stock < 2 ? 'red' : 'black' }}>{item.stock}</td>
                                                <td style={{ ...tdStyle, fontSize: '11px', color: '#7f8c8d' }}>{item.reason}</td>
                                                <td style={tdStyle}><input type="number" value={item.qty} onChange={e => updateItem(item.id, 'qty', parseInt(e.target.value))} style={qtyInput} /></td>
                                                <td style={tdStyle}><input type="number" value={item.price} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value))} style={{ ...qtyInput, width: '80px' }} /></td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{(item.qty * item.price).toLocaleString()}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }} onClick={() => removeItem(item.id)}>❌</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setCart([])} style={{ ...actionBtn('#cbd5e0'), color: '#333' }}>Vider</button>
                                {/* Allow if permission is true OR undefined (for backward compat/admin) */}
                                {(currentUser?.can_print !== false && currentUser?.can_print !== 0) && (
                                    <>
                                        <button onClick={() => exportToExcel(cart.map(c => ({ Designation: c.designation, Quantite: c.qty, PU: c.price, Total: c.qty * c.price })), `Commande_Brouillon_${new Date().toISOString().slice(0, 10)}`)} style={{ ...actionBtn('#107c41') }}>📊 Excel</button>
                                        <button onClick={printOrder} style={{ ...actionBtn('#2d3748') }}>🖨️ Aperçu</button>
                                    </>
                                )}
                                <button onClick={saveOrder} style={{ ...actionBtn('#48bb78') }}>💾 ENREGISTRER</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* GRAPH MODAL */}
            {showGraphModal && selectedProductStats && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3>📊 Variation Ventes : {selectedProductStats.name}</h3>
                            <button onClick={() => setShowGraphModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                        </div>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedProductStats.data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="ventes" stroke="#8884d8" activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                            Affiche les 6 derniers mois d'activité
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- COMPONENTS & STYLES ---
const Checkbox = ({ label, checked, onChange, color }: any) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: checked ? color : '#fff', border: `1px solid ${checked ? 'transparent' : '#eee'} `, borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span style={{ fontSize: '13px', fontWeight: checked ? 'bold' : 'normal' }}>{label}</span>
    </label>
);

const tabStyle = (active: boolean, color: string) => ({
    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
    background: active ? color : '#e2e8f0', color: active ? 'white' : '#4a5568',
    fontWeight: 'bold', cursor: 'pointer', transition: '0.2s'
});

const inputStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0' };
const qtyInput = { width: '60px', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e0', textAlign: 'center' as const };
const actionBtn = (bg: string) => ({ padding: '10px 20px', borderRadius: '8px', border: 'none', background: bg, color: 'white', fontWeight: 'bold', cursor: 'pointer' });
const thStyle = { padding: '10px', fontSize: '12px', color: '#718096', textAlign: 'left' as const };
const tdStyle = { padding: '10px', fontSize: '14px', borderBottom: '1px solid #eee' };
const modalOverlay = { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalContent = { background: 'white', padding: '30px', borderRadius: '15px', width: '600px', maxWidth: '90%' };
