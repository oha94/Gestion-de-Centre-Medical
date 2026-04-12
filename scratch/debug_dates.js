const mysql = require('mysql2/promise');

async function check() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'centre_medical'
    });

    console.log("=== DB DATE CHECK ===");
    const [config] = await connection.execute('SELECT date_systeme_actuelle FROM app_parametres_app LIMIT 1');
    console.log("Config Date (date_systeme_actuelle):", config[0].date_systeme_actuelle);

    const [sales] = await connection.execute('SELECT date_vente, libelle, montant_total FROM ventes WHERE date_vente LIKE "2026-04-11%" OR date_vente LIKE "11/04/2026%"');
    console.log("Sales found for 11th April:", sales.length);
    if (sales.length > 0) {
        console.log("Sample sale date value:", sales[0].date_vente);
    }

    const [all] = await connection.execute('SELECT date_vente FROM ventes ORDER BY id DESC LIMIT 5');
    console.log("Recent sales dates in DB:", all.map(s => s.date_vente));

    await connection.end();
}

check().catch(console.error);
