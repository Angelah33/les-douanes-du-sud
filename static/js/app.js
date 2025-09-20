// =========== Constantes et etat global ===========

const PAGE_SIZE = 50;

const PRIMARY_LABELS = {
  noire: "Liste noire",
  surveillance: "Liste de surveillance",
  hors: "Liste noire hors A&C",
  archives: "Archives",
};

let brigands = [];        // [{id, name, list, facts, is_crown, is_png, order}]
let organisations = [];   // [{id, nom_complet, nom_abrege}]

const pagers = {
  noire: 1,
  surveillance: 1,
  hors: 1,
  archives: 1,
  couronne: 1,
  png: 1,
  orderMembers: {} // {orgId: currentPage}
};

// =========== Utils ===========

function byName(a, b) {
  return (a.name || "").localeCompare((b.name || ""), "fr", { sensitivity: "base" });
}

function escapeText(s) {
  return (s ?? "")
    .replace(/\[b.*?\]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\n/g, " ");
}

function getOrgById(id) {
  if (!id) return null;
  return organisations.find(o => String(o.id) === String(id)) || null;
}

function formatReportLine(entry) {
  // Couleurs (optionnel dans l’aperçu)
  const COLOR_MAP = {
    couronne: "darkorange",
    noire: "red",
    surveillance: "darkred",
    hors: "crimson",
  };

  let color = null;
  if (entry.is_crown) color = COLOR_MAP.couronne;
  else if (entry.list === "noire") color = COLOR_MAP.noire;
  else if (entry.list === "surveillance") color = COLOR_MAP.surveillance;
  else if (entry.list === "hors") color = COLOR_MAP.hors;

  const nameBB = color ? `[color=${color}]${escapeText(entry.name)}[/color]` : escapeText(entry.name);

  const org = getOrgById(entry.order);
  const mentions = [];
  if (entry.is_crown) mentions.push("Recherché par la couronne de France");
  if (entry.is_png) mentions.push("[color=indigo]PNG[/color]");
  if (org?.nom_abrege) mentions.push(org.nom_abrege);

  const facts = entry.facts ? escapeText(entry.facts) : "";

  const parts = [nameBB];
  if (mentions.length) parts.push(mentions.join(" - "));
  if (facts) parts.push(facts);
  return parts.join(" - ");
}

// =========== DOM ===========

const DOM = {};
function initDOM() {
  // Creation
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

  // Tabs (3 boutons)
  DOM.tabButtons = document.querySelectorAll(".tab");
  DOM.panes = {
    "principales": document.getElementById("tab-principales"),
    "couronne-png": document.getElementById("tab-couronne-png"),
    "organisations": document.getElementById("tab-organisations"),
  };

  // Modal
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
}

// =========== API helpers ===========

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Erreur HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function normalizeOrderValue(raw) {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v || v === "aucun" || v === "none" || v === "null") return null;
  return raw;
}

// Brigands
async function apiGetBrigands() {
  return fetchJSON("/api/brigands");
}
async function apiCreateBrigand(b) {
  return fetchJSON("/api/brigands", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(b),
  });
}
async function apiUpdateBrigand(id, b) {
  return fetchJSON(`/api/brigands/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(b),
  });
}
async function apiDeleteBrigand(id) {
  return fetchJSON(`/api/brigands/${id}`, { method: "DELETE" });
}
async function apiDeleteByNames(names) {
  return fetchJSON("/api/brigands/delete-by-name", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ names }),
  });
}

// Organisations
async function apiGetOrgs() {
  return fetchJSON("/api/organisations");
}
async function apiCreateOrg(nom_complet, nom_abrege) {
  return fetchJSON("/api/organisations", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ nom_complet, nom_abrege }),
  });
}
async function apiDeleteOrg(id) {
  return fetchJSON(`/api/organisations/${id}`, { method: "DELETE" });
}

// =========== Chargement initial ===========

async function reloadAll() {
  const [orgs, brigs] = await Promise.all([apiGetOrgs(), apiGetBrigands()]);
  organisations = Array.isArray(orgs) ? orgs : [];
  brigands = Array.isArray(brigs) ? brigs : [];
  renderAll();
}

function renderAll() {
  renderOrderSelects();
  renderPrincipales();
  renderCouronnePNG();
  renderOrgsTab();
  renderOrdersAdminTable();
  renderOrderMembers();
}

// =========== Onglets ===========

function bindTabs() {
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".tab.active")?.classList.remove("active");
      btn.classList.add("active");
      const key = btn.dataset.tab;

      Object.values(DOM.panes).forEach(p => p.classList.remove("active"));
      const pane = DOM.panes[key];
      if (pane) pane.classList.add("active");
    });
  });
}

// =========== Rendus ===========

function renderOrderSelects() {
  const options = [`<option value="">Aucun</option>`]
    .concat(
      organisations.map(o => {
        const label = o.nom_abrege ? `${o.nom_complet} (${o.nom_abrege})` : o.nom_complet;
        return `<option value="${o.id}">${label}</option>`;
      })
    ).join("");

  if (DOM.orderSelect) DOM.orderSelect.innerHTML = options;
  if (DOM.editOrder) DOM.editOrder.innerHTML = options;
}

function dataPrimary(primary) {
  return brigands.filter(b => b.list === primary).sort(byName);
}

function pagerHTML(key, page, total) {
  return `
    <div class="pager" data-key="${key}">
      <button class="page" data-dir="-1" ${page <= 1 ? "disabled" : ""}>◀</button>
      <span class="badge">Page ${page}/${total}</span>
      <button class="page" data-dir="1" ${page >= total ? "disabled" : ""}>▶</button>
    </div>
  `;
}

function bindPager(key, mount) {
  const pager = mount.querySelector(`.pager[data-key="${key}"]`);
  if (!pager) return;
  pager.querySelectorAll(".page").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = parseInt(btn.dataset.dir, 10);
      const arr = getDatasetForKey(key);
      const total = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
      pagers[key] = Math.min(Math.max(1, (pagers[key] || 1) + dir), total);
      if (["noire","surveillance","hors","archives"].includes(key)) renderPrincipales();
      else renderCouronnePNG();
    });
  });
}

function getDatasetForKey(key) {
  if (key === "couronne") return brigands.filter(b => b.is_crown).sort(byName);
  if (key === "png") return brigands.filter(b => b.is_png).sort(byName);
  return dataPrimary(key);
}

function rowPrimaryHTML(r) {
  const org = getOrgById(r.order);
  const mentions = [
    r.is_crown ? '<span class="tag orange">Couronne</span>' : "",
    r.is_png ? '<span class="tag indigo">PNG</span>' : "",
    org?.nom_abrege ? `<span class="tag">${escapeText(org.nom_abrege)}</span>` : "",
  ].filter(Boolean).join(" ");

  return `
    <tr data-id="${r.id}">
      <td>${escapeText(r.name)}</td>
      <td>${escapeText(r.facts || "")}</td>
      <td>${mentions || '<span class="badge">—</span>'}</td>
      <td><code>${formatReportLine(r)}</code></td>
      <td class="row-actions">
        <button class="btn small" data-action="edit">Modifier</button>
        <button class="btn small danger" data-action="delete">Supprimer</button>
      </td>
    </tr>
  `;
}

function renderTablePrimary(primary, mount) {
  if (!mount) return;
  const data = dataPrimary(primary);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  pagers[primary] = Math.min(pagers[primary] || 1, totalPages);
  const page = pagers[primary];
  const start = (page - 1) * PAGE_SIZE;
  const rows = data.slice(start, start + PAGE_SIZE);

  mount.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Faits reprochés</th>
          <th>Mentions</th>
          <th>BBCode (aperçu)</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(rowPrimaryHTML).join("") || `<tr><td colspan="5">Aucune entrée</td></tr>`}
      </tbody>
    </table>
    ${pagerHTML(primary, page, totalPages)}
  `;

  bindPager(primary, mount);
  bindRowActions(mount);
}

function renderPrincipales() {
  renderTablePrimary("noire", DOM.tableNoire);
  renderTablePrimary("surveillance", DOM.tableSurveillance);
  renderTablePrimary("hors", DOM.tableHors);
  renderTablePrimary("archives", DOM.tableArchives);
}

function renderNamesOnlyTable(key, arr, mount) {
  if (!mount) return;
  const totalPages = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
  pagers[key] = Math.min(pagers[key] || 1, totalPages);
  const page = pagers[key];
  const start = (page - 1) * PAGE_SIZE;
  const rows = arr.slice(start, start + PAGE_SIZE);

  mount.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr data-id="${r.id}">
            <td>${escapeText(r.name)}</td>
            <td class="row-actions">
              <button class="btn small" data-action="edit">Modifier</button>
              <button class="btn small danger" data-action="delete">Supprimer</button>
            </td>
          </tr>
        `).join("") || `<tr><td colspan="2">Aucune entrée</td></tr>`}
      </tbody>
    </table>
    ${pagerHTML(key, page, totalPages)}
  `;

  bindPager(key, mount);
  bindRowActions(mount);
}

function renderCouronnePNG() {
  const crown = brigands.filter(b => b.is_crown).sort(byName);
  const png = brigands.filter(b => b.is_png).sort(byName);
  renderNamesOnlyTable("couronne", crown, DOM.tableCouronne);
  renderNamesOnlyTable("png", png, DOM.tablePNG);
}

function renderOrgsTab() {
  if (!DOM.tableOrders) return;
  const withOrg = brigands.filter(b => b.order).sort(byName);
  DOM.tableOrders.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Organisation</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${withOrg.map(b => {
          const org = getOrgById(b.order);
          const label = org ? (org.nom_abrege || org.nom_complet) : "—";
          return `
            <tr data-id="${b.id}">
              <td>${escapeText(b.name)}</td>
              <td>${escapeText(label)}</td>
              <td class="row-actions">
                <button class="btn small" data-action="edit">Modifier</button>
                <button class="btn small danger" data-action="delete">Supprimer</button>
              </td>
            </tr>
          `;
        }).join("") || `<tr><td colspan="3">Aucune entrée</td></tr>`}
      </tbody>
    </table>
  `;
  bindRowActions(DOM.tableOrders);
}

function renderOrdersAdminTable() {
  if (!DOM.ordersTable) return;
  DOM.ordersTable.innerHTML = `
    <table class="table">
      <thead><tr><th>Nom complet</th><th>Abrégé</th><th>Actions</th></tr></thead>
      <tbody>
        ${organisations.map(o => `
          <tr data-oid="${o.id}">
            <td>${escapeText(o.nom_complet)}</td>
            <td>${escapeText(o.nom_abrege || "")}</td>
            <td class="row-actions">
              <button class="btn small danger" data-action="del-org">Supprimer</button>
            </td>
          </tr>
        `).join("") || `<tr><td colspan="3">Aucune organisation</td></tr>`}
      </tbody>
    </table>
  `;

  DOM.ordersTable.querySelectorAll('[data-action="del-org"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const oid = tr.dataset.oid;
      const used = brigands.some(b => String(b.order) === String(oid));
      if (used) {
        alert("Impossible: des brigands sont encore rattachés à cette organisation.");
        return;
      }
      if (!confirm("Supprimer cette organisation ?")) return;
      try {
        await apiDeleteOrg(oid);
        await reloadAll();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

function renderOrderMembers() {
  if (!DOM.ordersMembers) return;
  let html = "";
  organisations.forEach(o => {
    const members = brigands.filter(b => String(b.order) === String(o.id)).sort(byName);
    const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
    if (!pagers.orderMembers[o.id]) pagers.orderMembers[o.id] = 1;
    pagers.orderMembers[o.id] = Math.min(pagers.orderMembers[o.id], totalPages);
    const page = pagers.orderMembers[o.id];
    const start = (page - 1) * PAGE_SIZE;
    const rows = members.slice(start, start + PAGE_SIZE);

    html += `
      <div class="card">
        <h5>${escapeText(o.nom_complet)} ${o.nom_abrege ? `<span class="badge">${escapeText(o.nom_abrege)}</span>` : ""}</h5>
        <table class="table">
          <thead><tr><th>Nom</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr data-id="${r.id}">
                <td>${escapeText(r.name)}</td>
                <td class="row-actions">
                  <button class="btn small" data-action="edit">Modifier</button>
                  <button class="btn small danger" data-action="delete">Supprimer</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="2">Aucun membre</td></tr>`}
          </tbody>
        </table>
        <div class="pager">
          <button class="page" data-omp="${o.id}" data-dir="-1">◀</button>
          <span class="badge">Page ${page}/${totalPages}</span>
          <button class="page" data-omp="${o.id}" data-dir="1">▶</button>
        </div>
      </div>
    `;
  });
  DOM.ordersMembers.innerHTML = html;

  // Pager par organisation
  DOM.ordersMembers.querySelectorAll(".pager .page").forEach(btn => {
    btn.addEventListener("click", () => {
      const oid = btn.dataset.omp;
      const dir = parseInt(btn.dataset.dir, 10);
      const members = brigands.filter(b => String(b.order) === String(oid));
      const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
      pagers.orderMembers[oid] = Math.min(Math.max(1, (pagers.orderMembers[oid] || 1) + dir), totalPages);
      renderOrderMembers();
    });
  });

  bindRowActions(DOM.ordersMembers);
}

// =========== Actions ligne ===========

function bindRowActions(scope) {
  scope.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      openEdit(id);
    });
  });
  scope.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      if (!confirm("Supprimer ce brigand ?")) return;
      try {
        await apiDeleteBrigand(id);
        await reloadAll();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

// =========== Modal édition ===========

function openEdit(id) {
  const b = brigands.find(x => String(x.id) === String(id));
  if (!b) return;
  DOM.editId.value = b.id;
  DOM.editName.value = b.name || "";
  DOM.editFacts.value = b.facts || "";
  DOM.editPrimary.value = b.list || "";
  DOM.editCrown.checked = !!b.is_crown;
  DOM.editPNG.checked = !!b.is_png;
  DOM.editOrder.value = b.order || "";
  showModal();
}

function showModal() {
  DOM.modal.classList.remove("hidden");
  DOM.modal.setAttribute("aria-hidden", "false");
}
function hideModal() {
  DOM.modal.classList.add("hidden");
  DOM.modal.setAttribute("aria-hidden", "true");
}

// =========== Événements ===========

function bindEvents() {
  // Tabs
  bindTabs();

  // Creation brigand
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
    if (!payload.name) return alert("Le nom IG est requis.");
    try {
      await apiCreateBrigand(payload);
      DOM.createForm.reset();
      await reloadAll();
      alert("Brigand ajouté !");
    } catch (err) {
      alert(err.message);
    }
  });

  // Suppression par noms
  DOM.deleteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = (DOM.deleteNames.value || "").trim();
    const names = raw.split("\n").map(s => s.trim()).filter(Boolean);
    if (!names.length) return alert("Aucun nom valide.");
    try {
      const res = await apiDeleteByNames(names);
      await reloadAll();
      DOM.deleteNames.value = "";
      alert(`Brigands supprimés: ${(res.deleted || []).join(", ")}`);
    } catch (err) {
      alert(err.message);
    }
  });

  // Recherche (ouvre le modal sur le premier match)
  if (DOM.editSearchForm) {
    const searchBtn = DOM.editSearchForm.querySelector("button");
    searchBtn?.addEventListener("click", () => {
      const q = (DOM.editSearchInput?.value || "").trim().toLowerCase();
      if (!q) return;
      const match = brigands.find(b => (b.name || "").toLowerCase() === q) ||
                    brigands.find(b => (b.name || "").toLowerCase().includes(q));
      if (!match) return alert("Aucun brigand trouvé.");
      openEdit(match.id);
    });
  }
}  

// =========== Modal ===========

// Fermeture du modal
DOM.closeModal?.addEventListener("click", hideModal);
DOM.cancelEdit?.addEventListener("click", hideModal);
DOM.modal?.addEventListener("click", (e) => {
  if (e.target === DOM.modal) hideModal();
});

// Soumission du formulaire d’edition
DOM.editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = DOM.editId.value;
  const payload = {
    name: DOM.editName.value.trim(),
    list: DOM.editPrimary.value || "",
    facts: DOM.editFacts.value.trim(),
    is_crown: DOM.editCrown.checked,
    is_png: DOM.editPNG.checked,
    order_id: DOM.editOrder.value || null,
  };
  if (!payload.name) return alert("Le nom IG est requis.");
  try {
    await apiUpdateBrigand(id, payload);
    hideModal();
    await reloadAll();
    alert("Brigand modifié !");
  } catch (err) {
    alert(err.message);
  }
});

// Suppression depuis le modal
DOM.deleteEntry?.addEventListener("click", async () => {
  const id = DOM.editId.value;
  if (!id) return;
  if (!confirm("Supprimer ce brigand ?")) return;
  try {
    await apiDeleteBrigand(id);
    hideModal();
    await reloadAll();
    alert("Brigand supprimé !");
  } catch (err) {
    alert(err.message);
  }
});

// Creation d’une organisation
DOM.orderForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom_complet = (DOM.orderName.value || "").trim();
  const nom_abrege = (DOM.orderShort.value || "").trim();
  if (!nom_complet) return alert("Le nom complet est requis.");
  try {
    await apiCreateOrg(nom_complet, nom_abrege || null);
    DOM.orderForm.reset();
    await loadOrganisations(); // recharge les <select>
    await reloadAll();         // recharge les tableaux
    alert("Organisation ajoutée !");
  } catch (err) {
    alert(err.message);
  }
});

// =========== Tabs ===========

document.querySelectorAll(".tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    // desactiver tous les boutons
    document.querySelectorAll(".tabs .tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // masquer toutes les sections
    document.querySelectorAll(".tabpane").forEach(pane => pane.classList.remove("active"));

    // afficher la section ciblee
    const target = document.getElementById("tab-" + btn.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// =========== Boot ===========

async function loadOrganisations() {
  const res = await fetch("/api/organisations");
  const data = await res.json();

  const selects = [document.getElementById("orderSelect"), document.getElementById("editOrder")];
  selects.forEach(sel => {
    sel.innerHTML = '<option value="">Aucune</option>';
    data.forEach(org => {
      sel.innerHTML += `<option value="${org.id}">${org.nom_abrege || org.nom_complet}</option>`;
    });
  });
}

async function loadBrigands() {
  const res = await fetch("/api/brigands");
  const data = await res.json();

  ["noire","surveillance","hors","archives","couronne","png"].forEach(id => {
    document.getElementById("table-" + id).innerHTML = "";
  });

  data.forEach(b => {
    const row = `<div>${b.name} — ${b.list || "Aucune"} — ${b.organisation || "Aucune"} — ${b.facts || ""}</div>`;

    if (b.list === "noire") document.getElementById("table-noire").innerHTML += row;
    if (b.list === "surveillance") document.getElementById("table-surveillance").innerHTML += row;
    if (b.list === "hors") document.getElementById("table-hors").innerHTML += row;
    if (b.list === "archives") document.getElementById("table-archives").innerHTML += row;

    if (b.is_crown) document.getElementById("table-couronne").innerHTML += row;
    if (b.is_png) document.getElementById("table-png").innerHTML += row;
  });
}

  async function loadOrdersTable() {
  const res = await fetch("/api/organisations");
  const data = await res.json();

  const container = document.getElementById("ordersTable");
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = "<p>Aucune organisation enregistrée.</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add("org-table");

  table.innerHTML = `
    <thead>
      <tr>
        <th>Nom complet</th>
        <th>Nom abrégé</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (org) => `
        <tr>
          <td>${org.nom_complet}</td>
          <td>${org.nom_abrege || "-"}</td>
          <td><button class="btn small danger" data-id="${org.id}">Supprimer</button></td>
        </tr>`
        )
        .join("")}
    </tbody>
  `;

  container.appendChild(table);

  // Brancher les boutons de suppression
  container.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cette organisation ?")) return;
      try {
        await apiDeleteOrg(btn.dataset.id);
        await loadOrganisations(); // recharge les <select>
        await loadOrdersTable();   // recharge le tableau
        alert("Organisation supprimée !");
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function afficherBlasonSiConnecte(user) {
  // Verifie que l’utilisateur est connecte ET qu’il appartient bien au bureau A&C
  if (user.isLoggedIn && user.bureau === "Armagnac & Comminges") {
    const blasonDiv = document.getElementById("blason");
    if (blasonDiv) {
      blasonDiv.innerHTML = `
        <img src="https://i.imgur.com/Tlkcjgy.png" alt="Blason Armagnac & Comminges" height="48">
        <b>Armagnac & Comminges</b>
      `;
      blasonDiv.style.display = "flex";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initDOM();
  bindEvents();
  await reloadAll();
  await loadOrganisations();
  await loadBrigands();
  await loadOrdersTable();

document.addEventListener("DOMContentLoaded", async () => {
  initDOM();
  bindEvents();
  await reloadAll();
  await loadOrganisations();
  await loadBrigands();
  await loadOrdersTable();

  //  Ajout : affichage du blason si connecte
  const user = {
    isLoggedIn: {{ 'true' if current_user.is_authenticated else 'false' }},
    bureau: "{{ current_user.bureau if current_user.is_authenticated else '' }}"
  };
  afficherBlasonSiConnecte(user);
});
