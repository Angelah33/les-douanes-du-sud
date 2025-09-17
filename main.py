from flask import Flask, render_template, render_template_string, request, redirect, url_for, flash, abort
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import text
import os, pytz
from datetime import datetime, timedelta, time, date
from flask import jsonify
def get_jour_de_jeu():
    now = datetime.now()
    heure = now.hour

    if heure < 3:
        return (now - timedelta(days=1)).date()
    elif 3 <= heure < 5:
        return None  # période de maintenance
    else:
        return now.date()
# --- Guides: markdown + sanitisation HTML ---
import markdown
import bleach

# ---------------------------------------------------------------------
# Connexion DB : normalise l'URL et force psycopg (psycopg3)
# ---------------------------------------------------------------------
def pg_uri(uri: str) -> str:
    if not uri:
        return "sqlite:///local.db"
    if uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql://", 1)
    if uri.startswith("postgresql://"):
        uri = uri.replace("postgresql://", "postgresql+psycopg://", 1)
    return uri

app = Flask(__name__, static_folder="static.ok")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")
app.config["SQLALCHEMY_DATABASE_URI"] = pg_uri(db_url)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

TIMEZONE = os.getenv("TIMEZONE", "Europe/Paris")
TZ = pytz.timezone(TIMEZONE)
BLOCK_FROM = os.getenv("BLOCK_DEPOSITS_FROM", "03:00")
BLOCK_TO = os.getenv("BLOCK_DEPOSITS_TO", "05:00")

SITE_NAME = os.getenv("SITE_NAME", "Les Douanes du Sud")
UI_BG_COLOR = os.getenv("UI_BG_COLOR", "#D5BC84")
UI_TEXT_COLOR = os.getenv("UI_TEXT_COLOR", "#7A451E")
REPORT_TITLE_COLOR = os.getenv("REPORT_TITLE_COLOR", "#162E5A")
BUREAU_NAME = os.getenv("BUREAU_NAME", "Armagnac & Comminges")
BUREAU_LOGO_URL = os.getenv("BUREAU_LOGO_URL", "")

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"

# ---------------------------------------------------------------------
# Modèles
# ---------------------------------------------------------------------
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="marechal")
    bureau = db.Column(db.String(120), nullable=True, default="Armagnac & Comminges")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Village(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    report_date = db.Column(db.Date, default=date.today)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    village = db.Column(db.String(120), nullable=False)
    tour_de_garde = db.Column(db.Boolean, default=True)
    mem_visions = db.Column(db.Text, default="")
    surveillance = db.Column(db.Text, default="")
    flux = db.Column(db.Text, default="")
    foreigners = db.Column(db.Text, default="")
    ac_presence = db.Column(db.Text, default="")
    armies_groups = db.Column(db.Text, default="")
    villagers = db.Column(db.Text, default="")
    moves = db.Column(db.Text, default="")
    bbcode = db.Column(db.Text, default="")

# ---------- Modèle pour Guides (Maréchal / Prévôt) ----------
class Guide(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    audience = db.Column(db.String(20), nullable=False, unique=True)  # 'marechal' | 'prevot'
    format = db.Column(db.String(20), nullable=False, default="markdown")
    content = db.Column(db.Text, default="")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.String(120), default="system")

class Brigand(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    list = db.Column(db.String(20), nullable=False)  # noire, surveillance, hors, archives
    facts = db.Column(db.Text, default="")
    is_crown = db.Column(db.Boolean, default=False)
    is_png = db.Column(db.Boolean, default=False)
    order = db.Column(db.String(120), default="")  # nom abrégé de l'organisation

# ---------- Rendu Markdown sûr (sanitize) ----------
ALLOWED_TAGS = bleach.sanitizer.ALLOWED_TAGS.union({
    "p","br","hr","pre","code","blockquote","ul","ol","li","strong","em","b","i","u",
    "h1","h2","h3","h4","h5","h6","img","a","table","thead","tbody","tr","th","td"
})
ALLOWED_ATTRS = {
    **bleach.sanitizer.ALLOWED_ATTRIBUTES,
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "table": ["border", "cellpadding", "cellspacing"]
}

def render_markdown_safe(text_md: str) -> str:
    """Convertit Markdown -> HTML puis nettoie le HTML (bleach)."""
    html = markdown.markdown(
        text_md or "",
        extensions=["extra", "tables", "sane_lists", "codehilite", "toc"]
    )
    clean = bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS)
    # nofollow + target=_blank sur les liens
    clean = bleach.linkify(
        clean,
        callbacks=[
            bleach.callbacks.nofollow,
            bleach.callbacks.target_blank,
        ],
    )
    return clean

# ---------------------------------------------------------------------
# Login / helpers
# ---------------------------------------------------------------------
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def parse_hhmm(s): h,m = s.split(":"); return time(int(h),int(m))
def is_blocked_now():
    now = datetime.now(TZ).time()
    start,end = parse_hhmm(BLOCK_FROM), parse_hhmm(BLOCK_TO)
    return start <= now < end if start<end else (now>=start or now<end)
def count_lines(txt): return len([ln for ln in (txt or "").splitlines() if ln.strip()])

def is_superadmin():
    return current_user.is_authenticated and getattr(current_user, "role", "") == "superadmin"

def is_prevot():
    return current_user.is_authenticated and getattr(current_user, "role", "") == "prevot"

# ---------- Seed / garantie d'existence des 2 guides ----------
def ensure_guides_exist():
    """Crée les lignes guides 'marechal' & 'prevot' si absentes."""
    changed = False
    if not Guide.query.filter_by(audience="marechal").first():
        g = Guide(audience="marechal", content="*(Vide)*\n\nRédigez ici le **Guide maréchal**.")
        db.session.add(g); changed = True
    if not Guide.query.filter_by(audience="prevot").first():
        g = Guide(audience="prevot", content="*(Vide)*\n\nRédigez ici le **Guide prévôt**.")
        db.session.add(g); changed = True
    if changed:
        db.session.commit()

# Appel auto au démarrage (assure les tables + guides)
with app.app_context():
    db.create_all()
    ensure_guides_exist()

# ---------------------------------------------------------------------
# Génération BBCode du rapport maréchal
# ---------------------------------------------------------------------
def bbcode_report(village_name, d, mem_visions, surveillance, flux, foreigners, ac_presence, armies_groups, villagers, moves):
    date_str = d.strftime("%d %B %Y")
    lines=[]
    def title(label,count=None):
        suffix=f" [color=blue][b]{count}[/b][/color]" if count is not None else ""
        lines.append(f"[color={REPORT_TITLE_COLOR}][size=14][b][u]{label}[/u] :[/b][/size][/color]{suffix}\n")
    lines.append(f"[quote][center][b][size=18]{village_name}[/size]\nRapport de la maréchaussée du {date_str}.[/b][/center]\n")
    mv=mem_visions.strip() or "[b]RAS.[/b]"
    title("MÉMOIRE ET VISIONS"); lines.append(mv+"\n\n")
    title("PERSONNES EN SURVEILLANCE",count_lines(surveillance)); lines.append(surveillance+"\n\n")
    title("FLUX MIGRATOIRES",count_lines(flux)); lines.append(flux+"\n\n")
    title("PRÉSENCES ÉTRANGÈRES",count_lines(foreigners)); lines.append(foreigners+"\n\n")
    title("PRÉSENCES ARMAGNACAISES & COMMINGEOISES",count_lines(ac_presence)); lines.append(ac_presence+"\n\n")
    title("ARMÉES ET GROUPES",count_lines(armies_groups)); lines.append(armies_groups+"\n\n")
    title("LISTE DES VILLAGEOIS & DÉMÉNAGEMENTS"); lines.append("[spoiler][quote]Déménagements[/quote]\n"+moves+"\n"+villagers+"\n[/spoiler]\n\n")
    legend="[quote][size=9][b]LÉGENDE[/b] :\n[color=red][b]Rouge[/b][/color] : Surveillance accrue (liste noire, casier judiciaire, etc.).\n[color=darkred][b]DarkRed[/b][/color] : Surveillance légère (prescriptions, casier léger, suspicions, etc.).\n[color=green][b]Vert[/b][/color] : Individu sans antécédent judiciaire chez A&C.\n[color=indigo][b]PNG[/b][/color] : Persona Non Grata (interdit de territoire).\n(statuts spéciaux) : (en prison), (en retraite spirituelle), (en retranchement), (mort).[/size][/quote]"
    lines.append(legend+"\n[/quote]")
    return "\n".join(lines)

# ---------------------------------------------------------------------
# Contexte global pour les templates
# ---------------------------------------------------------------------
@app.context_processor
def inject_globals():
    return dict(SITE_NAME=SITE_NAME, UI_BG_COLOR=UI_BG_COLOR, UI_TEXT_COLOR=UI_TEXT_COLOR,
                REPORT_TITLE_COLOR=REPORT_TITLE_COLOR, BUREAU_NAME=BUREAU_NAME, BUREAU_LOGO_URL=BUREAU_LOGO_URL)

# Vérifie que la colonne "bureau" existe dans la table user,
# et si elle n’existe pas, l’ajoute avec une valeur par défaut.
def ensure_user_bureau_column():
    from sqlalchemy import inspect, text
    insp = inspect(db.engine)
    if "user" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("user")]
        if "bureau" not in cols:
            with db.engine.connect() as conn:
                # 1) ajouter la colonne (sans DEFAULT d’abord)
                conn.execute(text('ALTER TABLE "user" ADD COLUMN bureau VARCHAR(120)'))
                # 2) remplir les lignes existantes
                conn.execute(text('UPDATE "user" SET bureau = \'Armagnac & Comminges\' WHERE bureau IS NULL'))
                # 3) définir un DEFAULT pour les futures insertions
                conn.execute(text('ALTER TABLE "user" ALTER COLUMN bureau SET DEFAULT \'Armagnac & Comminges\''))
                conn.commit()

# Appel automatique au démarrage pour être sûr que la colonne existe
with app.app_context():
    ensure_user_bureau_column()

# ---------------------------------------------------------------------
# Routes UI (propres)
# ---------------------------------------------------------------------
from sqlalchemy import case  # utilisé pour l'ordre d'affichage des rôles

@app.route("/")
def home():
    return render_template("home.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = request.form.get("username")
        p = request.form.get("password")
        remember = True if request.form.get("remember") == "on" else False

        user = User.query.filter_by(username=u).first()
        if not user or not user.check_password(p):
            flash("Identifiants incorrects.")
            return render_template("login.html")

        login_user(user, remember=remember)
        # Redirection selon le rôle
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("home"))


# ---------- Lecture des guides : renvoie du HTML à injecter en modale ----------
@app.route("/guide/<audience>")
@login_required
def guide_read(audience):
    """
    Autorisations :
      - maréchal : peut lire 'marechal'
      - prévôt   : peut lire 'prevot' ET 'marechal'
      - superadmin : peut lire tout (pas de lien spécifique dans la barre)
    """
    role = getattr(current_user, "role", "")
    allowed = (
        (role == "marechal" and audience == "marechal") or
        (role == "prevot"   and audience in ("prevot", "marechal")) or
        (role == "superadmin")
    )
    if not allowed:
        return "Non autorisé", 403

    g = Guide.query.filter_by(audience=audience).first()
    if not g:
        return "<em>Guide introuvable.</em>", 404

    html = render_markdown_safe(g.content)
    # On renvoie juste le fragment HTML (le JS du template l’injecte dans la modale)
    return html


# ---------- Routeur de tableaux de bord ----------
@app.route("/dashboard")
@login_required
def dashboard():
    role = getattr(current_user, "role", "")
    if role == "superadmin":
        return redirect(url_for("admin_dashboard"))
    elif role == "prevot":
        return redirect(url_for("prevot_dashboard"))
    else:
        return redirect(url_for("rapport"))


# ---------- Édition des guides (Super-admin uniquement) ----------
@app.route("/admin/guides", methods=["GET", "POST"])
@login_required
def admin_guides():
    if not is_superadmin():
        abort(403)

    gm = Guide.query.filter_by(audience="marechal").first()
    gp = Guide.query.filter_by(audience="prevot").first()

    if request.method == "POST":
        new_gm = request.form.get("content_marechal", "")
        new_gp = request.form.get("content_prevot", "")
        if gm:
            gm.content = new_gm
            gm.updated_by = current_user.username
        if gp:
            gp.content = new_gp
            gp.updated_by = current_user.username
        db.session.commit()
        flash("Guides enregistrés.")
        return redirect(url_for("admin_guides"))

    gm_html = render_markdown_safe(gm.content if gm else "")
    gp_html = render_markdown_safe(gp.content if gp else "")

    return render_template_string("""
{% extends "base.html" %}{% block content %}
<h1>Gérer les guides</h1>
<p><em>(Édition réservée au Super-admin)</em></p>

{% with msgs = get_flashed_messages() %}
  {% if msgs %}{% for m in msgs %}<div class="flash">{{ m }}</div>{% endfor %}{% endif %}
{% endwith %}

<form method="post" style="display:grid;gap:1rem;grid-template-columns:1fr 1fr;align-items:start">
  <div>
    <h3>Guide maréchal (Markdown)</h3>
    <textarea name="content_marechal" style="width:100%;height:300px">{{ (gm.content if gm else '')|e }}</textarea>
    <h4>Aperçu</h4>
    <div id="preview_marechal" style="background:#fff3; padding:.6rem; border:1px solid #0002">{{ gm_html|safe }}</div>
  </div>
  <div>
    <h3>Guide prévôt (Markdown)</h3>
    <textarea name="content_prevot" style="width:100%;height:300px">{{ (gp.content if gp else '')|e }}</textarea>
    <h4>Aperçu</h4>
    <div id="preview_prevot" style="background:#fff3; padding:.6rem; border:1px solid #0002">{{ gp_html|safe }}</div>
  </div>

  <div style="grid-column:1/-1">
    <button type="submit">Enregistrer</button>
  </div>
</form>

<script>
  // Aperçu “live” minimal : message disant que l'aperçu sera à jour après Enregistrer
  const pm = document.querySelector("textarea[name='content_marechal']");
  const pp = document.querySelector("textarea[name='content_prevot']");
  const vm = document.getElementById("preview_marechal");
  const vp = document.getElementById("preview_prevot");
  if (pm && vm) pm.addEventListener("input", ()=>{ vm.innerHTML = "<em>Aperçu mis à jour après enregistrement.</em>"; });
  if (pp && vp) pp.addEventListener("input", ()=>{ vp.innerHTML = "<em>Aperçu mis à jour après enregistrement.</em>"; });
</script>
{% endblock %}
""", gm=gm, gp=gp, gm_html=gm_html, gp_html=gp_html)


# ---------- Gestion des utilisateurs (réservé superadmin) ----------
@app.route("/admin/users", methods=["GET", "POST"], endpoint="admin_users")
@login_required
def admin_users():
    if not is_superadmin():
        abort(403)

    # Création / suppression
    if request.method == "POST":
        # Suppression multiple (cases cochées)
        to_delete = request.form.getlist("delete_user")
        if to_delete:
            for uid in to_delete:
                user = User.query.get(int(uid))
                if user and user.role != "superadmin":
                    db.session.delete(user)
            db.session.commit()
            flash("Comptes supprimés.")
            return redirect(url_for("admin_users"))

        # Création d’un nouvel utilisateur
        uname  = (request.form.get("username") or "").strip()
        pwd    = (request.form.get("password") or "").strip()
        role   = (request.form.get("role") or "marechal").strip()
        bureau = (request.form.get("bureau") or "Armagnac & Comminges").strip()

        if not uname or not pwd:
            flash("Renseigne un identifiant et un mot de passe.")
        elif User.query.filter_by(username=uname).first():
            flash("Cet utilisateur existe déjà.")
        else:
            u = User(username=uname, role=role, bureau=bureau)
            u.set_password(pwd)
            db.session.add(u)
            db.session.commit()
            flash(f"Utilisateur {uname} ({role}, {bureau}) créé.")
        return redirect(url_for("admin_users"))

    # Liste (superadmin caché) : prévôt en premier, puis maréchal, puis autres, tri alpha
    role_order = case(
        (User.role == "prevot", 0),
        (User.role == "marechal", 1),
        else_=2
    )
    users = (
        User.query
        .filter(User.role != "superadmin")
        .order_by(role_order, User.username.asc())
        .all()
    )

    return render_template_string("""
{% extends "base.html" %}{% block content %}
<h1>Gestion des utilisateurs</h1>

{% with msgs = get_flashed_messages() %}
  {% if msgs %}{% for m in msgs %}<div class="flash">{{ m }}</div>{% endfor %}{% endif %}
{% endwith %}

<h3>Créer un utilisateur</h3>
<form method="post" style="display:grid;grid-template-columns:1.1fr 1fr 1.2fr 1fr auto;gap:.5rem;align-items:end;max-width:980px">
  <div>
    <label>Identifiant</label>
    <input name="username" placeholder="ex: JeanDupont" required>
  </div>
  <div>
    <label>Mot de passe</label>
    <input name="password" type="password" required>
  </div>
  <div>
    <label>Bureau</label>
    <select name="bureau">
      <option value="Armagnac & Comminges" selected>Armagnac & Comminges</option>
    </select>
  </div>
  <div>
    <label>Rôle</label>
    <select name="role">
      <option value="marechal" selected>maréchal</option>
      <option value="prevot">prévôt</option>
      <option value="superadmin">superadmin</option>
    </select>
  </div>
  <button type="submit">Créer</button>
</form>

<h3 style="margin-top:1rem">Utilisateurs existants</h3>
<form method="post">
<table style="width:100%;max-width:980px;border-collapse:collapse">
  <thead>
    <tr>
      <th></th>
      <th style="text-align:left;border-bottom:1px solid #ddd">Identifiant</th>
      <th style="text-align:left;border-bottom:1px solid #ddd">Bureau</th>
      <th style="text-align:left;border-bottom:1px solid #ddd">Rôle</th>
    </tr>
  </thead>
  <tbody>
    {% for u in users %}
      <tr>
        <td><input type="checkbox" name="delete_user" value="{{ u.id }}"></td>
        <td style="padding:.4rem 0">{{ u.username }}</td>
        <td>{{ u.bureau or '—' }}</td>
        <td>{{ u.role }}</td>
      </tr>
    {% else %}
      <tr><td colspan="4"><em>Aucun utilisateur</em></td></tr>
    {% endfor %}
  </tbody>
</table>
<button type="submit">Supprimer sélection</button>
</form>
{% endblock %}
""", users=users)


# ---------- Tableau de bord Admin ----------
@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    if not is_superadmin():
        abort(403)
    return render_template_string("""
{% extends "base.html" %}{% block content %}
<h1>Tableau de bord — Admin</h1>
<ul>
  <li><a href="{{ url_for('admin_users') }}">Gérer les utilisateurs</a></li>
  <li><a href="{{ url_for('admin_guides') }}">Gérer les guides</a></li>
  <li><a href="{{ url_for('rapport') }}">Saisir un rapport</a></li>
</ul>
{% endblock %}
""")

# ---------- Tableau de bord Prévôt ----------

@app.route("/prevot/dashboard")
@login_required
def prevot_dashboard():
    role = getattr(current_user, "role", "")
    if role not in ("prevot", "admin", "superadmin"):
        abort(403)

    return render_template_string("""
    {% extends "base.html" %}
    {% block content %}
    <h1>Tableau de bord — Prévôt</h1>
    <ul>
      <li><a href="{{ url_for('gestion_marechaux') }}">Gérer les maréchaux</a></li>
      <li><a href="{{ url_for('rapports_du_jour') }}">Consulter les rapports du jour</a></li>
      <li><a href="{{ url_for('rectifier_rapport') }}">Rectifier un rapport</a></li>
      <li><a href="{{ url_for('synthese_douane') }}">Gérer la synthèse de douane</a></li>
      <li><a href="{{ url_for('brigands') }}">Gérer les listes des brigands</a></li>
      <li><a href="{{ url_for('tableau_gardes') }}">Tableau des gardes</a></li>
    </ul>
    {% endblock %}
    """)

@app.route("/api/brigands")
def api_brigands():
    brigands = Brigand.query.order_by(Brigand.name.asc()).all()
    result = []
    for b in brigands:
        result.append({
            "id": b.id,
            "name": b.name,
            "list": b.list,
            "facts": b.facts,
            "is_crown": b.is_crown,
            "is_png": b.is_png,
            "order": b.order
        })
    return jsonify(result)

@app.route("/api/brigands", methods=["POST"])
def create_brigand():
    data = request.get_json()
    if not data or "name" not in data or "list" not in data:
        return jsonify({"error": "Champs obligatoires manquants"}), 400

    brigand = Brigand(
        name=data["name"].strip(),
        list=data["list"],
        facts=data.get("facts", "").strip(),
        is_crown=bool(data.get("is_crown")),
        is_png=bool(data.get("is_png")),
        order=data.get("order", "").strip()
    )
    db.session.add(brigand)
    db.session.commit()
    return jsonify({"success": True, "id": brigand.id})

# ---------- Interfaces prévôtales ----------

@app.route("/brigands")
@login_required
def brigands():
    if current_user.role not in ["prevot", "admin"]:
        abort(403)
    return render_template("brigands.html")

@app.route("/prevot/marechaux", methods=["GET", "POST"], endpoint="gestion_marechaux")
@login_required
def gestion_marechaux():
    if current_user.role != "prevot":
        abort(403)

    bureau_ac = "Armagnac & Comminges"

    # Suppression
    if request.method == "POST" and request.form.getlist("delete_user"):
        to_delete = request.form.getlist("delete_user")
        for uid in to_delete:
            user = User.query.get(int(uid))
            if user and user.role == "marechal" and user.bureau == bureau_ac:
                db.session.delete(user)
        db.session.commit()
        flash("Maréchaux A&C supprimés.")
        return redirect(url_for("gestion_marechaux"))

    # Création
    if request.method == "POST" and not request.form.getlist("delete_user"):
        uname = (request.form.get("username") or "").strip()
        pwd   = (request.form.get("password") or "").strip()

        import re
        if not uname or not pwd:
            flash("Renseigne un identifiant et un mot de passe.")
        elif not re.match(r"^AC\d+$", pwd):
            flash("Mot de passe invalide : utilise 'AC' suivi de chiffres.")
        elif User.query.filter_by(username=uname).first():
            flash("Cet utilisateur existe déjà.")
        else:
            u = User(username=uname, role="marechal", bureau=bureau_ac)
            u.set_password(pwd)
            db.session.add(u)
            db.session.commit()
            flash(f"Maréchal {uname} (A&C) créé.")
        return redirect(url_for("gestion_marechaux"))

    # Liste des maréchaux A&C
    users = (
        User.query
        .filter_by(role="marechal", bureau=bureau_ac)
        .order_by(User.username.asc())
        .all()
    )

    return render_template("marechaux.html", users=users)

def jour_actif():
    now = datetime.now()
    seuil = now.replace(hour=5, minute=0, second=0, microsecond=0)
    if now < seuil:
        return (now - timedelta(days=1)).date()
    return now.date()

@app.route("/prevot/rapports-jour", methods=["GET"], endpoint="rapports_du_jour")
@login_required
def rapports_du_jour():
    if current_user.role != "prevot":
        abort(403)

    jour = jour_actif()
    villages = Village.query.order_by(Village.name.asc()).all()

    rapports_faits = []
    rapports_manquants = []

    for village in villages:
        rapport = Report.query.filter_by(village=village.name, report_date=jour).first()
        if rapport:
            rapports_faits.append((village.name, rapport.id))
        else:
            rapports_manquants.append(village.name)

    return render_template("rapports_jour.html",
                           jour=jour,
                           faits=rapports_faits,
                           manquants=rapports_manquants)

@app.route("/prevot/rectifier-rapport")
@login_required
def rectifier_rapport():
    if current_user.role != "prevot":
        abort(403)
    return render_template_string("<h2>Rectification des rapports — à venir</h2>")

@app.route("/prevot/synthese-douane")
@login_required
def synthese_douane():
    if current_user.role != "prevot":
        abort(403)
    return render_template_string("<h2>Synthèse de douane — à venir</h2>")

@app.route("/prevot/gardes")
@login_required
def tableau_gardes():
    if current_user.role != "prevot":
        abort(403)
    return render_template_string("<h2>Tableau des gardes — à venir</h2>")

# ---------- Formulaire Rapport Maréchal ----------

def get_villages_traite_today():
    today = date.today()
    rapports_du_jour = Report.query.filter_by(report_date=today).all()
    return [r.village for r in rapports_du_jour]

@app.route("/rapport", methods=["GET", "POST"])
@login_required
def rapport():
    villages = [v.name for v in Village.query.order_by(Village.name.asc()).all()]
    blocked = is_blocked_now()
    jour_de_jeu = get_jour_de_jeu()

    def rerender():
        villages_traite_today = get_villages_traite_today()
        return render_template(
            "rapport.html",
            villages=villages,
            blocked=blocked,
            form=request.form,
            villages_traite_today=villages_traite_today,
            jour_de_jeu=jour_de_jeu
        )

    if request.method == "POST":
        if blocked:
            flash("Dépôt bloqué.")
            return rerender()

        garde_val  = request.form.get("tour_de_garde", "")
        village    = (request.form.get("village") or "").strip()
        mv         = (request.form.get("mem_visions") or "").strip()
        surv       = (request.form.get("surveillance") or "").strip()
        flux       = (request.form.get("flux") or "").strip()
        foreigners = (request.form.get("foreigners") or "").strip()
        acp        = (request.form.get("ac_presence") or "").strip()
        ag         = (request.form.get("armies_groups") or "").strip()
        villagers  = (request.form.get("villagers") or "").strip()
        moves      = (request.form.get("moves") or "").strip()

        errors = []
        if garde_val not in ("oui", "non"):
            errors.append("Indiquez si la garde a été effectuée (oui / non).")
        if not village:
            errors.append("Choisissez un village.")
        elif village not in villages:
            errors.append("Le village choisi est invalide.")
        if not villagers.strip():
            errors.append("Renseignez la liste des villageois recensés en mairie.")
        if not ag.strip():
            errors.append("Renseignez les armées et groupes présents hors de la ville.")

        if errors:
            for e in errors:
                flash(e)
            return rerender()

        tour = (garde_val == "oui")
        if tour and not mv:
            mv = "[b]RAS.[/b]"
        if not tour and not mv:
            mv = "Tour de garde non effectué (autres données fournies)."

        bb = bbcode_report(village, jour_de_jeu, mv, surv, flux, foreigners, acp, ag, villagers, moves)

        r = Report(
            report_date=jour_de_jeu,
            user_id=current_user.id,
            village=village,
            tour_de_garde=tour,
            mem_visions=mv,
            surveillance=surv,
            flux=flux,
            foreigners=foreigners,
            ac_presence=acp,
            armies_groups=ag,
            villagers=villagers,
            moves=moves,
            bbcode=bb
        )
        db.session.add(r)
        db.session.commit()

        date_str = jour_de_jeu.strftime("%d %B %Y") if jour_de_jeu else "Date inconnue"
        return render_template(
            "report_result.html",
            bbcode=bb,
            village=village,
            date=date_str
        )

    # GET : afficher le formulaire
    villages_traite_today = get_villages_traite_today()
    return render_template(
        "rapport.html",
        villages=villages,
        blocked=blocked,
        form=None,
        villages_traite_today=villages_traite_today,
        jour_de_jeu=jour_de_jeu
    )

@app.route("/rapport/<int:rapport_id>", methods=["GET"], endpoint="voir_rapport")
@login_required
def voir_rapport(rapport_id):
    rapport = Report.query.get_or_404(rapport_id)
    if current_user.role not in ["prevot", "marechal"]:
        abort(403)
    return render_template("rapport_lecture.html", rapport=rapport)

# ---------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
