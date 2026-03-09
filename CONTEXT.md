# Bureau des Missions de Konoha — Contexte Projet

## Vue d'ensemble

Application web de gestion du **Bureau des Missions (BDM)** pour un serveur roleplay Garry's Mod (NarutoRP). Le BDM distribue des missions aux joueurs (appelés "ninjas" / "adhérents") et gère leur progression via un système de cartes à paliers avec récompenses.

**Style visuel :** Japon féodal / village ninja (tons chauds, textures parchemin, éléments en bois, accents rouges, ornements japonais type torii, kunai, bordures de parchemin). **Aucune référence au manga Naruto** — uniquement une esthétique originale.

**Palette de couleurs :**
- Rouges : `#8B0000`, `#C41E3A`
- Parchemin/beige : `#F5E6CA`, `#E8D5B7`
- Bois/marrons : `#3E2723`, `#5D4037`
- Or/accents : `#D4A017`
- Blanc cassé : `#FAF3E3`
- Vert (succès/validations) : `#4A5D23`

---

## Stack technique recommandé

- **Frontend :** React + Vite + TailwindCSS
- **Backend :** Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- **Auth :** Supabase Auth (email/password) avec rôles custom
- **Déploiement :** Vercel ou Netlify

---

## Système de rôles et permissions

4 rôles staff (utilisateurs du site) :

| Permission | Superviseur | Gérant BDM | Co-gérant | Membre BDM |
|---|:---:|:---:|:---:|:---:|
| Voir Dashboard | ✅ | ✅ | ✅ | ✅ |
| Gérer adhérents (ajouter, voir fiches) | ✅ | ✅ | ✅ | ✅ |
| Évoluer carte adhérent | ✅ | ✅ | ✅ | ✅ |
| Créer des rapports de mission | ✅ | ✅ | ✅ | ✅ |
| Cocher les cases "payé" sur les missions | ✅ | ✅ | ✅ | ❌ |
| Supprimer une mission | ✅ | ✅ | ✅ | ❌ |
| Créer / modifier un cycle | ✅ | ✅ | ❌ | ❌ |
| Supprimer un cycle | ✅ | ✅ | ✅ | ❌ |
| Configurer les cartes (paliers/récompenses) | ✅ | ✅ | ❌ | ❌ |
| Administration (gérer utilisateurs staff) | ✅ | ✅ | ✅ | ❌ |
| Supprimer l'accès d'un utilisateur | ✅ | ✅ | ✅ | ❌ |
| Modifier le rôle d'un Gérant | ❌ (personne) | ❌ | ❌ | ❌ |

> **Note :** Les adhérents (ninjas/joueurs) n'ont **aucun accès** au site. Ils sont uniquement enregistrés dans la base de données par le staff.

---

## Pages et fonctionnalités détaillées

### 1. Page de connexion

- Champs : identifiant (email ou username) + mot de passe
- Design : carte centrée avec cadre en bois, fond atmosphérique (village brumeux), emblème/crest du BDM en haut
- Bouton "Se connecter" stylé en plaque de bois

### 2. Dashboard (Tableau de bord)

- **Sidebar gauche** (navigation, style bois foncé) avec les liens :
  - Tableau de bord
  - Adhérents
  - Rapports BDM
  - Configuration Cartes *(masqué pour Membre BDM)*
  - Cycles *(masqué pour Membre BDM)*
  - Administration *(masqué pour Membre BDM)*
- **Top bar** : nom de l'utilisateur connecté, badge de rôle (Gérant=rouge, Co-gérant=orange, Membre BDM=bleu), cycle actif, bouton déconnexion
- **Contenu principal :**
  - Bannière du cycle actif (nom, dates, barre de progression des jours restants)
  - 4 cartes statistiques : Total adhérents, Missions ce cycle, Points distribués ce cycle, Membres BDM actifs
  - Fil d'activité récente (dernières missions, nouveaux adhérents, évolutions de cartes)

### 3. Page Adhérents

#### Formulaire "Nouvel Adhérent"
- Champs :
  - **Nom** (texte)
  - **Prénom** (texte)
  - **Niveau de carte** (dropdown) : Bronze / Or / VIP
    - Bronze = gratuit, par défaut à chaque nouveau cycle
    - Or = payant (30 000 ryos), valable un seul cycle, repasse en Bronze au cycle suivant
    - VIP = payant (120 000 ryos, -40% si déjà VIP), **permanent / à vie**, ne reset jamais
  - **Distribué par** (auto-rempli avec l'utilisateur connecté, lecture seule)
- Bouton "Enregistrer"

#### Tableau des adhérents
- Recherche + filtre par niveau de carte
- Colonnes : Nom & Prénom, Niveau de carte (badge coloré), Distribué par, Date d'inscription, Points de Missions (cycle en cours)
- Badges couleurs :
  - Bronze : `#CD7F32`
  - Or : `#D4A017`
  - VIP : `#7B1FA2`
- Actions par ligne :
  - **Voir fiche** (icône œil) → redirige vers la fiche adhérent
  - **Évolution** (icône flèche vers le haut) → ouvre une modale

#### Modale d'évolution de carte
- Affiche le niveau actuel (badge)
- Dropdown pour choisir le nouveau niveau (uniquement upgrade : Bronze→Or, Bronze→VIP, Or→VIP)
- Champ "Évolution réalisée par" (auto-rempli avec l'utilisateur connecté)
- Flèche visuelle de l'ancien badge vers le nouveau
- Bouton confirmer

### 4. Fiche Adhérent (page profil)

Accessible en cliquant sur un adhérent ou via une barre de recherche.

- **En-tête profil** : nom complet, grand badge du niveau de carte, 3 boîtes stats :
  - Total missions complétées (tous cycles)
  - Total points gagnés (tous cycles)
  - Points du cycle actuel

- **Barre de progression des paliers** : tracker horizontal type "battle pass" montrant l'avancement sur la carte actuelle **pour le cycle en cours**
  - Nœuds à chaque seuil de Points de Missions (ex: 100 PM, 200 PM, 300 PM...)
  - Paliers complétés = dorés/allumés
  - Paliers non atteints = grisés
  - Icône de récompense sous chaque nœud
  - Tooltip au survol avec la description de la récompense
  - **Les points sont remis à zéro à chaque nouveau cycle** — la progression affichée est celle du cycle sélectionné

- **Deux sections côte à côte :**
  - **Gauche — Historique des missions** : tableau filtrable par cycle (Date, Type, Rang, Points gagnés)
  - **Droite — Historique d'évolution de carte** : timeline verticale des changements de niveau (dates + qui a fait l'upgrade)

### 5. Page Rapports BDM

#### Sélecteur de cycle
- Dropdown stylisé en haut : "Cycle 1 — 01/01/2026 au 21/01/2026", "Cycle 2 — ...", etc.
- Filtre toute la page par cycle sélectionné

#### Formulaire "Nouvelle Mission"
- **Date de mission** (date picker)
- **Type de mission** (toggle 2 options) :
  - "Mission Ninja" (icône shuriken)
  - "Mission Récolte" (icône panier/récolte)
- **Rang** (sélecteur de badges, sur une ligne complète, bien espacé) :
  - D = gris `#9E9E9E` → **40 points**
  - C = bleu `#1565C0` → **70 points**
  - B = vert `#2E7D32` → **130 points**
  - A = rouge `#C62828` → **280 points**
  - S = or `#D4A017` → **700 points**
- **Exécutant** (dropdown single) : choix parmi les staff (Gérant/Co-gérant/Membre BDM) — **l'exécutant est aussi un adhérent et gagne les points de la mission**
- **Intervenants** (multi-select) : choix parmi les staff + option spéciale "Externe BDM" — **les intervenants sont aussi des adhérents et gagnent les points de la mission** (sauf les Externes BDM)
- **Ninjas ayant réalisé la mission** (multi-select avec recherche) : choix parmi la liste des adhérents

> **Règle importante :** Tous les participants (exécutant + intervenants staff + ninjas) gagnent les points de la mission. Par exemple, une mission Rang B (130 pts) rapporte 130 PM à chaque personne impliquée. Les "Externes BDM" ne gagnent pas de points.
- Bouton "Enregistrer la mission"

#### Tableau des missions du cycle
- Colonnes : Date, Type (icône), Rang (badge coloré), Exécutant, Intervenants (chips), Ninjas (chips), Points
- **Colonne paiement** : indicateur de progression "X/Y payés" avec mini barre de progression verte (vue résumée en ligne)
- **Au clic sur une ligne → accordéon dépliant** avec 3 sections :
  - **Exécutant** : nom + checkbox individuelle (payé oui/non)
  - **Intervenants** : liste de chaque nom + checkbox individuelle
  - **Ninjas** : liste de chaque nom + checkbox individuelle
  - Chaque section a un bouton "Tout cocher" en raccourci
  - Checkbox cochée = checkmark vert, non cochée = croix rouge
  - **Checkboxes modifiables uniquement par Gérant ou Co-gérant** → les Membres BDM voient une icône cadenas + état désactivé
- Pagination
- Ligne de résumé en bas : total des points du cycle

### 6. Configuration des Cartes (Gérant uniquement)

- **3 onglets** stylisés en plaques de bois : Bronze, Or, VIP
- Chaque onglet affiche un **track de récompenses horizontal** (style battle pass) :
  - Ligne de progression connectant les nœuds
  - Chaque nœud/palier contient :
    - Seuil en Points de Missions (champ number éditable, ex: "100", "200")
    - Type de récompense (dropdown) : Ryos (Coins), Équipement, Outfit/Tenue, Kunais, Pièces de mérite
    - Description de la récompense (champ texte)
    - Icône dynamique qui change selon le type sélectionné :
      - Ryos (Coins) = icône sac de pièces
      - Équipement = icône épée/armure
      - Outfit = icône vêtement/tenue
      - Kunais = icône kunai
      - Pièces de mérite = icône médaille
  - **L'icône et le label du dropdown doivent se mettre à jour immédiatement** quand on change le type
  - Bouton "Ajouter un palier" en fin de track
  - Drag & drop pour réorganiser les paliers
  - Bouton "Sauvegarder" en haut à droite
- Indication "Accessible uniquement au Gérant BDM" avec icône bouclier
- S'assurer que les icônes ne soient jamais coupées (padding suffisant au-dessus des nœuds)

#### Données de référence pour les paliers (depuis le screen fourni)

**Carte Bronze (Pass Mérite CADET — gratuit, reset chaque cycle) :**

| Seuil PM | Récompense |
|----------|-----------|
| 100 | 5 bols de ramen royal |
| 200 | 500 Ryos |
| 300 | 1 équipement T1 au choix |
| 400 | 1000 Ryos |
| 500 | 25 kunais |
| 600 | 2000 Ryos |
| 700 | 3 équipements T1 au choix |
| 800 | 1 tenue commune |
| 900 | 1 pièce mérite |
| 1000 | 5000 Ryos |

**Carte Or (Pass Mérite SUPRÊME — 30 000 ryos, valable 1 cycle) :**

| Seuil PM | Récompense |
|----------|-----------|
| 250 | 1500 Ryos |
| 500 | 2 pièces mérite |
| 750 | 1 tenue rare |
| 1000 | 500 kunais |
| 1250 | 3000 Ryos |
| 1500 | 5000 Ryos |
| 1750 | 3 pièces mérite |
| 2000 | 3 équipements T3 |
| 2250 | 10 000 Ryos |
| 2500 | 1 tenue exclusive BDM |

**Carte VIP (Pass Mérite LÉGENDE — 120 000 ryos, -40% VIP = 72 000, permanent à vie) :**

| Seuil PM | Récompense |
|----------|-----------|
| 300 | 7500 Ryos |
| 600 | 10 000 Ryos |
| 900 | 1 tenue épique |
| 1200 | 1 équipement T3 |
| 1500 | 5 pièces mérite |
| 1800 | 1 tenue exclusive BDM |
| 2000 | 15 000 Ryos |
| 2250 | 10 pièces mérite |
| 2500 | 3 équipements T4 |
| 2800 | 50 000 Ryos |

> Ces données servent de seed/données initiales. Les paliers et récompenses sont **entièrement configurables** depuis la page Config.

### 7. Gestion des Cycles (Gérant uniquement)

- Vue en cartes/liste de tous les cycles
- Chaque carte de cycle affiche :
  - Numéro du cycle (ex: "Cycle 1")
  - Date de début / Date de fin
  - Statut : Actif (lueur verte), Terminé (grisé), À venir (contour bleu)
  - Nombre de missions
  - Total des points distribués
- Le cycle actif a une bordure dorée lumineuse
- Bouton "Nouveau Cycle" → modale :
  - Date de début (date picker)
  - Date de fin (date picker, auto-suggestion +21 jours depuis le début)
  - Nom auto-généré "Cycle N+1"
- **Les cycles durent 3 semaines** (dates rentrées manuellement par le Gérant)
- Les récompenses et rapports de missions sont **rattachés à un cycle**

### 8. Administration (Gérant / Co-gérant)

#### Tableau des utilisateurs staff
- Colonnes : Nom, Rôle (badge : Gérant=rouge, Co-gérant=orange, Membre BDM=bleu), Statut (Actif=pastille verte, Désactivé=pastille rouge), Date d'ajout
- Actions :
  - **Changer le rôle** (dropdown) — visible uniquement pour Gérant/Co-gérant
  - **Désactiver l'accès** (bouton rouge) — Gérant/Co-gérant uniquement, avec modale de confirmation
  - Un Co-gérant **ne peut pas** modifier un Gérant (boutons grisés/désactivés sur la ligne du Gérant)
- Bouton "Ajouter un utilisateur" → modale (Nom, Prénom, Email, Rôle)

#### Matrice de permissions
- Carte visuelle en dessous du tableau montrant ce que chaque rôle peut faire
- Gérant = accès complet
- Co-gérant = tout sauf gérer le Gérant
- Membre BDM = gestion adhérents + rapports missions uniquement

---

## Schéma de base de données (Supabase/PostgreSQL)

### Tables principales

```sql
-- Utilisateurs staff (accès au site)
-- Chaque staff est aussi un adhérent (ils gagnent des PM quand ils participent aux missions)
CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gerant', 'co-gerant', 'membre_bdm')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  auth_user_id UUID REFERENCES auth.users(id)
);

-- Adhérents (joueurs, pas d'accès au site)
CREATE TABLE adherents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  card_tier TEXT NOT NULL CHECK (card_tier IN ('bronze', 'or', 'vip')),
  distributed_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ajout du lien staff → adhérent après création des deux tables (évite la référence circulaire)
ALTER TABLE staff_users ADD COLUMN adherent_id UUID REFERENCES adherents(id);

-- Historique d'évolutions de carte
CREATE TABLE card_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adherent_id UUID REFERENCES adherents(id) ON DELETE CASCADE,
  old_tier TEXT NOT NULL,
  new_tier TEXT NOT NULL,
  evolved_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cycles (périodes de 3 semaines)
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- ex: "Cycle 1"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'upcoming')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Missions
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  mission_date DATE NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('ninja', 'recolte')),
  rank TEXT NOT NULL CHECK (rank IN ('D', 'C', 'B', 'A', 'S')),
  points INTEGER NOT NULL, -- calculé automatiquement selon le rang
  executor_id UUID REFERENCES staff_users(id), -- staff qui donne la mission
  executor_adherent_id UUID REFERENCES adherents(id), -- l'exécutant en tant qu'adhérent (gagne les points)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intervenants d'une mission (staff ou externe)
CREATE TABLE mission_intervenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_users(id), -- NULL si externe
  adherent_id UUID REFERENCES adherents(id), -- l'intervenant en tant qu'adhérent (gagne les points), NULL si externe
  is_external BOOLEAN DEFAULT false, -- true = "Externe BDM" (pas de points)
  is_paid BOOLEAN DEFAULT false,
  paid_marked_by UUID REFERENCES staff_users(id) -- qui a coché
);

-- Ninjas assignés à une mission (adhérents)
CREATE TABLE mission_ninjas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  adherent_id UUID REFERENCES adherents(id),
  is_paid BOOLEAN DEFAULT false,
  paid_marked_by UUID REFERENCES staff_users(id)
);

-- Paiement de l'exécutant (stocké séparément pour cohérence)
-- Alternativement on peut ajouter executor_is_paid + executor_paid_marked_by dans missions
ALTER TABLE missions ADD COLUMN executor_is_paid BOOLEAN DEFAULT false;
ALTER TABLE missions ADD COLUMN executor_paid_marked_by UUID REFERENCES staff_users(id);

-- Configuration des paliers de carte (récompenses)
CREATE TABLE card_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_tier TEXT NOT NULL CHECK (card_tier IN ('bronze', 'or', 'vip')),
  pm_threshold INTEGER NOT NULL, -- seuil en Points de Missions
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ryos', 'equipement', 'outfit', 'kunais', 'pieces_merite', 'autre')),
  reward_description TEXT NOT NULL, -- ex: "5000 Ryos", "1 tenue rare"
  sort_order INTEGER NOT NULL, -- pour le drag & drop
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Récompenses réclamées par adhérent par cycle (progression reset chaque cycle)
CREATE TABLE claimed_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adherent_id UUID REFERENCES adherents(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES card_milestones(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  claimed_by UUID REFERENCES staff_users(id), -- staff qui a distribué la récompense
  UNIQUE(adherent_id, cycle_id, milestone_id) -- un palier ne peut être réclamé qu'une fois par cycle
);
```

### Trigger : synchronisation Auth → staff_users

Quand un utilisateur est créé via Supabase Auth, il faut automatiquement créer une entrée dans `staff_users`. Sans ce trigger, les users Auth n'apparaissent pas dans l'application.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.staff_users (auth_user_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'membre_bdm')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

> **Important :** Lors de la création d'un utilisateur depuis le panel Admin du site, il faut passer `first_name`, `last_name` et `role` dans les `user_metadata` de `supabase.auth.signUp()` pour que le trigger les récupère.

### Reset des cartes à chaque nouveau cycle

À la création d'un nouveau cycle, toutes les cartes adhérents sont rétrogradées en Bronze **sauf les VIP** (statut à vie). Cette logique doit être exécutée quand le Gérant crée un nouveau cycle.

```sql
CREATE OR REPLACE FUNCTION reset_cards_for_new_cycle(new_cycle_id UUID)
RETURNS void AS $$
BEGIN
  -- Rétrograde toutes les cartes en Bronze sauf VIP
  UPDATE adherents
  SET card_tier = 'bronze'
  WHERE card_tier != 'vip';

  -- Log les évolutions automatiques dans l'historique
  INSERT INTO card_evolutions (adherent_id, old_tier, new_tier, evolved_by)
  SELECT id, card_tier, 'bronze', NULL -- NULL = reset automatique par le système
  FROM adherents
  WHERE card_tier = 'or'; -- seuls les Or sont impactés (VIP gardent, Bronze restent Bronze)
END;
$$ LANGUAGE plpgsql;
```

> **Règle métier :** Bronze = par défaut à chaque cycle. Or = acheté pour un cycle, repasse en Bronze au suivant. VIP = permanent, ne reset jamais.

### Calcul automatique des points

```sql
-- Fonction pour obtenir les points selon le rang
CREATE OR REPLACE FUNCTION get_rank_points(mission_rank TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE mission_rank
    WHEN 'D' THEN 40
    WHEN 'C' THEN 70
    WHEN 'B' THEN 130
    WHEN 'A' THEN 280
    WHEN 'S' THEN 700
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-calculer les points à l'insertion
CREATE OR REPLACE FUNCTION set_mission_points()
RETURNS TRIGGER AS $$
BEGIN
  NEW.points := get_rank_points(NEW.rank);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mission_points
BEFORE INSERT OR UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION set_mission_points();
```

### Vue utile : points par adhérent par cycle (utilisée pour la progression de carte)

Tous les participants gagnent les points : exécutant + intervenants (sauf externes) + ninjas.

```sql
CREATE OR REPLACE VIEW adherent_cycle_points AS
-- Points des ninjas
SELECT mn.adherent_id, m.cycle_id, m.id AS mission_id, m.points
FROM mission_ninjas mn
JOIN missions m ON m.id = mn.mission_id
UNION ALL
-- Points de l'exécutant (en tant qu'adhérent)
SELECT m.executor_adherent_id AS adherent_id, m.cycle_id, m.id AS mission_id, m.points
FROM missions m
WHERE m.executor_adherent_id IS NOT NULL
UNION ALL
-- Points des intervenants (en tant qu'adhérents, sauf externes)
SELECT mi.adherent_id, m.cycle_id, m.id AS mission_id, m.points
FROM mission_intervenants mi
JOIN missions m ON m.id = mi.mission_id
WHERE mi.is_external = false AND mi.adherent_id IS NOT NULL;
```

Vue agrégée pour faciliter les requêtes :

```sql
CREATE OR REPLACE VIEW adherent_cycle_summary AS
SELECT
  adherent_id,
  cycle_id,
  COUNT(mission_id) AS mission_count,
  SUM(points) AS total_points
FROM adherent_cycle_points
GROUP BY adherent_id, cycle_id;
```

> **C'est cette vue qui détermine la progression de carte.** À chaque nouveau cycle, les points repartent de zéro. Les paliers atteints et récompenses sont liés au cycle en cours.

### Vue secondaire : cumul tous cycles (pour stats générales uniquement)

```sql
CREATE OR REPLACE VIEW adherent_total_points AS
SELECT
  adherent_id,
  COUNT(mission_id) AS total_missions,
  SUM(points) AS total_points
FROM adherent_cycle_points
GROUP BY adherent_id;
```

---

## RLS (Row Level Security) — Règles principales

- **staff_users** : lecture par tous les staff authentifiés, modification par gérant/co-gérant uniquement
- **adherents** : lecture/écriture par tous les staff authentifiés
- **missions** : lecture par tous les staff, écriture par tous les staff, modification des champs `is_paid` uniquement par gérant/co-gérant
- **card_milestones** : lecture par tous les staff, écriture uniquement par gérant
- **cycles** : lecture par tous les staff, écriture uniquement par gérant

---

## Points d'attention pour le développement

1. **Les adhérents n'ont JAMAIS accès au site** — ce ne sont pas des utilisateurs, juste des données
2. **Les checkboxes de paiement sont individuelles** — chaque personne (exécutant, chaque intervenant, chaque ninja) a sa propre case à cocher
3. **Tout est lié à un cycle** — les rapports de missions sont filtrés par cycle, les stats du dashboard sont par cycle
4. **La progression de carte est PAR CYCLE** — à chaque nouveau cycle, les points sont remis à zéro. Les paliers atteints et récompenses sont donc liés au cycle en cours. Un adhérent recommence sa progression à 0 PM à chaque début de cycle. **De plus, à chaque nouveau cycle, toutes les cartes adhérents sont automatiquement rétrogradées en Bronze, SAUF les VIP qui conservent leur statut à vie.** Les cartes Or repassent donc en Bronze à chaque cycle.
5. **Les rangs de badges (D/C/B/A/S) doivent tenir sur une seule ligne** sans dépasser le conteneur — prévoir un layout responsive ou passer sur une ligne dédiée
6. **La configuration des cartes est dynamique** — le dropdown de type de récompense doit mettre à jour l'icône et le label immédiatement
7. **Les icônes des paliers ne doivent jamais être coupées** — prévoir un padding suffisant
8. **La sidebar masque les liens Admin/Cycles/Config pour les Membres BDM**
9. **Un Co-gérant ne peut pas modifier le rôle d'un Gérant**
10. **Les membres staff (Gérant/Co-gérant/Membre BDM) sont aussi des adhérents** — chaque staff doit avoir une fiche adhérent correspondante. Quand un staff est exécutant ou intervenant d'une mission, il gagne les PM comme n'importe quel adhérent. Il faut donc un lien `staff_users.adherent_id` ou une correspondance manuelle. Lors de la création d'une mission, le formulaire doit identifier automatiquement la fiche adhérent liée au staff sélectionné.

---

## Maquettes Figma

Les maquettes Figma sont fournies en pièces jointes. Elles servent de référence visuelle pour :
- Le layout et la disposition des éléments
- Le style graphique (couleurs, typographie, ornements)
- Les composants UI (boutons, badges, tableaux, modales)
- Les différentes vues par rôle (Gérant vs Co-gérant vs Membre BDM)

**Respecter le design au maximum** tout en s'assurant que le responsive fonctionne correctement.