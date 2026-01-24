import React, { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";

export default function AvoirFournisseurs() {
  // États pour la liste des BR disponibles
  const [bonsRetour, setBonsRetour] = useState<any[]>([]);
  const [avoirs, setAvoirs] = useState<any[]>([]);

  // États pour les filtres
  const [searchCode, setSearchCode] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [activeTab, setActiveTab] = useState<"br" | "avoirs">("br");

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // États pour la création d'avoir
  const [showPopupAvoir, setShowPopupAvoir] = useState(false);
  const [brSelectionne, setBrSelectionne] = useState<any>(null);

  const [lignesAvoir, setLignesAvoir] = useState<any[]>([]);
  const [observation, setObservation] = useState("");

  // États pour les détails d'avoir
  const [showDetailsAvoir, setShowDetailsAvoir] = useState(false);
  const [avoirSelectionne, setAvoirSelectionne] = useState<any>(null);
  const [detailsAvoir, setDetailsAvoir] = useState<any[]>([]);

  // Fix Auto-Increment for Avoir tables
  const runMigrations = async () => {
    try {
      const db = await getDb();

      // 1. stock_avoirs_fournisseurs
      try { await db.execute("ALTER TABLE stock_avoirs_fournisseurs ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_avoirs_fournisseurs MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_avoirs_fournisseurs' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix Avoir table failed:", e); }

      // 2. stock_avoir_details
      try { await db.execute("ALTER TABLE stock_avoir_details ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_avoir_details MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_avoir_details' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix Avoir Details table failed:", e); }

      // 3. stock_avoir_mouvements
      try { await db.execute("ALTER TABLE stock_avoir_mouvements ADD PRIMARY KEY (id)"); } catch (e) { /* Ignore */ }
      try {
        await db.execute("ALTER TABLE stock_avoir_mouvements MODIFY COLUMN id INT AUTO_INCREMENT");
        console.log("✅ Fixed: 'stock_avoir_mouvements' ID is now Auto-Increment.");
      } catch (e) { console.error("Fix Avoir Mouvements table failed:", e); }

    } catch (e) { console.error("Migration wrapper error:", e); }
  };

  useEffect(() => {
    runMigrations();
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    await chargerBonsRetour();
    await chargerAvoirs();
  };

  const chargerBonsRetour = async () => {
    try {
      const db = await getDb();
      // Charger les BR qui n'ont pas encore d'avoir
      const res = await db.select<any[]>(`
        SELECT br.id, br.numero_br, br.date_br, 
               CAST(br.montant_total AS CHAR) as montant_total,
               bl.numero_bl, bl.date_bl,
               f.nom as nom_fournisseur
        FROM stock_bons_retour br
        LEFT JOIN stock_bons_livraison bl ON br.bl_id = bl.id
        LEFT JOIN stock_fournisseurs f ON bl.fournisseur_id = f.id
        LEFT JOIN stock_avoirs_fournisseurs a ON br.id = a.br_id
        WHERE a.id IS NULL
        ORDER BY br.date_br DESC
      `);
      setBonsRetour(res.map(b => ({ ...b, montant_total: parseFloat(b.montant_total || "0") })));
    } catch (e) {
      console.error("Erreur chargement BR:", e);
    }
  };

  const chargerAvoirs = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT a.id, a.numero_avoir, a.date_avoir, 
               CAST(a.montant_total AS CHAR) as montant_total,
               a.statut, a.observation,
               br.numero_br,
               bl.numero_bl,
               f.nom as nom_fournisseur
        FROM stock_avoirs_fournisseurs a
        JOIN stock_bons_retour br ON a.br_id = br.id
        JOIN stock_bons_livraison bl ON br.bl_id = bl.id
        JOIN stock_fournisseurs f ON bl.fournisseur_id = f.id
        ORDER BY a.date_avoir DESC
      `);
      setAvoirs(res.map(av => ({ ...av, montant_total: parseFloat(av.montant_total || "0") })));
    } catch (e) {
      console.error("Erreur chargement avoirs:", e);
    }
  };

  const ouvrirPopupAvoir = async (br: any) => {
    try {
      const db = await getDb();

      // Charger les détails du BR
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id, 
               CAST(d.quantite_retour AS CHAR) as quantite_retour,
               CAST(d.prix_achat_ht AS CHAR) as prix_achat_ht,
               d.motif as motif_retour,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               r.libelle as rayon
        FROM stock_br_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.br_id = ?
      `, [br.id]);

      setBrSelectionne(br);

      // Initialiser les lignes d'avoir avec motif par défaut
      const initAvoir = res.map(ligne => ({
        br_detail_id: ligne.id,
        article_id: ligne.article_id,
        designation: ligne.designation,
        cip: ligne.cip,
        quantite: parseFloat(ligne.quantite_retour || "0"),
        prix_unitaire: parseFloat(ligne.prix_achat_ht || "0"),
        motif_retour: ligne.motif_retour,
        motif_avoir: "", // À sélectionner
        total_ligne: parseFloat(ligne.total_ligne || "0"),
        rayon: ligne.rayon
      }));

      setLignesAvoir(initAvoir);
      setShowPopupAvoir(true);

    } catch (e) {
      console.error("Erreur ouverture popup:", e);
      alert("Erreur lors du chargement des détails");
    }
  };

  const genererNumeroAvoir = (numeroBL: string) => {
    // Basé sur le numéro du BL avec suffixe -A pour Avoir
    // Exemple : BL-005 → BL-005-A
    return `${numeroBL}-A`;
  };

  const changerMotifAvoir = (index: number, motif: string) => {
    const nouvelles = [...lignesAvoir];
    nouvelles[index].motif_avoir = motif;
    setLignesAvoir(nouvelles);
  };

  const appliquerMotifGlobal = (motif: string) => {
    const nouvelles = lignesAvoir.map(l => ({ ...l, motif_avoir: motif }));
    setLignesAvoir(nouvelles);
  };

  const enregistrerAvoir = async () => {
    // Vérifier que tous les produits ont un motif
    const lignesSansMotif = lignesAvoir.filter(l => !l.motif_avoir);
    if (lignesSansMotif.length > 0) {
      return alert("❌ Tous les produits doivent avoir un motif d'avoir !");
    }

    try {
      const db = await getDb();
      const numeroAvoir = genererNumeroAvoir(brSelectionne.numero_bl);
      const dateAvoir = new Date().toISOString().split('T')[0];
      const montantTotal = lignesAvoir.reduce((sum, l) => sum + l.total_ligne, 0);

      // Créer l'avoir avec statut Validé
      const resAvoir = await db.execute(`
        INSERT INTO stock_avoirs_fournisseurs 
        (numero_avoir, date_avoir, br_id, montant_total, observation, statut)
        VALUES (?, ?, ?, ?, ?, 'Validé')
      `, [numeroAvoir, dateAvoir, brSelectionne.id, montantTotal, observation]);

      const newAvoirId = resAvoir.lastInsertId;
      console.log("🆕 Avoir créé ID:", newAvoirId);

      if (!newAvoirId || newAvoirId <= 0) {
        throw new Error("L'ID de l'avoir retourné par la base de données est invalide (0 ou null). Échec de l'insertion.");
      }

      // Traiter chaque ligne selon son motif
      for (const ligne of lignesAvoir) {
        // Insérer la ligne de détail
        const resDetail = await db.execute(`
          INSERT INTO stock_avoir_details 
          (avoir_id, article_id, quantite, prix_unitaire, motif, total_ligne)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          newAvoirId,
          ligne.article_id,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.motif_avoir,
          ligne.total_ligne
        ]);

        const newDetailId = resDetail.lastInsertId;
        console.log("  - Détail inséré ID:", newDetailId, "pour Avoir ID:", newAvoirId);

        if (!newDetailId || newDetailId <= 0) {
          console.error("⚠️ Attention: Détail inséré avec ID invalide pour l'article", ligne.article_id);
          // On continue quand même pour essayer de sauver les autres lignes, mais c'est critique.
        }

        // Traitement selon le motif
        if (ligne.motif_avoir === "Remplacé") {
          // Récupérer le stock actuel
          const stockActuel = await db.select<any[]>(
            "SELECT CAST(quantite_stock AS CHAR) as quantite_stock FROM stock_articles WHERE id = ?",
            [ligne.article_id]
          );
          const stockAvant = parseFloat(stockActuel[0].quantite_stock || "0");

          // Remettre le stock comme avant le retour (on ajoute la quantité)
          await db.execute(
            "UPDATE stock_articles SET quantite_stock = quantite_stock + ? WHERE id = ?",
            [ligne.quantite, ligne.article_id]
          );

          // Traçabilité du mouvement
          await db.execute(`
            INSERT INTO stock_avoir_mouvements 
            (avoir_detail_id, article_id, quantite, type_mouvement, stock_avant, stock_apres)
            VALUES (?, ?, ?, 'Remplacé', ?, ?)
          `, [newDetailId, ligne.article_id, ligne.quantite, stockAvant, stockAvant + ligne.quantite]);
        }
        else if (ligne.motif_avoir === "Déduit facture") {
          // Traçabilité du mouvement (pas de changement de stock)
          const stockActuel = await db.select<any[]>(
            "SELECT CAST(quantite_stock AS CHAR) as quantite_stock FROM stock_articles WHERE id = ?",
            [ligne.article_id]
          );
          const stock = parseFloat(stockActuel[0].quantite_stock || "0");

          await db.execute(`
            INSERT INTO stock_avoir_mouvements 
            (avoir_detail_id, article_id, quantite, type_mouvement, stock_avant, stock_apres)
            VALUES (?, ?, ?, 'Déduit', ?, ?)
          `, [newDetailId, ligne.article_id, ligne.quantite, stock, stock]);
        }
        // Pour "Rejeté", on ne fait rien (ni stock ni déduction)
      }

      alert(`✅ Avoir fournisseur ${numeroAvoir} créé avec succès !\n\n` +
        `Montant total: ${Math.ceil(montantTotal).toLocaleString()} F\n` +
        `Produits traités: ${lignesAvoir.length}`);

      // Fermer et rafraîchir
      setShowPopupAvoir(false);
      setBrSelectionne(null);
      setLignesAvoir([]);
      setObservation("");
      chargerDonnees();

    } catch (e) {
      console.error("Erreur création avoir:", e);
      alert("❌ Erreur lors de la création de l'avoir");
    }
  };

  const ouvrirDetailsAvoir = async (avoir: any) => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT d.id, d.article_id,
               CAST(d.quantite AS CHAR) as quantite,
               CAST(d.prix_unitaire AS CHAR) as prix_unitaire,
               d.motif,
               CAST(d.total_ligne AS CHAR) as total_ligne,
               a.designation, a.cip,
               r.libelle as rayon
        FROM stock_avoir_details d
        JOIN stock_articles a ON d.article_id = a.id
        LEFT JOIN stock_rayons r ON a.rayon_id = r.id
        WHERE d.avoir_id = ?
      `, [avoir.id]);

      setAvoirSelectionne(avoir);
      setDetailsAvoir(res.map(r => ({
        ...r,
        quantite: parseFloat(r.quantite || "0"),
        prix_unitaire: parseFloat(r.prix_unitaire || "0"),
        total_ligne: parseFloat(r.total_ligne || "0")
      })));
      setShowDetailsAvoir(true);
    } catch (e) {
      console.error("Erreur détails avoir:", e);
    }
  };

  const supprimerAvoir = async (id: number, numero: string) => {
    if (!window.confirm(`⚠️ Supprimer l'avoir ${numero} ?\n\nCette action est irréversible.`)) return;

    try {
      const db = await getDb();

      // Récupérer les détails pour annuler les mouvements de stock
      const details = await db.select<any[]>(`
        SELECT article_id, CAST(quantite AS CHAR) as quantite, motif
        FROM stock_avoir_details
        WHERE avoir_id = ?
      `, [id]);

      // Annuler les mouvements de stock pour les produits "Remplacés"
      for (const detail of details) {
        if (detail.motif === "Remplacé") {
          // Retirer la quantité qui avait été rajoutée
          await db.execute(
            "UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?",
            [parseFloat(detail.quantite || "0"), detail.article_id]
          );
        }
      }

      // Supprimer l'avoir (cascade supprimera les détails et mouvements)
      await db.execute("DELETE FROM stock_avoirs_fournisseurs WHERE id = ?", [id]);

      alert("✅ Avoir supprimé avec succès !");
      chargerDonnees();
    } catch (e) {
      console.error("Erreur suppression:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  const imprimerAvoir = async () => {
    if (!avoirSelectionne || detailsAvoir.length === 0) return;

    const company = await getCompanyInfo();

    const content = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Avoir Fournisseur ${avoirSelectionne.numero_avoir}</title>
              <style>
                  @page { size: A4; margin: 0; }
                  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                  .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                  .company-sub { font-size: 10px; color: #7f8c8d; }
                  .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }

                  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                  .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                  .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                  th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                  td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                  tr:last-child td { border-bottom: none; }

                  .total-section { display: flex; justify-content: flex-end; margin-top: 20px; }
                  .total-box { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold; background: #f9f9f9; border: 1px solid #eee; color: #2c3e50; }

                  .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                  .sig-box { width: 40%; text-align: center; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #999; }
                  
                  .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; color: white; display: inline-block; }
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
                      <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Avoir Fournisseur</div>
                      <div class="doc-title">${avoirSelectionne.numero_avoir}</div>
                  </div>
              </div>
    
              <div class="meta-grid">
                  <div class="meta-item">
                      <label>Date</label>
                      <span>${new Date(avoirSelectionne.date_avoir).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div class="meta-item">
                      <label>Fournisseur</label>
                      <span>${avoirSelectionne.nom_fournisseur}</span>
                  </div>
                  <div class="meta-item">
                      <label>Réf. Bon de Retour</label>
                      <span>${avoirSelectionne.numero_br}</span>
                  </div>
                  <div class="meta-item">
                      <label>Réf. BL Origine</label>
                      <span>${avoirSelectionne.numero_bl}</span>
                  </div>
              </div>
              
              ${avoirSelectionne.observation ? `
              <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 5px; color: #856404;">
                   <strong>Observation:</strong> ${avoirSelectionne.observation}
              </div>` : ''}
    
              <table>
                  <thead>
                      <tr>
                          <th>Produit</th>
                          <th>Rayon</th>
                          <th>Qté</th>
                          <th>Prix U.</th>
                          <th>Motif</th>
                          <th style="text-align: right;">Total</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${detailsAvoir.map(ligne => {
      let color = '#ccc';
      if (ligne.motif === 'Rejeté') color = '#e74c3c';
      else if (ligne.motif === 'Remplacé') color = '#27ae60';
      else if (ligne.motif === 'Déduit facture') color = '#3498db';

      return `
                          <tr>
                              <td>${ligne.designation}<br/><span style="color:#7f8c8d; font-size:10px;">${ligne.cip || ''}</span></td>
                              <td>${ligne.rayon || '-'}</td>
                              <td>${ligne.quantite}</td>
                              <td>${Math.ceil(ligne.prix_unitaire).toLocaleString()} F</td>
                              <td><span class="badge" style="background-color: ${color}">${ligne.motif}</span></td>
                              <td style="text-align: right; font-weight: bold;">${Math.ceil(ligne.total_ligne).toLocaleString()} F</td>
                          </tr>`;
    }).join('')}
                  </tbody>
              </table>
    
              <div class="total-section">
                  <div class="total-box">
                      TOTAL : ${Math.ceil(avoirSelectionne.montant_total).toLocaleString()} F
                  </div>
              </div>
    
              <div class="signatures">
                  <div class="sig-box">Signature du Fournisseur</div>
                  <div class="sig-box">Signature du Responsable</div>
              </div>
    
              <div class="footer">
                  Imprimé le ${new Date().toLocaleString('fr-FR')}
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

  // Filtrage et pagination
  const dataFiltrees = activeTab === "br"
    ? bonsRetour.filter(br => {
      const matchCode = searchCode === "" || br.numero_br.toLowerCase().includes(searchCode.toLowerCase());
      const matchDateDebut = dateDebut === "" || br.date_br >= dateDebut;
      const matchDateFin = dateFin === "" || br.date_br <= dateFin;
      return matchCode && matchDateDebut && matchDateFin;
    })
    : avoirs.filter(av => {
      const matchCode = searchCode === "" || av.numero_avoir.toLowerCase().includes(searchCode.toLowerCase());
      const matchDateDebut = dateDebut === "" || av.date_avoir >= dateDebut;
      const matchDateFin = dateFin === "" || av.date_avoir <= dateFin;
      return matchCode && matchDateDebut && matchDateFin;
    });

  const totalPages = Math.ceil(dataFiltrees.length / itemsPerPage);
  const indexDebut = (currentPage - 1) * itemsPerPage;
  const indexFin = indexDebut + itemsPerPage;
  const dataPage = dataFiltrees.slice(indexDebut, indexFin);

  const recap = {
    nbProduits: lignesAvoir.length,
    qteTotal: lignesAvoir.reduce((sum, l) => sum + l.quantite, 0),
    montantTotal: lignesAvoir.reduce((sum, l) => sum + l.total_ligne, 0)
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>
        💼 Avoir Fournisseurs
      </h2>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => { setActiveTab("br"); setCurrentPage(1); }}
          style={{
            ...tabBtnStyle,
            background: activeTab === "br" ? '#3498db' : '#ecf0f1',
            color: activeTab === "br" ? 'white' : '#333'
          }}
        >
          📋 Bons de Retour ({bonsRetour.length})
        </button>
        <button
          onClick={() => { setActiveTab("avoirs"); setCurrentPage(1); }}
          style={{
            ...tabBtnStyle,
            background: activeTab === "avoirs" ? '#f39c12' : '#ecf0f1',
            color: activeTab === "avoirs" ? 'white' : '#333'
          }}
        >
          💼 Avoirs Créés ({avoirs.length})
        </button>
      </div>

      {/* Filtres */}
      <div style={filtresStyle}>
        <input
          value={searchCode}
          onChange={e => setSearchCode(e.target.value)}
          placeholder={`🔍 Rechercher par numéro ${activeTab === "br" ? "BR" : "avoir"}...`}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: '#555' }}>Du:</label>
          <input
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            style={inputStyle}
          />
          <label style={{ fontSize: '14px', color: '#555' }}>Au:</label>
          <input
            type="date"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            style={inputStyle}
          />
          {(searchCode || dateDebut || dateFin) && (
            <button
              onClick={() => { setSearchCode(""); setDateDebut(""); setDateFin(""); }}
              style={btnResetStyle}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: activeTab === "br" ? '#3498db' : '#f39c12', color: 'white' }}>
              <th style={thStyle}>{activeTab === "br" ? "N° BR" : "N° Avoir"}</th>
              <th style={thStyle}>Date</th>
              {activeTab === "br" && <th style={thStyle}>N° BL</th>}
              {activeTab === "avoirs" && <th style={thStyle}>N° BR</th>}
              <th style={thStyle}>Fournisseur</th>
              <th style={thStyle}>Montant</th>
              {activeTab === "avoirs" && <th style={thStyle}>Statut</th>}
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dataPage.length > 0 ? (
              dataPage.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                  <td style={tdStyle}>
                    <strong>{activeTab === "br" ? item.numero_br : item.numero_avoir}</strong>
                  </td>
                  <td style={tdStyle}>
                    {new Date(activeTab === "br" ? item.date_br : item.date_avoir).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={tdStyle}>
                    {activeTab === "br" ? item.numero_bl : item.numero_br}
                  </td>
                  <td style={tdStyle}>{item.nom_fournisseur}</td>
                  <td style={tdStyle}>
                    <strong>{Math.ceil(item.montant_total).toLocaleString()} F</strong>
                  </td>
                  {activeTab === "avoirs" && (
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeStyle,
                        background: item.statut === 'Validé' ? '#27ae60' : item.statut === 'Annulé' ? '#e74c3c' : '#f39c12'
                      }}>
                        {item.statut}
                      </span>
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {activeTab === "br" ? (
                      <button
                        onClick={() => ouvrirPopupAvoir(item)}
                        style={btnActionStyle}
                      >
                        💼 Effectuer une opération
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => ouvrirDetailsAvoir(item)} style={btnIconStyle}>
                          👁️
                        </button>
                        <button onClick={() => supprimerAvoir(item.id, item.numero_avoir)} style={{ ...btnIconStyle, color: '#e74c3c' }}>
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={activeTab === "br" ? 6 : 7} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>
                    {activeTab === "br" ? '📋' : '💼'}
                  </div>
                  <div>Aucun {activeTab === "br" ? "bon de retour disponible" : "avoir créé"}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={paginationStyle}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            style={btnPageStyle}
          >
            ← Précédent
          </button>
          <span>
            Page {currentPage} sur {totalPages} ({dataFiltrees.length} résultat{dataFiltrees.length > 1 ? 's' : ''})
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            style={btnPageStyle}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* POPUP CRÉATION AVOIR */}
      {showPopupAvoir && brSelectionne && (
        <div style={overlayStyle}>
          <div style={popupLargeStyle}>
            {/* En-tête */}
            <div style={headerStyle}>
              <div>
                <h2 style={{ margin: 0, color: 'white' }}>💼 Créer un Avoir Fournisseur</h2>
                <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>
                  BR: {brSelectionne.numero_br} | BL: {brSelectionne.numero_bl} | {brSelectionne.nom_fournisseur}
                </p>
              </div>
              <button onClick={() => setShowPopupAvoir(false)} style={btnCloseStyle}>✕</button>
            </div>

            {/* Corps */}
            <div style={bodyStyle}>
              {/* Motif global */}
              <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong>⚡ Application rapide du motif :</strong>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={() => appliquerMotifGlobal("Rejeté")} style={btnMotifGlobalStyle}>
                    ❌ Tout rejeter
                  </button>
                  <button onClick={() => appliquerMotifGlobal("Remplacé")} style={btnMotifGlobalStyle}>
                    🔄 Tout remplacer
                  </button>
                  <button onClick={() => appliquerMotifGlobal("Déduit facture")} style={btnMotifGlobalStyle}>
                    💰 Tout déduire
                  </button>
                </div>
              </div>

              {/* Tableau produits */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f39c12', color: 'white', zIndex: 1 }}>
                    <tr>
                      <th style={thStyle}>Produit</th>
                      <th style={thStyle}>Rayon</th>
                      <th style={thStyle}>Qté</th>
                      <th style={thStyle}>Prix U.</th>
                      <th style={thStyle}>Motif Retour</th>
                      <th style={thStyle}>Motif Avoir</th>
                      <th style={thStyle}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesAvoir.map((ligne, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #ecf0f1' }}>
                        <td style={tdStyle}>
                          <strong>{ligne.designation}</strong>
                          <br />
                          <small style={{ color: '#7f8c8d' }}>{ligne.cip || ''}</small>
                        </td>
                        <td style={tdStyle}>{ligne.rayon || '-'}</td>
                        <td style={tdStyle}><strong>{ligne.quantite}</strong></td>
                        <td style={tdStyle}>{Math.ceil(ligne.prix_unitaire).toLocaleString()} F</td>
                        <td style={tdStyle}>
                          <span style={{ ...motifBadgeStyle, background: getMotifRetourColor(ligne.motif_retour) }}>
                            {ligne.motif_retour}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={ligne.motif_avoir}
                            onChange={e => changerMotifAvoir(idx, e.target.value)}
                            style={{
                              ...selectStyle,
                              borderColor: ligne.motif_avoir ? '#27ae60' : '#e74c3c',
                              fontWeight: ligne.motif_avoir ? 'bold' : 'normal'
                            }}
                          >
                            <option value="">-- Choisir --</option>
                            <option value="Rejeté">❌ Rejeté</option>
                            <option value="Remplacé">🔄 Remplacé</option>
                            <option value="Déduit facture">💰 Déduit facture</option>
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <strong>{Math.ceil(ligne.total_ligne).toLocaleString()} F</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Observation */}
              <div style={{ marginTop: '15px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  📝 Observation (optionnel)
                </label>
                <textarea
                  value={observation}
                  onChange={e => setObservation(e.target.value)}
                  placeholder="Remarques ou notes concernant cet avoir..."
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <div style={{ flex: 1 }}>
                <div style={recapItemStyle}>
                  <span>Produits :</span>
                  <strong>{recap.nbProduits}</strong>
                </div>
                <div style={recapItemStyle}>
                  <span>Quantité totale :</span>
                  <strong>{recap.qteTotal}</strong>
                </div>
                <div style={recapItemStyle}>
                  <span>Montant total :</span>
                  <strong style={{ color: '#f39c12', fontSize: '18px' }}>
                    {Math.ceil(recap.montantTotal).toLocaleString()} F
                  </strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowPopupAvoir(false)} style={btnCancelStyle}>
                  ✕ Annuler
                </button>
                <button onClick={enregistrerAvoir} style={btnValidStyle}>
                  ✓ Créer l'Avoir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DÉTAILS AVOIR */}
      {showDetailsAvoir && avoirSelectionne && (
        <div style={overlayStyle}>
          <div style={popupMediumStyle}>
            <div style={{ ...headerStyle, background: '#f39c12' }}>
              <div>
                <h2 style={{ margin: 0, color: 'white' }}>💼 Détails de l'Avoir</h2>
                <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>
                  {avoirSelectionne.numero_avoir} - {avoirSelectionne.nom_fournisseur}
                </p>
              </div>
              <button onClick={() => setShowDetailsAvoir(false)} style={btnCloseStyle}>✕</button>
            </div>

            <div style={bodyStyle}>
              {/* Infos générales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div style={infoBoxStyle}>
                  <small>Date</small>
                  <strong>{new Date(avoirSelectionne.date_avoir).toLocaleDateString('fr-FR')}</strong>
                </div>
                <div style={infoBoxStyle}>
                  <small>Statut</small>
                  <span style={{
                    ...badgeStyle,
                    background: avoirSelectionne.statut === 'Validé' ? '#27ae60' : '#f39c12'
                  }}>
                    {avoirSelectionne.statut}
                  </span>
                </div>
                <div style={infoBoxStyle}>
                  <small>Bon de Retour</small>
                  <strong>{avoirSelectionne.numero_br}</strong>
                </div>
                <div style={infoBoxStyle}>
                  <small>Bon de Livraison</small>
                  <strong>{avoirSelectionne.numero_bl}</strong>
                </div>
                {avoirSelectionne.observation && (
                  <div style={{ ...infoBoxStyle, gridColumn: '1 / -1' }}>
                    <small>Observation</small>
                    <p style={{ margin: '5px 0 0 0' }}>{avoirSelectionne.observation}</p>
                  </div>
                )}
              </div>

              {/* Détails produits */}
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f39c12', color: 'white', zIndex: 1 }}>
                    <tr>
                      <th style={thStyle}>Produit</th>
                      <th style={thStyle}>Qté</th>
                      <th style={thStyle}>Prix U.</th>
                      <th style={thStyle}>Motif</th>
                      <th style={thStyle}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsAvoir.map((ligne: any) => (
                      <tr key={ligne.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                        <td style={tdStyle}>
                          <strong>{ligne.designation}</strong><br />
                          <small style={{ color: '#7f8c8d' }}>
                            {ligne.cip || ''} {ligne.rayon && `| ${ligne.rayon}`}
                          </small>
                        </td>
                        <td style={tdStyle}><strong>{ligne.quantite}</strong></td>
                        <td style={tdStyle}>{Math.ceil(ligne.prix_unitaire).toLocaleString()} F</td>
                        <td style={tdStyle}>
                          <span style={{
                            ...motifBadgeStyle,
                            background: getMotifAvoirColor(ligne.motif)
                          }}>
                            {ligne.motif === "Rejeté" && "❌"}
                            {ligne.motif === "Remplacé" && "🔄"}
                            {ligne.motif === "Déduit facture" && "💰"}
                            {" "}{ligne.motif}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <strong>{Math.ceil(ligne.total_ligne).toLocaleString()} F</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={footerStyle}>
              <div style={{ flex: 1, fontSize: '18px', fontWeight: 'bold', color: '#f39c12' }}>
                TOTAL: {Math.ceil(avoirSelectionne.montant_total).toLocaleString()} F
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={imprimerAvoir} style={btnPrintStyle}>
                  🖨️ Imprimer
                </button>
                <button onClick={() => utilsExportToExcel(detailsAvoir.map(d => ({
                  'Produit': d.designation,
                  'Rayon': d.rayon,
                  'Quantité': d.quantite,
                  'Prix U': d.prix_unitaire,
                  'Motif': d.motif,
                  'Total': d.total_ligne,
                })), `Avoir_${avoirSelectionne.numero_avoir}`)} style={{ ...btnPrintStyle, background: '#107c41' }}>
                  📊 Excel
                </button>
                <button onClick={() => setShowDetailsAvoir(false)} style={btnCancelStyle}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fonctions utilitaires
function getMotifRetourColor(motif: string) {
  const colors: any = {
    "Péremption": "#e74c3c",
    "Cassé": "#e67e22",
    "Avarié": "#e67e22",
    "Facturé non livré": "#3498db",
    "Bon état": "#27ae60",
    "Livré non facturé": "#9b59b6"
  };
  return colors[motif] || "#95a5a6";
}

function getMotifAvoirColor(motif: string) {
  const colors: any = {
    "Rejeté": "#e74c3c",
    "Remplacé": "#27ae60",
    "Déduit facture": "#3498db"
  };
  return colors[motif] || "#95a5a6";
}

// Styles
const tabBtnStyle: React.CSSProperties = {
  padding: '12px 25px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '15px',
  transition: '0.2s'
};

const filtresStyle: React.CSSProperties = {
  display: 'flex',
  gap: '15px',
  marginBottom: '20px',
  flexWrap: 'wrap'
};

const inputStyle: React.CSSProperties = {
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  fontSize: '14px',
  flex: 1,
  minWidth: '200px'
};

const btnResetStyle: React.CSSProperties = {
  padding: '10px 15px',
  background: '#e74c3c',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px'
};

const thStyle: React.CSSProperties = {
  padding: '12px 10px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 'bold'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: '14px'
};

const badgeStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 'bold',
  color: 'white'
};

const btnActionStyle: React.CSSProperties = {
  background: '#f39c12',
  color: 'white',
  border: 'none',
  padding: '8px 15px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '13px'
};

const btnIconStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer'
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '15px',
  marginTop: '20px',
  fontSize: '14px'
};

const btnPageStyle: React.CSSProperties = {
  padding: '8px 15px',
  background: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px'
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px'
};

const popupLargeStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '15px',
  width: '95%',
  maxWidth: '1200px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
};

const popupMediumStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '15px',
  width: '90%',
  maxWidth: '900px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
};

const headerStyle: React.CSSProperties = {
  background: '#f39c12',
  color: 'white',
  padding: '20px 25px',
  borderRadius: '15px 15px 0 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const bodyStyle: React.CSSProperties = {
  padding: '25px',
  flex: 1,
  overflowY: 'auto'
};

const footerStyle: React.CSSProperties = {
  padding: '20px 25px',
  borderTop: '2px solid #ecf0f1',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#f8f9fa'
};

const btnCloseStyle: React.CSSProperties = {
  fontSize: '2rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'white'
};

const btnMotifGlobalStyle: React.CSSProperties = {
  padding: '8px 15px',
  background: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold'
};

const selectStyle: React.CSSProperties = {
  padding: '8px',
  border: '2px solid',
  borderRadius: '5px',
  fontSize: '13px',
  width: '100%',
  cursor: 'pointer'
};

const motifBadgeStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 'bold',
  color: 'white',
  display: 'inline-block'
};

const recapItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #ecf0f1'
};

const btnCancelStyle: React.CSSProperties = {
  padding: '12px 30px',
  background: '#95a5a6',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 'bold'
};

const btnValidStyle: React.CSSProperties = {
  padding: '12px 30px',
  background: '#27ae60',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 'bold'
};

const btnPrintStyle: React.CSSProperties = {
  padding: '12px 25px',
  background: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 'bold'
};

const infoBoxStyle: React.CSSProperties = {
  background: '#f8f9fa',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ecf0f1'
};