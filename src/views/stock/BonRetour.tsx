import React, { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel } from "../../lib/exportUtils";

import { useAuth } from "../../contexts/AuthContext";

export default function BonRetourView({ currentUser: _ }: { currentUser?: any }) {
  const { user, canEdit, canDelete } = useAuth();
  // currentUser was used for printing signature. Now 'user' from context.
  const [bonsRetour, setBonsRetour] = useState<any[]>([]);
  const [filterDateDebut, setFilterDateDebut] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [filterNumero, setFilterNumero] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // États pour la recherche de BL
  const [searchBL, setSearchBL] = useState("");
  const [blTrouve, setBlTrouve] = useState<any>(null);
  const [showPopupRetour, setShowPopupRetour] = useState(false);

  // États pour le bon de retour en cours
  const [lignesRetour, setLignesRetour] = useState<any[]>([]);
  const [motifGlobal, setMotifGlobal] = useState("");
  const [appliquerMotifGlobal, setAppliquerMotifGlobal] = useState(false);

  // États pour la visualisation/modification d'un BR existant
  const [showDetailsBR, setShowDetailsBR] = useState(false);
  const [brSelectionne, setBrSelectionne] = useState<any>(null);
  const [lignesBRDetail, setLignesBRDetail] = useState<any[]>([]);
  const [ligneEnModif, setLigneEnModif] = useState<any>(null);
  const [modifData, setModifData] = useState<any>(null);

  const motifsList = [
    "Péremption",
    "Cassé",
    "Avarié",
    "Facturé non livré",
    "Bon état",
    "Livré non facturé"
  ];

  // Fonction pour générer le numéro de BR basé sur le numéro du BL
  const genererNumeroBR = (numeroBL: string) => {
    // Basé sur le numéro du BL avec suffixe -R pour Retour
    // Exemple : BL-005 → BL-005-R
    return `${numeroBL}-R`;
  };

  const chargerListeBR = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT br.id, br.numero_br, br.date_br, br.bl_id,
               CAST(br.montant_total AS CHAR) as montant_total,
               bl.numero_bl, bl.date_bl,
               f.nom as nom_fournisseur
        FROM stock_bons_retour br
        LEFT JOIN stock_bons_livraison bl ON br.bl_id = bl.id
        LEFT JOIN stock_fournisseurs f ON bl.fournisseur_id = f.id
        ORDER BY br.date_br DESC
      `);
      setBonsRetour(res.map(b => ({ ...b, montant_total: parseFloat(b.montant_total || "0") })));
      console.log("Bons de retour chargés:", res.length);
    } catch (e) {
      console.error("Erreur chargement BR:", e);
      setBonsRetour([]);
    }
  };

  // Fix Auto-Increment for BR tables
  const runMigrations = async () => {
    try {
      const db = await getDb();

      // 1. stock_bons_retour
      try { await db.execute("ALTER TABLE stock_bons_retour ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_bons_retour MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_bons_retour' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix BR table failed:", e); }

      // 2. stock_br_details
      try { await db.execute("ALTER TABLE stock_br_details ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_br_details MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_br_details' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix BR Details table failed:", e); }

    } catch (e) { console.error("Migration wrapper error:", e); }
  };

  useEffect(() => {
    runMigrations();
    chargerListeBR();
  }, []);

  const rechercherBL = async () => {
    if (!searchBL.trim()) {
      return alert("Veuillez saisir un numéro de BL");
    }

    try {
      const db = await getDb();

      // Rechercher le BL
      const resBL = await db.select<any[]>(`
        SELECT b.id, b.date_bl, b.numero_bl, b.fournisseur_id,
               CAST(b.montant_total AS CHAR) as montant_total,
               f.nom as nom_fournisseur
        FROM stock_bons_livraison b
        LEFT JOIN stock_fournisseurs f ON b.fournisseur_id = f.id
        WHERE b.numero_bl LIKE ?
        LIMIT 1
      `, [`%${searchBL}%`]);

      if (resBL.length === 0) {
        return alert("Aucun bon de livraison trouvé avec ce numéro");
      }

      const bl = resBL[0];

      // Charger les lignes du BL
      const resLignes = await db.select<any[]>(`
        SELECT d.id, d.article_id, 
               CAST(d.quantite AS CHAR) as quantite,
               d.date_peremption,
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

      if (resLignes.length === 0) {
        return alert("Ce bon de livraison ne contient aucun produit");
      }

      setBlTrouve(bl);

      // Initialiser les lignes de retour avec quantité 0 et motif vide
      const initRetour = resLignes.map(ligne => ({
        bl_detail_id: ligne.id,
        article_id: ligne.article_id,
        designation: ligne.designation,
        cip: ligne.cip,
        quantite_bl: parseFloat(ligne.quantite || "0"),
        quantite_retour: 0,
        prix_achat_ht: parseFloat(ligne.prix_achat_ht || "0"),
        rayon: ligne.rayon,
        date_peremption: ligne.date_peremption,
        motif: "",
        total_ligne: 0
      }));

      setLignesRetour(initRetour);
      setShowPopupRetour(true);

    } catch (e) {
      console.error("Erreur recherche BL:", e);
      alert("Erreur lors de la recherche du bon de livraison");
    }
  };

  const modifierQuantiteRetour = (index: number, delta: number) => {
    setLignesRetour(prev => {
      const newLignes = [...prev];
      const ligne = newLignes[index];
      const nouvelleQte = Math.max(0, Math.min(ligne.quantite_bl, ligne.quantite_retour + delta));

      newLignes[index] = {
        ...ligne,
        quantite_retour: nouvelleQte,
        total_ligne: nouvelleQte * ligne.prix_achat_ht
      };

      return newLignes;
    });
  };

  const modifierMotif = (index: number, motif: string) => {
    setLignesRetour(prev => {
      const newLignes = [...prev];
      newLignes[index] = { ...newLignes[index], motif };
      return newLignes;
    });
  };

  const appliquerMotifATous = () => {
    if (!motifGlobal) {
      return alert("Veuillez sélectionner un motif à appliquer");
    }

    setLignesRetour(prev =>
      prev.map(ligne => ({ ...ligne, motif: motifGlobal }))
    );

    setAppliquerMotifGlobal(false);
    alert(`Motif "${motifGlobal}" appliqué à tous les produits`);
  };

  const enregistrerBonRetour = async () => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    // Vérifier qu'il y a au moins un produit à retourner
    const lignesAvecRetour = lignesRetour.filter(l => l.quantite_retour > 0);

    if (lignesAvecRetour.length === 0) {
      return alert("Veuillez sélectionner au moins un produit à retourner");
    }

    // Vérifier que tous les produits à retourner ont un motif
    const lignesSansMotif = lignesAvecRetour.filter(l => !l.motif);
    if (lignesSansMotif.length > 0) {
      return alert("Tous les produits à retourner doivent avoir un motif");
    }

    try {
      const db = await getDb();
      const numeroBR = genererNumeroBR(blTrouve.numero_bl);
      const dateBR = new Date().toISOString().split('T')[0];
      const montantTotal = lignesAvecRetour.reduce((sum, l) => sum + l.total_ligne, 0);

      // Créer le bon de retour
      const resVal = await db.execute(
        `INSERT INTO stock_bons_retour 
        (numero_br, date_br, bl_id, montant_total) 
        VALUES (?, ?, ?, ?)`,
        [numeroBR, dateBR, blTrouve.id, montantTotal]
      );

      const newBrId = resVal.lastInsertId;

      // Insérer les détails et mettre à jour le stock
      for (const ligne of lignesAvecRetour) {
        // Insérer la ligne de détail
        await db.execute(
          `INSERT INTO stock_br_details 
          (br_id, article_id, quantite_retour, prix_achat_ht, motif, total_ligne)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newBrId,
            ligne.article_id,
            ligne.quantite_retour,
            ligne.prix_achat_ht,
            ligne.motif,
            ligne.total_ligne
          ]
        );

        // Diminuer le stock de l'article
        await db.execute(
          "UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?",
          [ligne.quantite_retour, ligne.article_id]
        );
      }

      alert(`✅ Bon de retour ${numeroBR} créé avec succès !\n\nMontant total: ${Math.ceil(montantTotal).toLocaleString()} F\nProduits retournés: ${lignesAvecRetour.length}`);

      // Fermer le popup et rafraîchir
      setShowPopupRetour(false);
      setBlTrouve(null);
      setLignesRetour([]);
      setSearchBL("");
      chargerListeBR();

    } catch (e) {
      console.error("Erreur enregistrement BR:", e);
      alert("Erreur lors de l'enregistrement du bon de retour");
    }
  };

  const ouvrirDetailsBR = async (br: any) => {
    try {
      const db = await getDb();

      // Charger les détails du BR
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, 
               CAST(d.quantite_retour AS CHAR) as quantite_retour, 
               d.motif,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               r.libelle as rayon
        FROM stock_br_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.br_id = ?
      `, [br.id]);

      const resParsed = res.map(r => ({
        ...r,
        quantite_retour: parseFloat(r.quantite_retour || "0"),
        prix_achat_ht: parseFloat(r.prix_achat_ht || "0"),
        total_ligne: parseFloat(r.total_ligne || "0")
      }));

      setBrSelectionne(br);
      setLignesBRDetail(resParsed);
      setShowDetailsBR(true);

    } catch (e) {
      console.error("Erreur chargement détails BR:", e);
      alert("Erreur lors du chargement des détails");
    }
  };

  // ===== FONCTIONS DE MODIFICATION DES LIGNES BR =====
  const ouvrirModificationLigne = (ligne: any) => {
    setLigneEnModif(ligne.id);
    setModifData({
      quantite_retour: ligne.quantite_retour,
      prix_achat_ht: ligne.prix_achat_ht,
      motif: ligne.motif
    });
  };

  const annulerModificationLigne = () => {
    setLigneEnModif(null);
    setModifData(null);
  };

  const enregistrerModificationLigne = async (ligne: any) => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    if (!modifData.quantite_retour || modifData.quantite_retour <= 0) {
      return alert("La quantité doit être supérieure à 0");
    }

    if (!modifData.motif) {
      return alert("Le motif est obligatoire");
    }

    try {
      const db = await getDb();

      // Calculer la différence de quantité pour ajuster le stock
      const diffQte = modifData.quantite_retour - ligne.quantite_retour;

      // Calculer les anciens et nouveaux totaux
      const ancienTotal = ligne.total_ligne;
      const nouveauTotal = modifData.quantite_retour * modifData.prix_achat_ht;
      const diffTotal = nouveauTotal - ancienTotal;

      // Mettre à jour la ligne de détail
      await db.execute(
        `UPDATE stock_br_details 
         SET quantite_retour = ?, prix_achat_ht = ?, motif = ?, total_ligne = ?
         WHERE id = ?`,
        [
          modifData.quantite_retour,
          modifData.prix_achat_ht,
          modifData.motif,
          nouveauTotal,
          ligne.id
        ]
      );

      // Ajuster le stock de l'article (attention: pour un retour, on diminue le stock)
      await db.execute(
        "UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?",
        [diffQte, ligne.article_id]
      );

      // Mettre à jour le montant total du BR
      await db.execute(
        "UPDATE stock_bons_retour SET montant_total = montant_total + ? WHERE id = ?",
        [diffTotal, brSelectionne.id]
      );

      // Recharger les lignes
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, 
               CAST(d.quantite_retour AS CHAR) as quantite_retour,
               d.motif,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               r.libelle as rayon
        FROM stock_br_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.br_id = ?
      `, [brSelectionne.id]);

      const resParsed = res.map(r => ({
        ...r,
        quantite_retour: parseFloat(r.quantite_retour || "0"),
        prix_achat_ht: parseFloat(r.prix_achat_ht || "0"),
        total_ligne: parseFloat(r.total_ligne || "0")
      }));

      setLignesBRDetail(resParsed);

      // Mettre à jour le montant total du BR sélectionné
      setBrSelectionne({ ...brSelectionne, montant_total: (brSelectionne.montant_total || 0) + diffTotal });

      // Fermer le mode édition
      setLigneEnModif(null);
      setModifData(null);

      alert("✅ Modification enregistrée !");
    } catch (e) {
      console.error("Erreur modification:", e);
      alert("❌ Erreur lors de la modification");
    }
  };

  const supprimerLigneBR = async (ligne: any) => {
    if (!canEdit()) return alert("⛔ Vous n'avez pas les droits de modification.");
    if (!window.confirm("⚠️ Supprimer cette ligne ?\n\nLe stock sera réajusté (augmenté).")) return;

    try {
      const db = await getDb();

      // Supprimer la ligne
      await db.execute("DELETE FROM stock_br_details WHERE id = ?", [ligne.id]);

      // Réaugmenter le stock de l'article (car on annule le retour)
      await db.execute(
        "UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?",
        [ligne.quantite_retour, ligne.article_id]
      );

      // Mettre à jour le montant total du BR
      await db.execute(
        "UPDATE stock_bons_retour SET montant_total = montant_total - ? WHERE id = ?",
        [ligne.total_ligne, brSelectionne.id]
      );

      setBrSelectionne({ ...brSelectionne, montant_total: (brSelectionne.montant_total || 0) - ligne.total_ligne });

      // Recharger les lignes
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, 
               CAST(d.quantite_retour AS CHAR) as quantite_retour,
               d.motif,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               r.libelle as rayon
        FROM stock_br_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.br_id = ?
      `, [brSelectionne.id]);

      const resParsed = res.map(r => ({
        ...r,
        quantite_retour: parseFloat(r.quantite_retour || "0"),
        prix_achat_ht: parseFloat(r.prix_achat_ht || "0"),
        total_ligne: parseFloat(r.total_ligne || "0")
      }));

      setLignesBRDetail(resParsed);

      alert("✅ Ligne supprimée !");
    } catch (e) {
      console.error("Erreur suppression ligne:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  const imprimerBR = async (br?: any, lignes?: any[]) => {
    // Utiliser les données passées en paramètre ou celles du BR sélectionné
    const brData = br || brSelectionne;
    const lignesData = lignes || lignesBRDetail;

    if (!brData || !lignesData || lignesData.length === 0) {
      alert("Aucun bon à imprimer ou le bon est vide");
      return;
    }

    const company = await getCompanyInfo();

    const totalRetour = Math.ceil(lignesData.reduce((sum: number, l: any) => sum + l.total_ligne, 0));
    const totalQte = lignesData.reduce((sum: number, l: any) => sum + l.quantite_retour, 0);

    const contenuImpression = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bon de Retour ${brData.numero_br}</title>
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
          .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
          .company-sub { font-size: 10px; color: #7f8c8d; }
          .doc-title { font-size: 18px; font-weight: 600; color: #e74c3c; text-transform: uppercase; letter-spacing: 1px; }

          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
          .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
          .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
          th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; text-transform: uppercase; font-size: 10px; }
          td { padding: 8px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
          tr:last-child td { border-bottom: none; }

          .motif-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
          .motif-peremption { background: #fff3cd; color: #856404; }
          .motif-casse { background: #f8d7da; color: #721c24; }
          .motif-avarie { background: #f8d7da; color: #721c24; }

          .total-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 30px; }
          .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #fdf2f2; border: 1px solid #fadbd8; color: #c0392b; margin-bottom: 5px; }
          .amount-text { font-size: 10px; color: #999; font-style: italic; }

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
            <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Bon de Retour</div>
            <div class="doc-title">${brData.numero_br}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>Fournisseur</label>
            <span>${brData.nom_fournisseur}</span>
          </div>
          <div class="meta-item">
            <label>Date Retour</label>
            <span>${new Date(brData.date_br).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="meta-item">
            <label>BL Origine</label>
            <span>${brData.numero_bl} (${new Date(brData.date_bl).toLocaleDateString('fr-FR')})</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35%">Article</th>
              <th style="width: 15%">Emplacement</th>
              <th style="width: 10%; text-align: center">Qté</th>
              <th style="width: 15%; text-align: right">PU Achat</th>
              <th style="width: 25%">Motif</th>
              <th style="width: 15%; text-align: right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lignesData.map((l: any) => {
      const motifClass = l.motif.toLowerCase().replace(/[éè]/g, 'e').replace(/\s+/g, '-');
      return `
                <tr>
                  <td><span style="font-weight:600; color:#2c3e50;">${l.designation}</span><br/><span style="color:#999; font-size:9px;">${l.cip}</span></td>
                  <td>${l.rayon || '-'}</td>
                  <td style="text-align: center; font-weight:600; color:#e74c3c;">${l.quantite_retour}</td>
                  <td style="text-align: right">${Math.ceil(l.prix_achat_ht).toLocaleString()}</td>
                  <td><span class="motif-badge motif-${motifClass}">${l.motif}</span></td>
                  <td style="text-align: right; font-weight:600; color:#c0392b;">${Math.ceil(l.total_ligne).toLocaleString()} F</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
             VALEUR RETOUR : ${totalRetour.toLocaleString()} F CFA
          </div>
          <div class="amount-text">
             ${lignesData.length} Articles retournés (Qté: ${totalQte})
          </div>
        </div>

        <div class="footer">
          Imprimé le ${new Date().toLocaleString('fr-FR')} par ${user?.nom_complet || 'Système'}
          <br/><br/>
          <div style="display:flex; justify-content:space-between; margin-top:20px; padding:0 50px;">
            <div>Signature Magasinier</div>
            <div>Signature Livreur/Fournisseur</div>
          </div>
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

  const supprimerBR = async (id: number) => {
    if (!canDelete()) return alert("⛔ Vous n'avez pas les droits de suppression.");
    if (!window.confirm("⚠️ Attention ! Supprimer ce bon de retour ?\n\nCette action est irréversible et le stock ne sera pas réajusté.")) return;

    try {
      const db = await getDb();
      await db.execute("DELETE FROM stock_br_details WHERE br_id = ?", [id]);
      await db.execute("DELETE FROM stock_bons_retour WHERE id = ?", [id]);
      alert("✅ Bon de retour supprimé !");
      chargerListeBR();
    } catch (e) {
      console.error("Erreur suppression BR:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  // Filtrage et pagination
  const brFiltres = bonsRetour.filter(br => {
    const dateBr = new Date(br.date_br).toISOString().split('T')[0];
    const matchDate = (!filterDateDebut || dateBr >= filterDateDebut) && (!filterDateFin || dateBr <= filterDateFin);
    const matchNumero = !filterNumero || br.numero_br.toLowerCase().includes(filterNumero.toLowerCase()) || br.numero_bl.toLowerCase().includes(filterNumero.toLowerCase());
    return matchDate && matchNumero;
  });

  const totalPages = Math.ceil(brFiltres.length / pageSize);
  const paginatedBR = brFiltres.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calculs pour le popup
  const totalQteRetour = lignesRetour.reduce((sum, l) => sum + l.quantite_retour, 0);
  const totalMontantRetour = Math.ceil(lignesRetour.reduce((sum, l) => sum + l.total_ligne, 0));
  const nbProduitsRetour = lignesRetour.filter(l => l.quantite_retour > 0).length;

  return (
    <div style={{ padding: '10px' }}>
      <h1>↩️ Bons de Retour</h1>

      {/* SECTION RECHERCHE BL */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#e74c3c' }}>
          🔍 Rechercher un Bon de Livraison
        </h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelS}>Numéro du BL</label>
            <input
              value={searchBL}
              onChange={e => setSearchBL(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && rechercherBL()}
              style={inputStyle}
              placeholder="Ex: BL-1024"
            />
          </div>
          <button onClick={rechercherBL} style={btnSearch}>
            🔍 Rechercher
          </button>
        </div>
      </div>

      {/* SECTION FILTRES */}
      <div style={{ ...cardStyle, marginTop: '20px', background: '#f8f9fa' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>📊 Filtrer les bons de retour :</strong>
          <input
            type="date"
            onChange={e => setFilterDateDebut(e.target.value)}
            style={inputSmall}
            placeholder="Date début"
          />
          <span>au</span>
          <input
            type="date"
            onChange={e => setFilterDateFin(e.target.value)}
            style={inputSmall}
            placeholder="Date fin"
          />
          <input
            type="text"
            value={filterNumero}
            onChange={e => setFilterNumero(e.target.value)}
            style={inputSmall}
            placeholder="N° BR ou N° BL"
          />
          <button
            onClick={() => {
              setFilterDateDebut("");
              setFilterDateFin("");
              setFilterNumero("");
              setCurrentPage(1);
            }}
            style={{ ...btnDelete, padding: '8px 15px', fontSize: '0.85rem' }}
          >
            🗑️ Réinitialiser
          </button>
        </div>
      </div>

      {/* LISTE DES BONS DE RETOUR */}
      <div style={{ marginTop: '20px', background: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '15px', borderBottom: '2px solid #e74c3c' }}>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>
            📋 Liste des Bons de Retour ({brFiltres.length})
          </h3>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#2c3e50', color: 'white' }}>
              <th style={tdStyle}>Date Retour</th>
              <th style={tdStyle}>N° BR</th>
              <th style={tdStyle}>BL d'origine</th>
              <th style={tdStyle}>Fournisseur</th>
              <th style={tdStyle}>Montant Retourné</th>
              <th style={{ ...tdStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBR.length > 0 ? (
              paginatedBR.map(br => (
                <tr key={br.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{new Date(br.date_br).toLocaleDateString('fr-FR')}</td>
                  <td style={tdStyle}><strong style={{ color: '#e74c3c' }}>{br.numero_br}</strong></td>
                  <td style={tdStyle}>
                    {br.numero_bl}<br />
                    <small style={{ color: '#7f8c8d' }}>{new Date(br.date_bl).toLocaleDateString('fr-FR')}</small>
                  </td>
                  <td style={tdStyle}>{br.nom_fournisseur || '-'}</td>
                  <td style={tdStyle}>
                    <strong style={{ color: '#e74c3c', fontSize: '14px' }}>
                      {Math.ceil(br.montant_total || 0).toLocaleString()} F
                    </strong>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => ouvrirDetailsBR(br)}
                      style={btnSee}
                      title="Voir les détails"
                    >
                      👁️ Détails
                    </button>
                    <button
                      onClick={() => supprimerBR(br.id)}
                      style={{ ...btnDelete, padding: '6px 12px', fontSize: '0.8rem', marginLeft: '5px' }}
                      title="Supprimer"
                      disabled={!canDelete()}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>↩️</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                    Aucun bon de retour
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    Recherchez un bon de livraison ci-dessus pour créer un retour
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ padding: '15px', textAlign: 'center', borderTop: '1px solid #eee' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              style={pageBtn}
            >
              ← Précédent
            </button>
            <span style={{ margin: '0 15px', fontWeight: 'bold' }}>
              Page {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              style={pageBtn}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {/* POPUP CRÉATION BON DE RETOUR */}
      {showPopupRetour && blTrouve && (
        <div style={overlayStyle}>
          <div style={{ ...popupStyle, width: '95%', maxWidth: '1400px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* En-tête */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #e74c3c',
              paddingBottom: '15px',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#e74c3c' }}>
                  ↩️ Créer un Bon de Retour
                </h2>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#7f8c8d' }}>
                  <strong>BL N° {blTrouve.numero_bl}</strong> - {blTrouve.nom_fournisseur}
                  <span style={{ marginLeft: '15px' }}>
                    📅 {new Date(blTrouve.date_bl).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPopupRetour(false);
                  setBlTrouve(null);
                  setLignesRetour([]);
                }}
                style={{
                  fontSize: '2rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#e74c3c'
                }}
              >
                &times;
              </button>
            </div>

            {/* Section motif global */}
            <div style={{
              background: '#fff3cd',
              padding: '15px',
              borderRadius: '8px',
              marginTop: '20px',
              border: '2px solid #ffc107'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={appliquerMotifGlobal}
                    onChange={e => setAppliquerMotifGlobal(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '15px' }}>
                    ⚡ Appliquer le même motif à tous les produits
                  </span>
                </label>
              </div>

              {appliquerMotifGlobal && (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelS}>Sélectionner le motif global</label>
                    <select
                      value={motifGlobal}
                      onChange={e => setMotifGlobal(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Choisir un motif --</option>
                      {motifsList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={appliquerMotifATous}
                    style={{ ...btnOk, background: '#ffc107', color: '#000' }}
                  >
                    ✓ Appliquer à tous
                  </button>
                </div>
              )}
            </div>

            {/* Tableau des produits */}
            <div style={{ marginTop: '20px', overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: '1200px' }}>
                <thead>
                  <tr style={{ background: '#e74c3c', color: 'white' }}>
                    <th style={{ ...tdStyle, width: '200px' }}>Article</th>
                    <th style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>Emplacement</th>
                    <th style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>Qté BL</th>
                    <th style={{ ...tdStyle, width: '150px', textAlign: 'center' }}>Qté à Retourner</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>PU Achat</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>Total</th>
                    <th style={{ ...tdStyle, width: '200px' }}>Motif de Retour</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesRetour.map((ligne, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid #eee',
                        background: ligne.quantite_retour > 0 ? '#fff5f5' : 'white'
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{ligne.designation}</strong><br />
                        <small style={{ color: '#7f8c8d' }}>{ligne.cip}</small>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {ligne.rayon || '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <strong>{ligne.quantite_bl}</strong>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => modifierQuantiteRetour(index, -1)}
                            disabled={ligne.quantite_retour === 0}
                            style={{
                              width: '35px',
                              height: '35px',
                              fontSize: '20px',
                              border: 'none',
                              borderRadius: '50%',
                              background: ligne.quantite_retour === 0 ? '#ddd' : '#e74c3c',
                              color: 'white',
                              cursor: ligne.quantite_retour === 0 ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            −
                          </button>
                          <span style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: ligne.quantite_retour > 0 ? '#e74c3c' : '#95a5a6',
                            minWidth: '40px',
                            textAlign: 'center'
                          }}>
                            {ligne.quantite_retour}
                          </span>
                          <button
                            onClick={() => modifierQuantiteRetour(index, 1)}
                            disabled={ligne.quantite_retour >= ligne.quantite_bl}
                            style={{
                              width: '35px',
                              height: '35px',
                              fontSize: '20px',
                              border: 'none',
                              borderRadius: '50%',
                              background: ligne.quantite_retour >= ligne.quantite_bl ? '#ddd' : '#27ae60',
                              color: 'white',
                              cursor: ligne.quantite_retour >= ligne.quantite_bl ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {Math.ceil(ligne.prix_achat_ht).toLocaleString()} F
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <strong style={{ color: ligne.quantite_retour > 0 ? '#e74c3c' : '#95a5a6' }}>
                          {Math.ceil(ligne.total_ligne).toLocaleString()} F
                        </strong>
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={ligne.motif}
                          onChange={e => modifierMotif(index, e.target.value)}
                          disabled={ligne.quantite_retour === 0}
                          style={{
                            ...inputStyle,
                            fontSize: '12px',
                            padding: '6px',
                            background: ligne.quantite_retour === 0 ? '#f5f5f5' : 'white',
                            cursor: ligne.quantite_retour === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="">-- Sélectionner --</option>
                          {motifsList.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {nbProduitsRetour > 0 && (
                  <tfoot>
                    <tr style={{
                      background: '#f8f9fa',
                      borderTop: '3px solid #e74c3c',
                      fontWeight: 'bold',
                      fontSize: '15px'
                    }}>
                      <td style={tdStyle}>TOTAUX</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#e74c3c' }}>
                        {totalQteRetour}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontSize: '16px' }}>
                        {totalMontantRetour.toLocaleString()} F
                      </td>
                      <td style={tdStyle}>
                        {nbProduitsRetour} produit{nbProduitsRetour > 1 ? 's' : ''}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Récapitulatif */}
            {nbProduitsRetour > 0 && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                background: '#fff5f5',
                borderRadius: '8px',
                border: '2px solid #e74c3c'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#e74c3c' }}>
                  📊 Récapitulatif du Retour
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Produits à retourner
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {nbProduitsRetour}
                    </div>
                  </div>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Quantité totale
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {totalQteRetour}
                    </div>
                  </div>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Montant total du retour
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {totalMontantRetour.toLocaleString()} F
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{
              marginTop: '25px',
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '2px solid #ddd',
              paddingTop: '20px',
              position: 'sticky',
              bottom: 0,
              background: 'white',
              zIndex: 10
            }}>
              <button
                onClick={() => {
                  setShowPopupRetour(false);
                  setBlTrouve(null);
                  setLignesRetour([]);
                }}
                style={{
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '14px 40px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                ✕ Annuler
              </button>

              <button
                onClick={enregistrerBonRetour}
                disabled={nbProduitsRetour === 0}
                style={{
                  background: nbProduitsRetour === 0 ? '#ddd' : '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '14px 50px',
                  borderRadius: '8px',
                  cursor: nbProduitsRetour === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  boxShadow: nbProduitsRetour === 0 ? 'none' : '0 4px 6px rgba(231,76,60,0.3)'
                }}
              >
                ✓ Enregistrer le Bon de Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DÉTAILS/MODIFICATION BON DE RETOUR EXISTANT */}
      {showDetailsBR && brSelectionne && (
        <div style={overlayStyle}>
          <div style={{ ...popupStyle, width: '95%', maxWidth: '1400px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* En-tête */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid #e74c3c',
              paddingBottom: '15px',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#e74c3c' }}>
                  ↩️ Bon de Retour N° {brSelectionne.numero_br}
                </h2>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#7f8c8d' }}>
                  <strong>BL N° {brSelectionne.numero_bl}</strong> - {brSelectionne.nom_fournisseur}
                  <span style={{ marginLeft: '15px' }}>
                    📅 {new Date(brSelectionne.date_br).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailsBR(false);
                  setBrSelectionne(null);
                  setLignesBRDetail([]);
                  setLigneEnModif(null);
                  setModifData(null);
                  chargerListeBR();
                }}
                style={{
                  fontSize: '2rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#e74c3c'
                }}
              >
                &times;
              </button>
            </div>

            {/* Tableau des produits retournés */}
            <div style={{ marginTop: '20px', overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: '1200px' }}>
                <thead>
                  <tr style={{ background: '#e74c3c', color: 'white' }}>
                    <th style={{ ...tdStyle, width: '250px' }}>Article</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'center' }}>Emplacement</th>
                    <th style={{ ...tdStyle, width: '120px', textAlign: 'center' }}>Qté Retournée</th>
                    <th style={{ ...tdStyle, width: '120px', textAlign: 'right' }}>PU Achat</th>
                    <th style={{ ...tdStyle, width: '120px', textAlign: 'right' }}>Total</th>
                    <th style={{ ...tdStyle, width: '200px' }}>Motif</th>
                    <th style={{ ...tdStyle, width: '100px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesBRDetail.length > 0 ? (
                    lignesBRDetail.map(l => {
                      const enModif = ligneEnModif === l.id;

                      if (enModif) {
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid #eee', background: '#fff3cd' }}>
                            <td style={tdStyle}>
                              <strong>{l.designation}</strong><br />
                              <small>{l.cip}</small>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{l.rayon || '-'}</td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.quantite_retour}
                                onChange={e => setModifData({ ...modifData, quantite_retour: parseFloat(e.target.value) || 0 })}
                                style={{ width: '80px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                value={modifData.prix_achat_ht}
                                onChange={e => setModifData({ ...modifData, prix_achat_ht: parseFloat(e.target.value) || 0 })}
                                style={{ width: '100px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <strong style={{ color: '#e74c3c' }}>
                                {Math.ceil(modifData.quantite_retour * modifData.prix_achat_ht).toLocaleString()} F
                              </strong>
                            </td>
                            <td style={tdStyle}>
                              <select
                                value={modifData.motif}
                                onChange={e => setModifData({ ...modifData, motif: e.target.value })}
                                style={{ ...inputStyle, fontSize: '12px', padding: '6px' }}
                              >
                                <option value="">-- Sélectionner --</option>
                                {motifsList.map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button
                                onClick={() => enregistrerModificationLigne(l)}
                                style={{ color: 'green', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', marginRight: '5px' }}
                                title="Enregistrer"
                              >
                                ✓
                              </button>
                              <button
                                onClick={annulerModificationLigne}
                                style={{ color: 'orange', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}
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
                          <td style={tdStyle}>
                            <strong>{l.designation}</strong><br />
                            <small style={{ color: '#7f8c8d' }}>{l.cip}</small>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{l.rayon || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <strong style={{ color: '#e74c3c', fontSize: '15px' }}>{l.quantite_retour}</strong>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {Math.ceil(l.prix_achat_ht).toLocaleString()} F
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <strong style={{ color: '#e74c3c', fontSize: '14px' }}>
                              {Math.ceil(l.total_ligne).toLocaleString()} F
                            </strong>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block',
                              padding: '5px 10px',
                              borderRadius: '5px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              background: '#fff3cd',
                              color: '#856404'
                            }}>
                              {l.motif}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              onClick={() => ouvrirModificationLigne(l)}
                              style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '8px' }}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => supprimerLigneBR(l)}
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
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#95a5a6' }}>
                        Aucun produit dans ce bon de retour
                      </td>
                    </tr>
                  )}
                </tbody>
                {lignesBRDetail.length > 0 && (
                  <tfoot>
                    <tr style={{
                      background: '#f8f9fa',
                      borderTop: '3px solid #e74c3c',
                      fontWeight: 'bold',
                      fontSize: '15px'
                    }}>
                      <td style={tdStyle}>TOTAUX</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#e74c3c' }}>
                        {lignesBRDetail.reduce((sum, l) => sum + l.quantite_retour, 0)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontSize: '16px' }}>
                        {Math.ceil(lignesBRDetail.reduce((sum, l) => sum + l.total_ligne, 0)).toLocaleString()} F
                      </td>
                      <td style={tdStyle}>
                        {lignesBRDetail.length} produit{lignesBRDetail.length > 1 ? 's' : ''}
                      </td>
                      <td style={tdStyle}>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Récapitulatif */}
            {lignesBRDetail.length > 0 && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                background: '#fff5f5',
                borderRadius: '8px',
                border: '2px solid #e74c3c'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#e74c3c' }}>
                  📊 Récapitulatif du Retour
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Produits retournés
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {lignesBRDetail.length}
                    </div>
                  </div>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Quantité totale
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {lignesBRDetail.reduce((sum, l) => sum + l.quantite_retour, 0)}
                    </div>
                  </div>
                  <div style={recapBox}>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>
                      Montant total du retour
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                      {Math.ceil(lignesBRDetail.reduce((sum, l) => sum + l.total_ligne, 0)).toLocaleString()} F
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{
              marginTop: '25px',
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '2px solid #ddd',
              paddingTop: '20px',
              position: 'sticky',
              bottom: 0,
              background: 'white',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => exportToExcel(lignesBRDetail.map(l => ({
                    Article: l.designation,
                    CIP: l.cip,
                    Motif: l.motif,
                    'Quantité': l.quantite_retour,
                    'PU Achat': l.prix_achat_ht,
                    'Total': l.total_ligne
                  })), `BR_${brSelectionne?.numero_br || 'Export'}`)}
                  style={{
                    background: '#107c41',
                    color: 'white',
                    border: 'none',
                    padding: '14px 40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  📊 Excel
                </button>
                <button
                  onClick={() => imprimerBR()}
                  style={{
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '14px 40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  🖨️ Imprimer le Bon
                </button>
              </div>

              <button
                onClick={() => {
                  setShowDetailsBR(false);
                  setBrSelectionne(null);
                  setLignesBRDetail([]);
                  setLigneEnModif(null);
                  setModifData(null);
                  chargerListeBR();
                }}
                style={{
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '14px 50px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                ✓ Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: '20px',
  borderRadius: '10px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #ddd',
  boxSizing: 'border-box',
  fontSize: '14px'
};

const inputSmall: React.CSSProperties = {
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #ddd',
  fontSize: '14px'
};

const labelS: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#7f8c8d',
  display: 'block',
  marginBottom: '5px',
  textTransform: 'uppercase'
};

const btnOk: React.CSSProperties = {
  background: '#27ae60',
  color: 'white',
  border: 'none',
  padding: '12px 25px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

const btnSearch: React.CSSProperties = {
  background: '#3498db',
  color: 'white',
  border: 'none',
  padding: '12px 30px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

const btnSee: React.CSSProperties = {
  background: '#3498db',
  color: 'white',
  border: 'none',
  padding: '6px 15px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px'
};

const btnDelete: React.CSSProperties = {
  background: '#e74c3c',
  color: 'white',
  border: 'none',
  padding: '6px 15px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px'
};

const pageBtn: React.CSSProperties = {
  padding: '8px 20px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  background: 'white',
  cursor: 'pointer',
  fontSize: '14px'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 8px',
  fontSize: '13px',
  textAlign: 'left'
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const popupStyle: React.CSSProperties = {
  background: 'white',
  padding: '30px',
  borderRadius: '15px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
};

const recapBox: React.CSSProperties = {
  background: 'white',
  padding: '15px',
  borderRadius: '8px',
  border: '1px solid #e74c3c',
  textAlign: 'center'
};