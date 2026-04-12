import { createConnection } from 'mysql2/promise';

async function test() {
  const conn = await createConnection({
    host: 'localhost', user: 'root', password: '', database: 'centre_medical'
  });

  const [row] = await conn.execute(`
    SELECT * FROM ventes 
    WHERE part_patient - reste_a_payer > 0
    AND DATE(date_vente) = CURDATE()
  `);
  console.log("VENTES:", row);

  const [mvt] = await conn.execute(`
    SELECT * FROM caisse_mouvements
    WHERE DATE(date_mouvement) = CURDATE()
  `);
  console.log("CAISSE MVT:", mvt);

  process.exit(0);
}
test();
