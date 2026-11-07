# Portail RH — TECHNOVA INDUSTRIE SA

Démo pédagogique : **l'analyse prédictive comme outil de GPEC**
(Gestion Prévisionnelle des Emplois et des Compétences).

Projet réalisé dans le cadre du module GRH — ENCG Settat — 2026.
Encadré par Pr. Fatima Ezzahra Siragi.

> Entreprise et données fictives (cas d'étude TECHNOVA du TD). La page de connexion
> est une simulation : n'importe quelle saisie fonctionne et rien n'est enregistré ni transmis.

## Voir le site

- En ligne : <https://adashix111.github.io/GRH/>
- Sans internet : double-cliquer sur `index.html`.

## L'idée en une phrase

**Descriptif** (que s'est-il passé ?) → **Prédictif** (que va-t-il se passer ?) →
**Prescriptif** (que faire ? = le plan d'action GPEC).

| Page | Niveau |
|---|---|
| Vue d'ensemble — diagnostic au 31/12/2025 | Descriptif |
| Prévisions 2026–2028 | Prédictif |
| Risque de départ (IA explicable) | Prédictif |
| Compétences de demain | Prédictif |
| Plan d'action GPEC | Prescriptif |

## La méthode (formule du TD)

Effectif disponible = Effectif 2025 − Retraites − Démissions ± Mobilité interne

Écart 2028 = Effectif disponible − Besoins 2028 (positif : surplus, négatif : déficit)

Scénario central : 969 salariés disponibles pour 1 150 besoins, soit un déficit de 181.

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans du portail |
| `css/style.css` | Le design (palette blanc et bleu foncé) |
| `js/data.js` | Les données (TD TECHNOVA + détail simulé) et le modèle de prévision |
| `js/app.js` | La navigation, les graphiques et les tableaux |
| `js/vendor/chart.umd.min.js` | Chart.js 4.5.1 (licence MIT), enregistré localement |
| `assets/` | Le logo |

Site statique : HTML, CSS et JavaScript, sans serveur ni base de données.
