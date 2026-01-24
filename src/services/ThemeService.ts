import { getDb } from '../lib/db';

export interface Theme {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    gradient: string;
}

export class ThemeService {
    static getPresets(): Theme[] {
        return [
            {
                name: 'Purple Elegance',
                primaryColor: '#667eea',
                secondaryColor: '#764ba2',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            {
                name: 'Ocean Blue',
                primaryColor: '#2193b0',
                secondaryColor: '#6dd5ed',
                gradient: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)'
            },
            {
                name: 'Sunset Orange',
                primaryColor: '#f46b45',
                secondaryColor: '#eea849',
                gradient: 'linear-gradient(135deg, #f46b45 0%, #eea849 100%)'
            },
            {
                name: 'Forest Green',
                primaryColor: '#11998e',
                secondaryColor: '#38ef7d',
                gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
            },
            {
                name: 'Royal Red',
                primaryColor: '#eb3349',
                secondaryColor: '#f45c43',
                gradient: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)'
            },
            {
                name: 'Dark Mode',
                primaryColor: '#2c3e50',
                secondaryColor: '#34495e',
                gradient: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
            }
        ];
    }

    static generateGradient(color1: string, color2: string): string {
        return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
    }

    static async loadTheme(): Promise<Theme | null> {
        try {
            const db = await getDb();
            const result = await db.select<any[]>(
                'SELECT couleur_primaire, couleur_secondaire FROM app_parametres_app WHERE id = 1'
            );

            if (result.length > 0 && result[0].couleur_primaire) {
                return {
                    name: 'Custom',
                    primaryColor: result[0].couleur_primaire,
                    secondaryColor: result[0].couleur_secondaire,
                    gradient: this.generateGradient(
                        result[0].couleur_primaire,
                        result[0].couleur_secondaire
                    )
                };
            }
            return null;
        } catch (error) {
            console.error('Error loading theme:', error);
            return null;
        }
    }

    static async saveTheme(theme: Theme): Promise<void> {
        try {
            const db = await getDb();
            await db.execute(
                `UPDATE app_parametres_app 
         SET couleur_primaire = ?, couleur_secondaire = ?
         WHERE id = 1`,
                [theme.primaryColor, theme.secondaryColor]
            );
        } catch (error) {
            console.error('Error saving theme:', error);
            throw error;
        }
    }

    static getDefaultTheme(): Theme {
        return this.getPresets()[0]; // Purple Elegance
    }
}
