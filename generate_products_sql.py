import csv
import re

def escape_sql_string(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"

def parse_price(price_str):
    if not price_str:
        return 0
    clean = re.sub(r'[^\d.]', '', str(price_str))
    if not clean:
        return 0
    return clean

input_file = 'products_data.txt'
output_file = 'import_products_v2.sql'

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Skip header if present
start_index = 0
if 'Article' in lines[0] or 'PRIX' in lines[0]:
    start_index = 1

rayons = set()
products = []

for line in lines[start_index:]:
    line = line.strip()
    if not line:
        continue
    
    parts = line.split('\t')
    if len(parts) < 3:
        parts = re.split(r'\s{2,}', line) # Try double space split
        
    if len(parts) >= 3:
        name = parts[0].strip()
        price_buy = parse_price(parts[1])
        price_sell = parse_price(parts[2])
        code_geo = parts[3].strip() if len(parts) > 3 else "DEFAULT"
        
        rayons.add(code_geo)
        products.append({
            'name': name,
            'pb': price_buy,
            'pv': price_sell,
            'geo': code_geo
        })

sql_statements = []
sql_statements.append("START TRANSACTION;")

# 1. Insert Rayons
for code in sorted(rayons):
    if code == "DEFAULT":
        lbl = "Rayon Général"
    else:
        lbl = f"Rayon {code}"
    # Use INSERT IGNORE or ON DUPLICATE KEY to avoid errors
    # For SQLite, INSERT OR IGNORE
    # For MySQL, INSERT IGNORE
    sql_statements.append(f"INSERT IGNORE INTO stock_rayons (libelle, code_geo) VALUES ({escape_sql_string(lbl)}, {escape_sql_string(code)});")

# 2. Insert Products
for p in products:
    # We sub-select the rayon ID based on code_geo
    rayon_sql = f"(SELECT id FROM stock_rayons WHERE code_geo = {escape_sql_string(p['geo'])} LIMIT 1)"
    
    stmt = f"INSERT INTO stock_articles (designation, prix_achat, prix_vente, quantite_stock, seuil_alerte, rayon_id) VALUES ({escape_sql_string(p['name'])}, {p['pb']}, {p['pv']}, 0, 5, {rayon_sql});"
    sql_statements.append(stmt)

sql_statements.append("COMMIT;")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print(f"Generated SQL for {len(rayons)} rayons and {len(products)} products in {output_file}")
