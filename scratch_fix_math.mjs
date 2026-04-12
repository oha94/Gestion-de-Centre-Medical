import fs from 'fs';

let content = fs.readFileSync('src/views/DocumentsMain.tsx', 'utf8');

// Replace the ventesNorm mapping
const newVentesMap = `            const ventesNorm = ventes.map(v => {
                const total       = Number(v.montant_total)  || 0;
                const patient     = Number(v.part_patient)   || 0;
                const assureur    = Number(v.part_assureur)  || 0;
                let resteAPayer = Number(v.reste_a_payer)  || 0;

                // CORRECTION LOGIQUE: 
                // Si la vente n'est pas payée (ex: Crédit, Assurance, Impayé, En attente)
                // le cash "Encaissé" doit être 0 pour coller à la réalité de la caisse !
                const mr = (v.mode_paiement || '').toUpperCase().trim();
                const st = (v.statut || '').toUpperCase().trim();

                const isUnpaid = (mr === 'CRÉDIT' || mr === 'CREDIT' || mr === 'ASSURANCE' || mr === 'NON PAYÉ' || mr === 'NON DÉFINI' || st === 'IMPAYE' || st === 'EN_ATTENTE' || st === 'NON_PAYE');
                
                if (isUnpaid) {
                    // Mettre tout le reste à payer sur la part patient si ce n'est pas déjà fait
                    if (resteAPayer === 0 && patient > 0) resteAPayer = patient;
                }

                const remise      = Math.max(0, total - patient - assureur);
                return {
                    ...v,
                    montant_total:   total,
                    part_patient:    patient,
                    part_assureur:   assureur,
                    reste_a_payer:   resteAPayer,
                    remise:          remise,
                    taux_couverture: Number(v.taux_couverture) || 0,
                    nom_assurance:   v.nom_assurance || v.societe_nom || null,
                };
            });`;

content = content.replace(/const ventesNorm = ventes\.map\(v => \{[\s\S]*?taux_couverture: Number\(v\.taux_couverture\) \|\| 0,\s*nom_assurance:   v\.nom_assurance \|\| v\.societe_nom \|\| null,\s*\};\s*\}\);/, newVentesMap);

// Replace the Paiements calculation to make it rigorously equal to real 'caisse_mouvements'
// and REMOVE the double-counting of ventesNorm!
const newPaiementBlock = `            // -- GROUP 5: MOYENS DE PAIEMENTS --
            const encaiss = await db.select<any[]>(\`
                SELECT mode_paiement, montant, type 
                FROM caisse_mouvements 
                WHERE type IN ('ENCAISSEMENT', 'RECOUVREMENT') AND DATE(date_mouvement) BETWEEN ? AND ?
            \`, [startDate, endDate]);

            const modesMap: Record<string, number> = {
                'ESPÈCE': 0,
                'WAVE': 0,
                'ORANGE MONEY': 0,
                'MTN': 0,
                'MOOV': 0
            };
            const addPaiement = (modeStr: string, val: number) => {
                if (val <= 0) return;
                let m = (modeStr || 'ESPÈCE').replace(/\\(Ref:.*?\\)/g, '').trim().toUpperCase();
                if (m === 'ESPECE' || m === '') m = 'ESPÈCE';
                if (m === 'ORANGE') m = 'ORANGE MONEY';
                modesMap[m] = (modesMap[m] || 0) + val;
            };

            // On se base UNIQUEMENT sur caisse_mouvements pour être cohérent avec Dashboard
            encaiss.forEach(e => addPaiement(e.mode_paiement, parseFloat(e.montant) || 0));

            setPaiements(Object.entries(modesMap).map(([mode, montant]) => ({ mode, montant })).sort((a,b) => b.montant - a.montant));`;

content = content.replace(/\/\/ -- GROUP 5: MOYENS DE PAIEMENTS --[\s\S]*?setPaiements\(Object\.entries\(modesMap\)\.map\(\(\[mode, montant\]\) => \(\{ mode, montant \}\)\)\.sort\(\(a,b\) => b\.montant - a\.montant\)\);/, newPaiementBlock);

fs.writeFileSync('src/views/DocumentsMain.tsx', content, 'utf8');
console.log("SUCCESS");
