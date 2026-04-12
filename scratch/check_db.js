const mysql = require('mysql2/promise');

async function check() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'centre_medical'
    });

    console.log("Checking recent sales...");
    const [rows] = await connection.execute('SELECT id, numero_ticket, patient_id, personnel_id, type_vente, montant_total, part_patient, date_vente FROM ventes ORDER BY id DESC LIMIT 5');
    console.log("Recent sales:", rows);

    await connection.end();
}

check().catch(console.error);
