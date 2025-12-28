import re

# Lire le fichier focolari_db.sql
with open('focolari_db.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Extraire toutes les sections CREATE TABLE jusqu'au prochain INSERT INTO ou --
pattern = r'(CREATE TABLE.*?;)'
tables = re.findall(pattern, content, re.DOTALL)

# Extraire les ALTER TABLE pour les index et contraintes
alter_pattern = r'(ALTER TABLE.*?;)'
alters = re.findall(alter_pattern, content, re.DOTALL)

# Extraire les vues
view_pattern = r'(CREATE ALGORITHM.*?;)'
views = re.findall(view_pattern, content, re.DOTALL)

# Écrire dans structure.sql
with open('structure.sql', 'w', encoding='utf-8') as f:
    f.write("-- Structure complète de la base de données focolari_db\n")
    f.write("-- Généré automatiquement\n\n")
    f.write("SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n")
    f.write("START TRANSACTION;\n")
    f.write("SET time_zone = \"+00:00\";\n\n")
    
    # Écrire les CREATE TABLE
    for table in tables:
        f.write(table + "\n\n")
    
    # Écrire les vues
    for view in views:
        f.write(view + "\n\n")
    
    # Écrire les ALTER TABLE (index et contraintes)
    f.write("-- Index et contraintes\n\n")
    for alter in alters:
        if 'AUTO_INCREMENT' not in alter:  # Exclure les AUTO_INCREMENT
            f.write(alter + "\n\n")
    
    f.write("COMMIT;\n")

print("Structure extraite avec succès!")
