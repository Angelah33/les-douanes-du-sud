const DOM = {};

async function apiGetBrigands() {
  const res = await fetch("/api/brigands");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors du chargement des brigands");
  return json;
}

async function apiGetOrganisations() {
  const res = await fetch("/api/organisations");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors du chargement des organisations");
  return json;
}

async function apiCreateOrganisation(data) {
  const res = await fetch("/api/organisations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors de la création");
  return json;
}

function initDOM() {
  // Création
  DOM.formulaireCreation = document.getElementById("formulaireCreation");
  DOM.nomIG = document.getElementById("nomIG");
  DOM.listePrincipale = document.getElementById("listePrincipale");
  DOM.faitsReproches = document.getElementById("faitsReproches");
  DOM.rechercheCouronne = document.getElementById("rechercheCouronne");
  DOM.estPNG = document.getElementById("estPNG");
  DOM.organisationSelect = document.getElementById("organisationSelect");

  // Suppression par noms
  DOM.formulaireSuppression = document.getElementById("formulaireSuppression");
  DOM.nomsSuppression = document.getElementById("nomsSuppression");

  // Recherche/édition
  DOM.formulaireRecherche = document.getElementById("formulaireRecherche");
  DOM.rechercheNom = document.getElementById("rechercheNom");

  // Organisations (admin)
  DOM.formulaireOrganisation = document.getElementById("formulaireOrganisation");
  DOM.nomCompletOrganisation = document.getElementById("nomCompletOrganisation");
  DOM.nomAbregeOrganisation = document.getElementById("nomAbregeOrganisation");
  DOM.tableOrganisationsAjoutees = document.getElementById("table-organisations-ajoutees");
  DOM.organisationsMembres = document.getElementById("organisations-membres");

  // Tables onglets
  DOM.tableNoire = document.getElementById("table-noire");
  DOM.tableSurveillance = document.getElementById("table-surveillance");
  DOM.tableHors = document.getElementById("table-hors");
  DOM.tableArchives = document.getElementById("table-archives");
  DOM.tableCouronne = document.getElementById("table-couronne");
  DOM.tablePNG = document.getElementById("table-png");
  DOM.tableOrganisations = document.getElementById("table-organisations");

  // Tabs
  DOM.tabButtons = document.querySelectorAll(".tab");
  DOM.panes = {
    "principales": document.getElementById("tab-principales"),
    "couronne-png": document.getElementById("tab-couronne-png"),
    "organisations": document.getElementById("tab-organisations"),
  };

  // Modale
  DOM.modaleEdition = document.getElementById("modaleEdition");
  DOM.fermerModale = document.getElementById("fermerModale");
  DOM.formulaireEdition = document.getElementById("formulaireEdition");
  DOM.identifiantBrigand = document.getElementById("identifiantBrigand");
  DOM.nomBrigandEdition = document.getElementById("nomBrigandEdition");
  DOM.faitsEdition = document.getElementById("faitsEdition");
  DOM.listePrincipaleEdition = document.getElementById("listePrincipaleEdition");
  DOM.rechercheCouronneEdition = document.getElementById("rechercheCouronneEdition");
  DOM.estPNGEdition = document.getElementById("estPNGEdition");
  DOM.organisationEdition = document.getElementById("organisationEdition");
  DOM.supprimerEntree = document.getElementById("supprimerEntree");
  DOM.annulerEdition = document.getElementById("annulerEdition");

  // Message
  DOM.message = document.getElementById("message");
}

function bindTabs() {
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      Object.values(DOM.panes).forEach(p => p.classList.remove("active"));
      DOM.panes[btn.dataset.tab]?.classList.add("active");
    });
  });
}

function bindEvents() {
  bindTabs();

  // Création brigand
  DOM.formulaireCreation?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nom: DOM.nomIG.value.trim(),
      liste: DOM.listePrincipale.value || "",
      faits: DOM.faitsReproches.value.trim(),
      recherche_couronne: DOM.rechercheCouronne.checked,
      est_png: DOM.estPNG.checked,
      organisation_id: DOM.organisationSelect.value || null,
    };

    if (!payload.nom) {
      DOM.message.innerHTML = `<div class="error">Le nom IG est requis.</div>`;
      return;
    }

    try {
      await apiCreateBrigand(payload);
      DOM.formulaireCreation.reset();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigand ajouté !</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Recherche brigand à modifier
  const searchBtn = DOM.formulaireRecherche?.querySelector("button");
  searchBtn?.addEventListener("click", () => {
    const nom = DOM.rechercheNom.value.trim();
    if (!nom) return;
    const found = window.allBrigands.find(b => b.nom.toLowerCase() === nom.toLowerCase());
    if (!found) {
      DOM.message.innerHTML = `<div class="error">Aucun brigand trouvé.</div>`;
      return;
    }
    openEdit(found.id);
  });

  // Soumission modale édition
  DOM.formulaireEdition?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      id: DOM.identifiantBrigand.value,
      nom: DOM.nomBrigandEdition.value.trim(),
      liste: DOM.listePrincipaleEdition.value || "",
      faits: DOM.faitsEdition.value.trim(),
      recherche_couronne: DOM.rechercheCouronneEdition.checked,
      est_png: DOM.estPNGEdition.checked,
      organisation_id: DOM.organisationEdition.value || null,
    };

    if (!payload.nom) {
      DOM.message.innerHTML = `<div class="error">Le nom IG est requis.</div>`;
      return;
    }

    try {
      await apiUpdateBrigand(payload);
      closeModal();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigand modifié !</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Suppression depuis modale
  DOM.supprimerEntree?.addEventListener("click", async () => {
    const id = DOM.identifiantBrigand.value;
    if (!id) return;
    try {
      await apiDeleteBrigand(id);
      closeModal();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigand supprimé !</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Annuler modale
  DOM.annulerEdition?.addEventListener("click", () => {
    closeModal();
  });

  // Suppression multiple
  DOM.formulaireSuppression?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = DOM.nomsSuppression.value.trim();
    if (!raw) return;
    const noms = raw.split(";").map(n => n.trim()).filter(n => n);
    try {
      const res = await apiDeleteBrigands(noms);
      DOM.formulaireSuppression.reset();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigands supprimés: ${(res.deleted || []).join(", ")}</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Ajout organisation
  DOM.formulaireOrganisation?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nom_complet: DOM.nomCompletOrganisation.value.trim(),
      nom_abrege: DOM.nomAbregeOrganisation.value.trim(),
    };
    if (!payload.nom_complet) return;
    try {
      await apiCreateOrganisation(payload);
      DOM.formulaireOrganisation.reset();
      await reloadAll();
    } catch (err) {
      console.error(err);
    }
  });

  // Onglets
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      Object.values(DOM.panes).forEach(p => p.classList.remove("active"));
      DOM.panes[btn.dataset.tab]?.classList.add("active");
    });
  });

  // Fermer modale
  DOM.fermerModale?.addEventListener("click", () => {
    closeModal();
  });
}

function openEdit(id) {
  const b = window.allBrigands.find(b => b.id === id);
  if (!b) return;
  DOM.identifiantBrigand.value = b.id;
  DOM.nomBrigandEdition.value = b.nom || "";
  DOM.faitsEdition.value = b.faits || "";
  DOM.listePrincipaleEdition.value = b.liste || "";
  DOM.organisationEdition.value = b.organisation_id || "";
  DOM.rechercheCouronneEdition.checked = b.recherche_couronne || false;
  DOM.estPNGEdition.checked = b.est_png || false;
  DOM.modaleEdition.classList.remove("hidden");
  DOM.modaleEdition.setAttribute("aria-hidden", "false");
}

function closeModal() {
  DOM.modaleEdition.classList.add("hidden");
  DOM.modaleEdition.setAttribute("aria-hidden", "true");
  DOM.formulaireEdition.reset();
}

async function reloadAll() {
  const [brigands, organisations] = await Promise.all([
    apiGetBrigands(),
    apiGetOrganisations(),
  ]);

  window.allBrigands = brigands;

  // Détection des brigands invalides
  const brigandsInvalides = brigands.filter(b =>
    !b.nom || !b.liste || b.liste.trim() === ""
  );

  if (brigandsInvalides.length > 0) {
    console.warn("⚠️ Brigands invalides détectés :", brigandsInvalides.map(b => b.nom));
    DOM.message.innerHTML = `
      <div class="error">
        ⚠️ ${brigandsInvalides.length} brigand(s) mal renseigné(s) détecté(s).<br>
        Consultez la console pour les noms.<br>
        Supprimez-les via la modale une fois la page réparée.
      </div>
    `;
  }

  // Affichage des onglets et formulaires
  renderTabs(brigands, organisations);
  renderFormCreate(organisations);
  renderFormEdit(organisations);
  renderFormDelete(brigands);
}

// Affiche les brigands dans les onglets dynamiques
function renderTabs(brigands, organisations) {
  // Listes principales
  DOM.tableNoire.innerHTML = renderList(brigands.filter(b => b.liste === "noire"));
  DOM.tableSurveillance.innerHTML = renderList(brigands.filter(b => b.liste === "surveillance"));
  DOM.tableHors.innerHTML = renderList(brigands.filter(b => b.liste === "hors"));
  DOM.tableArchives.innerHTML = renderList(brigands.filter(b => b.liste === "archives"));

  // Couronne & PNG
  DOM.tableCouronne.innerHTML = renderList(brigands.filter(b => b.recherche_couronne));
  DOM.tablePNG.innerHTML = renderList(brigands.filter(b => b.est_png));

  // Organisations brigandes
  DOM.tableOrganisations.innerHTML = renderOrganisations(organisations);
}

// Remplit le menu déroulant dans le formulaire de création
function renderFormCreate(organisations) {
  DOM.organisationSelect.innerHTML = `<option value="">Aucune</option>` +
    organisations.map(o => `<option value="${o.id}">${o.nom_complet}</option>`).join("");
}

// Remplit le menu déroulant dans la modale d’édition
function renderFormEdit(organisations) {
  DOM.organisationEdition.innerHTML = `<option value="">Aucune</option>` +
    organisations.map(o => `<option value="${o.id}">${o.nom_complet}</option>`).join("");
}

// Affiche les noms disponibles en suggestion pour suppression
function renderFormDelete(brigands) {
  const noms = brigands.map(b => b.nom).filter(Boolean);
  if (noms.length) {
    DOM.nomsSuppression.placeholder = `Ex: ${noms.slice(0, 3).join(";")}`;
  }
}

// Utilitaire : affiche une liste de brigands
function renderList(arr) {
  if (!arr.length) return "<em>Aucun brigand</em>";
  return `<ul>${arr.map(b => `<li>${b.nom}</li>`).join("")}</ul>`;
}

// Utilitaire : affiche une liste d’organisations
function renderOrganisations(arr) {
  if (!arr.length) return "<em>Aucune organisation</em>";
  return `<ul>${arr.map(o => `<li>${o.nom_complet} (${o.nom_abrege || "-"})</li>`).join("")}</ul>`;
}

async function apiCreateBrigand(data) {
  const res = await fetch("/api/brigands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors de la création");
  return json;
}

async function apiUpdateBrigand(data) {
  const id = data.id;
  const res = await fetch(`/api/brigands/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors de la modification");
  return json;
}

async function apiDeleteBrigand(id) {
  const res = await fetch(`/api/brigands/${id}`, {
    method: "DELETE"
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors de la suppression");
  return json;
}

async function apiDeleteBrigands(noms) {
  const res = await fetch("/api/brigands/delete-by-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noms })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur lors de la suppression multiple");
  return json;
}

document.addEventListener("DOMContentLoaded", async () => {
  initDOM();
  bindEvents();
  await reloadAll();
});
