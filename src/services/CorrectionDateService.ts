import { getDb } from "../lib/db";
import { DateTravailManager } from "./DateTravailManager";

export class CorrectionDateService {
    /**
     * Corrige la date d'une vente (déplace vers la bonne date métier)
     */
    static async corrigerDateVente(
        venteId: number,
        nouvelleDate: string,
        raison: string,
        user: any
    ): Promise<{ success: boolean; message: string }> {
        try {
            if (!raison || raison.trim().length === 0) {
                return { success: false, message: "La raison est obligatoire pour corriger une date" };
            }

            const db = await getDb();

            // Récupérer la vente
            const vente = await db.select<any[]>(`SELECT * FROM ventes WHERE id = ?`, [venteId]);
            if (vente.length === 0) {
                return { success: false, message: "Vente introuvable" };
            }

            const dateAvant = vente[0].date_vente.split(' ')[0]; // Extraire juste la date

            // Valider la correction
            const validation = await this.validerCorrection(dateAvant, nouvelleDate, user);
            if (!validation.allowed) {
                return { success: false, message: validation.reason || "Correction non autorisée" };
            }

            // Mettre à jour la date de la vente
            const heureActuelle = vente[0].date_vente.split(' ')[1] || '00:00:00';
            const nouvelleDateComplete = `${nouvelleDate} ${heureActuelle}`;

            await db.execute(`
                UPDATE ventes SET date_vente = ? WHERE id = ?
            `, [nouvelleDateComplete, venteId]);

            // Enregistrer la trace de correction
            await db.execute(`
                INSERT INTO corrections_dates_metier (
                    table_source, record_id, date_avant, date_apres, user_id, raison
                )
                VALUES ('ventes', ?, ?, ?, ?, ?)
            `, [venteId, dateAvant, nouvelleDate, user?.id || null, raison]);

            // Recalculer les totaux des deux dates impactées
            await this.recalculerTotaux(dateAvant);
            await this.recalculerTotaux(nouvelleDate);

            return {
                success: true,
                message: `Date corrigée avec succès !\n\nDe : ${new Date(dateAvant).toLocaleDateString('fr-FR')}\nÀ : ${new Date(nouvelleDate).toLocaleDateString('fr-FR')}`
            };
        } catch (e) {
            console.error("Erreur corrigerDateVente:", e);
            return { success: false, message: "Erreur lors de la correction" };
        }
    }

    /**
     * Valide qu'une correction de date est possible
     */
    static async validerCorrection(
        dateSource: string,
        dateDest: string,
        user: any
    ): Promise<{ allowed: boolean; reason?: string }> {
        try {
            // Vérifier permission
            if (user.role_nom !== 'Administrateur') {
                const db = await getDb();
                const res = await db.select<any[]>(`
                    SELECT * FROM app_permissions_roles 
                    WHERE role_id = ? AND code_permission = 'correct_date_errors'
                `, [user.role_id]);

                if (res.length === 0) {
                    return { allowed: false, reason: "Permission 'Corriger les erreurs de date' requise" };
                }
            }

            // Vérifier que la date source peut être modifiée
            const canModifySource = await DateTravailManager.canModifyDate(dateSource, user);
            if (!canModifySource.allowed) {
                return {
                    allowed: false,
                    reason: `Date source (${new Date(dateSource).toLocaleDateString('fr-FR')}) : ${canModifySource.reason}`
                };
            }

            // Vérifier que la date destination peut être modifiée
            const canModifyDest = await DateTravailManager.canModifyDate(dateDest, user);
            if (!canModifyDest.allowed) {
                return {
                    allowed: false,
                    reason: `Date destination (${new Date(dateDest).toLocaleDateString('fr-FR')}) : ${canModifyDest.reason}`
                };
            }

            return { allowed: true };
        } catch (e) {
            console.error("Erreur validerCorrection:", e);
            return { allowed: false, reason: "Erreur de validation" };
        }
    }

    /**
     * Recalcule les totaux d'une date (après correction)
     */
    static async recalculerTotaux(date: string): Promise<void> {
        try {
            const db = await getDb();

            // Recalculer les totaux de la journée
            const totaux = await db.select<any[]>(`
                SELECT 
                    COUNT(*) as nombre_ventes,
                    SUM(part_patient) as total_general
                FROM ventes
                WHERE DATE(date_vente) = ?
            `, [date]);

            if (totaux.length > 0) {
                // Mettre à jour la clôture si elle existe
                await db.execute(`
                    UPDATE clotures_journalieres 
                    SET nombre_ventes = ?, total_general = ?
                    WHERE date_cloture = ?
                `, [totaux[0].nombre_ventes || 0, totaux[0].total_general || 0, date]);
            }
        } catch (e) {
            console.error("Erreur recalculerTotaux:", e);
        }
    }

    /**
     * Récupère l'historique des corrections
     */
    static async getHistoriqueCorrections(limit: number = 50): Promise<any[]> {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT c.*, u.nom_complet as user_nom
                FROM corrections_dates_metier c
                LEFT JOIN app_utilisateurs u ON c.user_id = u.id
                ORDER BY c.date_correction DESC
                LIMIT ?
            `, [limit]);
            return res;
        } catch (e) {
            console.error("Erreur getHistoriqueCorrections:", e);
            return [];
        }
    }
}
