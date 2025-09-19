// =========== Données ===========

// Page size (pagination)
const PAGE_SIZE = 50;

// Listes principales
const PRIMARY_LABELS = {
  noire: "Liste noire",
  surveillance: "Surveillance",
  hors: "Liste noire hors A&C",
  archives: "Archives",
};

// Couleurs d’affichage (BBCode) pour nom
// NOTE: la teinte hors A&C est à valider. Ici: darkcrimson = "crimson".
const COLOR_MAP = {
  couronne: "darkorange",
  noire: "red",
  surveillance: "darkred",
  hors: "crimson", // TODO: à confirmer/ajuster
};

// Ordres initialisés (avec nom abrégé pour rapport)
let orders = [
  { id: cuid(), name: "LA MANO", short: "LA MANO" },
  { id: cuid(), name: "O.N.E.", short: "O.N.E." },
  { id: cuid(), name: "MANONERA", short: "MANONERA" },
  { id: cuid(), name: "Cie DU RAT MORT", short: "RAT MORT" },
  { id: cuid(), name: "DUROCASSE & Cie", short: "DUROCASSE" },
  { id: cuid(), name: "FATUM", short: "FATUM" },
  { id: cuid(), name: "MEMENTO MORI", short: "MEMENTO" },
  { id: cuid(), name: "TRÊFLES", short: "TRÊFLES" },
  { id: cuid(), name: "SCORPION DE SEL", short: "SCORPION" },
  { id: "none", name: "— Aucun ordre —", short: "" }, // option exigée si pas d’ordre
];

// Entrées brigands
let brigands = []; // {id, name, facts, primary, isCrown, isPNG, orderId}
let selectedBrigand = null; // ← brigand actuellement sélectionné pour modification

// États de pagination par tableau
const pagers = {
  noire: 1,
  surveillance: 1,
  hors: 1,
  archives: 1,
  couronne: 1,
  png: 1,
  // Orders: pagination par ordre, stockée dynamiquement
  orderMembers: {}, // {orderId: currentPage}
};

// ✅ Création d’un brigand
document.addEventListener("DOMContentLoaded", () => {
  if (createForm) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const brigand = {
        name: document.getElementById("name").value.trim(),
        list: document.getElementById("primaryList").value,
        facts: document.getElementById("facts").value.trim(),
        is_crown: document.getElementById("isCrown").checked,
        is_png: document.getElementById("isPNG").checked,
        order: document.getElementById("orderSelect").value
      };

      try {
        const res = await fetch("/api/brigands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brigand)
        });

        const result = await res.json();
        if (res.ok) {
          alert("Brigand ajouté !");
          e.target.reset();
          reloadBrigands();
        } else {
          alert("Erreur : " + result.error);
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Erreur réseau");
      }
    });
  }
});

// 🔧 Modifier le brigand sélectionné
document.addEventListener("DOMContentLoaded", () => {
  const updateBtn = document.getElementById("updateButton");
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      if (!selectedBrigand || !selectedBrigand.id) {
        alert("Aucun brigand sélectionné.");
        return;
      }

      const updatedBrigand = {
        name: document.getElementById("name").value.trim(),
        list: document.getElementById("primaryList").value,
        facts: document.getElementById("facts").value.trim(),
        is_crown: document.getElementById("isCrown").checked,
        is_png: document.getElementById("isPNG").checked,
        order: document.getElementById("orderSelect").value
      };

      try {
        const res = await fetch(`/api/brigands/${selectedBrigand.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedBrigand)
        });

        const result = await res.json();
        if (res.ok) {
          alert("Brigand modifié !");
          selectedBrigand = null;
          document.getElementById("createForm").reset();
          reloadBrigands();
        } else {
          alert("Erreur : " + result.error);
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Erreur réseau");
      }
    });
  }
});

// 🗑️ Supprimer le brigand sélectionné
document.addEventListener("DOMContentLoaded", () => {
  const deleteBtn = document.getElementById("deleteButton");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!selectedBrigand || !selectedBrigand.id) {
        alert("Aucun brigand sélectionné.");
        return;
      }

      if (!confirm("Confirmer la suppression du brigand ?")) return;

      try {
        const res = await fetch(`/api/brigands/${selectedBrigand.id}`, {
          method: "DELETE"
        });

        if (res.ok) {
          alert("Brigand supprimé !");
          selectedBrigand = null;
          document.getElementById("createForm").reset();
          reloadBrigands();
        } else {
          const result = await res.json();
          alert("Erreur : " + result.error);
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Erreur réseau");
      }
    });
  }
});

document.getElementById("deleteForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const raw = document.getElementById("deleteNames").value.trim();
  if (!raw) return alert("Aucun nom à supprimer");

  const names = raw.split("\n").map(n => n.trim()).filter(n => n);
  if (!names.length) return alert("Format invalide");

  try {
    const res = await fetch("/api/brigands/delete-by-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erreur lors de la suppression");

    alert(`Brigands supprimés : ${result.deleted.join(", ")}`);
    document.getElementById("deleteNames").value = "";
  } catch (err) {
    alert(err.message);
  }
});

// 🔄 Rechargement des brigands
async function reloadBrigands() {
  try {
    const res = await fetch("/api/brigands");
    const data = await res.json();
    brigands = data;
    renderAllTables();
  } catch (err) {
    console.error("Erreur lors du rechargement des brigands :", err);
  }
}

// 🧩 Affichage des brigands dans les tableaux
function renderAllTables() {
  const tables = {
    noire: document.getElementById("table-noire"),
    surveillance: document.getElementById("table-surveillance"),
    hors: document.getElementById("table-hors"),
    archives: document.getElementById("table-archives"),
    couronne: document.getElementById("table-couronne"),
    png: document.getElementById("table-png"),
    orders: document.getElementById("table-orders")
  };

  // Nettoyer les tableaux
  for (const key in tables) {
    tables[key].innerHTML = "";
  }

  // Répartir les brigands
  brigands.forEach((b) => {
    const div = document.createElement("div");
    div.className = "brigand-entry";
    div.textContent = b.name + (b.facts ? " — " + b.facts : "");

    // 🔄 Rendre le brigand cliquable pour modification
    div.addEventListener("click", () => {
      selectedBrigand = b;
      document.getElementById("name").value = b.name;
      document.getElementById("primaryList").value = b.list;
      document.getElementById("facts").value = b.facts || "";
      document.getElementById("isCrown").checked = b.is_crown || false;
      document.getElementById("isPNG").checked = b.is_png || false;
      document.getElementById("orderSelect").value = b.order || "none";
    });

    // 🧩 Répartition dans les bons tableaux
    if (tables[b.list]) tables[b.list].appendChild(div);
    if (b.is_crown) tables.couronne.appendChild(div.cloneNode(true));
    if (b.is_png) tables.png.appendChild(div.cloneNode(true));
    if (b.order && b.order !== "none") tables.orders.appendChild(div.cloneNode(true));
  });
}

// =========== Utils ===========
function cuid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

function byName(a, b) {
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}

function getOrderById(id) {
  return orders.find(o => o.id === id);
}

function escapeText(s) {
  return (s || "")
    .replace(/\[b.*?\]/g, "")   // ligne 1 : regex complète sur une ligne
    .replace(/\]/g, "");        // ligne 2 : autre regex complète
}

// Règles d’assemblage (export BBCode pour rapports)
function formatReportLine(entry) {
  const order = getOrderById(entry.orderId);
  // Couleur nom: Couronne > (sinon) primaire (noire/surveillance/hors). Archives pas de couleur
  let color = null;
  if (entry.isCrown) color = COLOR_MAP.couronne;
  else if (entry.primary === "noire") color = COLOR_MAP.noire;
  else if (entry.primary === "surveillance") color = COLOR_MAP.surveillance;
  else if (entry.primary === "hors") color = COLOR_MAP.hors;

  const nameBB = color ? `[color=${color}]${escapeText(entry.name)}[/color]` : escapeText(entry.name);

  // Mentions: toujours toutes, dans l’ordre: Couronne, PNG, Ordre
  const mentions = [];
  if (entry.isCrown) mentions.push("Recherché par la couronne de France");
  if (entry.isPNG) mentions.push("[color=indigo]PNG[/color]");
  if (order && order.short) mentions.push(order.short);

  // Faits reprochés si présents
  const facts = entry.facts ? escapeText(entry.facts) : "";

  // Assemblage
  const parts = [nameBB];
  if (mentions.length) parts.push(mentions.join(" - "));
  if (facts) parts.push(facts);
  return parts.join(" - ");
}

// =========== DOM refs ===========
const createForm = document.getElementById("createForm");
const nameInput = document.getElementById("name");
const factsInput = document.getElementById("facts");
const primarySelect = document.getElementById("primaryList");
const isCrownInput = document.getElementById("isCrown");
const isPNGInput = document.getElementById("isPNG");
const orderSelect = document.getElementById("orderSelect");

const tables = {
  noire: document.getElementById("table-noire"),
  surveillance: document.getElementById("table-surveillance"),
  hors: document.getElementById("table-hors"),
  archives: document.getElementById("table-archives"),
  couronne: document.getElementById("table-couronne"),
  png: document.getElementById("table-png"),
};

const tabButtons = document.querySelectorAll(".tab");
const panes = {
  principales: document.getElementById("tab-principales"),
  annotatives: document.getElementById("tab-annotatives"),
};

// Orders management
const ordersTable = document.getElementById("ordersTable");
const ordersMembers = document.getElementById("ordersMembers");
const orderForm = document.getElementById("orderForm");
const orderName = document.getElementById("orderName");
const orderShort = document.getElementById("orderShort");

// Modal
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("closeModal");
const editForm = document.getElementById("editForm");
const editId = document.getElementById("editId");
const editName = document.getElementById("editName");
const editFacts = document.getElementById("editFacts");
const editPrimary = document.getElementById("editPrimary");
const editCrown = document.getElementById("editCrown");
const editPNG = document.getElementById("editPNG");
const editOrder = document.getElementById("editOrder");
const deleteEntryBtn = document.getElementById("deleteEntry");
const cancelEditBtn = document.getElementById("cancelEdit");

// =========== Chargement des organisations brigandes ===========
async function chargerOrganisations() {
  try {
    const res = await fetch('/api/organisations');
    if (!res.ok) throw new Error("Erreur " + res.status);
    const data = await res.json();

    const selectCreate = document.getElementById('orderSelect');
    const selectEdit = document.getElementById('editOrder');

    [selectCreate, selectEdit].forEach(select => {
      if (!select) return;
      select.innerHTML = '<option value="">Aucun</option>';
if (Array.isArray(data)) {
  data.forEach(orga => {
    if (!orga || !orga.id || !orga.nom) return;
    const opt = document.createElement('option');
    opt.value = orga.id;
    opt.textContent = orga.nom;
    select.appendChild(opt);
  });
} else {
  console.warn("Réponse inattendue pour les organisations :", data);
}
    });
  } catch (err) {
    console.error("Impossible de charger les organisations :", err);
  }
}

// =========== Initialisation ===========
function init() {
  chargerOrganisations();
  bindEvents();
  renderAll();
}
document.addEventListener("DOMContentLoaded", init);

function renderOrderSelects() {
  const opts = orders
    .map(o => `<option value="${o.id}">${o.name} ${o.id==="none"?"":"(" + o.short + ")"}</option>`)
    .join("");
  orderSelect.innerHTML = opts;
  editOrder.innerHTML = opts;
}

// =========== Événements ===========
function bindEvents() {
  // Tabs
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".tab.active")?.classList.remove("active");
    btn.classList.add("active");

    const target = btn.dataset.tab;

    // Masquer tous les panneaux
    Object.values(panes).forEach(pane => pane.classList.add("hidden"));

    // Afficher le panneau ciblé
    const activePane = panes[target];
    if (activePane) activePane.classList.remove("hidden");
  });
});

  // Création
  createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = {
      id: cuid(),
      name: nameInput.value.trim(),
      facts: factsInput.value.trim(),
      primary: primarySelect.value,
      isCrown: isCrownInput.checked,
      isPNG: isPNGInput.checked,
      orderId: orderSelect.value,
    };
    if (!entry.name) { alert("Le nom IG est requis."); return; }
    if (!entry.orderId) { alert("Sélectionne un ordre."); return; }
    brigands.push(entry);
    createForm.reset();
    // Remettre la liste par défaut si besoin
    primarySelect.value = "noire";
    renderAll();
  });

  // Orders gestion
  orderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const full = orderName.value.trim();
    const short = orderShort.value.trim();
    if (!full || !short) return;
    orders = orders.filter(o => o.id !== "none"); // remonte "none" à la fin
    orders.push({ id: cuid(), name: full, short });
    orders.push({ id: "none", name: "— Aucun ordre —", short: "" });
    orderForm.reset();
    renderOrderSelects();
    renderOrdersTables();
    renderAnnotatives();
  });

  // Modal
  closeModalBtn.addEventListener("click", hideModal);
  cancelEditBtn.addEventListener("click", hideModal);
  editForm.addEventListener("submit", onEditSubmit);
  deleteEntryBtn.addEventListener("click", onDeleteEntry);

  // Fermer modal sur fond
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });
}

// =========== Rendu global ===========
function renderAll() {
  renderPrincipales();
  renderAnnotatives();
  renderOrdersTables();
}

// Principales
function renderPrincipales() {
  renderTablePrimary("noire", tables.noire);
  renderTablePrimary("surveillance", tables.surveillance);
  renderTablePrimary("hors", tables.hors);
  renderTablePrimary("archives", tables.archives);
}

function filterPrimary(p) {
  return brigands.filter(b => b.primary === p).sort(byName);
}

function renderTablePrimary(primary, mount) {
  const data = filterPrimary(primary);
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
        ${rows.map(r => rowPrimaryHTML(r)).join("") || `<tr><td colspan="5">Aucune entrée</td></tr>`}
      </tbody>
    </table>
    ${pagerHTML(primary, page, totalPages)}
  `;

  bindPager(primary, mount);
  bindRowActions(mount);
}

function rowPrimaryHTML(r) {
  const order = getOrderById(r.orderId);
  const mentions = [
    r.isCrown ? '<span class="tag orange">Couronne</span>' : "",
    r.isPNG ? '<span class="tag indigo">PNG</span>' : "",
    order && order.short ? `<span class="tag">${order.short}</span>` : "",
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

// Annotatives (noms seuls)
function renderAnnotatives() {
  // Couronne
  const crown = brigands.filter(b => b.isCrown).sort(byName);
  renderNamesOnlyTable("couronne", crown, tables.couronne);

  // PNG
  const png = brigands.filter(b => b.isPNG).sort(byName);
  renderNamesOnlyTable("png", png, tables.png);

  // Members per order
  renderOrderMembers();
}

function renderNamesOnlyTable(key, arr, mount) {
  const totalPages = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
  pagers[key] = Math.min(pagers[key] || 1, totalPages);
  const page = pagers[key];
  const start = (page - 1) * PAGE_SIZE;
  const rows = arr.slice(start, start + PAGE_SIZE);

  // 🔍 Ajout du log pour débogage
  console.log(`[${key}] ${arr.length} brigands trouvés`);
  console.log(`[${key}]`, arr.map(b => b.name));

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

// Orders tables
function renderOrdersTables() {
  // Liste des ordres
  ordersTable.innerHTML = `
    <table class="table">
      <thead><tr><th>Nom complet</th><th>Abrégé</th><th>Actions</th></tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr data-oid="${o.id}">
            <td>${escapeText(o.name)}</td>
            <td>${escapeText(o.short)}</td>
            <td class="row-actions">
              ${o.id==="none" ? '<span class="badge">Réservé</span>' : `
                <button class="btn small danger" data-action="del-order">Supprimer</button>
              `}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  ordersTable.querySelectorAll('[data-action="del-order"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const oid = tr.dataset.oid;
      // Empêcher suppression si des membres l’utilisent
      const used = brigands.some(b => b.orderId === oid);
      if (used) {
        alert("Impossible: des entrées utilisent encore cet ordre.");
        return;
      }
      orders = orders.filter(o => o.id !== oid);
      renderOrderSelects();
      renderOrdersTables();
      renderAnnotatives();
    });
  });

  renderOrderMembers();
}

function renderOrderMembers() {
  let html = "";
  orders.forEach(o => {
    if (o.id === "none") return;
    const members = brigands.filter(b => b.orderId === o.id).sort(byName);
    const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
    if (!pagers.orderMembers[o.id]) pagers.orderMembers[o.id] = 1;
    pagers.orderMembers[o.id] = Math.min(pagers.orderMembers[o.id], totalPages);
    const page = pagers.orderMembers[o.id];
    const start = (page - 1) * PAGE_SIZE;
    const rows = members.slice(start, start + PAGE_SIZE);

    html += `
      <div class="card">
        <h5>${escapeText(o.name)} <span class="badge">${escapeText(o.short)}</span></h5>
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
  ordersMembers.innerHTML = html;

  // Pager des ordres
  ordersMembers.querySelectorAll(".pager .page").forEach(btn => {
    btn.addEventListener("click", () => {
      const oid = btn.dataset.omp;
      const dir = parseInt(btn.dataset.dir, 10);
      const members = brigands.filter(b => b.orderId === oid);
      const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
      pagers.orderMembers[oid] = Math.min(Math.max(1, (pagers.orderMembers[oid] || 1) + dir), totalPages);
      renderOrderMembers();
    });
  });

  // Actions par ligne
  bindRowActions(ordersMembers);
}

// Pager helpers
function pagerHTML(key, page, total) {
  return `
    <div class="pager" data-key="${key}">
      <button class="page" data-dir="-1" ${page<=1 ? "disabled":""}>◀</button>
      <span class="badge">Page ${page}/${total}</span>
      <button class="page" data-dir="1" ${page>=total ? "disabled":""}>▶</button>
    </div>
  `;
}

function bindPager(key, mount) {
  const pager = mount.querySelector(`.pager[data-key="${key}"]`);
  if (!pager) return;
  pager.querySelectorAll(".page").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = parseInt(btn.dataset.dir, 10);
      const data = getDataForKey(key);
      const total = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
      pagers[key] = Math.min(Math.max(1, (pagers[key] || 1) + dir), total);
      if (["noire","surveillance","hors","archives"].includes(key)) renderPrincipales();
      else renderAnnotatives();
    });
  });
}

function getDataForKey(key) {
  if (key === "couronne") return brigands.filter(b => b.isCrown).sort(byName);
  if (key === "png") return brigands.filter(b => b.isPNG).sort(byName);
  return filterPrimary(key);
}

// Actions ligne: modifier/supprimer
function bindRowActions(scope) {
  scope.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      openEdit(id);
    });
  });
  scope.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      if (confirm("Supprimer cette entrée ?")) {
        brigands = brigands.filter(b => b.id !== id);
        renderAll();
      }
    });
  });
}

// =========== Modal édition ===========
function openEdit(id) {
  const b = brigands.find(x => x.id === id);
  if (!b) return;
  editId.value = b.id;
  editName.value = b.name;
  editFacts.value = b.facts || "";
  editPrimary.value = b.primary;
  editCrown.checked = !!b.isCrown;
  editPNG.checked = !!b.isPNG;
  editOrder.value = b.orderId || "none";
  showModal();
}

function onEditSubmit(e) {
  e.preventDefault();
  const id = editId.value;
  const idx = brigands.findIndex(b => b.id === id);
  if (idx < 0) return;
  brigands[idx] = {
    ...brigands[idx],
    name: editName.value.trim(),
    facts: editFacts.value.trim(),
    primary: editPrimary.value,
    isCrown: editCrown.checked,
    isPNG: editPNG.checked,
    orderId: editOrder.value,
  };
  hideModal();
  renderAll();
}

function onDeleteEntry() {
  const id = editId.value;
  if (confirm("Supprimer cette entrée ?")) {
    brigands = brigands.filter(b => b.id !== id);
    hideModal();
    renderAll();
  }
}

function showModal() {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}
function hideModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function renderTable(container, rows) {
  if (!rows.length) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'badge' }, ['Aucune entrée']));
    return;
  }

  const table = el('table', { class: 'table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', {}, ['Nom IG']),
      el('th', {}, ['Faits reprochés']),
    ])
  ]);

  const tbody = el('tbody');
  rows.forEach(r => {
    tbody.appendChild(
      el('tr', {}, [
        el('td', {}, [r.name || '—']),
        el('td', {}, [r.facts || '—']),
      ])
    );
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  container.innerHTML = '';
  container.appendChild(table);
}

async function loadBrigandTables() {
  const targets = {
    noire: document.getElementById('table-noire'),
    surveillance: document.getElementById('table-surveillance'),
    hors: document.getElementById('table-hors'),
    archives: document.getElementById('table-archives'),
  };

  Object.values(targets).forEach(div => {
    if (div) div.innerHTML = '<div class="badge">Chargement…</div>';
  });

  try {
    const res = await fetch('/api/brigands', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const groups = { noire: [], surveillance: [], hors: [], archives: [] };
    (Array.isArray(data) ? data : []).forEach(b => {
      const key = b.list;
      if (key in groups) groups[key].push(b);
    });

    Object.entries(groups).forEach(([key, rows]) => {
      const container = targets[key];
      if (container) renderTable(container, rows);
    });
  } catch (err) {
    console.error('Erreur chargement brigands:', err);
    Object.values(targets).forEach(div => {
      if (div) div.innerHTML = '<div class="badge">Erreur de chargement</div>';
    });
  }
}

document.addEventListener('DOMContentLoaded', loadBrigandTables);
