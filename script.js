// --- LOGIQUE JAVASCRIPT ---

let panier = [];

// === SYSTÈME D'ÉDITION DES PRIX ===
const STORAGE_KEY = "registre_prix_overrides";
let prixOverrides = {};
let editMode = false;

function chargerOverrides() {
  try {
    prixOverrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    prixOverrides = {};
  }
  appliquerOverrides();
}

function appliquerOverrides() {
  Object.keys(prixOverrides).forEach((key) => {
    const parts = key.split(":");
    if (parts.length !== 3) return;
    const [cat, idxStr, field] = parts;
    const idx = parseInt(idxStr);
    const item = registreData[cat]?.items?.[idx];
    if (item) item[field] = prixOverrides[key];
  });
}

function sauvegarderOverride(cat, index, field, value) {
  const key = `${cat}:${index}:${field}`;
  prixOverrides[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prixOverrides));
  } catch (e) {
    console.warn("Impossible de sauvegarder:", e);
  }
}

function resetOverrides() {
  if (
    !confirm(
      "Réinitialiser tous les prix aux valeurs d'origine ? Cette action est irréversible.",
    )
  )
    return;
  prixOverrides = {};
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);

  const btn = document.getElementById("editToggle");
  if (btn) {
    btn.textContent = editMode
      ? "💾 Terminer l'édition"
      : "✏️ Modifier les prix";
    btn.classList.toggle("active", editMode);
  }

  const resetBtn = document.getElementById("resetPrix");
  if (resetBtn) resetBtn.style.display = editMode ? "inline-flex" : "none";

  document.querySelectorAll("[data-price-cell]").forEach((cell) => {
    cell.contentEditable = editMode ? "true" : "false";
    if (!editMode) cell.blur();
  });
}

function setupEditToolbar() {
  const btn = document.getElementById("editToggle");
  if (btn) btn.addEventListener("click", toggleEditMode);

  const resetBtn = document.getElementById("resetPrix");
  if (resetBtn) resetBtn.addEventListener("click", resetOverrides);

  // Sauvegarde à la perte de focus
  document.addEventListener("focusout", (e) => {
    const cell = e.target;
    if (!cell.hasAttribute || !cell.hasAttribute("data-price-cell")) return;
    if (!editMode) return;

    const cat = cell.dataset.cat;
    const index = parseInt(cell.dataset.index);
    const field = cell.dataset.field;
    let newValue = (cell.textContent || "").replace(/\s+/g, " ").trim();
    if (!newValue) newValue = "-";

    sauvegarderOverride(cat, index, field, newValue);

    if (registreData[cat]?.items?.[index]) {
      registreData[cat].items[index][field] = newValue;
    }

    const prixExtrait = extrairePrix(newValue);
    cell.dataset.prix = newValue;

    // Mise à jour du panier si présent
    const nomArticle =
      cell.dataset.nom || registreData[cat]?.items?.[index]?.nom || "";
    const materiau = cell.dataset.materiau || "";
    const nomComplet = materiau ? `${nomArticle} (${materiau})` : nomArticle;

    panier.forEach((p) => {
      if (p.nom === nomComplet && prixExtrait > 0) p.prixUnitaire = prixExtrait;
    });
    mettreAJourPanierUI();

    cell.classList.add("saved-flash");
    setTimeout(() => cell.classList.remove("saved-flash"), 600);
  });

  // Entrée = valider
  document.addEventListener("keydown", (e) => {
    if (
      e.target.hasAttribute &&
      e.target.hasAttribute("data-price-cell") &&
      editMode
    ) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.target.blur();
      }
    }
  });
}

// === FIN SYSTÈME ÉDITION ===

document.addEventListener("DOMContentLoaded", () => {
  chargerOverrides();
  renderTabs();
  renderAllSections();
  setupSearch();
  setupPanier();
  setupEditToolbar();

  const firstTab = document.querySelector(".tab-btn");
  if (firstTab) firstTab.click();
});

// 1. Onglets
function renderTabs() {
  const tabsContainer = document.getElementById("tabsContainer");
  Object.keys(registreData).forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = registreData[key].title;
    btn.dataset.target = key;

    btn.addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      resetVisibility();
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".section-content")
        .forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(key).classList.add("active");
    });
    tabsContainer.appendChild(btn);
  });
}

// 2. Sections
function renderAllSections() {
  const mainContent = document.getElementById("mainContent");
  const listCategories = [
    "nourriture",
    "sacs",
    "vetements",
    "chapeaux",
    "chaussures",
    "outils",
  ];

  for (const [key, data] of Object.entries(registreData)) {
    const section = document.createElement("section");
    section.id = key;
    section.className = "section-content";

    const h2 = document.createElement("h2");
    h2.textContent = data.title;
    section.appendChild(h2);

    const tableResponsive = document.createElement("div");
    tableResponsive.className = "table-responsive";

    const table = document.createElement("table");
    if (key === "armes" || key === "armures" || key === "bijoux")
      table.className = "table-grid";
    else if (listCategories.includes(key)) table.className = "table-list";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    data.headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    data.items.forEach((item, index) => {
      const tr = document.createElement("tr");

      if (key === "armes") {
        tr.innerHTML = `
                    <td><strong>${item.nom}</strong></td>
                    ${creerCellulePrix(item.nom, "Fer", item.fer, key, index, "fer")}
                    ${creerCellulePrix(item.nom, "Acier", item.acier, key, index, "acier")}
                    ${creerCellulePrix(item.nom, "Commun", item.commun, key, index, "commun")}
                    ${creerCellulePrix(item.nom, "Bosmer", item.bosmer, key, index, "bosmer")}
                    ${creerCellulePrix(item.nom, "Altmer", item.altmer, key, index, "altmer")}
                    ${creerCellulePrix(item.nom, "Dwemer", item.dwemer, key, index, "dwemer")}
                    ${creerCellulePrix(item.nom, "Verre", item.verre, key, index, "verre")}
                `;
      } else if (key === "armures") {
        tr.innerHTML = `
                    <td><strong>${item.nom}</strong></td>
                    ${creerCellulePrix(item.nom, "Commun", item.commun, key, index, "commun")}
                    ${creerCellulePrix(item.nom, "Peau", item.peau, key, index, "peau")}
                    ${creerCellulePrix(item.nom, "Fourrure", item.fourrure, key, index, "fourrure")}
                    ${creerCellulePrix(item.nom, "Cuir", item.cuir, key, index, "cuir")}
                    ${creerCellulePrix(item.nom, "Impérial", item.imperial, key, index, "imperial")}
                    ${creerCellulePrix(item.nom, "Impérial Lin", item.imperial_lin, key, index, "imperial_lin")}
                    ${creerCellulePrix(item.nom, "Fer", item.fer, key, index, "fer")}
                    ${creerCellulePrix(item.nom, "Acier", item.acier, key, index, "acier")}
                    ${creerCellulePrix(item.nom, "Bosmer Léger", item.bosmer_leger, key, index, "bosmer_leger")}
                    ${creerCellulePrix(item.nom, "Bosmer Lourd", item.bosmer_lourd, key, index, "bosmer_lourd")}
                    ${creerCellulePrix(item.nom, "Chasse sauvage", item.chasse, key, index, "chasse")}
                    ${creerCellulePrix(item.nom, "Altmer", item.altmer, key, index, "altmer")}
                    ${creerCellulePrix(item.nom, "Dwemer", item.dwemer, key, index, "dwemer")}
                    ${creerCellulePrix(item.nom, "Verre", item.verre, key, index, "verre")}
                `;
      } else if (key === "bijoux") {
        tr.classList.add("row-clickable");
        tr.innerHTML = `
                    <td>${item.type}</td>
                    <td><strong>${item.nom}</strong></td>
                    <td class="price" data-price-cell data-cat="${key}" data-index="${index}" data-field="prix" data-nom="${item.nom}">${item.prix}</td>
                `;
        tr.addEventListener("click", (e) => {
          if (editMode) return;
          if (e.target.hasAttribute && e.target.hasAttribute("data-price-cell"))
            return;
          ajouterAuPanier(
            item.nom,
            registreData[key].items[index].prix,
            item.type,
          );
        });
      } else {
        tr.classList.add("row-clickable");
        tr.innerHTML = `
                    <td><strong>${item.nom}</strong></td>
                    <td class="price" data-price-cell data-cat="${key}" data-index="${index}" data-field="prix" data-nom="${item.nom}">${item.prix}</td>
                `;
        tr.addEventListener("click", (e) => {
          if (editMode) return;
          if (e.target.hasAttribute && e.target.hasAttribute("data-price-cell"))
            return;
          ajouterAuPanier(item.nom, registreData[key].items[index].prix, "");
        });
      }

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableResponsive.appendChild(table);
    section.appendChild(tableResponsive);
    mainContent.appendChild(section);
  }
}

function creerCellulePrix(nomArticle, materiau, valeurPrix, cat, index, field) {
  const estInvalide = !valeurPrix || valeurPrix === "X" || valeurPrix === "-";
  const dataAttrs = `data-price-cell data-cat="${cat}" data-index="${index}" data-field="${field}" data-nom="${nomArticle}" data-materiau="${materiau}"`;

  if (estInvalide) {
    return `<td class="price cell-vide" ${dataAttrs}>${valeurPrix || "-"}</td>`;
  }

  const valeurSafe = String(valeurPrix).replace(/"/g, "&quot;");
  return `<td class="price cell-clickable" ${dataAttrs} data-prix="${valeurSafe}">${valeurPrix}</td>`;
}

// Clic sur les cellules de prix (armes/armures)
document.addEventListener("click", (e) => {
  if (editMode) return;
  if (e.target.classList.contains("cell-clickable")) {
    const nom = e.target.dataset.nom;
    const materiau = e.target.dataset.materiau;
    const prixTexte = e.target.dataset.prix;
    ajouterAuPanier(nom, prixTexte, materiau);

    e.target.style.backgroundColor = "rgba(245, 158, 11, 0.3)";
    setTimeout(() => {
      e.target.style.backgroundColor = "";
    }, 300);
  }
});

// 3. Recherche
function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query === "") {
      resetVisibility();
      const activeTab = document.querySelector(".tab-btn.active");
      if (activeTab)
        document
          .getElementById(activeTab.dataset.target)
          .classList.add("active");
      return;
    }
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".section-content")
      .forEach((s) => s.classList.remove("active"));

    document.querySelectorAll(".section-content").forEach((section) => {
      let hasResults = false;
      section.querySelectorAll("tbody tr").forEach((row) => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
          row.style.display = "";
          hasResults = true;
        } else {
          row.style.display = "none";
        }
      });
      if (hasResults) section.classList.add("active");
    });
  });
}

function resetVisibility() {
  document
    .querySelectorAll("tbody tr")
    .forEach((row) => (row.style.display = ""));
  document
    .querySelectorAll(".section-content")
    .forEach((s) => s.classList.remove("active"));
}

// 4. Panier
function setupPanier() {
  document.getElementById("viderPanier").addEventListener("click", () => {
    panier = [];
    mettreAJourPanierUI();
  });
}

function extrairePrix(prixTexte) {
  if (typeof prixTexte === "number") return prixTexte;
  if (typeof prixTexte === "string") {
    const match = prixTexte.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }
  return 0;
}

function ajouterAuPanier(nom, prixTexte, details = "") {
  const prix = extrairePrix(prixTexte);
  if (prix === 0) {
    alert("Impossible d'ajouter cet article : prix invalide.");
    return;
  }
  const nomComplet = details ? `${nom} (${details})` : nom;
  const existingItem = panier.find((item) => item.nom === nomComplet);
  if (existingItem) existingItem.quantite += 1;
  else panier.push({ nom: nomComplet, prixUnitaire: prix, quantite: 1 });
  mettreAJourPanierUI();
}

function retirerDuPanier(index) {
  panier.splice(index, 1);
  mettreAJourPanierUI();
}

function mettreAJourPanierUI() {
  const list = document.getElementById("panier-list");
  const totalSpan = document.getElementById("panier-total");
  const badge = document.getElementById("panier-count-badge");

  list.innerHTML = "";
  let total = 0;
  let count = 0;

  if (panier.length === 0) {
    const li = document.createElement("li");
    li.className = "panier-vide";
    li.textContent = "Le panier est vide.";
    list.appendChild(li);
  } else {
    panier.forEach((item, index) => {
      const sousTotal = item.prixUnitaire * item.quantite;
      total += sousTotal;
      count += item.quantite;

      const li = document.createElement("li");
      li.innerHTML = `
                <div class="item-info">
                    <span class="item-nom">${item.nom}</span>
                    <span class="item-details">${item.prixUnitaire} S × ${item.quantite}</span>
                </div>
                <div class="item-action">
                    <span class="item-prix">${sousTotal} S</span>
                    <button class="btn-remove-item" data-index="${index}">✕</button>
                </div>
            `;
      list.appendChild(li);
    });
  }
  totalSpan.textContent = total;
  badge.textContent = count;

  list.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      retirerDuPanier(parseInt(e.target.dataset.index, 10));
    });
  });
}
