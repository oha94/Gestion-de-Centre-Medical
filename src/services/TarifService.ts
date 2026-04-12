
import { getDb } from "../lib/db";

export class TarifService {

    /**
     * Récupère le prix d'une prestation pour un patient donné (Assuré ou non).
     * @param prestationId ID de la prestation
     * @param assuranceId (Optionnel) ID de l'assurance du patient
     */
    static async getPrix(prestationId: number, assuranceId?: number): Promise<number> {
        const db = await getDb();

        // 1. Récupérer les infos de la prestation
        const resPrest = await db.select<any[]>("SELECT prix_standard, prix_assurance_1, prix_assurance_2, cotation FROM prestations WHERE id = ?", [prestationId]);
        if (!resPrest || resPrest.length === 0) return 0;
        const prest = resPrest[0];

        // Prix par défaut
        const prixStandard = prest.prix_standard || 0;

        // Si pas d'assurance, retourner prix standard
        if (!assuranceId) return prixStandard;

        // 2. Vérifier le NIVEAU DE TARIF de l'assurance ET sa Valeur Cotation
        const resAssur = await db.select<any[]>("SELECT niveau_tarif, valeur_cotation FROM assurances WHERE id = ?", [assuranceId]);
        if (!resAssur || resAssur.length === 0) return prixStandard;

        const assurance = resAssur[0];
        const niveau = assurance.niveau_tarif || 0;
        const valeurCotation = assurance.valeur_cotation || 0;

        // 3. VERIFIER LES TARIFS NEGOCIES SPECIFIQUES (Nouvelle table tarifs_prestations)
        try {
            const specifique = await db.select<any[]>("SELECT prix FROM tarifs_prestations WHERE assurance_id = ? AND prestation_id = ?", [assuranceId, prestationId]);
            if (specifique && specifique.length > 0 && specifique[0].prix > 0) {
                return specifique[0].prix;
            }
        } catch (e) { /* Table doesn't exist yet, ignore */ }

        // 4. PRIORITÉ : CALCUL PAR COTATION (Si Cotation > 0 et Valeur Assurance > 0)
        if (prest.cotation > 0 && valeurCotation > 0) {
            return prest.cotation * valeurCotation;
        }

        // 5. Sinon, retourner le prix correspondant au niveau (Legacy)
        if (niveau === 1) return prest.prix_assurance_1 || prixStandard;
        if (niveau === 2) return prest.prix_assurance_2 || prixStandard;

        // Niveau 0 ou autre -> Standard
        return prixStandard;
    }

    /**
     * Récupère les détails du tarif (Prix Standard, Part Assureur Fixe si applicable)
     */
    static async getTarifDetail(prestationId: number, assuranceId?: number): Promise<{ prixStandard: number, partAssureur?: number, niveau: number, prixAssur1?: number, prixAssur2?: number, cotation?: number, valeurCotation?: number }> {
        const db = await getDb();
        console.log("Fetching tarif detail for:", prestationId, "Assurance:", assuranceId);
        const resPrest = await db.select<any[]>("SELECT prix_standard, prix_assurance_1, prix_assurance_2, cotation FROM prestations WHERE id = ?", [prestationId]);

        if (!resPrest || resPrest.length === 0) return { prixStandard: 0, niveau: 0 };

        const prest = resPrest[0];
        const prixStandard = prest.prix_standard || 0;
        const prixAssur1 = prest.prix_assurance_1 || 0;
        const prixAssur2 = prest.prix_assurance_2 || 0;
        const cotation = prest.cotation || 0;

        if (!assuranceId) return { prixStandard, niveau: 0, prixAssur1, prixAssur2, cotation };

        const resAssur = await db.select<any[]>("SELECT niveau_tarif, valeur_cotation FROM assurances WHERE id = ?", [assuranceId]);
        if (!resAssur || resAssur.length === 0) return { prixStandard, niveau: 0, prixAssur1, prixAssur2, cotation };

        const niveau = resAssur[0].niveau_tarif || 0;
        const valeurCotation = resAssur[0].valeur_cotation || 0;
        
        // 1. VERIFIER LES TARIFS NEGOCIES SPECIFIQUES (Nouvelle table tarifs_prestations)
        try {
            const specifique = await db.select<any[]>("SELECT prix FROM tarifs_prestations WHERE assurance_id = ? AND prestation_id = ?", [assuranceId, prestationId]);
            if (specifique && specifique.length > 0 && specifique[0].prix > 0) {
                return {
                    prixStandard: specifique[0].prix, // Overridden price becomes the base 'Standard' price for this insurance context
                    partAssureur: undefined, // Sera calculé par la suite avec le taux
                    niveau: niveau,
                    prixAssur1: prixAssur1,
                    prixAssur2: prixAssur2,
                    cotation: cotation,
                    valeurCotation: valeurCotation
                };
            }
        } catch (e) { /* Table doesn't exist yet, ignore */ }

        let partAssureur = undefined;

        // Priorité Cotation
        if (cotation > 0 && valeurCotation > 0) {
            partAssureur = cotation * valeurCotation;
        } else {
            if (niveau === 1 && prest.prix_assurance_1 > 0) partAssureur = prest.prix_assurance_1;
            if (niveau === 2 && prest.prix_assurance_2 > 0) partAssureur = prest.prix_assurance_2;
        }

        return { prixStandard, partAssureur, niveau, cotation, valeurCotation };
    }
}
