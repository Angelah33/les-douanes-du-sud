# Les Douanes du Sud - v3

MVP opérationnel (connexion, rapports maréchaux, génération BBCode).

## Déploiement

### Initialisation (Render → Shell)
```bash
python manage.py initdb
python manage.py add-villages "Auch;Eauze;Lectoure;Muret;Saint Bertrand de Comminges;Saint Liziers"
python manage.py create-superadmin "Agatha.isabella" "AC-Prevot!2025#"
```
