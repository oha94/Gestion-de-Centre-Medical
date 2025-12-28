import { getDb } from "../lib/db";

export class DateSystemeService {
    /**
     * Vérifie si la date système est à jour (égale à la date de l'ordinateur)
     */
    static async isDateSystemeAJour(): Promise<boolean> {
        try {
            const db = await getDb();
            const params: any[] = await db.select(
                'SELECT date_systeme_actuelle FROM app_parametres_app WHERE id = 1'
            );

            if (params.length === 0 || !params[0].date_systeme_actuelle) {
                // Si pas de date système, initialiser avec la date du jour
                const dateOrdinateur = new Date().toISOString().split('T')[0];
                await db.execute(
                    'UPDATE app_parametres_app SET date_systeme_actuelle = ? WHERE id = 1',
                    [dateOrdinateur]
                );
                return true;
            }

            const dateSysteme = params[0].date_systeme_actuelle;
            const dateOrdinateur = new Date().toISOString().split('T')[0];

            return dateSysteme === dateOrdinateur;
        } catch (error) {
            console.error('Erreur isDateSystemeAJour:', error);
            return false;
        }
    }

    /**
     * Récupère les dates système et ordinateur
     */
    static async getDates(): Promise<{ dateSysteme: string; dateOrdinateur: string }> {
        try {
            const db = await getDb();
            const params: any[] = await db.select(
                'SELECT date_systeme_actuelle FROM app_parametres_app WHERE id = 1'
            );

            const dateSysteme = params.length > 0 ? params[0].date_systeme_actuelle : null;
            const dateOrdinateur = new Date().toISOString().split('T')[0];

            return {
                dateSysteme: dateSysteme || dateOrdinateur,
                dateOrdinateur
            };
        } catch (error) {
            console.error('Erreur getDates:', error);
            const dateOrdinateur = new Date().toISOString().split('T')[0];
            return {
                dateSysteme: dateOrdinateur,
                dateOrdinateur
            };
        }
    }

    /**
     * Vérifie si une action peut être effectuée (bloque si date pas à jour)
     */
    static async verifierAvantAction(): Promise<{ autorise: boolean; message: string }> {
        const aJour = await this.isDateSystemeAJour();

        if (!aJour) {
            const { dateSysteme, dateOrdinateur } = await this.getDates();
            return {
                autorise: false,
                message: `⚠️ Clôture obligatoire\n\nLa date système (${new Date(dateSysteme).toLocaleDateString('fr-FR')}) est différente de la date actuelle (${new Date(dateOrdinateur).toLocaleDateString('fr-FR')}).\n\nVous devez clôturer la journée précédente avant de continuer.\n\nRendez-vous dans Facturation > Clôture Journée.`
            };
        }

        return { autorise: true, message: '' };
    }

    /**
     * Vérifie si une date est clôturée
     */
    static async isDateCloturee(date: string): Promise<boolean> {
        try {
            const db = await getDb();
            const result: any[] = await db.select(
                `SELECT statut FROM clotures_journalieres WHERE date_cloture = ?`,
                [date]
            );

            return result.length > 0 && result[0].statut === 'CLOTUREE';
        } catch (error) {
            console.error('Erreur isDateCloturee:', error);
            return false;
        }
    }

    /**
     * Vérifie si une date est ouverte (dé-clôturée)
     */
    static async isDateOuverte(date: string): Promise<boolean> {
        try {
            const db = await getDb();
            const result: any[] = await db.select(
                `SELECT statut FROM clotures_journalieres WHERE date_cloture = ?`,
                [date]
            );

            return result.length > 0 && result[0].statut === 'OUVERTE';
        } catch (error) {
            console.error('Erreur isDateOuverte:', error);
            return false;
        }
    }
}
