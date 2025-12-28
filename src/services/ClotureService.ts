import { getDb } from "../lib/db";
import { DateTravailManager } from "./DateTravailManager";

export class ClotureService {
    /**
     * Clôture une journée
     */
    static async cloturerJournee(date: string, dateNouvelle: string, user: any): Promise<{ success: boolean; message: string }> {
        try {
            const db = await getDb();

            // Vérifier si cette date a déjà été clôturée
            const existingCloture = await db.select<any[]>(`
                SELECT * FROM clotures_journalieres WHERE date_cloture = ?
            `, [date]);

            // Insérer la clôture seulement si elle n'existe pas déjà
            if (existingCloture.length === 0) {
                await db.execute(`
                    INSERT INTO clotures_journalieres (
                        date_cloture, date_systeme_suivante, user_id, statut
                    )
                    VALUES (?, ?, ?, 'CLOTUREE')
                `, [date, dateNouvelle, user?.id || null]);
            } else {
                // Mettre à jour le statut si la date existe
                await db.execute(`
                    UPDATE clotures_journalieres 
                    SET statut = 'CLOTUREE', date_systeme_suivante = ?
                    WHERE date_cloture = ?
                `, [dateNouvelle, date]);
            }

            // Mettre à jour la date système
            await db.execute(`
                UPDATE app_parametres_app 
                SET date_systeme_actuelle = ?, derniere_cloture = ?
            `, [dateNouvelle, date]);

            return {
                success: true,
                message: `Clôture effectuée avec succès !\n\nNouvelle date système : ${new Date(dateNouvelle).toLocaleDateString('fr-FR')}`
            };
        } catch (e) {
            console.error("Erreur cloturerJournee:", e);
            return { success: false, message: "Erreur lors de la clôture" };
        }
    }

    /**
     * Dé-clôture une journée (avec raison obligatoire)
     */
    static async decloturerJournee(date: string, user: any, raison: string): Promise<{ success: boolean; message: string }> {
        try {
            if (!raison || raison.trim().length === 0) {
                return { success: false, message: "La raison est obligatoire pour dé-clôturer une date" };
            }

            // Vérifier les permissions
            const canDecloture = await DateTravailManager.canDecloture(date, user);
            if (!canDecloture.allowed) {
                return { success: false, message: canDecloture.reason || "Accès refusé" };
            }

            const db = await getDb();

            // Vérifier que la date est bien clôturée
            const cloture = await db.select<any[]>(`
                SELECT * FROM clotures_journalieres 
                WHERE date_cloture = ? AND statut = 'CLOTUREE'
            `, [date]);

            if (cloture.length === 0) {
                return { success: false, message: "Cette date n'est pas clôturée" };
            }

            // Dé-clôturer
            await db.execute(`
                UPDATE clotures_journalieres 
                SET statut = 'OUVERTE',
                    decloture_user_id = ?,
                    decloture_date = NOW(),
                    decloture_raison = ?
                WHERE date_cloture = ?
            `, [user?.id || null, raison, date]);

            return {
                success: true,
                message: `Date dé-clôturée avec succès !\n\nVous pouvez maintenant effectuer des modifications.`
            };
        } catch (e) {
            console.error("Erreur decloturerJournee:", e);
            return { success: false, message: "Erreur lors de la dé-clôture" };
        }
    }

    /**
     * Re-clôture une journée après correction
     */
    static async recloturerJournee(date: string): Promise<{ success: boolean; message: string }> {
        try {
            const db = await getDb();

            // Vérifier que la date est bien ouverte
            const cloture = await db.select<any[]>(`
                SELECT * FROM clotures_journalieres 
                WHERE date_cloture = ? AND statut = 'OUVERTE'
            `, [date]);

            if (cloture.length === 0) {
                return { success: false, message: "Cette date n'est pas ouverte" };
            }

            // Re-clôturer
            await db.execute(`
                UPDATE clotures_journalieres 
                SET statut = 'CLOTUREE',
                    recloture_date = NOW()
                WHERE date_cloture = ?
            `, [date]);

            return {
                success: true,
                message: `Date re-clôturée avec succès !`
            };
        } catch (e) {
            console.error("Erreur recloturerJournee:", e);
            return { success: false, message: "Erreur lors de la re-clôture" };
        }
    }

    /**
     * Récupère l'historique des clôtures/dé-clôtures
     */
    static async getHistoriqueClotures(limit: number = 30): Promise<any[]> {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT c.*, 
                       u1.nom_complet as user_nom,
                       u2.nom_complet as decloture_user_nom
                FROM clotures_journalieres c
                LEFT JOIN app_utilisateurs u1 ON c.user_id = u1.id
                LEFT JOIN app_utilisateurs u2 ON c.decloture_user_id = u2.id
                ORDER BY c.date_cloture DESC
                LIMIT ?
            `, [limit]);
            return res;
        } catch (e) {
            console.error("Erreur getHistoriqueClotures:", e);
            return [];
        }
    }
}
