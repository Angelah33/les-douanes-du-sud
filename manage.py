import click
from app import db, User, Village, app

@click.group()
def cli(): pass

@cli.command("initdb")
def initdb():
    with app.app_context(): db.create_all(); print("DB initialisée.")

@cli.command("create-superadmin")
@click.argument("username")
@click.argument("password")
def create_superadmin(username,password):
    from app import User,db
    with app.app_context():
        u=User.query.filter_by(username=username).first()
        if u: print("Existe déjà."); return
        u=User(username=username,role="superadmin")
        u.set_password(password)
        db.session.add(u); db.session.commit(); print("Super-admin créé.")

@cli.command("add-villages")
@click.argument("villages")
def add_villages(villages):
    names=[v.strip() for v in villages.split(";") if v.strip()]
    from app import Village,db
    with app.app_context():
        for n in names:
            if not Village.query.filter_by(name=n).first():
                db.session.add(Village(name=n))
        db.session.commit(); print("Villages ajoutés:",", ".join(names))

if __name__=="__main__": cli()
