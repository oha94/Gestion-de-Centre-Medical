import { useState, useEffect } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel as utilsExportToExcel } from "../../lib/exportUtils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CompteFournisseurs({ currentUser }: { currentUser?: any }) {
  // États principaux
  const [blList, setBlList] = useState<any[]>([]);
  const [historiqueList, setHistoriqueList] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"bl" | "historique" | "dashboard">("bl");

  // États pour les filtres
  const [filterFournisseur, setFilterFournisseur] = useState("");
  const [filterDateDebut, setFilterDateDebut] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // États pour le paiement
  const [showPopupPaiement, setShowPopupPaiement] = useState(false);
  const [blSelectionne, setBlSelectionne] = useState<any>(null);
  const [paiementsBL, setPaiementsBL] = useState<any[]>([]);

  // Données du paiement
  const [montantPaiement, setMontantPaiement] = useState("");
  const [modePaiement, setModePaiement] = useState("");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [observationPaiement, setObservationPaiement] = useState("");

  // États pour les détails
  const [showDetailsBL, setShowDetailsBL] = useState(false);
  const [detailsBL, setDetailsBL] = useState<any>(null);

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // ============================================
  // MIGRATION DES VUES (SANS CAST - Correction DECIMAL)
  // ============================================
  // ============================================
  // MIGRATION DES VUES (VERSION FINALE CORRIGÉE)
  // ============================================
  useEffect(() => {
    const initialiser = async () => {
      // NOUVELLE CLÉ pour forcer la recréation
      const migrationKey = "vues_cast_correction_v7";
      const dejaMigre = localStorage.getItem(migrationKey);

      if (!dejaMigre) {
        console.log("🚀 Migration CAST FIX v7...");

        try {
          const db = await getDb();

          // Suppression FORCÉE (ignorer les erreurs)
          const tables = ["v_situation_bl", "v_historique_paiements", "v_deductions_bl"];

          for (const t of tables) {
            try {
              await db.execute(`DROP TABLE IF EXISTS ${t}`);
              console.log(`✓ ${t} (TABLE) supprimée`);
            } catch (e) {
              console.log(`⚠️ ${t} (TABLE) n'existe pas`);
            }

            try {
              await db.execute(`DROP VIEW IF EXISTS ${t}`);
              console.log(`✓ ${t} (VIEW) supprimée`);
            } catch (e) {
              console.log(`⚠️ ${t} (VIEW) n'existe pas`);
            }
          }

          console.log("🧹 Nettoyage terminé");
          console.log("🔨 Création des vues SANS CAST...");

          // VUE 1 : v_situation_bl (SANS AUCUN CAST!)
          try {
            await db.execute(`
              CREATE VIEW v_situation_bl AS
              SELECT 
                bl.id as bl_id, 
                bl.numero_bl, 
                bl.date_bl, 
                bl.fournisseur_id, 
                f.nom as nom_fournisseur,
                CAST(bl.montant_total AS DOUBLE) as montant_bl,
                CAST(COALESCE((SELECT SUM(ad.total_ligne) FROM stock_avoirs_fournisseurs av JOIN stock_avoir_details ad ON av.id = ad.avoir_id JOIN stock_bons_retour br ON av.br_id = br.id WHERE br.bl_id = bl.id AND ad.motif = 'Déduit facture' AND av.statut = 'Validé'), 0) AS DOUBLE) as montant_deductions,
                CAST((bl.montant_total - COALESCE((SELECT SUM(ad.total_ligne) FROM stock_avoirs_fournisseurs av JOIN stock_avoir_details ad ON av.id = ad.avoir_id JOIN stock_bons_retour br ON av.br_id = br.id WHERE br.bl_id = bl.id AND ad.motif = 'Déduit facture' AND av.statut = 'Validé'), 0)) AS DOUBLE) as montant_net,
                CAST(COALESCE((SELECT SUM(montant_paye) FROM stock_paiements_fournisseurs WHERE bl_id = bl.id), 0) AS DOUBLE) as montant_paye,
                CAST((bl.montant_total - COALESCE((SELECT SUM(ad.total_ligne) FROM stock_avoirs_fournisseurs av JOIN stock_avoir_details ad ON av.id = ad.avoir_id JOIN stock_bons_retour br ON av.br_id = br.id WHERE br.bl_id = bl.id AND ad.motif = 'Déduit facture' AND av.statut = 'Validé'), 0) - COALESCE((SELECT SUM(montant_paye) FROM stock_paiements_fournisseurs WHERE bl_id = bl.id), 0)) AS DOUBLE) as solde_restant,
                COALESCE((SELECT COUNT(*) FROM stock_paiements_fournisseurs WHERE bl_id = bl.id), 0) as nb_paiements,
                CASE
                  WHEN COALESCE((SELECT SUM(montant_paye) FROM stock_paiements_fournisseurs WHERE bl_id = bl.id), 0) = 0 THEN 'Non payé'
                  WHEN COALESCE((SELECT SUM(montant_paye) FROM stock_paiements_fournisseurs WHERE bl_id = bl.id), 0) >= (bl.montant_total - COALESCE((SELECT SUM(ad.total_ligne) FROM stock_avoirs_fournisseurs av JOIN stock_avoir_details ad ON av.id = ad.avoir_id JOIN stock_bons_retour br ON av.br_id = br.id WHERE br.bl_id = bl.id AND ad.motif = 'Déduit facture' AND av.statut = 'Validé'), 0)) - 0.5 THEN 'Payé'
                  ELSE 'Partiellement payé'
                END as statut_paiement
              FROM stock_bons_livraison bl 
              LEFT JOIN stock_fournisseurs f ON bl.fournisseur_id = f.id
            `);
            console.log("✅ v_situation_bl créée");
          } catch (e) {
            console.error("❌ Erreur v_situation_bl:", e);
          }

          // VUE 2 : v_historique_paiements (SANS CAST!)
          try {
            await db.execute(`
              CREATE VIEW v_historique_paiements AS
              SELECT 
                p.id, p.numero_paiement, p.date_paiement, p.bl_id, 
                bl.numero_bl, bl.date_bl, CAST(bl.montant_total AS DOUBLE) as montant_bl, 
                p.fournisseur_id, f.nom as nom_fournisseur, CAST(p.montant_paye AS DOUBLE) as montant_paye,
                p.mode_paiement, p.reference_paiement, p.observation, 
                p.created_by, p.created_at,
                (SELECT COUNT(*) + 1 FROM stock_paiements_fournisseurs p2 WHERE p2.bl_id = p.bl_id AND p2.id < p.id) as numero_versement
              FROM stock_paiements_fournisseurs p
              JOIN stock_bons_livraison bl ON p.bl_id = bl.id
              JOIN stock_fournisseurs f ON p.fournisseur_id = f.id
              ORDER BY p.date_paiement DESC, p.created_at DESC
            `);
            console.log("✅ v_historique_paiements créée");
          } catch (e) {
            console.error("❌ Erreur v_historique_paiements:", e);
          }

          // VUE 3 : v_deductions_bl (SANS CAST!)
          try {
            await db.execute(`
              CREATE VIEW v_deductions_bl AS
              SELECT 
                bl.id as bl_id, bl.numero_bl, av.numero_avoir, av.date_avoir, 
                br.numero_br, ad.article_id, art.designation, ad.quantite, 
                CAST(ad.prix_unitaire AS DOUBLE) as prix_unitaire, CAST(ad.total_ligne AS DOUBLE) as montant_deduction
              FROM stock_bons_livraison bl
              JOIN stock_bons_retour br ON br.bl_id = bl.id
              JOIN stock_avoirs_fournisseurs av ON av.br_id = br.id
              JOIN stock_avoir_details ad ON ad.avoir_id = av.id
              JOIN stock_articles art ON ad.article_id = art.id
              WHERE ad.motif = 'Déduit facture' AND av.statut = 'Validé'
            `);
            console.log("✅ v_deductions_bl créée");
          } catch (e) {
            console.error("❌ Erreur v_deductions_bl:", e);
          }

          // Marquer la migration comme terminée
          localStorage.setItem(migrationKey, "true");
          console.log("🎉 Migration terminée avec succès!");

        } catch (error: any) {
          console.error("❌ Erreur migration:", error);
        }
      } else {
        console.log("✓ Migration déjà effectuée");
      }

      // Charger les données
      chargerDonnees();
    };

    initialiser();
  }, []);

  const chargerDonnees = async () => {
    await chargerFournisseurs();
    await chargerBLList();
    await chargerHistorique();
    await chargerDashboard();
  };

  const chargerFournisseurs = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>("SELECT id, nom FROM stock_fournisseurs ORDER BY nom");
      setFournisseurs(res);
    } catch (e) {
      console.error("Erreur chargement fournisseurs:", e);
    }
  };

  const chargerBLList = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`SELECT * FROM v_situation_bl ORDER BY date_bl DESC`);
      setBlList(res);
    } catch (e) {
      console.error("Erreur chargement BL:", e);
    }
  };

  const chargerHistorique = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`SELECT * FROM v_historique_paiements ORDER BY date_paiement DESC, created_at DESC LIMIT 100`);
      setHistoriqueList(res);
    } catch (e) {
      console.error("Erreur chargement historique:", e);
    }
  };

  const chargerDashboard = async () => {
    try {
      const db = await getDb();

      const statsStatut = await db.select<any[]>(`
        SELECT statut_paiement, COUNT(*) as nb_bl, CAST(SUM(montant_net) AS DOUBLE) as montant_total, CAST(SUM(montant_paye) AS DOUBLE) as total_paye, CAST(SUM(solde_restant) AS DOUBLE) as total_restant
        FROM v_situation_bl GROUP BY statut_paiement
      `);

      const statsFournisseur = await db.select<any[]>(`
        SELECT nom_fournisseur, COUNT(*) as nb_bl, CAST(SUM(montant_net) AS DOUBLE) as montant_a_payer, CAST(SUM(montant_paye) AS DOUBLE) as montant_paye, CAST(SUM(solde_restant) AS DOUBLE) as solde_restant
        FROM v_situation_bl WHERE solde_restant > 0 GROUP BY fournisseur_id, nom_fournisseur ORDER BY solde_restant DESC LIMIT 10
      `);

      const totaux = await db.select<any[]>(`
        SELECT COUNT(*) as nb_total_bl, CAST(SUM(montant_bl) AS DOUBLE) as total_bl, CAST(SUM(montant_deductions) AS DOUBLE) as total_deductions, CAST(SUM(montant_net) AS DOUBLE) as total_net, CAST(SUM(montant_paye) AS DOUBLE) as total_paye, CAST(SUM(solde_restant) AS DOUBLE) as total_solde
        FROM v_situation_bl
      `);

      setDashboardStats({ parStatut: statsStatut, parFournisseur: statsFournisseur, totaux: totaux[0] });
    } catch (e) {
      console.error("Erreur chargement dashboard:", e);
    }
  };

  const ouvrirPopupPaiement = async (bl: any) => {
    try {
      const db = await getDb();
      const paiements = await db.select<any[]>(`SELECT * FROM v_historique_paiements WHERE bl_id = ? ORDER BY date_paiement DESC`, [bl.bl_id]);

      setBlSelectionne(bl);
      setPaiementsBL(paiements);
      setMontantPaiement(bl.solde_restant > 0 ? bl.solde_restant.toString() : "");
      setModePaiement("");
      setReferencePaiement("");
      setObservationPaiement("");
      setShowPopupPaiement(true);
    } catch (e) {
      console.error("Erreur ouverture popup:", e);
      alert("Erreur lors du chargement des détails");
    }
  };

  const genererNumeroPaiement = (numeroBL: string, numeroVersement: number) => {
    return `PAY-${numeroBL}-${String(numeroVersement).padStart(3, '0')}`;
  };

  const enregistrerPaiement = async () => {
    if (!montantPaiement || parseFloat(montantPaiement) <= 0) {
      return alert("❌ Le montant doit être supérieur à 0");
    }

    if (parseFloat(montantPaiement) > blSelectionne.solde_restant) {
      return alert(`❌ Le montant ne peut pas dépasser le solde restant (${Math.ceil(blSelectionne.solde_restant).toLocaleString()} F)`);
    }

    if (!modePaiement) {
      return alert("❌ Veuillez sélectionner un mode de paiement");
    }

    try {
      const db = await getDb();
      const numeroVersement = paiementsBL.length + 1;
      const numeroPaiement = genererNumeroPaiement(blSelectionne.numero_bl, numeroVersement);
      const datePaiement = new Date().toISOString().split('T')[0];

      await db.execute(`
        INSERT INTO stock_paiements_fournisseurs 
        (numero_paiement, bl_id, fournisseur_id, montant_paye, mode_paiement, reference_paiement, date_paiement, observation, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [numeroPaiement, blSelectionne.bl_id, blSelectionne.fournisseur_id, parseFloat(montantPaiement), modePaiement, referencePaiement || null, datePaiement, observationPaiement || null, 'admin']);

      const nouveauSolde = blSelectionne.solde_restant - parseFloat(montantPaiement);
      const statut = nouveauSolde <= 0.01 ? "complètement payé" : "partiellement payé";

      alert(`✅ Paiement ${numeroPaiement} enregistré!\n\nMontant: ${Math.ceil(parseFloat(montantPaiement)).toLocaleString()} F\nNouveau solde: ${Math.ceil(nouveauSolde).toLocaleString()} F\nStatut: BL ${statut}`);

      setShowPopupPaiement(false);
      setBlSelectionne(null);
      setPaiementsBL([]);
      chargerDonnees();

    } catch (e) {
      console.error("Erreur enregistrement:", e);
      alert("❌ Erreur lors de l'enregistrement");
    }
  };

  const ouvrirDetailsBL = async (bl: any) => {
    try {
      const db = await getDb();
      const deductions = await db.select<any[]>(`SELECT * FROM v_deductions_bl WHERE bl_id = ?`, [bl.bl_id]);
      const paiements = await db.select<any[]>(`SELECT * FROM v_historique_paiements WHERE bl_id = ? ORDER BY date_paiement DESC`, [bl.bl_id]);
      setDetailsBL({ ...bl, deductions, paiements });
      setShowDetailsBL(true);
    } catch (e) {
      console.error("Erreur détails:", e);
    }
  };

  // ============================================
  // IMPRESSION : Reçu de Paiement Individuel
  // ============================================
  // ============================================
  // IMPRESSION : Reçu de Paiement Individuel
  // ============================================
  // IMPRESSION : Reçu de Paiement Individuel
  // ============================================
  const imprimerRecu = async (paiement: any) => {
    try {
      const company = await getCompanyInfo();
      const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reçu ${paiement.numero_paiement}</title>
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

                .amount-box { margin: 30px 0; text-align: center; background: #fdfdfd; padding: 20px; border-radius: 6px; border: 1px dashed #ddd; }
                .amount-label { font-size: 10px; color: #999; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
                .amount-value { font-size: 24px; font-weight: 700; color: #2c3e50; }

                .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                .sig-box { width: 40%; text-align: center; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #999; }

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
                    <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Reçu de Paiement</div>
                    <div class="doc-title">${paiement.numero_paiement}</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Date</label>
                    <span>${new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}</span>
                </div>
                <div class="meta-item">
                    <label>Fournisseur</label>
                    <span>${paiement.nom_fournisseur}</span>
                </div>
                <div class="meta-item">
                    <label>Mode de Paiement</label>
                    <span>${paiement.mode_paiement}</span>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Concerne le BL</label>
                    <span>${paiement.numero_bl}</span>
                </div>
                <div class="meta-item">
                    <label>Référence Paiement</label>
                    <span>${paiement.reference_paiement || '-'}</span>
                </div>
            </div>
            
            ${paiement.observation ? `
            <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 5px; color: #856404;">
                 <strong>Note:</strong> ${paiement.observation}
            </div>` : ''}

            <div class="amount-box">
                <div class="amount-label">Montant Payé</div>
                <div class="amount-value">${Math.ceil(paiement.montant_paye).toLocaleString()} F CFA</div>
            </div>

            <div class="signatures">
                <div class="sig-box">Signature du Fournisseur</div>
                <div class="sig-box">Signature du Caissier</div>
            </div>

            <div class="footer">
                Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
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
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'impression du reçu");
    }
  };

  // ============================================
  // IMPRESSION : BL Détaillé (Facture Fournisseur)
  // ============================================
  // ============================================
  // IMPRESSION : BL Détaillé (Facture Fournisseur)
  // ============================================
  const imprimerBL = async (bl: any) => {
    try {
      const db = await getDb();
      const company = await getCompanyInfo();
      const deductions = await db.select<any[]>(`SELECT * FROM v_deductions_bl WHERE bl_id = ?`, [bl.bl_id]);
      const paiements = await db.select<any[]>(`SELECT * FROM v_historique_paiements WHERE bl_id = ? ORDER BY date_paiement`, [bl.bl_id]);

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Facture BL ${bl.numero_bl}</title>
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
                
                .section-header { font-size: 12px; font-weight: 600; color: #555; margin: 25px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase; }

                .totals-box { margin-left: auto; width: 200px; padding-top: 15px; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                .final-total { font-size: 14px; font-weight: 700; color: #2c3e50; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; }

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
                    <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Facture Fournisseur</div>
                    <div class="doc-title">${bl.numero_bl}</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Fournisseur</label>
                    <span>${bl.nom_fournisseur}</span>
                </div>
                <div class="meta-item">
                    <label>Date BL</label>
                    <span>${new Date(bl.date_bl).toLocaleDateString('fr-FR')}</span>
                </div>
                <div class="meta-item">
                    <label>Statut Paiement</label>
                    <span>${bl.statut_paiement}</span>
                </div>
            </div>

            <div class="totals-box">
                <div class="total-row">
                    <span>Montant BL (Brut)</span>
                    <strong>${Math.ceil(bl.montant_bl).toLocaleString()} F</strong>
                </div>
                ${bl.montant_deductions > 0 ? `
                <div class="total-row" style="color: #f39c12;">
                    <span>Déductions (Avoirs/Retours)</span>
                    <strong>- ${Math.ceil(bl.montant_deductions).toLocaleString()} F</strong>
                </div>` : ''}
                <div class="total-row" style="font-weight:bold; color: #2c3e50;">
                    <span>Montant Net à Payer</span>
                    <span>${Math.ceil(bl.montant_net).toLocaleString()} F</span>
                </div>
                 ${bl.montant_paye > 0 ? `
                <div class="total-row" style="color: #27ae60;">
                    <span>Déjà Payé</span>
                    <strong>- ${Math.ceil(bl.montant_paye).toLocaleString()} F</strong>
                </div>` : ''}
                
                <div class="total-row final-total" style="color: ${bl.solde_restant > 0.5 ? '#e74c3c' : '#27ae60'}">
                    <span>SOLDE RESTANT DÛ</span>
                    <span>${Math.ceil(bl.solde_restant).toLocaleString()} F</span>
                </div>
            </div>

            ${deductions.length > 0 ? `
            <div class="section-header">📋 DÉTAILS DÉDUCTIONS</div>
            <table>
                <thead>
                    <tr><th>Avoir</th><th>BR</th><th>Date</th><th>Produit</th><th style="text-align:right">Montant</th></tr>
                </thead>
                <tbody>
                    ${deductions.map(d => `
                    <tr>
                        <td>${d.numero_avoir}</td>
                        <td>${d.numero_br}</td>
                        <td>${new Date(d.date_avoir).toLocaleDateString('fr-FR')}</td>
                        <td>${d.designation} <small>x${d.quantite}</small></td>
                        <td style="text-align:right">${Math.ceil(d.montant_deduction).toLocaleString()} F</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            ` : ''}

            ${paiements.length > 0 ? `
            <div class="section-header">💰 HISTORIQUE PAIEMENTS</div>
            <table>
                <thead>
                    <tr><th>Date</th><th>Référence</th><th>Mode</th><th style="text-align:right">Montant</th></tr>
                </thead>
                <tbody>
                    ${paiements.map(p => `
                    <tr>
                        <td>${new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                        <td>${p.numero_paiement}</td>
                        <td>${p.mode_paiement}</td>
                        <td style="text-align:right; font-weight:bold; color:#27ae60">${Math.ceil(p.montant_paye).toLocaleString()} F</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            ` : '<div style="margin-top:20px; color:#7f8c8d; font-style:italic;">Aucun paiement enregistré pour ce BL.</div>'}

            <div class="footer">
                 Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
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

    } catch (e) {
      console.error("Erreur impression BL:", e);
      alert("❌ Erreur lors de l'impression");
    }
  };

  // ============================================
  // IMPRESSION : Bordereau de Règlement
  // ============================================
  // ============================================
  // IMPRESSION : Bordereau de Règlement
  // ============================================
  // IMPRESSION : Bordereau de Règlement
  // ============================================
  const imprimerBordereauReglement = async (bl: any) => {
    try {
      const db = await getDb();
      const company = await getCompanyInfo();
      const paiements = await db.select<any[]>(`SELECT * FROM v_historique_paiements WHERE bl_id = ? ORDER BY date_paiement`, [bl.bl_id]);

      if (paiements.length === 0) {
        return alert("❌ Aucun paiement à imprimer pour ce BL");
      }

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bordereau ${bl.numero_bl}</title>
            <style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                .company-sub { font-size: 10px; color: #7f8c8d; }
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
                    <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Bordereau de Règlement</div>
                    <div class="doc-title">${bl.numero_bl}</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Fournisseur</label>
                    <span>${bl.nom_fournisseur}</span>
                </div>
                <div class="meta-item">
                    <label>Date BL</label>
                    <span>${new Date(bl.date_bl).toLocaleDateString('fr-FR')}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Date Paiement</th>
                        <th>N° Paiement</th>
                        <th>Mode</th>
                        <th>Référence</th>
                        <th style="text-align: right;">Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${paiements.map((p, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                        <td>${p.numero_paiement}</td>
                        <td>${p.mode_paiement}</td>
                        <td>${p.reference_paiement || '-'}</td>
                        <td style="text-align: right;">${Math.ceil(p.montant_paye).toLocaleString()} F</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-box">
                    TOTAL PAYÉ : ${Math.ceil(paiements.reduce((sum, p) => sum + p.montant_paye, 0)).toLocaleString()} F
                </div>
            </div>

            <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                <div style="border-top: 1px solid #ccc; width: 40%; text-align: center; padding-top: 10px;">Signature du Fournisseur</div>
                <div style="border-top: 1px solid #ccc; width: 40%; text-align: center; padding-top: 10px;">Signature du Responsable</div>
            </div>

            <div class="footer">
                Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
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

    } catch (e) {
      console.error("Erreur:", e);
      alert("❌ Erreur lors de l'impression");
    }
  };

  // ============================================
  // IMPRESSION : Relevé Fournisseur
  // ============================================
  // ============================================
  // IMPRESSION : Relevé Fournisseur
  // ============================================
  // IMPRESSION : Relevé Fournisseur
  // ============================================
  const imprimerReleveFournisseur = async () => {
    try {
      const company = await getCompanyInfo();
      const fournisseurSelectionne = fournisseurs.find(f => f.id.toString() === filterFournisseur);
      const nomFournisseur = fournisseurSelectionne ? fournisseurSelectionne.nom : "Tous les fournisseurs";

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relevé ${nomFournisseur}</title>
            <style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Inter', sans-serif; font-size: 11px; color: #444; line-height: 1.4; margin: 15mm; padding: 0; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .company-name { font-size: 16px; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                .company-sub { font-size: 10px; color: #7f8c8d; }
                .doc-title { font-size: 18px; font-weight: 600; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }

                .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
                .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 2px; letter-spacing: 0.5px; }
                .meta-item span { display: block; font-size: 12px; font-weight: 600; color: #333; }

                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #fdfdfd; font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; }
                td { padding: 7px 10px; border-bottom: 1px solid #f9f9f9; color: #444; }
                tr:last-child td { border-bottom: none; }

                .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
                .kpi-box { padding: 10px; background: #fdfdfd; border-radius: 6px; border: 1px solid #eee; }
                .kpi-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
                .kpi-value { font-size: 14px; font-weight: 700; color: #2c3e50; margin-top: 3px; }

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
                    <div class="doc-title">RELEVÉ DE COMPTE</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Fournisseur</label>
                    <span>${nomFournisseur}</span>
                </div>
                <div class="meta-item">
                    <label>Nombre de BL</label>
                    <span>${blFiltres.length}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>N° BL</th>
                        <th>Brut</th>
                        <th>Déductions</th>
                        <th>Net</th>
                        <th>Payé</th>
                        <th style="text-align: right;">Solde Dû</th>
                    </tr>
                </thead>
                <tbody>
                    ${blFiltres.map(bl => `
                    <tr>
                        <td>${new Date(bl.date_bl).toLocaleDateString('fr-FR')}</td>
                        <td>${bl.numero_bl}</td>
                        <td>${Math.ceil(bl.montant_bl).toLocaleString()}</td>
                         <td style="color: #f39c12;">${bl.montant_deductions > 0 ? `-${Math.ceil(bl.montant_deductions).toLocaleString()}` : '-'}</td>
                        <td style="font-weight: bold;">${Math.ceil(bl.montant_net).toLocaleString()}</td>
                        <td style="color: #27ae60;">${bl.montant_paye > 0 ? Math.ceil(bl.montant_paye).toLocaleString() : '-'}</td>
                        <td style="text-align: right; color: ${bl.solde_restant > 0.5 ? '#e74c3c' : '#27ae60'}; font-weight: bold;">${Math.ceil(bl.solde_restant).toLocaleString()} F</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="kpi-row">
                 <div class="kpi-box">
                    <div class="kpi-label">Montant Net Total</div>
                    <div class="kpi-value" style="color: #3498db;">${Math.ceil(blFiltres.reduce((sum, bl) => sum + bl.montant_net, 0)).toLocaleString()} F</div>
                </div>
                 <div class="kpi-box">
                    <div class="kpi-label">Total Payé</div>
                    <div class="kpi-value" style="color: #27ae60;">${Math.ceil(blFiltres.reduce((sum, bl) => sum + bl.montant_paye, 0)).toLocaleString()} F</div>
                </div>
                 <div class="kpi-box">
                    <div class="kpi-label">Solde Restant</div>
                    <div class="kpi-value" style="color: #e74c3c;">${Math.ceil(blFiltres.reduce((sum, bl) => sum + bl.solde_restant, 0)).toLocaleString()} F</div>
                </div>
            </div>

            <div class="footer">
                Imprimé le ${new Date().toLocaleString('fr-FR')} par ${currentUser?.nom_complet || 'Système'}
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

    } catch (e) {
      console.error("Erreur Impression Relevé:", e);
      alert("❌ Erreur lors de l'impression du relevé");
    }
  };

  const supprimerPaiement = async (id: number, numero: string) => {
    if (!window.confirm(`⚠️ Supprimer le paiement ${numero}?`)) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM stock_paiements_fournisseurs WHERE id = ?", [id]);
      alert("✅ Paiement supprimé!");
      chargerDonnees();
      if (showDetailsBL) setShowDetailsBL(false);
    } catch (e) {
      console.error("Erreur suppression:", e);
      alert("❌ Erreur lors de la suppression");
    }
  };

  // Filtrage
  const blFiltres = blList.filter(bl => {
    const matchFournisseur = !filterFournisseur || bl.fournisseur_id.toString() === filterFournisseur;
    const matchDateDebut = !filterDateDebut || bl.date_bl >= filterDateDebut;
    const matchDateFin = !filterDateFin || bl.date_bl <= filterDateFin;
    const matchStatut = !filterStatut || bl.statut_paiement === filterStatut;
    return matchFournisseur && matchDateDebut && matchDateFin && matchStatut;
  });

  const historiqueFiltres = historiqueList.filter(h => {
    const matchFournisseur = !filterFournisseur || h.fournisseur_id.toString() === filterFournisseur;
    const matchDateDebut = !filterDateDebut || h.date_paiement >= filterDateDebut;
    const matchDateFin = !filterDateFin || h.date_paiement <= filterDateFin;
    return matchFournisseur && matchDateDebut && matchDateFin;
  });


  // Calcul des totaux filtrés
  const totauxFiltres = {
    montantBrut: blFiltres.reduce((sum, bl) => sum + bl.montant_bl, 0),
    deductions: blFiltres.reduce((sum, bl) => sum + bl.montant_deductions, 0),
    montantNet: blFiltres.reduce((sum, bl) => sum + bl.montant_net, 0),
    montantPaye: blFiltres.reduce((sum, bl) => sum + bl.montant_paye, 0),
    soldeRestant: blFiltres.reduce((sum, bl) => sum + bl.solde_restant, 0)
  };

  // ============================================
  // EXPORTS
  // ============================================
  const exportToExcel = async () => {
    try {
      const data = activeTab === "bl" ? blFiltres : historiqueFiltres;
      if (!data || data.length === 0) {
        return alert("⚠️ Aucune donnée à exporter");
      }

      const XLSX = await import('xlsx');

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");
      XLSX.writeFile(wb, `export_${activeTab}_${new Date().getTime()}.xlsx`);
    } catch (e) {
      console.error("Erreur Export Excel:", e);
      alert("❌ Une erreur est survenue lors de l'export Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      if (activeTab === "bl") {
        if (!blFiltres || blFiltres.length === 0) {
          return alert("⚠️ Aucune donnée à exporter");
        }
        doc.text("Relevé Bons de Livraison", 14, 15);
        autoTable(doc, {
          head: [['Date', 'N° BL', 'Fournisseur', 'Montant', 'Déduction', 'Net', 'Payé', 'Solde', 'Statut']],
          body: blFiltres.map(bl => [
            new Date(bl.date_bl).toLocaleDateString('fr-FR'),
            bl.numero_bl,
            bl.nom_fournisseur,
            Math.ceil(bl.montant_bl).toLocaleString(),
            Math.ceil(bl.montant_deductions).toLocaleString(),
            Math.ceil(bl.montant_net).toLocaleString(),
            Math.ceil(bl.montant_paye).toLocaleString(),
            Math.ceil(bl.solde_restant).toLocaleString(),
            bl.statut_paiement
          ]),
          startY: 20
        });
      } else if (activeTab === "historique") {
        if (!historiqueFiltres || historiqueFiltres.length === 0) {
          return alert("⚠️ Aucune donnée à exporter");
        }
        doc.text("Historique Paiements", 14, 15);
        autoTable(doc, {
          head: [['Date', 'N° Paiement', 'N° BL', 'Fournisseur', 'Montant', 'Mode', 'Réf']],
          body: historiqueFiltres.map(p => [
            new Date(p.date_paiement).toLocaleDateString('fr-FR'),
            p.numero_paiement,
            p.numero_bl,
            p.nom_fournisseur,
            Math.ceil(p.montant_paye).toLocaleString(),
            p.mode_paiement,
            p.reference_paiement || '-'
          ]),
          startY: 20
        });
      }

      doc.save(`export_${activeTab}_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error("Erreur Export PDF:", e);
      alert("❌ Une erreur est survenue lors de l'export PDF");
    }
  };


  // Pagination
  const dataFiltrees = activeTab === "bl" ? blFiltres : historiqueFiltres;
  const totalPages = Math.ceil(dataFiltrees.length / itemsPerPage);
  const indexDebut = (currentPage - 1) * itemsPerPage;
  const indexFin = indexDebut + itemsPerPage;
  const dataPage = dataFiltrees.slice(indexDebut, indexFin);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>💰 Compte Fournisseurs</h2>








      {/* Onglets */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => { setActiveTab("dashboard"); setCurrentPage(1); }} style={{ ...tabBtnStyle, background: activeTab === "dashboard" ? '#9b59b6' : '#ecf0f1', color: activeTab === "dashboard" ? 'white' : '#333' }}>📊 Dashboard</button>
        <button onClick={() => { setActiveTab("bl"); setCurrentPage(1); }} style={{ ...tabBtnStyle, background: activeTab === "bl" ? '#3498db' : '#ecf0f1', color: activeTab === "bl" ? 'white' : '#333' }}>📋 BL ({blFiltres.length})</button>
        <button onClick={() => { setActiveTab("historique"); setCurrentPage(1); }} style={{ ...tabBtnStyle, background: activeTab === "historique" ? '#27ae60' : '#ecf0f1', color: activeTab === "historique" ? 'white' : '#333' }}>📜 Historique ({historiqueFiltres.length})</button>
      </div>

      {/* Filtres */}
      {activeTab !== "dashboard" && (
        <div style={filtresStyle}>
          <select value={filterFournisseur} onChange={e => setFilterFournisseur(e.target.value)} style={inputStyle}>
            <option value="">👥 Tous les fournisseurs</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', color: '#555' }}>Du:</label>
            <input type="date" value={filterDateDebut} onChange={e => setFilterDateDebut(e.target.value)} style={inputStyle} />
            <label style={{ fontSize: '14px', color: '#555' }}>Au:</label>
            <input type="date" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)} style={inputStyle} />
          </div>
          {activeTab === "bl" && (
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={inputStyle}>
              <option value="">📊 Tous les statuts</option>
              <option value="Non payé">Non payé</option>
              <option value="Partiellement payé">Partiellement payé</option>
              <option value="Payé">Payé</option>
            </select>
          )}
          {(filterFournisseur || filterDateDebut || filterDateFin || filterStatut) && (
            <button onClick={() => { setFilterFournisseur(""); setFilterDateDebut(""); setFilterDateFin(""); setFilterStatut(""); }} style={btnResetStyle}>✕ Réinitialiser</button>
          )}
          {activeTab === "bl" && blFiltres.length > 0 && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={imprimerReleveFournisseur} style={{ ...btnResetStyle, background: '#3498db' }}>
                🖨️ Imprimer Relevé
              </button>
              <button onClick={exportToExcel} style={{ ...btnResetStyle, background: '#27ae60' }}>
                📊 Excel
              </button>
              <button onClick={exportToPDF} style={{ ...btnResetStyle, background: '#e74c3c' }}>
                📄 PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* TOTAUX FILTRÉS */}
      {activeTab === "bl" && (filterFournisseur || filterDateDebut || filterDateFin || filterStatut) && blFiltres.length > 0 && (
        <div style={{ background: '#d4edda', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
          <div><div style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>Montant Brut</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>{Math.ceil(totauxFiltres.montantBrut).toLocaleString()} F</div></div>
          <div><div style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>Déductions</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f39c12' }}>-{Math.ceil(totauxFiltres.deductions).toLocaleString()} F</div></div>
          <div><div style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>Net à Payer</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9b59b6' }}>{Math.ceil(totauxFiltres.montantNet).toLocaleString()} F</div></div>
          <div><div style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>Total Payé</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}>{Math.ceil(totauxFiltres.montantPaye).toLocaleString()} F</div></div>
          <div><div style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>Solde Restant</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>{Math.ceil(totauxFiltres.soldeRestant).toLocaleString()} F</div></div>
        </div>
      )}

      {/* DASHBOARD */}
      {activeTab === "dashboard" && dashboardStats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #3498db' }}><div style={statLabelStyle}>Total BL</div><div style={statValueStyle}>{dashboardStats.totaux.nb_total_bl}</div></div>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #e74c3c' }}><div style={statLabelStyle}>Montant BL</div><div style={statValueStyle}>{Math.ceil(dashboardStats.totaux.total_bl || 0).toLocaleString()} F</div></div>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #f39c12' }}><div style={statLabelStyle}>Déductions (BR)</div><div style={statValueStyle}>-{Math.ceil(dashboardStats.totaux.total_deductions || 0).toLocaleString()} F</div></div>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #9b59b6' }}><div style={statLabelStyle}>Montant Net</div><div style={statValueStyle}>{Math.ceil(dashboardStats.totaux.total_net || 0).toLocaleString()} F</div></div>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #27ae60' }}><div style={statLabelStyle}>Total Payé</div><div style={statValueStyle}>{Math.ceil(dashboardStats.totaux.total_paye || 0).toLocaleString()} F</div></div>
            <div style={{ ...statCardStyle, borderLeft: '5px solid #e74c3c' }}><div style={statLabelStyle}>Solde Restant</div><div style={{ ...statValueStyle, color: '#e74c3c' }}>{Math.ceil(dashboardStats.totaux.total_solde || 0).toLocaleString()} F</div></div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>📊 Répartition par Statut</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8f9fa' }}>
                <th style={thStyle}>Statut</th><th style={thStyle}>Nombre BL</th><th style={thStyle}>Montant Net</th><th style={thStyle}>Montant Payé</th><th style={thStyle}>Solde Restant</th>
              </tr></thead>
              <tbody>
                {dashboardStats.parStatut.map((stat: any) => (
                  <tr key={stat.statut_paiement}>
                    <td style={tdStyle}><span style={{ ...badgeStyle, background: stat.statut_paiement === 'Payé' ? '#27ae60' : stat.statut_paiement === 'Partiellement payé' ? '#f39c12' : '#e74c3c' }}>{stat.statut_paiement}</span></td>
                    <td style={tdStyle}><strong>{stat.nb_bl}</strong></td>
                    <td style={tdStyle}>{Math.ceil(stat.montant_total || 0).toLocaleString()} F</td>
                    <td style={tdStyle}>{Math.ceil(stat.total_paye || 0).toLocaleString()} F</td>
                    <td style={tdStyle}><strong>{Math.ceil(stat.total_restant || 0).toLocaleString()} F</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>🏆 Top 10 Créances Fournisseurs</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8f9fa' }}>
                <th style={thStyle}>Fournisseur</th><th style={thStyle}>Nombre BL</th><th style={thStyle}>À Payer</th><th style={thStyle}>Payé</th><th style={thStyle}>Solde</th>
              </tr></thead>
              <tbody>
                {dashboardStats.parFournisseur.map((stat: any, idx: number) => (
                  <tr key={idx}>
                    <td style={tdStyle}><strong>{stat.nom_fournisseur}</strong></td>
                    <td style={tdStyle}>{stat.nb_bl}</td>
                    <td style={tdStyle}>{Math.ceil(stat.montant_a_payer || 0).toLocaleString()} F</td>
                    <td style={tdStyle}>{Math.ceil(stat.montant_paye || 0).toLocaleString()} F</td>
                    <td style={{ ...tdStyle, color: '#e74c3c', fontWeight: 'bold' }}>{Math.ceil(stat.solde_restant || 0).toLocaleString()} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LISTE BL */}
      {activeTab === "bl" && (
        <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#3498db', color: 'white' }}>
              <th style={thStyle}>Date BL</th><th style={thStyle}>N° BL</th><th style={thStyle}>Fournisseur</th><th style={thStyle}>Montant BL</th><th style={thStyle}>Déductions (BR)</th><th style={thStyle}>Net</th><th style={thStyle}>Payé</th><th style={thStyle}>Solde</th><th style={thStyle}>Statut</th><th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {dataPage.length > 0 ? dataPage.map((bl: any) => (
                <tr key={bl.bl_id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                  <td style={tdStyle}>{new Date(bl.date_bl).toLocaleDateString('fr-FR')}</td>
                  <td style={tdStyle}><strong>{bl.numero_bl}</strong></td>
                  <td style={tdStyle}>{bl.nom_fournisseur}</td>
                  <td style={tdStyle}>{Math.ceil(bl.montant_bl).toLocaleString()} F</td>
                  <td style={{ ...tdStyle, color: '#f39c12' }}>{bl.montant_deductions > 0 ? `-${Math.ceil(bl.montant_deductions).toLocaleString()} F` : '-'}</td>
                  <td style={tdStyle}><strong>{Math.ceil(bl.montant_net).toLocaleString()} F</strong></td>
                  <td style={{ ...tdStyle, color: '#27ae60' }}>{bl.montant_paye > 0 ? Math.ceil(bl.montant_paye).toLocaleString() + ' F' : '-'}</td>
                  <td style={{ ...tdStyle, color: bl.solde_restant > 0 ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>{Math.ceil(bl.solde_restant).toLocaleString()} F</td>
                  <td style={tdStyle}><span style={{ ...badgeStyle, background: bl.statut_paiement === 'Payé' ? '#27ae60' : bl.statut_paiement === 'Partiellement payé' ? '#f39c12' : '#e74c3c' }}>{bl.statut_paiement}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                    <button onClick={() => ouvrirDetailsBL(bl)} style={btnIconStyle} title="Détails">👁️</button>
                    <button onClick={() => imprimerBL(bl)} style={{ ...btnIconStyle, color: '#3498db' }} title="Imprimer Facture BL">🖨️</button>
                    <button onClick={() => utilsExportToExcel([{
                      'N° BL': bl.numero_bl,
                      'Fournisseur': bl.nom_fournisseur,
                      'Date': new Date(bl.date_bl).toLocaleDateString('fr-FR'),
                      'Montant': bl.montant_bl,
                      'Déductions': bl.montant_deductions,
                      'Net': bl.montant_net,
                      'Payé': bl.montant_paye,
                      'Solde': bl.solde_restant,
                      'Statut': bl.statut_paiement
                    }], `BL_${bl.numero_bl}`)} style={{ ...btnIconStyle, color: '#107c41' }} title="Excel">📊</button>
                    {bl.nb_paiements > 0 && <button onClick={() => imprimerBordereauReglement(bl)} style={{ ...btnIconStyle, color: '#9b59b6' }} title="Imprimer Bordereau">📄</button>}
                    {bl.solde_restant > 0 && <button onClick={() => ouvrirPopupPaiement(bl)} style={{ ...btnIconStyle, color: '#27ae60' }} title="Payer">💰</button>}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}><div style={{ fontSize: '48px', marginBottom: '10px' }}>💰</div><div>Aucun BL trouvé</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* HISTORIQUE */}
      {activeTab === "historique" && (
        <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#27ae60', color: 'white' }}>
              <th style={thStyle}>Date</th><th style={thStyle}>N° Paiement</th><th style={thStyle}>BL</th><th style={thStyle}>Fournisseur</th><th style={thStyle}>Montant</th><th style={thStyle}>Mode</th><th style={thStyle}>Référence</th><th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {dataPage.length > 0 ? dataPage.map((paiement: any) => (
                <tr key={paiement.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                  <td style={tdStyle}>{new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}</td>
                  <td style={tdStyle}><strong>{paiement.numero_paiement}</strong></td>
                  <td style={tdStyle}>{paiement.numero_bl}</td>
                  <td style={tdStyle}>{paiement.nom_fournisseur}</td>
                  <td style={{ ...tdStyle, color: '#27ae60', fontWeight: 'bold' }}>{Math.ceil(paiement.montant_paye).toLocaleString()} F</td>
                  <td style={tdStyle}><span style={{ ...badgeStyle, background: '#3498db' }}>{paiement.mode_paiement}</span></td>
                  <td style={tdStyle}>{paiement.reference_paiement || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                    <button onClick={() => imprimerRecu(paiement)} style={btnIconStyle} title="Imprimer Reçu">🖨️</button>
                    <button onClick={() => utilsExportToExcel([{
                      'N° Paiement': paiement.numero_paiement,
                      'Date': new Date(paiement.date_paiement).toLocaleDateString('fr-FR'),
                      'BL': paiement.numero_bl,
                      'Fournisseur': paiement.nom_fournisseur,
                      'Montant': paiement.montant_paye,
                      'Mode': paiement.mode_paiement,
                      'Référence': paiement.reference_paiement
                    }], `Recu_${paiement.numero_paiement}`)} style={{ ...btnIconStyle, color: '#107c41' }} title="Excel">📊</button>
                    <button onClick={() => supprimerPaiement(paiement.id, paiement.numero_paiement)} style={{ ...btnIconStyle, color: '#e74c3c' }} title="Supprimer">🗑️</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}><div style={{ fontSize: '48px', marginBottom: '10px' }}>📜</div><div>Aucun paiement enregistré</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {activeTab !== "dashboard" && totalPages > 1 && (
        <div style={paginationStyle}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={btnPageStyle}>← Précédent</button>
          <span>Page {currentPage} sur {totalPages} ({dataFiltrees.length} résultat{dataFiltrees.length > 1 ? 's' : ''})</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} style={btnPageStyle}>Suivant →</button>
        </div>
      )}

      {/* POPUP PAIEMENT */}
      {showPopupPaiement && blSelectionne && (
        <div style={overlayStyle}>
          <div style={popupMediumStyle}>
            <div style={headerStyle}>
              <h2 style={{ margin: 0 }}>💰 Nouveau Paiement</h2>
              <button onClick={() => setShowPopupPaiement(false)} style={btnCloseStyle}>&times;</button>
            </div>
            <div style={bodyStyle}>
              <div style={infoBoxStyle}>
                <div style={labelStyle}>BL N° {blSelectionne.numero_bl} ({blSelectionne.nom_fournisseur})</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}>
                  <span>Reste à payer :</span>
                  <span style={{ color: '#e74c3c' }}>{Math.ceil(blSelectionne.solde_restant).toLocaleString()} F</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Montant du versement</label>
                  <input
                    type="number"
                    value={montantPaiement}
                    onChange={e => setMontantPaiement(e.target.value)}
                    style={{ ...inputStyle, width: '100%', fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mode de règlement</label>
                  <select
                    value={modePaiement}
                    onChange={e => setModePaiement(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={labelStyle}>Référence (N° Chèque/Virement)</label>
                <input
                  value={referencePaiement}
                  onChange={e => setReferencePaiement(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  placeholder="Optionnel"
                />
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={labelStyle}>Observation</label>
                <textarea
                  value={observationPaiement}
                  onChange={e => setObservationPaiement(e.target.value)}
                  style={{ ...inputStyle, width: '100%', minHeight: '80px' }}
                  placeholder="Notes..."
                />
              </div>

              {/* Historique rapide dans le popup */}
              <div style={{ marginTop: '30px' }}>
                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Historique des paiements sur ce BL</h4>
                {paiementsBL.length > 0 ? (
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead><tr style={{ background: '#f8f9fa' }}><th>Date</th><th>Montant</th><th>Mode</th></tr></thead>
                    <tbody>
                      {paiementsBL.map(p => (
                        <tr key={p.id}>
                          <td style={{ padding: '5px' }}>{new Date(p.date_paiement).toLocaleDateString()}</td>
                          <td style={{ padding: '5px', fontWeight: 'bold' }}>{Math.ceil(p.montant_paye).toLocaleString()} F</td>
                          <td style={{ padding: '5px' }}>{p.mode_paiement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontStyle: 'italic', color: '#999', fontSize: '12px' }}>Aucun paiement précédent.</p>
                )}
              </div>
            </div>
            <div style={footerStyle}>
              <button onClick={() => setShowPopupPaiement(false)} style={btnCancelStyle}>Annuler</button>
              <button onClick={enregistrerPaiement} style={btnValidStyle}>💾 Enregistrer le Paiement</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DÉTAILS BL */}
      {showDetailsBL && detailsBL && (
        <div style={overlayStyle}>
          <div style={popupLargeStyle}>
            <div style={{ ...headerStyle, background: '#3498db' }}>
              <h2 style={{ margin: 0 }}>📄 Détails BL {detailsBL.numero_bl}</h2>
              <button onClick={() => setShowDetailsBL(false)} style={btnCloseStyle}>&times;</button>
            </div>
            <div style={bodyStyle}>
              {/* Infos Générales */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
                <div style={infoBoxStyle}><div style={labelStyle}>Fournisseur</div><div style={{ fontWeight: 'bold' }}>{detailsBL.nom_fournisseur}</div></div>
                <div style={infoBoxStyle}><div style={labelStyle}>Date BL</div><div>{new Date(detailsBL.date_bl).toLocaleDateString('fr-FR')}</div></div>
                <div style={{ ...infoBoxStyle, border: '1px solid #3498db' }}><div style={labelStyle}>Montant Total</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>{Math.ceil(detailsBL.montant_bl).toLocaleString()} F</div></div>
                <div style={{ ...infoBoxStyle, border: '1px solid #e74c3c' }}><div style={labelStyle}>Reste à Payer</div><div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>{Math.ceil(detailsBL.solde_restant).toLocaleString()} F</div></div>
              </div>

              {/* Tableau Déductions */}
              {detailsBL.deductions && detailsBL.deductions.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ borderBottom: '2px solid #f39c12', paddingBottom: '10px', color: '#f39c12' }}>↩️ Déductions (Avoirs / Retours)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#fef5e7' }}>
                      <th style={thStyle}>Date</th><th style={thStyle}>N° Avoir</th><th style={thStyle}>Produit</th><th style={thStyle}>Qté</th><th style={thStyle}>Prix U.</th><th style={thStyle}>Total</th>
                    </tr></thead>
                    <tbody>
                      {detailsBL.deductions.map((d: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={tdStyle}>{new Date(d.date_avoir).toLocaleDateString()}</td>
                          <td style={tdStyle}><strong>{d.numero_avoir}</strong></td>
                          <td style={tdStyle}>{d.designation}</td>
                          <td style={tdStyle}>{d.quantite}</td>
                          <td style={tdStyle}>{Math.ceil(d.prix_unitaire).toLocaleString()}</td>
                          <td style={{ ...tdStyle, color: '#f39c12', fontWeight: 'bold' }}>{Math.ceil(d.montant_deduction).toLocaleString()} F</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tableau Paiements */}
              <div>
                <h3 style={{ borderBottom: '2px solid #27ae60', paddingBottom: '10px', color: '#27ae60' }}>💰 Historique des Règlements</h3>
                {detailsBL.paiements && detailsBL.paiements.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#e8f6ef' }}>
                      <th style={thStyle}>Date</th><th style={thStyle}>N° Paiement</th><th style={thStyle}>Mode</th><th style={thStyle}>Référence</th><th style={thStyle}>Observation</th><th style={thStyle}>Montant</th><th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {detailsBL.paiements.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={tdStyle}>{new Date(p.date_paiement).toLocaleDateString()}</td>
                          <td style={tdStyle}><strong>{p.numero_paiement}</strong></td>
                          <td style={tdStyle}>{p.mode_paiement}</td>
                          <td style={tdStyle}>{p.reference_paiement || '-'}</td>
                          <td style={tdStyle}>{p.observation || '-'}</td>
                          <td style={{ ...tdStyle, color: '#27ae60', fontWeight: 'bold' }}>{Math.ceil(p.montant_paye).toLocaleString()} F</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button onClick={() => imprimerRecu(p)} style={btnIconStyle} title="Reçu">🖨️</button>
                            <button onClick={() => supprimerPaiement(p.id, p.numero_paiement)} style={{ ...btnIconStyle, color: '#e74c3c' }} title="Supprimer">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', background: '#f9f9f9', borderRadius: '8px' }}>Aucun paiement enregistré pour le moment.</div>
                )}
              </div>

            </div>
            <div style={footerStyle}>
              <button onClick={() => setShowDetailsBL(false)} style={btnCancelStyle}>Fermer</button>
              <button
                onClick={() => { setShowDetailsBL(false); ouvrirPopupPaiement(detailsBL); }}
                disabled={detailsBL.solde_restant <= 0}
                style={{ ...btnValidStyle, background: detailsBL.solde_restant > 0 ? '#27ae60' : '#ccc', cursor: detailsBL.solde_restant > 0 ? 'pointer' : 'not-allowed' }}
              >
                💰 Ajouter un paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const tabBtnStyle: React.CSSProperties = { padding: '12px 25px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: '0.2s' };
const filtresStyle: React.CSSProperties = { display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' };
const inputStyle: React.CSSProperties = { padding: '10px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px', minWidth: '200px' };
const btnResetStyle: React.CSSProperties = { padding: '10px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' };
const thStyle: React.CSSProperties = { padding: '12px 10px', textAlign: 'left', fontSize: '13px', fontWeight: 'bold' };
const tdStyle: React.CSSProperties = { padding: '12px 10px', fontSize: '14px' };
const badgeStyle: React.CSSProperties = { padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: 'white', display: 'inline-block' };
const btnIconStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', marginLeft: '8px' };
const paginationStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px', fontSize: '14px' };
const btnPageStyle: React.CSSProperties = { padding: '8px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const popupLargeStyle: React.CSSProperties = { background: 'white', borderRadius: '15px', width: '95%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' };
const popupMediumStyle: React.CSSProperties = { background: 'white', borderRadius: '15px', width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' };
const headerStyle: React.CSSProperties = { background: '#27ae60', color: 'white', padding: '20px 25px', borderRadius: '15px 15px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const bodyStyle: React.CSSProperties = { padding: '25px', flex: 1, overflowY: 'auto' };
const footerStyle: React.CSSProperties = { padding: '20px 25px', borderTop: '2px solid #ecf0f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' };
const btnCloseStyle: React.CSSProperties = { fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer', color: 'white' };
const infoBoxStyle: React.CSSProperties = { background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #ecf0f1' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '5px' };
const btnCancelStyle: React.CSSProperties = { padding: '12px 30px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' };
const btnValidStyle: React.CSSProperties = { padding: '12px 30px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' };
const statCardStyle: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const statLabelStyle: React.CSSProperties = { fontSize: '13px', color: '#7f8c8d', marginBottom: '8px', fontWeight: 'bold' };
const statValueStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' };