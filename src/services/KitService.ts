import { getDb } from "../lib/db";

export interface KitComponent {
    id?: number;
    article_id: number;
    quantite: number;
    // Champs joints pour l'affichage
    designation?: string;
    stock_actuel?: number;
}

export interface Kit {
    id: number;
    nom: string;
    code: string;
    prix_standard: number;
    components?: KitComponent[];
}

export interface KitConsumption {
    id: number;
    kit_id: number;
    user_id?: number;
    patient_id?: number;
    date_consommation: string;
    origin: string;
    details_json: string;
    nom_kit?: string;
    nom_patient?: string;
}

export const KitService = {
    // --- MIGRATION / INITIALISATION ---
    async initTables() {
        const db = await getDb();
        try {
            // 1. Table KITS
            await db.execute(`
        CREATE TABLE IF NOT EXISTS kits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          code VARCHAR(50) UNIQUE NOT NULL,
          prix_standard INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // 2. Table KIT_COMPONENTS
            await db.execute(`
        CREATE TABLE IF NOT EXISTS kit_components (
          id INT AUTO_INCREMENT PRIMARY KEY,
          kit_id INT NOT NULL,
          article_id INT NOT NULL,
          quantite INT NOT NULL DEFAULT 1,
          FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE
        )
      `);

            // 3. Table KIT_CONSUMPTIONS
            await db.execute(`
        CREATE TABLE IF NOT EXISTS kit_consumptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          kit_id INT,
          user_id INT,
          patient_id INT,
          date_consommation DATETIME DEFAULT CURRENT_TIMESTAMP,
          origin VARCHAR(50) DEFAULT 'INFIRMIER',
          details_json TEXT
        )
      `);

            console.log("✅ Tables des kits initialisées.");
        } catch (e) {
            console.error("❌ Erreur initialisation tables kits:", e);
        }
    },

    // --- CRUD ---

    async getKits(): Promise<Kit[]> {
        const db = await getDb();
        try {
            // Récupérer les kits
            const kits = await db.select<Kit[]>("SELECT * FROM kits ORDER BY nom ASC");

            // Pour chaque kit, récupérer ses composants
            // Note: On pourrait faire une seule requête avec JOIN mais ça complique le parsing ici
            for (const kit of kits) {
                kit.components = await db.select<KitComponent[]>(`
          SELECT kc.*, sa.designation, sa.quantite_stock as stock_actuel
          FROM kit_components kc
          JOIN stock_articles sa ON kc.article_id = sa.id
          WHERE kc.kit_id = ?
        `, [kit.id]);
            }
            return kits;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async createKit(kit: Omit<Kit, 'id'>, components: KitComponent[]) {
        const db = await getDb();
        try {
            // 1. Insert Kit
            const res = await db.execute(
                "INSERT INTO kits (nom, code, prix_standard) VALUES (?, ?, ?)",
                [kit.nom, kit.code, kit.prix_standard]
            );
            // @ts-ignore - lastInsertId dépend du driver
            const kitId = res.lastInsertId;

            // 2. Insert Components
            for (const comp of components) {
                await db.execute(
                    "INSERT INTO kit_components (kit_id, article_id, quantite) VALUES (?, ?, ?)",
                    [kitId, comp.article_id, comp.quantite]
                );
            }
            return kitId;
        } catch (e) {
            throw e;
        }
    },

    async updateKit(id: number, kit: Partial<Kit>, components: KitComponent[]) {
        const db = await getDb();
        try {
            // 1. Update Kit info
            await db.execute(
                "UPDATE kits SET nom = ?, code = ?, prix_standard = ? WHERE id = ?",
                [kit.nom, kit.code, kit.prix_standard, id]
            );

            // 2. Replace Components (Delete & Re-insert simplistic approach)
            await db.execute("DELETE FROM kit_components WHERE kit_id = ?", [id]);

            for (const comp of components) {
                await db.execute(
                    "INSERT INTO kit_components (kit_id, article_id, quantite) VALUES (?, ?, ?)",
                    [id, comp.article_id, comp.quantite]
                );
            }
        } catch (e) {
            throw e;
        }
    },

    async deleteKit(id: number) {
        const db = await getDb();
        try {
            await db.execute("DELETE FROM kits WHERE id = ?", [id]);
        } catch (e) {
            throw e;
        }
    },

    // --- LOGIC METIER ---

    async checkStock(kitId: number): Promise<{ available: boolean, missing: string[] }> {
        const db = await getDb();
        const components = await db.select<any[]>(`
      SELECT kc.quantite as qte_requise, sa.quantite_stock, sa.designation
      FROM kit_components kc
      JOIN stock_articles sa ON kc.article_id = sa.id
      WHERE kc.kit_id = ?
    `, [kitId]);

        const missing: string[] = [];
        for (const comp of components) {
            if (comp.quantite_stock < comp.qte_requise) {
                missing.push(`${comp.designation} (Stock: ${comp.quantite_stock}, Requis: ${comp.qte_requise})`);
            }
        }

        return { available: missing.length === 0, missing };
    },

    async consumeKit(kitId: number, userId: number | null, patientId: number | null, origin: string = 'INFIRMIER') {
        const db = await getDb();

        // 1. Vérif stock
        const check = await this.checkStock(kitId);
        if (!check.available) {
            throw new Error("Stock insuffisant : " + check.missing.join(", "));
        }

        try {
            // 2. Décrémentation Stock
            const components = await db.select<KitComponent[]>("SELECT * FROM kit_components WHERE kit_id = ?", [kitId]);

            for (const comp of components) {
                // Update stock
                await db.execute(
                    "UPDATE stock_articles SET quantite_stock = quantite_stock - ? WHERE id = ?",
                    [comp.quantite, comp.article_id]
                );

                // Log mouvement stock
                await db.execute(
                    "INSERT INTO stock_mouvements (article_id, type_mouvement, quantite, motif) VALUES (?, 'SORTIE', ?, ?)",
                    [comp.article_id, comp.quantite, `Consommation Kit #${kitId} (${origin})`]
                );
            }

            // 3. Enregistrer Consommation Kit
            await db.execute(
                "INSERT INTO kit_consumptions (kit_id, user_id, patient_id, origin, details_json) VALUES (?, ?, ?, ?, ?)",
                [kitId, userId, patientId, origin, JSON.stringify(components)]
            );

            return true;
        } catch (e) {
            throw e;
        }
    },

    async getHistory(): Promise<KitConsumption[]> {
        const db = await getDb();
        return db.select<KitConsumption[]>(`
      SELECT kc.*, k.nom as nom_kit, p.nom_prenoms as nom_patient 
      FROM kit_consumptions kc
      LEFT JOIN kits k ON kc.kit_id = k.id
      LEFT JOIN patients p ON kc.patient_id = p.id
      ORDER BY kc.date_consommation DESC
    `);
    }
};
