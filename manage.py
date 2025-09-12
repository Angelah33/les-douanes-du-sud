import click
from app import app

@click.group()
def cli():
    pass

@cli.command("init-db")
def init_db():
    print("Initialisation de la base de données... (placeholder)")

if __name__ == "__main__":
    cli()
