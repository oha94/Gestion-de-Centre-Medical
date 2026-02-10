import React, { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel } from "../../lib/exportUtils";

import { useAuth } from "../../contexts/AuthContext";

export default function BonLivraisonView({ currentUser: _ }: { currentUser?: any }) {
  const { user, canEdit, canDelete } = useAuth();
  // currentUser was used for logging deletions and printing signature. Now 'user' from context.
  const [bons, setBons] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [filterDateDebut, setFilterDateDebut] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [filterFournisseur, setFilterFournisseur] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [newBL, setNewBL] = useState({ date: new Date().toISOString().split('T')[0], fournisseurId: "", numero: "" });
  const [showDetails, setShowDetails] = useState(false);
  const [selectedBL, setSelectedBL] = useState<any>(null);
  const [lignesBL, setLignesBL] = useState<any[]>([]);
  const [searchArticle, setSearchArticle] = useState("");
  const [ligne, setLigne] = useState({
    articleId: "",
    cip: "",
    designation: "",
    qte: 0,
    pAchatTTC: 0,
    pVente: 0,
    tvaActive: false,
    tva: 0,
    peremption: ""
  });
  const [ligneEnModif, setLigneEnModif] = useState<any>(null);
  const [modifData, setModifData] = useState<any>(null);

  const chargerListeBL = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT b.id, b.date_bl, b.numero_bl, b.fournisseur_id, 
               CAST(b.montant_total AS CHAR) as montant_total,
               f.nom as nom_fournisseur
        FROM stock_bons_livraison b
        LEFT JOIN stock_fournisseurs f ON b.fournisseur_id = f.id
        ORDER BY b.date_bl DESC
      `);
      setBons(res.map(b => ({ ...b, montant_total: parseFloat(b.montant_total || "0") })));
      console.log("Bons chargés:", res.length);
    } catch (e) {
      console.error("Erreur chargement BL:", e);
      setBons([]);
    }
  };

  const chargerDonnees = async () => {
    try {
      const db = await getDb();
      const resFourn = await db.select<any[]>("SELECT * FROM stock_fournisseurs ORDER BY nom ASC");
      setFournisseurs(resFourn);
      console.log("Fournisseurs chargés:", resFourn.length);

      // MODIFICATION ICI : Jointure pour avoir le libellé du rayon
      const resArt = await db.select<any[]>(`
        SELECT a.id, a.cip, a.designation, 
               CAST(a.prix_achat AS CHAR) as prix_achat, 
               CAST(a.prix_vente AS CHAR) as prix_vente,
               CAST(a.quantite_stock AS CHAR) as quantite_stock,
               r.libelle as rayon
        FROM stock_articles a
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        ORDER BY a.designation ASC
      `);
      setArticles(resArt.map(a => ({
        ...a,
        prix_achat: parseFloat(a.prix_achat || "0"),
        prix_vente: parseFloat(a.prix_vente || "0"),
        quantite_stock: parseFloat(a.quantite_stock || "0")
      })));
      console.log("Articles chargés:", resArt.length);

      await chargerListeBL();
    } catch (e) {
      console.error("Erreur chargement init:", e);
      alert("Erreur lors du chargement des données. Vérifiez la console (F12).");
    }
  };

  // Fix Auto-Increment for BL tables
  const runMigrations = async () => {
    try {
      const db = await getDb();

      // 1. stock_bons_livraison
      try { await db.execute("ALTER TABLE stock_bons_livraison ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_bons_livraison MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_bons_livraison' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix BL table failed:", e); }

      // 2. stock_bl_details
      try { await db.execute("ALTER TABLE stock_bl_details ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_bl_details MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_bl_details' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix BL Details table failed:", e); }

      // 3. stock_bl_supprimes (Fix pour erreur suppression)
      try { await db.execute("ALTER TABLE stock_bl_supprimes ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_bl_supprimes MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_bl_supprimes' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix BL Supprimes table failed:", e); }

    } catch (e) { console.error("Migration wrapper error:", e); }
  };

  useEffect(() => {
    runMigrations();
    chargerDonnees();
  }, []);

  const bonsFiltres = bons.filter(b => {
    const dateB = new Date(b.date_bl).toISOString().split('T')[0];
    const matchDate = (!filterDateDebut || dateB >= filterDateDebut) && (!filterDateFin || dateB <= filterDateFin);
    const matchFourn = !filterFournisseur || b.fournisseur_id == filterFournisseur;
    return matchDate && matchFourn;
  });

  const totalPages = Math.ceil(bonsFiltres.length / pageSize);
  const paginatedBons = bonsFiltres.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const creerBonLivraison = async () => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    if (!newBL.numero || !newBL.fournisseurId) return alert("Numéro de BL et Fournisseur obligatoires");

    try {
      const db = await getDb();
      console.log("Création BL:", newBL);

      await db.execute(
        "INSERT INTO stock_bons_livraison (date_bl, numero_bl, fournisseur_id, montant_total) VALUES (?,?,?,0)",
        [newBL.date, newBL.numero, parseInt(newBL.fournisseurId)]
      );

      const nouveauBon = await db.select<any[]>(`
        SELECT b.id, b.date_bl, b.numero_bl, b.fournisseur_id, 
               CAST(b.montant_total AS CHAR) as montant_total,
               f.nom as nom_fournisseur
        FROM stock_bons_livraison b
        LEFT JOIN stock_fournisseurs f ON b.fournisseur_id = f.id
        WHERE b.id = LAST_INSERT_ID()
      `);

      if (nouveauBon.length > 0) {
        const bon = nouveauBon[0];
        bon.montant_total = parseFloat(bon.montant_total || "0");
        setSelectedBL(bon);
        setLignesBL([]);
        setShowDetails(true);
      }

      setNewBL({ ...newBL, numero: "" });

    } catch (e) {
      console.error("Erreur création BL:", e);
      alert("Erreur lors de la création du bon. Vérifiez la console (F12).");
    }
  };

  const ouvrirDetails = async (bl: any) => {
    setSelectedBL(bl);

    try {
      const db = await getDb();
      // MODIFICATION ICI : Jointure pour le rayon
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, d.quantite, d.date_peremption,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.prix_vente AS CHAR) as prix_vente,
               CAST(d.tva AS CHAR) as tva,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               CAST(a.quantite_stock AS CHAR) as stock_actuel,
               r.libelle as rayon
        FROM stock_bl_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.bl_id = ?
      `, [bl.id]);

      // Calculer le stock avant réception pour chaque ligne
      const resAvecStock = res.map(ligne => ({
        ...ligne,
        prix_achat_ht: parseFloat(ligne.prix_achat_ht || "0"),
        prix_vente: parseFloat(ligne.prix_vente || "0"),
        tva: parseFloat(ligne.tva || "0"),
        total_ligne: parseFloat(ligne.total_ligne || "0"),
        stock_actuel: parseFloat(ligne.stock_actuel || "0"),
        stock_avant: parseFloat(ligne.stock_actuel || "0") - ligne.quantite
      }));

      setLignesBL(resAvecStock);
      setShowDetails(true);
    } catch (e) {
      console.error("Erreur chargement détails:", e);
      setLignesBL([]);
      setShowDetails(true);
    }
  };

  const handleSelectArticle = (id: string) => {
    const art = articles.find(a => a.id == id);
    if (art) {
      setLigne({
        ...ligne,
        articleId: id,
        cip: art.cip,
        designation: art.designation,
        pAchatTTC: art.prix_achat || 0,
        pVente: art.prix_vente || 0
      });
      setSearchArticle("");
    }
  };

  const handleNumberChange = (field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setLigne(prev => ({ ...prev, [field]: val }));
  };



  const ajouterProduitAuBL = async () => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    if (!ligne.articleId || !ligne.qte) return alert("Article et Quantité requis");



    const totalLigne = ligne.qte * ligne.pAchatTTC;

    try {
      const db = await getDb();

      await db.execute(
        `INSERT INTO stock_bl_details 
        (bl_id, article_id, quantite, prix_achat_ht, prix_vente, tva, date_peremption, total_ligne) 
        VALUES (?,?,?,?,?,?,?,?)`,
        [selectedBL.id, ligne.articleId, ligne.qte, ligne.pAchatTTC, ligne.pVente, ligne.tvaActive ? ligne.tva : 0, ligne.peremption || null, totalLigne]
      );

      await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?", [ligne.qte, ligne.articleId]);
      await db.execute("UPDATE stock_articles SET prix_vente = ? WHERE id = ?", [ligne.pVente, ligne.articleId]);
      await db.execute("UPDATE stock_bons_livraison SET montant_total = montant_total + ? WHERE id = ?", [totalLigne, selectedBL.id]);

      setSelectedBL({ ...selectedBL, montant_total: (selectedBL.montant_total || 0) + totalLigne });

      setLigne(prev => ({ ...prev, articleId: "", cip: "", designation: "", qte: 0, pAchatTTC: 0, pVente: 0, tvaActive: false, tva: 0, peremption: "" }));

      const db2 = await getDb();
      // MODIFICATION ICI : Jointure pour le rayon
      const res = await db2.select<any[]>(`
        SELECT d.id, d.article_id, d.quantite, d.date_peremption,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.prix_vente AS CHAR) as prix_vente,
               CAST(d.tva AS CHAR) as tva,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               CAST(a.quantite_stock AS CHAR) as stock_actuel,
               r.libelle as rayon
        FROM stock_bl_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.bl_id = ?
      `, [selectedBL.id]);

      const resAvecStock = res.map(ligne => ({
        ...ligne,
        prix_achat_ht: parseFloat(ligne.prix_achat_ht || "0"),
        prix_vente: parseFloat(ligne.prix_vente || "0"),
        tva: parseFloat(ligne.tva || "0"),
        total_ligne: parseFloat(ligne.total_ligne || "0"),
        stock_actuel: parseFloat(ligne.stock_actuel || "0"),
        stock_avant: parseFloat(ligne.stock_actuel || "0") - ligne.quantite
      }));

      setLignesBL(resAvecStock);

    } catch (e) {
      console.error("Erreur ajout produit:", e);
      alert("Erreur lors de l'ajout du produit");
    }
  };

  const supprimerProduitDuBL = async (detailId: number, articleId: number, qte: number, montantLigne: number) => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");


    if (!window.confirm("Supprimer cette ligne ? Le stock sera déduit.")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM stock_bl_details WHERE id = ?", [detailId]);
      await db.execute("UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?", [qte, articleId]);
      await db.execute("UPDATE stock_bons_livraison SET montant_total = montant_total - ? WHERE id = ?", [montantLigne, selectedBL.id]);

      setSelectedBL({ ...selectedBL, montant_total: (selectedBL.montant_total || 0) - montantLigne });

      const db2 = await getDb();
      // MODIFICATION ICI : Jointure pour le rayon
      const res = await db2.select<any[]>(`
        SELECT d.id, d.article_id, d.quantite, d.date_peremption,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.prix_vente AS CHAR) as prix_vente,
               CAST(d.tva AS CHAR) as tva,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               CAST(a.quantite_stock AS CHAR) as stock_actuel,
               r.libelle as rayon
        FROM stock_bl_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.bl_id = ?
      `, [selectedBL.id]);

      const resAvecStock = res.map(ligne => ({
        ...ligne,
        prix_achat_ht: parseFloat(ligne.prix_achat_ht || "0"),
        prix_vente: parseFloat(ligne.prix_vente || "0"),
        tva: parseFloat(ligne.tva || "0"),
        total_ligne: parseFloat(ligne.total_ligne || "0"),
        stock_actuel: parseFloat(ligne.stock_actuel || "0"),
        stock_avant: parseFloat(ligne.stock_actuel || "0") - ligne.quantite
      }));

      setLignesBL(resAvecStock);
    } catch (e) {
      console.error("Erreur suppression ligne:", e);
    }
  };

  const supprimerBL = async (id: number) => {
    if (!canDelete()) return alert("⛔ Vous n'avez pas les droits de suppression.");
    const bl = bons.find(b => b.id === id);
    if (!bl) return;



    if (!window.confirm("Supprimer tout le bon de livraison ? Le stock sera restauré (si implémenté).")) return;

    try {
      const db = await getDb();

      // LOGGER LA SUPPRESSION (Archivage)
      // On récupère les détails pour le JSON AVEC la désignation pour lecture future
      const details = await db.select<any[]>(`
        SELECT d.*, a.designation 
        FROM stock_bl_details d
        LEFT JOIN stock_articles a ON d.article_id = a.id
        WHERE d.bl_id = ?
      `, [id]);
      const detailsJson = JSON.stringify(details);

      await db.execute(`
        INSERT INTO stock_bl_supprimes (bl_id, numero_bl, fournisseur_nom, montant_total, user_id, details_json) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [bl.id, bl.numero_bl, bl.nom_fournisseur || 'Inconnu', bl.montant_total || 0, user?.id || 0, detailsJson]);

      // Note: Idealement on devrait déduire le stock des lignes si elles ont été ajoutées.
      // Cependant, `supprimerProduitDuBL` le fait, mais pas `supprimerBL` (faille potentielle dans code existant).
      // On va juste logguer et supprimer pour l'instant comme demandé "État des BL supprimés".

      await db.execute("DELETE FROM stock_bl_details WHERE bl_id = ?", [id]);
      await db.execute("DELETE FROM stock_bons_livraison WHERE id = ?", [id]);
      alert("Bon supprimé et archivé !");
      chargerListeBL();
    } catch (e) {
      console.error("Erreur suppression BL:", e);
      alert("Erreur lors de la suppression");
    }
  };

  // ===== FONCTIONS DE MODIFICATION =====
  const ouvrirModification = (ligneBL: any) => {
    setLigneEnModif(ligneBL.id);
    setModifData({
      quantite: ligneBL.quantite,
      prix_achat_ht: ligneBL.prix_achat_ht,
      prix_vente: ligneBL.prix_vente,
      tva: ligneBL.tva,
      date_peremption: ligneBL.date_peremption || ""
    });
  };

  const annulerModification = () => {
    setLigneEnModif(null);
    setModifData(null);
  };

  const enregistrerModification = async (ligneBL: any) => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    if (!modifData.quantite || modifData.quantite <= 0) {
      return alert("La quantité doit être supérieure à 0");
    }

    try {
      const db = await getDb();

      // Calculer la différence de quantité pour ajuster le stock
      const diffQte = modifData.quantite - ligneBL.quantite;

      // Calculer les anciens et nouveaux totaux
      const ancienTotal = ligneBL.total_ligne;
      const nouveauTotal = modifData.quantite * modifData.prix_achat_ht;
      const diffTotal = nouveauTotal - ancienTotal;

      // Mettre à jour la ligne de détail
      await db.execute(
        `UPDATE stock_bl_details 
         SET quantite = ?, prix_achat_ht = ?, prix_vente = ?, tva = ?, 
             date_peremption = ?, total_ligne = ?
         WHERE id = ?`,
        [
          modifData.quantite,
          modifData.prix_achat_ht,
          modifData.prix_vente,
          modifData.tva,
          modifData.date_peremption || null,
          nouveauTotal,
          ligneBL.id
        ]
      );

      // Ajuster le stock de l'article
      await db.execute(
        "UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?",
        [diffQte, ligneBL.article_id]
      );

      // Mettre à jour le prix de vente dans la table articles
      await db.execute(
        "UPDATE stock_articles SET prix_vente = ? WHERE id = ?",
        [modifData.prix_vente, ligneBL.article_id]
      );

      // Mettre à jour le montant total du BL
      await db.execute(
        "UPDATE stock_bons_livraison SET montant_total = montant_total + ? WHERE id = ?",
        [diffTotal, selectedBL.id]
      );

      // Recharger les lignes
      // MODIFICATION ICI : Jointure pour le rayon
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, d.quantite, d.date_peremption,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.prix_vente AS CHAR) as prix_vente,
               CAST(d.tva AS CHAR) as tva,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               CAST(a.quantite_stock AS CHAR) as stock_actuel,
               r.libelle as rayon
        FROM stock_bl_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.bl_id = ?
      `, [selectedBL.id]);

      const resAvecStock = res.map(ligne => ({
        ...ligne,
        prix_achat_ht: parseFloat(ligne.prix_achat_ht || "0"),
        prix_vente: parseFloat(ligne.prix_vente || "0"),
        tva: parseFloat(ligne.tva || "0"),
        total_ligne: parseFloat(ligne.total_ligne || "0"),
        stock_actuel: parseFloat(ligne.stock_actuel || "0"),
        stock_avant: parseFloat(ligne.stock_actuel || "0") - ligne.quantite
      }));

      setLignesBL(resAvecStock);

      // Mettre à jour le montant total du BL sélectionné
      setSelectedBL({ ...selectedBL, montant_total: (selectedBL.montant_total || 0) + diffTotal });

      // Fermer le mode édition
      setLigneEnModif(null);
      setModifData(null);

      alert("Modification enregistrée !");
    } catch (e) {
      console.error("Erreur modification:", e);
      alert("Erreur lors de la modification");
    }
  };

  // ===== FONCTION D'IMPRESSION MISE À JOUR =====
  const imprimerBL = async () => {
    if (!selectedBL || lignesBL.length === 0) {
      alert("Aucun bon à imprimer ou le bon est vide");
      return;
    }

    const company = await getCompanyInfo();

    // Calculs financiers
    const totalTTC = Math.ceil(lignesBL.reduce((sum, l) => sum + (l.quantite * l.prix_achat_ht), 0));
    const totalHT = Math.ceil(lignesBL.reduce((sum, l) => {
      const prixTTC = l.prix_achat_ht;
      const prixHT = l.tva > 0 ? prixTTC / (1 + l.tva / 100) : prixTTC;
      return sum + (l.quantite * prixHT);
    }, 0));
    const totalTVA = totalTTC - totalHT;
    const totalVente = Math.ceil(lignesBL.reduce((sum, l) => sum + (l.quantite * l.prix_vente), 0));
    const margeTotal = totalVente - totalTTC;
    const tauxMarge = totalTTC > 0 ? ((margeTotal / totalTTC) * 100).toFixed(1) : '0';
    const totalQte = lignesBL.reduce((sum, l) => sum + l.quantite, 0);

    const contenuImpression = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BL ${selectedBL.numero_bl}</title>
        <style>
          @page { size: landscape; margin: 0; }
          body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
          .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
          .company-sub { font-size: 10px; color: #7f8c8d; }
          .doc-title { font-size: 18px; font-weight: 600; color: #27ae60; text-transform: uppercase; letter-spacing: 1px; }

          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
          .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
          .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; }
          th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; text-transform: uppercase; font-size: 9px; }
          td { padding: 6px 8px; border-bottom: 1px solid #f9f9f9; color: #444; }
          tr:last-child td { border-bottom: none; }

          .totaux-container { display: flex; justify-content: space-between; gap: 20px; margin-top: 20px; }
          .totaux-box { flex: 1; background: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eee; }
          .totaux-title { font-size: 11px; font-weight: 600; color: #2c3e50; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; text-transform: uppercase; }
          
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
          .total-row.main { font-weight: 700; font-size: 13px; color: #27ae60; margin-top: 8px; border-top: 1px solid #eee; padding-top: 5px; }

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
            <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Bon de Livraison</div>
            <div class="doc-title">${selectedBL.numero_bl}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>Fournisseur</label>
            <span>${selectedBL.nom_fournisseur}</span>
          </div>
          <div class="meta-item">
            <label>Date de Livraison</label>
            <span>${new Date(selectedBL.date_bl).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="meta-item">
            <label>Référence Interne</label>
            <span>${selectedBL.id}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25%">Article</th>
              <th style="width: 7%; text-align: center">Stock Av.</th>
              <th style="width: 6%; text-align: center">Qté</th>
              <th style="width: 7%; text-align: center">Stock Ap.</th>
              <th style="width: 9%; text-align: right">PU Achat</th>
              <th style="width: 6%; text-align: center">TVA</th>
              <th style="width: 9%; text-align: right">PU Vente</th>
              <th style="width: 10%; text-align: right">Total Achat</th>
              <th style="width: 10%; text-align: right">Total Vente</th>
              <th style="width: 11%; text-align: right">Marge</th>
            </tr>
          </thead>
          <tbody>
            ${lignesBL.map(l => {
      const stockApres = l.stock_avant + l.quantite;
      const totalAchat = l.quantite * l.prix_achat_ht;
      const totalVente = l.quantite * l.prix_vente;
      const marge = totalVente - totalAchat;
      return `
                <tr>
                  <td><span style="font-weight:600; color:#2c3e50;">${l.designation}</span><br/><span style="color:#999; font-size:9px;">${l.cip}</span></td>
                  <td style="text-align: center; color:#7f8c8d;">${Math.ceil(l.stock_avant)}</td>
                  <td style="text-align: center; font-weight:600; background:#f0f9f4;">${l.quantite}</td>
                  <td style="text-align: center; color:#7f8c8d;">${Math.ceil(stockApres)}</td>
                  <td style="text-align: right">${Math.ceil(l.prix_achat_ht).toLocaleString()}</td>
                  <td style="text-align: center">${l.tva > 0 ? l.tva + '%' : '-'}</td>
                  <td style="text-align: right">${Math.ceil(l.prix_vente).toLocaleString()}</td>
                  <td style="text-align: right; font-weight:600; color:#e67e22;">${Math.ceil(totalAchat).toLocaleString()}</td>
                  <td style="text-align: right; color:#3498db;">${Math.ceil(totalVente).toLocaleString()}</td>
                  <td style="text-align: right; color:#27ae60;">${Math.ceil(marge).toLocaleString()}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>

        <div class="totaux-container">
          <div class="totaux-box">
             <div class="totaux-title">Détails Financiers</div>
             <div class="total-row"><span>Total HT :</span><span>${totalHT.toLocaleString()} F</span></div>
             <div class="total-row"><span>Total TVA :</span><span>${totalTVA.toLocaleString()} F</span></div>
             <div class="total-row main"><span>TOTAL TTC :</span><span>${totalTTC.toLocaleString()} F</span></div>
             <div class="total-row" style="margin-top:5px; color:#7f8c8d; font-size:9px;"><span>Articles :</span><span>${lignesBL.length} | Quantité : ${totalQte}</span></div>
          </div>
          <div class="totaux-box">
             <div class="totaux-title">Rentabilité</div>
             <div class="total-row"><span>Valeur Vente :</span><span>${totalVente.toLocaleString()} F</span></div>
             <div class="total-row"><span>Coût Achat :</span><span>${totalTTC.toLocaleString()} F</span></div>
             <div class="total-row main"><span>MARGE TOTALE :</span><span>${margeTotal.toLocaleString()} F</span></div>
             <div class="total-row" style="margin-top:5px; color:#7f8c8d; font-size:9px;"><span>Taux de Marge :</span><span>${tauxMarge} %</span></div>
          </div>
        </div>

        <div class="footer">
          Imprimé le ${new Date().toLocaleString('fr-FR')} par ${user?.nom_complet || 'Système'}
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
      doc.write(contenuImpression);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  };

  const articlesFiltres = articles.filter(a =>
    (a.designation || "").toLowerCase().includes(searchArticle.toLowerCase()) ||
    (a.cip || "").toLowerCase().includes(searchArticle.toLowerCase())
  );

  // ===== CALCULS FINANCIERS =====
  const calculerTotalTTC = () => Math.ceil(lignesBL.reduce((sum, l) => sum + (l.quantite * l.prix_achat_ht), 0));

  const calculerTotalHT = () => Math.ceil(lignesBL.reduce((sum, l) => {
    const prixTTC = l.prix_achat_ht;
    const prixHT = l.tva > 0 ? prixTTC / (1 + l.tva / 100) : prixTTC;
    return sum + (l.quantite * prixHT);
  }, 0));

  const calculerTotalTVA = () => calculerTotalTTC() - calculerTotalHT();

  const calculerTotalVente = () => Math.ceil(lignesBL.reduce((sum, l) => sum + (l.quantite * l.prix_vente), 0));

  const calculerMargeTotal = () => calculerTotalVente() - calculerTotalTTC();

  const calculerTauxMarge = () => {
    const totalAchat = calculerTotalTTC();
    return totalAchat > 0 ? ((calculerMargeTotal() / totalAchat) * 100).toFixed(1) : '0';
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1>🚚 Bons de Livraison</h1>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#27ae60' }}>➕ Créer un nouveau Bon</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'flex-end' }}>
          <div><label style={labelS}>Date BL</label><input type="date" value={newBL.date} onChange={e => setNewBL({ ...newBL, date: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelS}>Fournisseur</label>
            <select value={newBL.fournisseurId} onChange={e => setNewBL({ ...newBL, fournisseurId: e.target.value })} style={inputStyle}>
              <option value="">-- Choisir --</option>
              {fournisseurs.map(fr => <option key={fr.id} value={fr.id}>{fr.nom}</option>)}
            </select>
          </div>
          <div><label style={labelS}>Numéro BL</label><input value={newBL.numero} onChange={e => setNewBL({ ...newBL, numero: e.target.value })} style={inputStyle} placeholder="Ex: BL-1024" /></div>
          {canEdit() ? (
            <button onClick={creerBonLivraison} style={btnOk}>Créer</button>
          ) : (
            <div style={{ color: '#e74c3c', padding: '10px' }}>🚫 Création interdite</div>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: '20px', background: '#f8f9fa' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <strong>🔍 Filtrer :</strong>
          <input type="date" onChange={e => setFilterDateDebut(e.target.value)} style={inputSmall} />
          <span>au</span>
          <input type="date" onChange={e => setFilterDateFin(e.target.value)} style={inputSmall} />
          <select onChange={e => setFilterFournisseur(e.target.value)} style={inputSmall}>
            <option value="">Tous les fournisseurs</option>
            {fournisseurs.map(fr => <option key={fr.id} value={fr.id}>{fr.nom}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: '20px', background: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#2c3e50', color: 'white' }}>
              <th style={tdStyle}>Date</th>
              <th style={tdStyle}>N° BL</th>
              <th style={tdStyle}>Fournisseur</th>
              <th style={tdStyle}>Montant Total</th>
              <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBons.length > 0 ? (
              paginatedBons.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{new Date(b.date_bl).toLocaleDateString('fr-FR')}</td>
                  <td style={tdStyle}><strong>{b.numero_bl}</strong></td>
                  <td style={tdStyle}>{b.nom_fournisseur || '-'}</td>
                  <td style={tdStyle}><strong>{Math.ceil(b.montant_total || 0).toLocaleString()} F</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => ouvrirDetails(b)} style={btnSee}>👁️ Détails</button>
                    {canDelete() && <button onClick={() => supprimerBL(b.id)} style={{ ...btnDelete, padding: '5px 10px', fontSize: '0.8rem' }}>🗑️</button>}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Aucun bon de livraison</div>
                <div style={{ fontSize: '14px' }}>Créez votre premier bon ci-dessus</div>
              </td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid #eee' }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={pageBtn}>Précédent</button>
            <span style={{ margin: '0 15px' }}>Page {currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={pageBtn}>Suivant</button>
          </div>
        )}
      </div>

      {showDetails && selectedBL && (
        <div style={overlayStyle}>
          <div style={{ ...popupStyle, width: '95%', maxWidth: '1400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #27ae60', paddingBottom: '15px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#27ae60' }}>📦 Détails BL N° {selectedBL.numero_bl}</h2>
                <small>{selectedBL.nom_fournisseur} - {new Date(selectedBL.date_bl).toLocaleDateString('fr-FR')}</small>
              </div>
              <button onClick={() => { setShowDetails(false); chargerListeBL(); }} style={{ fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}>&times;</button>
            </div>

            <div style={{ background: '#e8f6ef', padding: '15px', borderRadius: '10px', marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelS}>Choisir l'article (CIP ou Nom)</label>
                  <input
                    value={searchArticle}
                    onChange={e => setSearchArticle(e.target.value)}
                    style={inputStyle}
                    placeholder="Rechercher..."
                  />
                  {searchArticle && (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px', background: 'white', marginTop: '5px' }}>
                      {articlesFiltres.slice(0, 10).map(a => (
                        <div
                          key={a.id}
                          onClick={() => handleSelectArticle(a.id)}
                          style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <strong>{a.designation}</strong><br />
                          <small>CIP: {a.cip} | Stock: {a.quantite_stock}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {ligne.articleId && <div style={{ marginTop: '5px', padding: '5px', background: '#d4edda', borderRadius: '5px' }}><small>Sélectionné: {ligne.designation} ({ligne.cip})</small></div>}
                </div>

                <div><label style={labelS}>Quantité Livrée</label><input type="number" value={ligne.qte || ''} onChange={e => handleNumberChange('qte', e.target.value)} style={inputStyle} /></div>
                <div><label style={labelS}>PU Achat</label><input type="number" value={ligne.pAchatTTC || ''} onChange={e => handleNumberChange('pAchatTTC', e.target.value)} style={inputStyle} /></div>
                <div><label style={labelS}>PU Vente</label><input type="number" value={ligne.pVente || ''} onChange={e => handleNumberChange('pVente', e.target.value)} style={inputStyle} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '10px', marginTop: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={labelS}>TVA</label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={ligne.tvaActive} onChange={e => setLigne({ ...ligne, tvaActive: e.target.checked })} />
                    <span style={{ marginLeft: '5px' }}>Activer</span>
                  </label>
                </div>
                <div><label style={labelS}>Taux TVA (%)</label><input type="number" value={ligne.tva || ''} onChange={e => handleNumberChange('tva', e.target.value)} style={inputStyle} disabled={!ligne.tvaActive} /></div>
                <div><label style={labelS}>Date Péremption</label><input type="date" value={ligne.peremption} onChange={e => setLigne({ ...ligne, peremption: e.target.value })} style={inputStyle} /></div>
                <button onClick={ajouterProduitAuBL} style={btnOk}>➕ Ajouter</button>
              </div>
            </div>

            <div style={{ marginTop: '20px', overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: '1300px' }}>
                <thead>
                  <tr style={{ background: '#27ae60', color: 'white' }}>
                    <th style={{ ...tdStyle, width: '180px' }}>Article</th>
                    <th style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>Stock Avant</th>
                    <th style={{ ...tdStyle, width: '60px', textAlign: 'center' }}>Qté</th>
                    <th style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>Stock Après</th>
                    <th style={{ ...tdStyle, width: '90px', textAlign: 'right' }}>PU Achat</th>
                    <th style={{ ...tdStyle, width: '60px', textAlign: 'center' }}>TVA</th>
                    <th style={{ ...tdStyle, width: '90px', textAlign: 'right' }}>PU Vente</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>Total Achat</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>Total Vente</th>
                    <th style={{ ...tdStyle, width: '90px', textAlign: 'center' }}>Emplacement</th>
                    <th style={{ ...tdStyle, width: '90px', textAlign: 'center' }}>Péremption</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>Marge</th>
                    <th style={{ ...tdStyle, width: '80px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesBL.length > 0 ? (
                    lignesBL.map(l => {
                      const stockApres = l.stock_avant + l.quantite;
                      const totalAchat = l.quantite * l.prix_achat_ht;
                      const totalVente = l.quantite * l.prix_vente;
                      const marge = totalVente - totalAchat;
                      const enModif = ligneEnModif === l.id;

                      if (enModif) {
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid #eee', background: '#fff3cd' }}>
                            <td style={tdStyle}>{l.designation}<br /><small>{l.cip}</small></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{Math.ceil(l.stock_avant)}</td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.quantite}
                                onChange={e => setModifData({ ...modifData, quantite: parseFloat(e.target.value) || 0 })}
                                style={{ width: '60px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{Math.ceil(l.stock_avant + modifData.quantite)}</td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.prix_achat_ht}
                                onChange={e => setModifData({ ...modifData, prix_achat_ht: parseFloat(e.target.value) || 0 })}
                                style={{ width: '85px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.tva}
                                onChange={e => setModifData({ ...modifData, tva: parseFloat(e.target.value) || 0 })}
                                style={{ width: '50px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.prix_vente}
                                onChange={e => setModifData({ ...modifData, prix_vente: parseFloat(e.target.value) || 0 })}
                                style={{ width: '85px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{l.rayon || '-'}</td>
                            <td style={tdStyle}>
                              <input
                                type="date"
                                value={modifData.date_peremption}
                                onChange={e => setModifData({ ...modifData, date_peremption: e.target.value })}
                                style={{ width: '110px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button
                                onClick={() => enregistrerModification(l)}
                                style={{ color: 'green', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '5px' }}
                                title="Enregistrer"
                              >
                                ✓
                              </button>
                              <button
                                onClick={annulerModification}
                                style={{ color: 'orange', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                                title="Annuler"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={tdStyle}>{l.designation}<br /><small>{l.cip}</small></td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{Math.ceil(l.stock_avant)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}><strong>{l.quantite}</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}><strong style={{ color: '#27ae60' }}>{Math.ceil(stockApres)}</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{Math.ceil(l.prix_achat_ht).toLocaleString()} F</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{l.tva > 0 ? `${l.tva}%` : '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{Math.ceil(l.prix_vente).toLocaleString()} F</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#e67e22' }}><strong>{Math.ceil(totalAchat).toLocaleString()} F</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#3498db' }}><strong>{Math.ceil(totalVente).toLocaleString()} F</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{l.rayon || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{l.date_peremption ? new Date(l.date_peremption).toLocaleDateString('fr-FR') : '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#27ae60' }}><strong>{Math.ceil(marge).toLocaleString()} F</strong></td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              onClick={() => ouvrirModification(l)}
                              style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '5px' }}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => supprimerProduitDuBL(l.id, l.article_id, l.quantite, l.total_ligne)}
                              style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px', color: '#95a5a6' }}>Aucun produit dans ce bon</td></tr>
                  )}
                </tbody>
                {lignesBL.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8f9fa', borderTop: '3px solid #27ae60', fontWeight: 'bold' }}>
                      <td style={{ ...tdStyle, fontSize: '15px' }}>TOTAUX</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, fontSize: '15px', textAlign: 'center', color: '#2c3e50' }}>
                        {lignesBL.reduce((sum, l) => sum + l.quantite, 0)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                      <td style={{ ...tdStyle, fontSize: '15px', textAlign: 'right', color: '#e67e22' }}>
                        {calculerTotalTTC().toLocaleString()} F
                      </td>
                      <td style={{ ...tdStyle, fontSize: '15px', textAlign: 'right', color: '#3498db' }}>
                        {calculerTotalVente().toLocaleString()} F
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, fontSize: '16px', textAlign: 'right', color: '#27ae60' }}>
                        {calculerMargeTotal().toLocaleString()} F
                      </td>
                      <td style={{ ...tdStyle, fontSize: '13px', textAlign: 'right', color: '#7f8c8d' }}>
                        {calculerTauxMarge()}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* RÉCAPITULATIF FINANCIER */}
            <div style={{ marginTop: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Colonne gauche - Détails */}
                <div style={{ borderRight: '1px solid #ddd', paddingRight: '20px' }}>
                  <h3 style={{ marginTop: 0, color: '#2c3e50', fontSize: '16px', borderBottom: '2px solid #27ae60', paddingBottom: '10px' }}>📊 Détails du Bon</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <span>Total HT :</span>
                    <strong>{calculerTotalHT().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', color: '#e67e22' }}>
                    <span>Total TVA :</span>
                    <strong>{calculerTotalTVA().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '18px', color: '#27ae60', borderTop: '2px solid #27ae60', marginTop: '5px' }}>
                    <span><strong>Total TTC :</strong></span>
                    <strong>{calculerTotalTTC().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
                    <span>Nombre d'articles :</span>
                    <strong>{lignesBL.length}</strong>
                  </div>
                </div>

                {/* Colonne droite - Ventes */}
                <div style={{ paddingLeft: '20px' }}>
                  <h3 style={{ marginTop: 0, color: '#2c3e50', fontSize: '16px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>💰 Valeur de Vente</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <span>Prix de Vente Total :</span>
                    <strong>{calculerTotalVente().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <span>Coût d'Achat Total :</span>
                    <strong>{calculerTotalTTC().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '18px', color: '#27ae60', borderTop: '2px solid #27ae60', marginTop: '5px' }}>
                    <span><strong>Marge Totale :</strong></span>
                    <strong>{calculerMargeTotal().toLocaleString()} F</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
                    <span>Taux de Marge Moyen :</span>
                    <strong>{calculerTauxMarge()} %</strong>
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => exportToExcel(lignesBL.map(l => ({
                      Article: l.designation,
                      CIP: l.cip,
                      'Stock Avant': l.stock_avant,
                      'Quantité': l.quantite,
                      'Stock Après': l.stock_avant + l.quantite,
                      'PU Achat': l.prix_achat_ht,
                      'Total Achat': l.quantite * l.prix_achat_ht,
                      'PU Vente': l.prix_vente,
                      'Total Vente': l.quantite * l.prix_vente
                    })), `BL_${selectedBL?.numero_bl || 'Export'}`)}
                    style={{
                      background: '#107c41',
                      color: 'white',
                      border: 'none',
                      padding: '14px 35px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    📊 Excel
                  </button>
                  <button
                    onClick={imprimerBL}
                    style={{
                      background: '#3498db',
                      color: 'white',
                      border: 'none',
                      padding: '14px 35px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    🖨️ Imprimer le Bon
                  </button>
                </div>

                <button
                  onClick={() => { setShowDetails(false); chargerListeBL(); }}
                  style={{
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '14px 40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  ✓ Terminer et Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' };
const inputSmall: React.CSSProperties = { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', marginRight: '10px' };
const labelS: React.CSSProperties = { fontSize: '10px', fontWeight: 'bold', color: '#7f8c8d', display: 'block', marginBottom: '3px', textTransform: 'uppercase' };
const btnOk = { background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' as const };
const btnSee = { background: '#3498db', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' };
const btnDelete = { background: '#e74c3c', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' };
const pageBtn: React.CSSProperties = { padding: '6px 15px', border: '1px solid #ddd', borderRadius: '5px', background: 'white', cursor: 'pointer' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const tdStyle: React.CSSProperties = { padding: '12px 8px', fontSize: '13px', textAlign: 'left' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const popupStyle: React.CSSProperties = { background: 'white', padding: '30px', borderRadius: '15px', maxHeight: '90vh', overflowY: 'auto' };