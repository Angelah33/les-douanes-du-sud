const DOM = {};

function initDOM() {
  // Création
  DOM.createForm = document.getElementById("createForm");
  DOM.name = document.getElementById("name");
  DOM.primaryList = document.getElementById("primaryList");
  DOM.facts = document.getElementById("facts");
  DOM.isCrown = document.getElementById("isCrown");
  DOM.isPNG = document.getElementById("isPNG");
  DOM.orderSelect = document.getElementById("orderSelect");

  // Suppression par noms
  DOM.deleteForm = document.getElementById("deleteForm");
  DOM.deleteNames = document.getElementById("deleteNames");

  // Recherche/édition
  DOM.editSearchForm = document.getElementById("editSearchForm");
  DOM.editSearchInput = document.getElementById("editSearch");

  // Organisations (admin)
  DOM.orderForm = document.getElementById("orderForm");
  DOM.orderName = document.getElementById("orderName");
  DOM.orderShort = document.getElementById("orderShort");
  DOM.ordersTable = document.getElementById("ordersTable");
  DOM.ordersMembers = document.getElementById("ordersMembers");

  // Tables onglets
  DOM.tableNoire = document.getElementById("table-noire");
  DOM.tableSurveillance = document.getElementById("table-surveillance");
  DOM.tableHors = document.getElementById("table-hors");
  DOM.tableArchives = document.getElementById("table-archives");
  DOM.tableCouronne = document.getElementById("table-couronne");
  DOM.tablePNG = document.getElementById("table-png");
  DOM.tableOrders = document.getElementById("table-orders");

  // Tabs
  DOM.tabButtons = document.querySelectorAll(".tab");
  DOM.panes = {
    "principales": document.getElementById("tab-principales"),
    "couronne-png": document.getElementById("tab-couronne-png"),
    "organisations": document.getElementById("tab-organisations"),
  };

  // Modale
  DOM.modal = document.getElementById("modal");
  DOM.closeModal = document.getElementById("closeModal");
  DOM.editForm = document.getElementById("editForm");
  DOM.editId = document.getElementById("editId");
  DOM.editName = document.getElementById("editName");
  DOM.editFacts = document.getElementById("editFacts");
  DOM.editPrimary = document.getElementById("editPrimary");
  DOM.editCrown = document.getElementById("editCrown");
  DOM.editPNG = document.getElementById("editPNG");
  DOM.editOrder = document.getElementById("editOrder");
  DOM.deleteEntry = document.getElementById("deleteEntry");
  DOM.cancelEdit = document.getElementById("cancelEdit");

  // Message
  DOM.message = document.getElementById("message");
}

function bindEvents() {
  bindTabs();

  // Création brigand
  DOM.createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: DOM.name.value.trim(),
      list: DOM.primaryList.value || "",
      facts: DOM.facts.value.trim(),
      is_crown: DOM.isCrown.checked,
      is_png: DOM.isPNG.checked,
      order_id: DOM.orderSelect.value || null,
    };

    if (!payload.name) {
      DOM.message.innerHTML = `<div class="error">Le nom IG est requis.</div>`;
      return;
    }

    try {
      await apiCreateBrigand(payload);
      DOM.createForm.reset();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigand ajouté !</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Recherche brigand à modifier
  const searchBtn = DOM.editSearchForm?.querySelector("button");
  searchBtn?.addEventListener("click", () => {
    const name = DOM.editSearchInput.value.trim();
    if (!name) return;
    const found = window.allBrigands.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (!found) {
      DOM.message.innerHTML = `<div class="error">Aucun brigand trouvé.</div>`;
      return;
    }
    openEdit(found.id);
  });

  // Soumission modale édition
  DOM.editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      id: DOM.editId.value,
      name: DOM.editName.value.trim(),
      list: DOM.editPrimary.value || "",
      facts: DOM.editFacts.value.trim(),
      is_crown: DOM.editCrown.checked,
      is_png: DOM.editPNG.checked,
      order_id: DOM.editOrder.value || null,
    };

    if (!payload.name) {
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
  DOM.deleteEntry?.addEventListener("click", async () => {
    const id = DOM.editId.value;
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
  DOM.cancelEdit?.addEventListener("click", () => {
    closeModal();
  });

  // Suppression multiple
  DOM.deleteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = DOM.deleteNames.value.trim();
    if (!raw) return;
    const names = raw.split(";").map(n => n.trim()).filter(n => n);
    try {
      const res = await apiDeleteBrigands(names);
      DOM.deleteForm.reset();
      await reloadAll();
      DOM.message.innerHTML = `<div class="success">Brigands supprimés: ${(res.deleted || []).join(", ")}</div>`;
      setTimeout(() => { DOM.message.innerHTML = ""; }, 5000);
    } catch (err) {
      DOM.message.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });

  // Ajout organisation
  DOM.orderForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nom_complet: DOM.orderName.value.trim(),
      nom_abrege: DOM.orderShort.value.trim(),
    };
    if (!payload.nom_complet) return;
    try {
      await apiCreateOrder(payload);
      DOM.orderForm.reset();
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
  DOM.closeModal?.addEventListener("click", () => {
    closeModal();
  });
}

function openEdit(id) {
  const b = window.allBrigands.find(b => b.id === id);
  if (!b) return;
  DOM.editId.value = b.id;
  DOM.editName.value = b.name || "";
  DOM.editFacts.value = b.facts || "";
  DOM.editPrimary.value = b.list || "";
  DOM.editOrder.value = b.order || "";
  DOM.editCrown.checked = b.is_crown || false;
  DOM.editPNG.checked = b.is_png || false;
  DOM.modal.classList.remove("hidden");
  DOM.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  DOM.modal.classList.add("hidden");
  DOM.modal.setAttribute("aria-hidden", "true");
  DOM.editForm.reset();
}

async function reloadAll() {
  const [brigands, orders] = await Promise.all([
    apiGetBrigands(),
    apiGetOrders(),
  ]);

  window.allBrigands = brigands;

  // Détection des brigands invalides
  const brigandsInvalides = brigands.filter(b =>
    !b.name || !b.list || b.list.trim() === ""
  );

  if (brigandsInvalides.length > 0) {
    console.warn("⚠️ Brigands invalides détectés :", brigandsInvalides.map(b => b.name));
    DOM.message.innerHTML = `
      <div class="error">
        ⚠️ ${brigandsInvalides.length} brigand(s) mal renseigné(s) détecté(s).<br>
        Consultez la console pour les noms.<br>
        Supprimez-les via la modale une fois la page réparée.
      </div>
    `;
  }

  // Affichage des onglets et formulaires
  renderTabs(brigands, orders);
  renderFormCreate(brigands, orders);
  renderFormEdit(brigands, orders);
  renderFormDelete(brigands);
}

// Affiche les brigands dans les onglets dynamiques
function renderTabs(brigands, orders) {
  // Listes principales
  DOM.tableNoire.innerHTML = renderList(brigands.filter(b => b.list === "noire"));
  DOM.tableSurveillance.innerHTML = renderList(brigands.filter(b => b.list === "surveillance"));
  DOM.tableHors.innerHTML = renderList(brigands.filter(b => b.list === "hors"));
  DOM.tableArchives.innerHTML = renderList(brigands.filter(b => b.list === "archives"));

  // Couronne & PNG
  DOM.tableCouronne.innerHTML = renderList(brigands.filter(b => b.is_crown));
  DOM.tablePNG.innerHTML = renderList(brigands.filter(b => b.is_png));

  // Organisations brigandes
  DOM.tableOrders.innerHTML = renderOrders(orders);
}

// Remplit le menu déroulant dans le formulaire de création
function renderFormCreate(brigands, orders) {
  DOM.orderSelect.innerHTML = `<option value="">Aucune</option>` +
    orders.map(o => `<option value="${o.id}">${o.nom_complet}</option>`).join("");
}

// Remplit le menu déroulant dans la modale d’édition
function renderFormEdit(brigands, orders) {
  DOM.editOrder.innerHTML = `<option value="">Aucune</option>` +
    orders.map(o => `<option value="${o.id}">${o.nom_complet}</option>`).join("");
}

// Affiche les noms disponibles en suggestion pour suppression
function renderFormDelete(brigands) {
  const names = brigands.map(b => b.name).filter(Boolean);
  if (names.length) {
    DOM.deleteNames.placeholder = `Ex: ${names.slice(0, 3).join(";")}`;
  }
}

// Utilitaire : affiche une liste de brigands
function renderList(arr) {
  if (!arr.length) return "<em>Aucun brigand</em>";
  return `<ul>${arr.map(b => `<li>${b.name}</li>`).join("")}</ul>`;
}

// Utilitaire : affiche une liste d’organisations
function renderOrders(arr) {
  if (!arr.length) return "<em>Aucune organisation</em>";
  return `<ul>${arr.map(o => `<li>${o.nom_complet} (${o.nom_abrege || "-"})</li>`).join("")}</ul>`;
}
