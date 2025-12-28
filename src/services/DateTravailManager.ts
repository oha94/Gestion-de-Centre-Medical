import { getDb } from "../lib/db";

export class DateTravailManager {
    /**
     * Récupère la date métier actuelle (date_travail)
     */
    static async getDateTravail(): Promise<string> {
        try {
            const db = await getDb();
            const res = await db.select<any[]>("SELECT date_systeme_actuelle FROM app_parametres_app LIMIT 1");
            return res[0]?.date_systeme_actuelle || new Date().toISOString().split('T')[0];
        } catch (e) {
            console.error("Erreur getDateTravail:", e);
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Vérifie si une date est clôturée
     */
    static async isDateCloturee(date: string): Promise<boolean> {
        try {
            const db = await getDb();
            const res = await db.select<any[]>(`
                SELECT statut FROM clotures_journalieres 
                WHERE date_cloture = ? AND statut = 'CLOTUREE'
            `, [date]);
            return res.length > 0;
        } catch (e) {
            console.error("Erreur isDateCloturee:", e);
            return false;
        }
    }

    /**
     * Vérifie si un utilisateur peut modifier une date
     */
    static async canModifyDate(date: string, user: any): Promise<{ allowed: boolean; reason?: string }> {
        try {
            // Admin peut toujours modifier
            if (user.role_nom === 'Administrateur') {
                return { allowed: true };
            }

            const dateTravail = await this.getDateTravail();

            // Si c'est la date de travail actuelle, OK
            if (date === dateTravail) {
                return { allowed: true };
            }

            // Vérifier si la date est clôturée
            const isCloturee = await this.isDateCloturee(date);
            if (isCloturee) {
                // Vérifier permission de dé-clôture
                const db = await getDb();
                const res = await db.select<any[]>(`
                    SELECT * FROM app_permissions_roles 
                    WHERE role_id = ? AND code_permission = 'decloture_dates'
                `, [user.role_id]);

                if (res.length === 0) {
                    return { allowed: false, reason: "Date clôturée - permission de dé-clôture requise" };
                }
            }

            return { allowed: true };
        } catch (e) {
            console.error("Erreur canModifyDate:", e);
            return { allowed: false, reason: "Erreur de vérification" };
        }
    }

    /**
     * Récupère le nombre maximum de jours dé-clôturables
     */
    static async getJoursDecloturableMax(): Promise<number> {
        try {
            const db = await getDb();
            const res = await db.select<any[]>("SELECT jours_decloture_max FROM app_parametres_app LIMIT 1");
            return res[0]?.jours_decloture_max || 7;
        } catch (e) {
            console.error("Erreur getJoursDecloturableMax:", e);
            return 7;
        }
    }

    /**
     * Vérifie si une date peut être dé-clôturée (limite de jours)
     */
    static async canDecloture(date: string, user: any): Promise<{ allowed: boolean; reason?: string }> {
        try {
            // Admin peut toujours dé-clôturer
            if (user.role_nom === 'Administrateur') {
                return { allowed: true };
            }

            const maxJours = await this.getJoursDecloturableMax();
            const dateObj = new Date(date);
            const today = new Date();
            const diffTime = today.getTime() - dateObj.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > maxJours) {
                return {
                    allowed: false,
                    reason: `Date trop ancienne (limite: ${maxJours} jours)`
                };
            }

            return { allowed: true };
        } catch (e) {
            console.error("Erreur canDecloture:", e);
            return { allowed: false, reason: "Erreur de vérification" };
        }
    }
}
