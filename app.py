from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os, pytz
from datetime import datetime, timedelta, time, date

def pg_uri(uri: str) -> str:
    return uri.replace("postgresql://", "postgresql+psycopg2://")

app = Flask(__name__)
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

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="marechal")
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

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

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def parse_hhmm(s): h,m = s.split(":"); return time(int(h),int(m))
def is_blocked_now():
    now = datetime.now(TZ).time()
    start,end = parse_hhmm(BLOCK_FROM), parse_hhmm(BLOCK_TO)
    return start <= now < end if start<end else (now>=start or now<end)
def count_lines(txt): return len([ln for ln in (txt or "").splitlines() if ln.strip()])

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

@app.context_processor
def inject_globals():
    return dict(SITE_NAME=SITE_NAME, UI_BG_COLOR=UI_BG_COLOR, UI_TEXT_COLOR=UI_TEXT_COLOR,
                REPORT_TITLE_COLOR=REPORT_TITLE_COLOR, BUREAU_NAME=BUREAU_NAME, BUREAU_LOGO_URL=BUREAU_LOGO_URL)

@app.route("/")
def home(): return render_template("home.html")

@app.route("/login",methods=["GET","POST"])
def login():
    if request.method=="POST":
        u=request.form.get("username"); p=request.form.get("password"); remember=True if request.form.get("remember")=="on" else False
        user=User.query.filter_by(username=u).first()
        if not user or not user.check_password(p):
            flash("Identifiants incorrects."); return render_template("login.html")
        login_user(user,remember=remember); return redirect(url_for("rapport"))
    return render_template("login.html")

@app.route("/logout"); @login_required
def logout(): logout_user(); return redirect(url_for("home"))

@app.route("/rapport",methods=["GET","POST"]); @login_required
def rapport():
    villages=[v.name for v in Village.query.order_by(Village.name.asc()).all()]; blocked=is_blocked_now()
    if request.method=="POST":
        if blocked: flash("Dépôt bloqué."); return render_template("rapport.html",villages=villages,blocked=blocked)
        village=request.form.get("village"); 
        if not village: flash("Choisissez un village."); return render_template("rapport.html",villages=villages,blocked=blocked)
        tour=request.form.get("tour_de_garde")=="oui"
        mv=request.form.get("mem_visions","").strip(); 
        if tour and not mv: mv="[b]RAS.[/b]"
        if not tour and not mv: mv="Tour de garde non effectué (autres données fournies)."
        surv=request.form.get("surveillance",""); flux=request.form.get("flux","")
        foreigners=request.form.get("foreigners",""); acp=request.form.get("ac_presence","")
        ag=request.form.get("armies_groups",""); villagers=request.form.get("villagers",""); moves=request.form.get("moves","")
        today=date.today(); bb=bbcode_report(village,today,mv,surv,flux,foreigners,acp,ag,villagers,moves)
        r=Report(report_date=today,user_id=current_user.id,village=village,tour_de_garde=tour,mem_visions=mv,surveillance=surv,flux=flux,foreigners=foreigners,ac_presence=acp,armies_groups=ag,villagers=villagers,moves=moves,bbcode=bb)
        db.session.add(r); db.session.commit(); return render_template("report_result.html",bbcode=bb,village=village,date=today.strftime("%d %B %Y"))
    return render_template("rapport.html",villages=villages,blocked=blocked)

if __name__=="__main__": app.run(host="0.0.0.0",port=5000)
