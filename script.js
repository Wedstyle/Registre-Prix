const _0x1a = [
  "https://snrwlsrqomysfyvuayfm.supabase.co",
  "sb_publishable_H1Zv0Sk1H_ITiT3E1RTfxQ_EKrne7_D",
  "registre.local",
];
const SUPABASE_URL = _0x1a[0];
const SUPABASE_ANON_KEY = _0x1a[1];
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
const DOMAINE_INTERNE = _0x1a[2];

let panier = [];
let prixOverrides = {};
let stockData = {};
let customArticles = [];
let customCategories = [];
let articlesSupprimes = [];
let editMode = false;
let utilisateurCourant = null;
let remisePourcent = 0;

function afficherToast(message, type = "info", duree = 3000) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duree);
}

function afficherVue(nomVue) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  const vue = document.getElementById("view-" + nomVue);
  if (vue) vue.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === nomVue);
  });
  const panierAside = document.querySelector(".cart-col");
  if (panierAside) {
    const cv =
      utilisateurCourant &&
      (utilisateurCourant.valide === true ||
        utilisateurCourant.role === "patron");
    panierAside.style.display = nomVue === "catalogue" && cv ? "block" : "none";
  }
  if (nomVue === "admin") {
    chargerListeEmployes();
    chargerStock();
  }
  if (nomVue === "dashboard") chargerDashboard();
  window.scrollTo(0, 0);
}

function pseudoVersEmail(p) {
  return `${p.toLowerCase().trim()}@${DOMAINE_INTERNE}`;
}

async function initAuth() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (session) await chargerProfil(session.user);
    else mettreAJourUIUtilisateur(null);
  } catch (e) {
    mettreAJourUIUtilisateur(null);
  }
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) await chargerProfil(session.user);
    else mettreAJourUIUtilisateur(null);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view && btn.style.display !== "none") afficherVue(view);
    });
  });
  document.querySelectorAll(".switch-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  const lf = document.getElementById("loginForm");
  if (lf) lf.addEventListener("submit", connexion);
  const rf = document.getElementById("registerForm");
  if (rf) rf.addEventListener("submit", inscription);
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".admin-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.adminTab;
      document
        .getElementById("adminEmployes")
        .classList.toggle("hidden", target !== "employes");
      document
        .getElementById("adminStock")
        .classList.toggle("hidden", target !== "stock");
      document
        .getElementById("adminComptabilite")
        .classList.toggle("hidden", target !== "comptabilite");
      if (target === "comptabilite") chargerComptabilite();
      if (target === "stock") chargerStock();
    });
  });
  const ss = document.getElementById("stockSearch");
  if (ss) ss.addEventListener("input", filtrerStock);
  const ssa = document.getElementById("stockSaveAll");
  if (ssa) ssa.addEventListener("click", sauvegarderToutLeStock);
  const ba = document.getElementById("btnAddArticle");
  if (ba) ba.addEventListener("click", ouvrirFormArticle);
  const ca = document.getElementById("cancelNewArticle");
  if (ca) ca.addEventListener("click", fermerFormArticle);
  const cf = document.getElementById("confirmNewArticle");
  if (cf) cf.addEventListener("click", creerArticle);
  const bc = document.getElementById("btnAddCategorie");
  if (bc) bc.addEventListener("click", ouvrirFormCategorie);
  const cc = document.getElementById("cancelNewCategory");
  if (cc) cc.addEventListener("click", fermerFormCategorie);
  const cfcat = document.getElementById("confirmNewCategory");
  if (cfcat) cfcat.addEventListener("click", creerCategorie);
  const vv = document.getElementById("validerVente");
  if (vv) vv.addEventListener("click", validerVente);
  const ri = document.getElementById("remiseInput");
  if (ri)
    ri.addEventListener("input", (e) => {
      remisePourcent = Math.max(
        0,
        Math.min(100, parseInt(e.target.value) || 0),
      );
      mettreAJourPanierUI();
    });

  document.addEventListener("click", (e) => {
    if (e.target.id === "resetComptaBtn") reinitialiserComptabilite();
    if (e.target.id === "exportCsvBtn") exporterComptabiliteCSV();
    if (e.target.id === "annulerVenteBtn") annulerDerniereVente();
  });
}

async function chargerProfil(user) {
  try {
    const { data } = await supabaseClient
      .from("employees")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) utilisateurCourant = data;
    else {
      const pseudo =
        user.user_metadata?.pseudo || user.email?.split("@")[0] || "inconnu";
      utilisateurCourant = {
        id: user.id,
        pseudo,
        role: user.user_metadata?.role || "employe",
        valide: false,
      };
    }
  } catch (e) {
    utilisateurCourant = {
      id: user.id,
      pseudo: "inconnu",
      role: "employe",
      valide: false,
    };
  }
  mettreAJourUIUtilisateur(utilisateurCourant);
}

function mettreAJourUIUtilisateur(user) {
  const navLoginBtn = document.getElementById("navLoginBtn");
  const navUserInfo = document.getElementById("navUserInfo");
  const adminBtn = document.querySelector(".nav-btn.admin-only");
  const dashboardBtn = document.querySelector(".nav-btn.dashboard-only");
  const catalogueBtn = document.querySelector(
    '.nav-btn[data-view="catalogue"]',
  );
  const panierAside = document.querySelector(".cart-col");

  if (!user) {
    navLoginBtn.style.display = "inline-flex";
    navLoginBtn.textContent = "👤 Connexion";
    navUserInfo.style.display = "none";
    if (adminBtn) adminBtn.style.display = "none";
    if (dashboardBtn) dashboardBtn.style.display = "none";
    if (catalogueBtn) catalogueBtn.style.display = "inline-flex";
    if (panierAside) panierAside.style.display = "none";
    const et = document.getElementById("editToggle");
    if (et) et.style.display = "none";
    verifierModeLecture();
    const cv = document.querySelector(".view.active");
    if (
      !cv ||
      cv.id === "view-attente" ||
      cv.id === "view-admin" ||
      cv.id === "view-dashboard"
    )
      afficherVue("catalogue");
    return;
  }
  const estValide = user.valide === true || user.role === "patron";
  const estPatron = user.role === "patron";
  navLoginBtn.style.display = "none";
  if (catalogueBtn) catalogueBtn.style.display = "inline-flex";
  navUserInfo.style.display = "flex";
  navUserInfo.innerHTML = `
        <span>Connecté : <strong>${user.pseudo}</strong></span>
        <span class="role-badge ${estPatron ? "patron" : estValide ? "employe" : "attente"}">
            ${estPatron ? "Patron" : estValide ? "Employé" : "En attente"}
        </span>
        <button class="nav-btn-logout" id="navLogoutBtn">Déconnexion</button>
    `;
  document
    .getElementById("navLogoutBtn")
    .addEventListener("click", deconnexion);
  if (adminBtn) adminBtn.style.display = estPatron ? "inline-flex" : "none";
  if (dashboardBtn)
    dashboardBtn.style.display = estPatron ? "inline-flex" : "none";
  const et = document.getElementById("editToggle");
  if (et) {
    if (estPatron) et.style.display = "inline-flex";
    else {
      et.style.display = "none";
      if (document.body.classList.contains("edit-mode")) toggleEditMode();
    }
  }
  if (panierAside) panierAside.style.display = estValide ? "block" : "none";
  if (!estValide) afficherVue("attente");
  else {
    const cv = document.querySelector(".view.active");
    if (!cv || cv.id === "view-login" || cv.id === "view-attente")
      afficherVue("catalogue");
  }
  verifierModeLecture();
}

function verifierModeLecture() {
  const old = document.getElementById("lectureBanner");
  if (old) old.remove();
  if (!utilisateurCourant) {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent || !mainContent.parentElement) return;
    const banner = document.createElement("div");
    banner.id = "lectureBanner";
    banner.className = "lecture-banner";
    banner.innerHTML = `
            <span>👁️ Mode lecture seule — Vous pouvez consulter les prix, mais pas ajouter au panier.</span>
            <button onclick="afficherVue('login')" class="btn-lecture">Se connecter</button>
        `;
    mainContent.parentElement.insertBefore(banner, mainContent);
  }
}

function switchTab(tabName) {
  document
    .querySelectorAll(".switch-tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
  document
    .getElementById("loginForm")
    .classList.toggle("hidden", tabName !== "login");
  document
    .getElementById("registerForm")
    .classList.toggle("hidden", tabName !== "register");
  document.getElementById("loginError").textContent = "";
  document.getElementById("registerError").textContent = "";
}

async function inscription(e) {
  e.preventDefault();
  const pseudo = document.getElementById("registerPseudo").value.trim();
  const password = document.getElementById("registerPassword").value;
  const pc = document.getElementById("registerPasswordConfirm").value;
  const errorDiv = document.getElementById("registerError");
  const btn = e.target.querySelector('button[type="submit"]');
  errorDiv.textContent = "";
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(pseudo)) {
    errorDiv.textContent = "Pseudo invalide.";
    return;
  }
  if (password !== pc) {
    errorDiv.textContent = "Les mots de passe ne correspondent pas.";
    return;
  }
  if (password.length < 6) {
    errorDiv.textContent = "6 caractères minimum.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Création...";
  try {
    const { data: existe, error: errCheck } = await supabaseClient.rpc(
      "pseudo_existe",
      { p_pseudo: pseudo },
    );
    if (errCheck) throw errCheck;
    if (existe) {
      errorDiv.textContent = "Ce pseudo est déjà pris.";
      btn.disabled = false;
      btn.textContent = "Créer mon compte";
      return;
    }
  } catch (err) {
    errorDiv.textContent = "Erreur de vérification.";
    btn.disabled = false;
    btn.textContent = "Créer mon compte";
    return;
  }
  const { error } = await supabaseClient.auth.signUp({
    email: pseudoVersEmail(pseudo),
    password,
    options: { data: { pseudo, role: "employe" } },
  });
  btn.disabled = false;
  btn.textContent = "Créer mon compte";
  if (error) {
    errorDiv.textContent = error.message.includes("already registered")
      ? "Pseudo déjà utilisé."
      : error.message;
    return;
  }
  errorDiv.style.color = "#22c55e";
  errorDiv.textContent = "Compte créé !";
  const { error: errLogin } = await supabaseClient.auth.signInWithPassword({
    email: pseudoVersEmail(pseudo),
    password,
  });
  if (!errLogin)
    setTimeout(() => {
      errorDiv.style.color = "";
    }, 500);
  else {
    errorDiv.style.color = "";
    switchTab("login");
    document.getElementById("loginPseudo").value = pseudo;
  }
}

async function connexion(e) {
  e.preventDefault();
  const pseudo = document.getElementById("loginPseudo").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorDiv = document.getElementById("loginError");
  const btn = e.target.querySelector('button[type="submit"]');
  errorDiv.textContent = "";
  btn.disabled = true;
  btn.textContent = "Connexion...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: pseudoVersEmail(pseudo),
    password,
  });
  btn.disabled = false;
  btn.textContent = "Se connecter";
  if (error) {
    errorDiv.textContent = error.message.includes("Invalid login")
      ? "Pseudo ou mot de passe incorrect."
      : error.message;
    return;
  }
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (user) {
    const { data: profil } = await supabaseClient
      .from("employees")
      .select("actif")
      .eq("id", user.id)
      .maybeSingle();
    if (profil && profil.actif === false) {
      await supabaseClient.auth.signOut();
      errorDiv.textContent = "Votre compte a été désactivé.";
    }
  }
}

async function deconnexion() {
  await supabaseClient.auth.signOut();
  panier = [];
  remisePourcent = 0;
  if (typeof mettreAJourPanierUI === "function") mettreAJourPanierUI();
}

async function chargerOverrides() {
  try {
    const { data } = await supabaseClient.from("prix_overrides").select("*");
    prixOverrides = {};
    (data || []).forEach((row) => {
      prixOverrides[`${row.categorie}:${row.item_index}:${row.champ}`] =
        row.valeur;
    });
    appliquerOverrides();
  } catch (e) {}
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

async function sauvegarderOverride(cat, index, field, value) {
  if (cat === "custom") {
    const { error } = await supabaseClient
      .from("custom_articles")
      .update({ prix: String(value) })
      .eq("id", index);
    if (!error) {
      const article = customArticles.find((a) => a.id == index);
      if (article) article.prix = String(value);
    }
    return !error;
  }
  prixOverrides[`${cat}:${index}:${field}`] = value;
  const { error } = await supabaseClient
    .from("prix_overrides")
    .upsert(
      {
        categorie: cat,
        item_index: index,
        champ: field,
        valeur: String(value),
      },
      { onConflict: "categorie,item_index,champ" },
    );
  return !error;
}

async function resetOverrides() {
  if (!confirm("Réinitialiser TOUS les prix ?")) return;
  const { error } = await supabaseClient
    .from("prix_overrides")
    .delete()
    .neq("id", 0);
  if (!error) location.reload();
}

function ecouterChangementsTempsReel() {
  supabaseClient
    .channel("db-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prix_overrides" },
      () => {
        chargerOverrides().then(() => {
          document
            .querySelectorAll(".section-content.active")
            .forEach((s) => reRenderSection(s.id));
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stock" },
      () => chargerStock(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sales" },
      () => {
        const cv = document.querySelector(".view.active");
        if (cv && cv.id === "view-dashboard") chargerDashboard();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "custom_articles" },
      () => {
        chargerArticlesCustom().then(() => {
          renderTabs();
          renderAllSections();
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "custom_categories" },
      () => {
        chargerCategoriesCustom().then(() => {
          renderTabs();
          renderAllSections();
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "articles_supprimes" },
      () => {
        chargerArticlesSupprimes().then(() => {
          renderTabs();
          renderAllSections();
          chargerStock();
        });
      },
    )
    .subscribe();
}

function reRenderSection(cat) {
  const section = document.getElementById(cat);
  if (!section) return;
  const data = registreData[cat];
  if (!data) return;
  const rows = section.querySelectorAll("tbody tr");
  data.items.forEach((item, idx) => {
    const row = rows[idx];
    if (!row) return;
    row.querySelectorAll("[data-price-cell]").forEach((cell) => {
      const field = cell.dataset.field;
      if (item[field] !== undefined) {
        cell.textContent = item[field];
        cell.dataset.prix = item[field];
      }
    });
  });
}

function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);
  const btn = document.getElementById("editToggle");
  if (btn) {
    btn.textContent = editMode ? "Terminer l'édition" : "Modifier les prix";
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
  document.addEventListener("focusout", async (e) => {
    const cell = e.target;
    if (!cell.hasAttribute || !cell.hasAttribute("data-price-cell")) return;
    if (!editMode) return;
    const cat = cell.dataset.cat;
    const index = parseInt(cell.dataset.index);
    const field = cell.dataset.field;
    let newValue = (cell.textContent || "").replace(/\s+/g, " ").trim();
    if (!newValue) newValue = "-";
    await sauvegarderOverride(cat, index, field, newValue);
    if (cat !== "custom" && registreData[cat]?.items?.[index]) {
      registreData[cat].items[index][field] = newValue;
    }
    cell.dataset.prix = newValue;
    cell.classList.add("saved-flash");
    setTimeout(() => cell.classList.remove("saved-flash"), 600);
  });
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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    renderTabs();
    renderAllSections();
    setupSearch();
    setupPanier();
    setupEditToolbar();
  } catch (e) {}
  try {
    await initAuth();
    verifierModeLecture();
  } catch (e) {}
  try {
    await chargerOverrides();
    await chargerArticlesCustom();
    await chargerCategoriesCustom();
    await chargerArticlesSupprimes();
    await chargerStock();
    renderTabs();
    renderAllSections();
    document.querySelectorAll(".section-content").forEach((s) => {
      if (s.classList.contains("active")) reRenderSection(s.id);
    });
  } catch (e) {}
  try {
    ecouterChangementsTempsReel();
  } catch (e) {}
  const firstTab = document.querySelector(".tab-btn");
  if (firstTab) firstTab.click();
});

async function chargerArticlesCustom() {
  try {
    const { data } = await supabaseClient
      .from("custom_articles")
      .select("*")
      .order("created_at");
    customArticles = data || [];
  } catch (e) {
    customArticles = [];
  }
}

async function chargerCategoriesCustom() {
  try {
    const { data } = await supabaseClient
      .from("custom_categories")
      .select("*")
      .order("created_at");
    customCategories = data || [];
  } catch (e) {
    customCategories = [];
  }
}

async function chargerArticlesSupprimes() {
  try {
    // Utilise la VUE PUBLIQUE qui ne contient que les IDs (pas de fuite d'info)
    const { data } = await supabaseClient
      .from("articles_supprimes_ids")
      .select("*");
    articlesSupprimes = data || [];
  } catch (e) {
    articlesSupprimes = [];
  }
}

function estSupprime(cat, idx) {
  return articlesSupprimes.some(
    (a) => a.categorie === cat && a.item_index === idx,
  );
}

function toutesLesCategories() {
  const keys = Object.keys(registreData).map((k) => ({
    key: k,
    titre: registreData[k].title,
    custom: false,
  }));
  customCategories.forEach((c) => {
    keys.push({ key: `cat_${c.id}`, titre: c.nom, custom: true, id: c.id });
  });
  return keys;
}

function renderTabs() {
  const tabsContainer = document.getElementById("tabsContainer");
  if (!tabsContainer) return;
  tabsContainer.innerHTML = "";
  toutesLesCategories().forEach(({ key, titre }) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = titre;
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
      const sec = document.getElementById(key);
      if (sec) sec.classList.add("active");
    });
    tabsContainer.appendChild(btn);
  });
}

function renderAllSections() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;
  mainContent.innerHTML = "";
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
      if (estSupprime(key, index)) return;
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
        tr.innerHTML = `<td>${item.type}</td><td><strong>${item.nom}</strong></td>
                    <td class="price" data-price-cell data-cat="${key}" data-index="${index}" data-field="prix" data-nom="${item.nom}">${item.prix}</td>`;
      } else {
        tr.classList.add("row-clickable");
        tr.innerHTML = `<td><strong>${item.nom}</strong></td>
                    <td class="price" data-price-cell data-cat="${key}" data-index="${index}" data-field="prix" data-nom="${item.nom}">${item.prix}</td>`;
      }
      tbody.appendChild(tr);
    });

    const customCat = customArticles.filter(
      (a) => a.categorie === key && !estSupprime("custom", a.id),
    );
    customCat.forEach((a) => {
      const tr = document.createElement("tr");
      tr.classList.add("row-clickable");
      tr.dataset.customId = a.id;
      tr.innerHTML = `<td><strong>${a.nom}</strong> <span class="custom-badge">Custom</span></td>
                <td class="price" data-price-cell data-cat="custom" data-index="${a.id}" data-field="prix" data-nom="${a.nom}">${a.prix}</td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableResponsive.appendChild(table);
    section.appendChild(tableResponsive);
    mainContent.appendChild(section);
  }

  customCategories.forEach((c) => {
    const catKey = `cat_${c.id}`;
    const section = document.createElement("section");
    section.id = catKey;
    section.className = "section-content";

    const h2 = document.createElement("h2");
    h2.textContent = c.nom;
    section.appendChild(h2);

    const tableResponsive = document.createElement("div");
    tableResponsive.className = "table-responsive";
    const table = document.createElement("table");
    table.className = "table-list";

    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Article</th><th>Prix (Septims)</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const items = customArticles.filter(
      (a) => a.categorie === catKey && !estSupprime("custom", a.id),
    );
    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="2" style="text-align:center;color:var(--text-muted);font-style:italic;padding:2rem;">Aucun article dans cette catégorie.</td>';
      tbody.appendChild(tr);
    } else {
      items.forEach((a) => {
        const tr = document.createElement("tr");
        tr.classList.add("row-clickable");
        tr.dataset.customId = a.id;
        tr.innerHTML = `<td><strong>${a.nom}</strong></td>
                    <td class="price" data-price-cell data-cat="custom" data-index="${a.id}" data-field="prix" data-nom="${a.nom}">${a.prix}</td>`;
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    tableResponsive.appendChild(table);
    section.appendChild(tableResponsive);
    mainContent.appendChild(section);
  });
}

function creerCellulePrix(nomArticle, materiau, valeurPrix, cat, index, field) {
  const estInvalide = !valeurPrix || valeurPrix === "X" || valeurPrix === "-";
  const dataAttrs = `data-price-cell data-cat="${cat}" data-index="${index}" data-field="${field}" data-nom="${nomArticle}" data-materiau="${materiau}"`;
  if (estInvalide)
    return `<td class="price cell-vide" ${dataAttrs}>${valeurPrix || "-"}</td>`;
  const valeurSafe = String(valeurPrix).replace(/"/g, "&quot;");
  return `<td class="price cell-clickable" ${dataAttrs} data-prix="${valeurSafe}">${valeurPrix}</td>`;
}

function avertirLectureSeule() {
  const banner = document.getElementById("lectureBanner");
  if (banner) {
    banner.style.transform = "scale(1.02)";
    banner.style.borderColor = "#ef4444";
    banner.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    setTimeout(() => {
      banner.style.transform = "";
      banner.style.borderColor = "";
      banner.style.backgroundColor = "";
    }, 600);
  }
}

document.addEventListener("click", (e) => {
  if (editMode) return;
  const estValide =
    utilisateurCourant &&
    (utilisateurCourant.valide === true ||
      utilisateurCourant.role === "patron");

  if (e.target.classList.contains("cell-clickable")) {
    if (!estValide) return avertirLectureSeule();
    ajouterAuPanier(
      e.target.dataset.nom,
      e.target.dataset.prix,
      e.target.dataset.materiau,
      {
        cat: e.target.dataset.cat,
        idx: parseInt(e.target.dataset.index),
        champ: e.target.dataset.field,
      },
    );
    e.target.style.backgroundColor = "rgba(245, 158, 11, 0.3)";
    setTimeout(() => {
      e.target.style.backgroundColor = "";
    }, 300);
    return;
  }

  const row = e.target.closest(".row-clickable");
  if (row) {
    if (
      e.target.hasAttribute &&
      e.target.hasAttribute("data-price-cell") &&
      e.target.dataset.cat !== "custom"
    )
      return;
    if (!estValide) return avertirLectureSeule();

    const customId = row.dataset.customId;
    if (customId) {
      const article = customArticles.find((a) => a.id == customId);
      if (article) {
        ajouterAuPanier(article.nom, article.prix, "", {
          cat: "custom",
          idx: parseInt(customId),
          champ: "default",
        });
      }
      return;
    }

    const cat = row.closest(".section-content")?.id;
    if (!cat) return;
    const tbody = row.parentElement;
    const index = Array.from(tbody.children).indexOf(row);
    const data = registreData[cat];
    if (!data || !data.items[index]) return;
    const item = data.items[index];

    if (cat === "bijoux") {
      ajouterAuPanier(item.nom, item.prix, item.type, {
        cat,
        idx: index,
        champ: "default",
      });
    } else {
      ajouterAuPanier(item.nom, item.prix, "", {
        cat,
        idx: index,
        champ: "default",
      });
    }
  }
});

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query === "") {
      resetVisibility();
      const activeTab = document.querySelector(".tab-btn.active");
      if (activeTab) {
        const sec = document.getElementById(activeTab.dataset.target);
        if (sec) sec.classList.add("active");
      }
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

function setupPanier() {
  const btn = document.getElementById("viderPanier");
  if (btn)
    btn.addEventListener("click", () => {
      panier = [];
      remisePourcent = 0;
      const ri = document.getElementById("remiseInput");
      if (ri) ri.value = 0;
      mettreAJourPanierUI();
    });
}

function extrairePrix(prixTexte) {
  if (typeof prixTexte === "number") return prixTexte;
  if (typeof prixTexte === "string") {
    const m = prixTexte.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  return 0;
}

function ajouterAuPanier(nom, prixTexte, details = "", key = null) {
  const prix = extrairePrix(prixTexte);
  if (prix === 0) return;
  const nomComplet = details ? `${nom} (${details})` : nom;
  const ex = panier.find(
    (i) =>
      i.nom === nomComplet &&
      i.cat === key?.cat &&
      i.idx === key?.idx &&
      i.champ === key?.champ,
  );
  if (ex) ex.quantite += 1;
  else
    panier.push({
      nom: nomComplet,
      prixUnitaire: prix,
      quantite: 1,
      cat: key?.cat || null,
      idx: key?.idx !== undefined ? key.idx : null,
      champ: key?.champ || "default",
    });
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
  const btnValider = document.getElementById("validerVente");
  const remiseInfo = document.getElementById("panier-remise-info");
  if (!list) return;
  list.innerHTML = "";
  let totalAvantRemise = 0,
    count = 0;
  if (panier.length === 0) {
    const li = document.createElement("li");
    li.className = "panier-vide";
    li.textContent = "Le panier est vide.";
    list.appendChild(li);
    if (btnValider) btnValider.disabled = true;
    if (remiseInfo) remiseInfo.style.display = "none";
  } else {
    panier.forEach((item, index) => {
      const st = item.prixUnitaire * item.quantite;
      totalAvantRemise += st;
      count += item.quantite;

      let stockInfo = "";
      if (item.cat && item.idx !== null) {
        const stockKey = `${item.cat}:${item.idx}:${item.champ}`;
        const s = stockData[stockKey];
        if (s) {
          if (s.quantite <= 0)
            stockInfo = `<span class="item-stock-info rupture">⚠ Rupture de stock (${s.quantite})</span>`;
          else if (s.quantite < item.quantite)
            stockInfo = `<span class="item-stock-info rupture">⚠ Seulement ${s.quantite} en stock</span>`;
          else if (s.quantite <= s.seuil)
            stockInfo = `<span class="item-stock-info alerte">Stock bas : ${s.quantite}</span>`;
          else
            stockInfo = `<span class="item-stock-info">Stock : ${s.quantite}</span>`;
        }
      }

      const li = document.createElement("li");
      li.innerHTML = `
                <div class="item-info">
                    <span class="item-nom">${item.nom}</span>
                    <span class="item-details">${item.prixUnitaire} S × ${item.quantite}</span>
                    ${stockInfo}
                </div>
                <div class="item-action">
                    <span class="item-prix">${st} S</span>
                    <button class="btn-remove-item" data-index="${index}">✕</button>
                </div>`;
      list.appendChild(li);
    });
    if (btnValider) btnValider.disabled = false;
  }

  const montantRemise = Math.round(totalAvantRemise * (remisePourcent / 100));
  const totalFinal = totalAvantRemise - montantRemise;

  if (totalSpan) totalSpan.textContent = totalFinal;
  if (badge) badge.textContent = count;

  if (remiseInfo) {
    if (remisePourcent > 0 && totalAvantRemise > 0) {
      remiseInfo.style.display = "block";
      remiseInfo.textContent = `(-${montantRemise} S sur ${totalAvantRemise} S)`;
    } else {
      remiseInfo.style.display = "none";
    }
  }

  list.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      retirerDuPanier(parseInt(e.target.dataset.index, 10));
    });
  });
}

async function validerVente() {
  if (!utilisateurCourant) {
    afficherToast("Vous devez être connecté.", "error");
    return;
  }
  if (panier.length === 0) {
    afficherToast("Le panier est vide.", "error");
    return;
  }
  const estValide =
    utilisateurCourant.valide === true || utilisateurCourant.role === "patron";
  if (!estValide) {
    afficherToast("Votre compte n'est pas encore validé.", "error");
    return;
  }

  const btn = document.getElementById("validerVente");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Enregistrement...";
  }

  const items = panier.map((i) => ({
    nom: i.nom,
    prix: i.prixUnitaire,
    qte: i.quantite,
    cat: i.cat,
    idx: i.idx,
    champ: i.champ || "default",
  }));

  const totalAvantRemise = panier.reduce(
    (s, i) => s + i.prixUnitaire * i.quantite,
    0,
  );
  const montantRemise = Math.round(totalAvantRemise * (remisePourcent / 100));
  const totalFinal = totalAvantRemise - montantRemise;

  const { data, error } = await supabaseClient.rpc("valider_vente", {
    p_employee_id: utilisateurCourant.id,
    p_employee_nom: utilisateurCourant.pseudo,
    p_items: items,
    p_total: totalFinal,
    p_remise_pourcent: remisePourcent,
    p_total_avant_remise: totalAvantRemise,
  });

  if (btn) {
    btn.disabled = false;
    btn.textContent = "💾 Valider la vente";
  }

  if (error) {
    afficherToast(error.message || "Erreur lors de la vente.", "error", 5000);
    return;
  }

  let msg = `✅ Vente enregistrée ! Total : ${totalFinal} Septims`;
  if (remisePourcent > 0) msg += ` (remise ${remisePourcent}%)`;
  afficherToast(msg, "success", 4000);

  panier = [];
  remisePourcent = 0;
  const ri = document.getElementById("remiseInput");
  if (ri) ri.value = 0;
  mettreAJourPanierUI();
  await chargerStock();
}

async function chargerListeEmployes() {
  const container = document.getElementById("employesList");
  if (!container) return;
  container.innerHTML = "Chargement...";
  const { data, error } = await supabaseClient
    .from("employees")
    .select("*")
    .order("created_at");
  if (error || !data) {
    container.innerHTML = '<div class="no-data">Erreur.</div>';
    return;
  }
  if (data.length === 0) {
    container.innerHTML = '<div class="no-data">Aucun employé.</div>';
    return;
  }
  container.innerHTML = "";
  data.forEach((emp) => {
    const div = document.createElement("div");
    div.className = "employe-row" + (emp.actif === false ? " inactif" : "");
    const dateInscription = new Date(emp.created_at).toLocaleDateString(
      "fr-FR",
    );
    const estMoiMeme = emp.id === utilisateurCourant?.id;
    let actionsHtml = "";
    if (!estMoiMeme) {
      const estValide = emp.valide !== false;
      const estActif = emp.actif !== false;
      if (!estValide)
        actionsHtml += `<button class="btn-action valider" data-action="valider" data-id="${emp.id}">✅ Valider</button>`;
      if (!estActif)
        actionsHtml += `<button class="btn-action reactiver" data-action="reactiver" data-id="${emp.id}">🔓 Réactiver</button>`;
      else {
        if (emp.role === "employe" && estValide)
          actionsHtml += `<button class="btn-action promote" data-action="promote" data-id="${emp.id}">⬆️ Patron</button>`;
        if (emp.role === "patron")
          actionsHtml += `<button class="btn-action demote" data-action="demote" data-id="${emp.id}">⬇️ Employé</button>`;
        if (estValide)
          actionsHtml += `<button class="btn-action invalider" data-action="invalider" data-id="${emp.id}">⏸️ Invalider</button>`;
        actionsHtml += `<button class="btn-action exclure" data-action="exclure" data-id="${emp.id}">🚫 Exclure</button>`;
      }
    } else
      actionsHtml =
        '<em style="color:var(--text-muted);font-size:0.8rem;">(vous)</em>';
    div.innerHTML = `
            <div class="employe-info">
                <span class="employe-pseudo">${emp.pseudo} ${estMoiMeme ? "👑" : ""}</span>
                <span class="employe-meta">Inscrit le ${dateInscription} <span class="employe-role ${emp.role}">${emp.role}</span>
                ${emp.valide === false ? '<span style="color:#f59e0b;">• EN ATTENTE</span>' : ""}
                ${emp.actif === false ? '<span style="color:#ef4444;">• EXCLU</span>' : ""}</span>
            </div>
            <div class="employe-actions">${actionsHtml}</div>`;
    container.appendChild(div);
  });
  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async () =>
        await executerActionEmploye(btn.dataset.action, btn.dataset.id),
    );
  });
}

async function executerActionEmploye(action, id) {
  let updates = {},
    confirmation = "";
  switch (action) {
    case "valider":
      confirmation = "Valider ce compte ?";
      updates = { valide: true };
      break;
    case "invalider":
      confirmation = "Retirer la validation ?";
      updates = { valide: false };
      break;
    case "promote":
      confirmation = "Passer en Patron ?";
      updates = { role: "patron", valide: true };
      break;
    case "demote":
      confirmation = "Rétrograder en Employé ?";
      updates = { role: "employe" };
      break;
    case "exclure":
      confirmation = "Exclure ?";
      updates = { actif: false };
      break;
    case "reactiver":
      confirmation = "Réactiver ?";
      updates = { actif: true };
      break;
  }
  if (!confirm(confirmation)) return;
  const { error } = await supabaseClient
    .from("employees")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) {
    afficherToast("Erreur : " + error.message, "error");
    return;
  }
  chargerListeEmployes();
}

async function chargerStock() {
  const container = document.getElementById("stockContent");
  try {
    const { data, error } = await supabaseClient.from("stock").select("*");
    if (error) throw error;
    stockData = {};
    (data || []).forEach((row) => {
      const champ = row.champ || "default";
      stockData[`${row.categorie}:${row.item_index}:${champ}`] = {
        quantite: row.quantite,
        seuil: row.seuil_alerte,
      };
    });
    if (container) renderStock();
    mettreAJourPanierUI();
  } catch (e) {
    if (container)
      container.innerHTML =
        '<div class="no-data">Erreur de chargement du stock.</div>';
  }
}

function renderStock() {
  const container = document.getElementById("stockContent");
  if (!container) return;
  container.innerHTML = "";
  const listCategories = [
    "nourriture",
    "sacs",
    "vetements",
    "chapeaux",
    "chaussures",
    "armes",
    "armures",
    "bijoux",
    "outils",
  ];

  listCategories.forEach((catKey) => {
    const catData = registreData[catKey];
    if (!catData) return;
    let allRows = [];

    if (catKey === "armes") {
      const mats = [
        "fer",
        "acier",
        "commun",
        "bosmer",
        "altmer",
        "dwemer",
        "verre",
      ];
      const labels = {
        fer: "Fer",
        acier: "Acier",
        commun: "Commun",
        bosmer: "Bosmer",
        altmer: "Altmer",
        dwemer: "Dwemer",
        verre: "Verre",
      };
      catData.items.forEach((item, idx) => {
        if (estSupprime(catKey, idx)) return;
        mats.forEach((mat) => {
          const val = item[mat];
          if (val && val !== "-" && val !== "X") {
            allRows.push({
              nom: `${item.nom} (${labels[mat]})`,
              key: `${catKey}:${idx}:${mat}`,
              cat: catKey,
              idx,
              champ: mat,
              itemNom: item.nom,
            });
          }
        });
      });
    } else if (catKey === "armures") {
      const mats = [
        "commun",
        "peau",
        "fourrure",
        "cuir",
        "imperial",
        "imperial_lin",
        "fer",
        "acier",
        "bosmer_leger",
        "bosmer_lourd",
        "chasse",
        "altmer",
        "dwemer",
        "verre",
      ];
      const labels = {
        commun: "Commun",
        peau: "Peau",
        fourrure: "Fourrure",
        cuir: "Cuir",
        imperial: "Impérial",
        imperial_lin: "Impérial Lin",
        fer: "Fer",
        acier: "Acier",
        bosmer_leger: "Bosmer Léger",
        bosmer_lourd: "Bosmer Lourd",
        chasse: "Chasse",
        altmer: "Altmer",
        dwemer: "Dwemer",
        verre: "Verre",
      };
      catData.items.forEach((item, idx) => {
        if (estSupprime(catKey, idx)) return;
        mats.forEach((mat) => {
          const val = item[mat];
          if (val && val !== "-" && val !== "X") {
            allRows.push({
              nom: `${item.nom} (${labels[mat]})`,
              key: `${catKey}:${idx}:${mat}`,
              cat: catKey,
              idx,
              champ: mat,
              itemNom: item.nom,
            });
          }
        });
      });
    } else {
      catData.items.forEach((item, idx) => {
        if (estSupprime(catKey, idx)) return;
        allRows.push({
          nom: item.nom,
          key: `${catKey}:${idx}:default`,
          cat: catKey,
          idx,
          champ: "default",
          itemNom: item.nom,
        });
      });
    }

    const customs = customArticles.filter(
      (a) => a.categorie === catKey && !estSupprime("custom", a.id),
    );
    customs.forEach((a) => {
      allRows.push({
        nom: a.nom,
        key: `custom:${a.id}:default`,
        cat: "custom",
        idx: a.id,
        champ: "default",
        isCustom: true,
        customId: a.id,
      });
    });

    if (allRows.length === 0) return;
    container.appendChild(creerBlocStock(catData.title, allRows, catKey));
  });

  customCategories.forEach((c) => {
    const catKey = `cat_${c.id}`;
    const items = customArticles.filter(
      (a) => a.categorie === catKey && !estSupprime("custom", a.id),
    );
    const allRows = items.map((a) => ({
      nom: a.nom,
      key: `custom:${a.id}:default`,
      cat: "custom",
      idx: a.id,
      champ: "default",
      isCustom: true,
      customId: a.id,
    }));
    container.appendChild(creerBlocStock(c.nom, allRows, catKey, true));
  });

  attacherEvenementsStock(container);
}

function creerBlocStock(titre, allRows, catKey, isCustomCat = false) {
  let ruptures = 0,
    alertes = 0;
  allRows.forEach((r) => {
    const st = stockData[r.key] || { quantite: 0, seuil: 5 };
    if (st.quantite <= 0) ruptures++;
    else if (st.quantite <= st.seuil) alertes++;
  });

  const catDiv = document.createElement("div");
  catDiv.className = "stock-categorie" + (isCustomCat ? " custom-cat" : "");
  if (catKey && catKey.startsWith("cat_"))
    catDiv.dataset.catId = catKey.replace("cat_", "");

  const header = document.createElement("div");
  header.className = "stock-categorie-header";
  header.innerHTML = `
        <span class="stock-categorie-titre">
            ${titre}
            ${isCustomCat ? `<button class="btn-delete-cat" data-delcat="${catKey.replace("cat_", "")}" title="Supprimer la catégorie">🗑️ Supprimer la catégorie</button>` : ""}
        </span>
        <span class="stock-categorie-stats">
            ${allRows.length} article(s)
            ${ruptures > 0 ? ` · <span style="color:#ef4444;">${ruptures} rupture(s)</span>` : ""}
            ${alertes > 0 ? ` · <span style="color:#f59e0b;">${alertes} alerte(s)</span>` : ""}
        </span>`;
  const body = document.createElement("div");
  body.className = "stock-categorie-body";

  if (allRows.length === 0) {
    body.innerHTML =
      '<div style="padding:1rem;color:var(--text-muted);font-style:italic;text-align:center;">Aucun article</div>';
  } else {
    allRows.forEach((r) => {
      const st = stockData[r.key] || { quantite: 0, seuil: 5 };
      let etatClass = "ok",
        badge = "";
      if (st.quantite < 0) {
        etatClass = "rupture";
        badge = '<span class="stock-badge rupture">Négatif</span>';
      } else if (st.quantite === 0) {
        etatClass = "rupture";
        badge = '<span class="stock-badge rupture">Rupture</span>';
      } else if (st.quantite <= st.seuil) {
        etatClass = "alerte";
        badge = '<span class="stock-badge alerte">Alerte</span>';
      }

      const isCustom = r.isCustom || false;
      const itemDiv = document.createElement("div");
      itemDiv.className = `stock-item ${etatClass}`;
      itemDiv.dataset.nom = r.nom;
      itemDiv.dataset.key = r.key;

      let deleteBtn = "";
      if (isCustom) {
        deleteBtn = `<button class="btn-delete-custom" data-del="${r.customId}" title="Supprimer">🗑️</button>`;
      } else if (catKey && !catKey.startsWith("cat_")) {
        deleteBtn = `<button class="btn-delete-custom" 
                    data-delstd-cat="${catKey}" 
                    data-delstd-idx="${r.idx}" 
                    data-delstd-nom="${r.itemNom || r.nom}" 
                    title="Masquer cet article">🗑️</button>`;
      }

      itemDiv.innerHTML = `
                <div class="stock-item-nom">${r.nom}${badge}
                    ${deleteBtn}
                </div>
                <div class="stock-input-group">
                    <label class="stock-input-label">Quantité</label>
                    <input type="number" min="0" class="stock-input quantite" value="${st.quantite}" data-key="${r.key}" data-field="quantite">
                </div>
                <div class="stock-input-group">
                    <label class="stock-input-label">Seuil</label>
                    <input type="number" min="0" class="stock-input seuil" value="${st.seuil}" data-key="${r.key}" data-field="seuil">
                </div>`;
      body.appendChild(itemDiv);
    });
  }

  header.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-delete-cat")) return;
    body.style.display = body.style.display === "none" ? "" : "none";
  });
  catDiv.appendChild(header);
  catDiv.appendChild(body);
  return catDiv;
}

function attacherEvenementsStock(container) {
  container.querySelectorAll(".stock-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const key = e.target.dataset.key;
      const field = e.target.dataset.field;
      const value = parseInt(e.target.value) || 0;
      if (!stockData[key]) stockData[key] = { quantite: 0, seuil: 5 };
      if (field === "quantite") stockData[key].quantite = value;
      else stockData[key].seuil = value;
      await sauvegarderStockItem(key, stockData[key]);
      e.target.classList.add("saved-flash");
      setTimeout(() => e.target.classList.remove("saved-flash"), 500);
      mettreAJourPanierUI();
    });
  });

  container.querySelectorAll(".btn-delete-cat").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const delCat = e.target.dataset.delcat;
      if (!delCat) return;

      if (
        !confirm(
          "⚠️ Supprimer cette catégorie ET tous ses articles ?\n\nCette action est IRRÉVERSIBLE.",
        )
      )
        return;
      if (!confirm("⚠️ Confirmer une dernière fois ?")) return;

      const catKey = `cat_${delCat}`;

      const items = customArticles.filter((a) => a.categorie === catKey);
      for (const a of items) {
        await supabaseClient
          .from("stock")
          .delete()
          .eq("categorie", "custom")
          .eq("item_index", a.id);
        await supabaseClient
          .from("articles_supprimes")
          .delete()
          .eq("categorie", "custom")
          .eq("item_index", a.id);
      }

      await supabaseClient
        .from("custom_articles")
        .delete()
        .eq("categorie", catKey);
      await supabaseClient.from("custom_categories").delete().eq("id", delCat);

      await chargerCategoriesCustom();
      await chargerArticlesCustom();
      await chargerStock();
      renderTabs();
      renderAllSections();
      afficherToast("✅ Catégorie supprimée.", "success");
    });
  });

  container.querySelectorAll(".btn-delete-custom").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const delItem = e.target.dataset.del;
      const delStdCat = e.target.dataset.delstdCat;
      const delStdIdx = e.target.dataset.delstdIdx;
      const delStdNom = e.target.dataset.delstdNom;

      if (delItem) {
        if (!confirm("Supprimer définitivement cet article personnalisé ?"))
          return;
        await supabaseClient.from("custom_articles").delete().eq("id", delItem);
        await supabaseClient
          .from("stock")
          .delete()
          .eq("categorie", "custom")
          .eq("item_index", delItem);
        await chargerArticlesCustom();
        await chargerStock();
        renderTabs();
        renderAllSections();
        afficherToast("✅ Article supprimé.", "success");
        return;
      }

      if (delStdCat !== undefined && delStdIdx !== undefined) {
        if (
          !confirm(
            `Masquer "${delStdNom}" du catalogue ?\n\nIl pourra être restauré manuellement via Supabase.`,
          )
        )
          return;

        const { error } = await supabaseClient
          .from("articles_supprimes")
          .insert({
            categorie: delStdCat,
            item_index: parseInt(delStdIdx),
            item_nom: delStdNom,
          });

        if (error) {
          afficherToast("Erreur : " + error.message, "error");
          return;
        }

        await chargerArticlesSupprimes();
        await chargerStock();
        renderAllSections();
        renderTabs();
        afficherToast("✅ Article masqué.", "success");
      }
    });
  });
}

async function sauvegarderStockItem(key, data) {
  const [cat, idxStr, champ] = key.split(":");
  const idx = parseInt(idxStr);
  let itemNom = "";
  if (cat === "custom") {
    const article = customArticles.find((a) => a.id == idx);
    itemNom = article?.nom || "Article";
  } else {
    itemNom = registreData[cat]?.items?.[idx]?.nom || "";
  }
  const { error } = await supabaseClient.from("stock").upsert(
    {
      categorie: cat,
      item_index: idx,
      champ: champ,
      item_nom: itemNom,
      quantite: data.quantite,
      seuil_alerte: data.seuil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "categorie,item_index,champ" },
  );
  if (error) afficherToast("Erreur : " + error.message, "error");
}

async function sauvegarderToutLeStock() {
  const inputs = document.querySelectorAll(".stock-input");
  inputs.forEach((input) => {
    const key = input.dataset.key;
    const field = input.dataset.field;
    const value = parseInt(input.value) || 0;
    if (!stockData[key]) stockData[key] = { quantite: 0, seuil: 5 };
    if (field === "quantite") stockData[key].quantite = value;
    else stockData[key].seuil = value;
  });
  let count = 0,
    erreurs = 0;
  for (const key of Object.keys(stockData)) {
    try {
      await sauvegarderStockItem(key, stockData[key]);
      count++;
    } catch (e) {
      erreurs++;
    }
  }
  afficherToast(
    erreurs > 0
      ? `${count} sauvegardés, ${erreurs} erreurs.`
      : `✅ ${count} articles sauvegardés !`,
    erreurs > 0 ? "error" : "success",
  );
  chargerStock();
}

function filtrerStock() {
  const q = document.getElementById("stockSearch").value.toLowerCase().trim();
  document.querySelectorAll(".stock-item").forEach((item) => {
    item.style.display = item.dataset.nom.toLowerCase().includes(q)
      ? ""
      : "none";
  });
  document.querySelectorAll(".stock-categorie").forEach((cat) => {
    const visibles = Array.from(cat.querySelectorAll(".stock-item")).some(
      (i) => i.style.display !== "none",
    );
    cat.style.display = visibles ? "" : "none";
  });
}

function ouvrirFormArticle() {
  const form = document.getElementById("newArticleForm");
  const select = document.getElementById("newArticleCat");
  select.innerHTML = "";
  Object.entries(registreData).forEach(([key, data]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = data.title;
    select.appendChild(opt);
  });
  customCategories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = `cat_${c.id}`;
    opt.textContent = `📁 ${c.nom}`;
    select.appendChild(opt);
  });
  document.getElementById("newArticleNom").value = "";
  document.getElementById("newArticlePrix").value = "";
  document.getElementById("newArticleStock").value = "0";
  form.classList.remove("hidden");
}

function fermerFormArticle() {
  document.getElementById("newArticleForm").classList.add("hidden");
}

function ouvrirFormCategorie() {
  document.getElementById("newCategoryForm").classList.remove("hidden");
  document.getElementById("newCategoryNom").value = "";
  document.getElementById("newCategoryNom").focus();
}

function fermerFormCategorie() {
  document.getElementById("newCategoryForm").classList.add("hidden");
}

async function creerCategorie() {
  const nom = document.getElementById("newCategoryNom").value.trim();
  if (!nom) {
    afficherToast("Nom requis.", "error");
    return;
  }
  if (nom.length < 2) {
    afficherToast("Nom trop court.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("custom_categories")
    .insert({ nom, created_by: utilisateurCourant?.id });

  if (error) {
    if (error.message.includes("duplicate"))
      afficherToast("Cette catégorie existe déjà.", "error");
    else afficherToast("Erreur : " + error.message, "error");
    return;
  }

  await chargerCategoriesCustom();
  renderTabs();
  renderAllSections();
  fermerFormCategorie();
  afficherToast("✅ Catégorie créée !", "success");
}

async function creerArticle() {
  const cat = document.getElementById("newArticleCat").value;
  const nom = document.getElementById("newArticleNom").value.trim();
  const prix = document.getElementById("newArticlePrix").value.trim();
  const stockInit =
    parseInt(document.getElementById("newArticleStock").value) || 0;

  if (!nom) {
    afficherToast("Nom requis.", "error");
    return;
  }
  if (!prix) {
    afficherToast("Prix requis.", "error");
    return;
  }

  const { data, error } = await supabaseClient
    .from("custom_articles")
    .insert({ categorie: cat, nom, prix, created_by: utilisateurCourant?.id })
    .select()
    .single();

  if (error) {
    afficherToast("Erreur : " + error.message, "error");
    return;
  }

  await supabaseClient.from("stock").upsert(
    {
      categorie: "custom",
      item_index: data.id,
      champ: "default",
      item_nom: nom,
      quantite: stockInit,
      seuil_alerte: 5,
    },
    { onConflict: "categorie,item_index,champ" },
  );

  await chargerArticlesCustom();
  await chargerStock();
  renderTabs();
  renderAllSections();
  fermerFormArticle();
  afficherToast("✅ Article créé !", "success");
}

async function reinitialiserComptabilite() {
  if (utilisateurCourant?.role !== "patron") {
    afficherToast("Réservé aux patrons.", "error");
    return;
  }
  if (
    !confirm(
      "⚠️ Supprimer TOUTES les ventes de la comptabilité ?\n\nCette action est IRRÉVERSIBLE.",
    )
  )
    return;
  if (!confirm("⚠️ Confirmer une dernière fois ?")) return;

  const btn = document.getElementById("resetComptaBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Suppression...";
  }

  const { error } = await supabaseClient.from("sales").delete().neq("id", 0);

  if (btn) {
    btn.disabled = false;
    btn.textContent = "🗑️ Réinitialiser la comptabilité";
  }

  if (error) {
    afficherToast("Erreur : " + error.message, "error", 5000);
    return;
  }

  afficherToast("✅ Comptabilité réinitialisée.", "success");
  chargerComptabilite();
}

function exporterComptabiliteCSV() {
  if (!window._comptaSales || window._comptaSales.length === 0) {
    afficherToast("Aucune vente à exporter.", "error");
    return;
  }
  const sales = window._comptaSales;

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  let csv = "\uFEFF";
  csv += "Date;Employé;Articles;Remise (%);Total avant remise;Total final\n";

  sales.forEach((s) => {
    const date = new Date(s.created_at)
      .toLocaleString("fr-FR")
      .replace(/,/g, "");
    const items = (s.items || [])
      .map((i) => `${i.qte}x ${i.nom} (${i.prix}S)`)
      .join(" | ");
    const remise = s.remise_pourcent ? Number(s.remise_pourcent) : 0;
    const totalAvant = s.total_avant_remise
      ? Number(s.total_avant_remise)
      : Number(s.total);
    const totalFinal = Number(s.total);

    csv +=
      [
        escapeCSV(date),
        escapeCSV(s.employee_nom || "Inconnu"),
        escapeCSV(items),
        escapeCSV(remise),
        escapeCSV(totalAvant),
        escapeCSV(totalFinal),
      ].join(";") + "\n";
  });

  const totalGeneral = sales.reduce((sum, s) => sum + Number(s.total), 0);
  csv += `\n;;;;TOTAL GÉNÉRAL;${totalGeneral}\n`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `comptabilite_${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  afficherToast(`✅ Export CSV de ${sales.length} ventes`, "success");
}

async function annulerDerniereVente() {
  if (utilisateurCourant?.role !== "patron") {
    afficherToast("Réservé aux patrons.", "error");
    return;
  }

  const { data: sales, error } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !sales || sales.length === 0) {
    afficherToast("Aucune vente à annuler.", "error");
    return;
  }

  const derniere = sales[0];
  const date = new Date(derniere.created_at).toLocaleString("fr-FR");
  const items = (derniere.items || [])
    .map((i) => `${i.qte}x ${i.nom}`)
    .join(", ");
  const msg = `⚠️ Annuler la dernière vente ?\n\nDate : ${date}\nEmployé : ${derniere.employee_nom}\nArticles : ${items}\nTotal : ${derniere.total} S\n\nLe stock sera restauré automatiquement.`;

  if (!confirm(msg)) return;
  if (!confirm("⚠️ Confirmer définitivement ?")) return;

  const btn = document.getElementById("annulerVenteBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Annulation...";
  }

  const { data, error: rpcError } = await supabaseClient.rpc("annuler_vente", {
    p_sale_id: derniere.id,
  });

  if (btn) {
    btn.disabled = false;
    btn.textContent = "↩️ Annuler la dernière vente";
  }

  if (rpcError) {
    afficherToast("Erreur : " + rpcError.message, "error", 5000);
    return;
  }

  afficherToast("✅ Vente annulée, stock restauré.", "success");
  await chargerStock();
  chargerComptabilite();
}

async function chargerComptabilite() {
  const container = document.getElementById("comptabiliteContent");
  if (!container) return;

  const estPatron = utilisateurCourant?.role === "patron";

  container.innerHTML = `
        ${
          estPatron
            ? `
            <div style="text-align: center; margin-bottom: 1.5rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
                <button id="exportCsvBtn" class="btn-toolbar">📥 Exporter en CSV</button>
                <button id="annulerVenteBtn" class="btn-toolbar">↩️ Annuler la dernière vente</button>
                <button id="resetComptaBtn" class="btn-toolbar btn-danger">🗑️ Réinitialiser la comptabilité</button>
            </div>
        `
            : ""
        }
        <div id="comptaData">Chargement...</div>
    `;

  const dataContainer = document.getElementById("comptaData");

  const { data: sales, error } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    dataContainer.innerHTML = '<div class="no-data">Erreur.</div>';
    return;
  }

  window._comptaSales = sales || [];

  if (!sales || sales.length === 0) {
    dataContainer.innerHTML = '<div class="no-data">Aucune vente.</div>';
    return;
  }

  const stats = calculerStats(sales);

  const parEmploye = {};
  sales.forEach((s) => {
    const nom = s.employee_nom || "Inconnu";
    if (!parEmploye[nom])
      parEmploye[nom] = { ventes: 0, total: 0, employee_nom: nom };
    parEmploye[nom].ventes++;
    parEmploye[nom].total += Number(s.total);
  });

  const parJour = {};
  sales.forEach((s) => {
    const d = new Date(s.created_at);
    const key = d.toISOString().slice(0, 10);
    if (!parJour[key]) parJour[key] = { ventes: 0, total: 0, date: d };
    parJour[key].ventes++;
    parJour[key].total += Number(s.total);
  });

  const totalGeneral = sales.reduce((sum, s) => sum + Number(s.total), 0);

  let html = "";

  html += `
        <div class="compta-section">
            <h3>📊 Statistiques</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card-title">🏆 Top 10 articles vendus</div>
                    ${
                      stats.topArticles.length === 0
                        ? '<div style="color:var(--text-muted);font-style:italic;font-size:0.85rem;">Aucune donnée</div>'
                        : stats.topArticles
                            .map(
                              (a, i) => `
                            <div class="stat-ligne">
                                <span class="stat-ligne-nom">${i + 1}. ${a.nom}</span>
                                <span class="stat-ligne-valeur">${a.qte} v.</span>
                            </div>
                        `,
                            )
                            .join("")
                    }
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">💰 Chiffre d'affaires par catégorie</div>
                    ${
                      stats.parCategorie.length === 0
                        ? '<div style="color:var(--text-muted);font-style:italic;font-size:0.85rem;">Aucune donnée</div>'
                        : stats.parCategorie
                            .map(
                              (c) => `
                            <div class="stat-ligne">
                                <span class="stat-ligne-nom">${c.label}</span>
                                <span class="stat-ligne-valeur">${c.total} S</span>
                            </div>
                        `,
                            )
                            .join("")
                    }
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">📅 Comparaison</div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Cette semaine</span>
                        <span class="comparaison-valeur">${stats.semaineActuelle} S</span>
                    </div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Semaine dernière</span>
                        <span class="comparaison-valeur">${stats.semainePrecedente} S</span>
                    </div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Évolution</span>
                        <span class="comparaison-valeur">${stats.evolutionSemaine}</span>
                    </div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Ce mois</span>
                        <span class="comparaison-valeur">${stats.moisActuel} S</span>
                    </div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Mois dernier</span>
                        <span class="comparaison-valeur">${stats.moisPrecedent} S</span>
                    </div>
                    <div class="comparaison-card">
                        <span class="comparaison-label">Évolution</span>
                        <span class="comparaison-valeur">${stats.evolutionMois}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

  html += `
        <div class="compta-section">
            <h3>Récapitulatif par employé</h3>
            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem;">Cliquez sur un employé pour voir le détail de ses ventes.</p>
            <table class="compta-table">
                <thead><tr><th></th><th>Employé</th><th>Nb ventes</th><th>Total</th></tr></thead>
                <tbody>
    `;

  Object.entries(parEmploye)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([nom, s]) => {
      html += `<tr class="compta-employe-row" data-employe="${nom}">
            <td style="width:30px;"><span class="employe-expand-icon">▸</span></td>
            <td><strong>${nom}</strong></td>
            <td>${s.ventes}</td>
            <td style="color:var(--accent);font-weight:700;">${s.total} S</td>
        </tr>`;
    });

  html += `</tbody></table>
        <div class="compta-total"><span>TOTAL GÉNÉRAL</span><span>${totalGeneral} Septims</span></div></div>

        <div class="compta-section">
            <h3>Ventes par jour</h3>
            <div class="compta-filter">
                <button data-filter="7" class="active">7 derniers jours</button>
                <button data-filter="30">30 derniers jours</button>
                <button data-filter="all">Tout</button>
            </div>
            <div id="jourContent"></div>
        </div>

        <div class="compta-section">
            <h3>Historique (${sales.length} ventes)</h3>
            <table class="compta-table">
                <thead><tr><th>Date</th><th>Employé</th><th>Articles</th><th>Remise</th><th>Total</th></tr></thead>
                <tbody>
    `;

  sales.slice(0, 100).forEach((s) => {
    const date = new Date(s.created_at).toLocaleString("fr-FR");
    const itemsResume = (s.items || [])
      .map((i) => `${i.qte}× ${i.nom}`)
      .join(", ");
    const remise =
      Number(s.remise_pourcent) > 0
        ? `<span style="color:#22c55e;font-weight:700;">-${s.remise_pourcent}%</span>`
        : '<span style="color:var(--text-muted);">-</span>';
    html += `<tr>
            <td style="white-space:nowrap;font-size:0.8rem;">${date}</td>
            <td><strong>${s.employee_nom || "?"}</strong></td>
            <td style="font-size:0.8rem;color:var(--text-muted);">${itemsResume}</td>
            <td>${remise}</td>
            <td style="color:var(--accent);font-weight:700;">${s.total} S</td>
        </tr>`;
  });

  html += `</tbody></table></div>`;
  dataContainer.innerHTML = html;

  dataContainer.querySelectorAll(".compta-employe-row").forEach((row) => {
    row.addEventListener("click", () => toggleDetailEmploye(row, sales));
  });

  renderVentesParJour(parJour, "7");

  dataContainer.querySelectorAll(".compta-filter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      dataContainer
        .querySelectorAll(".compta-filter button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderVentesParJour(parJour, btn.dataset.filter);
    });
  });
}

function toggleDetailEmploye(row, sales) {
  const nom = row.dataset.employe;
  const nextRow = row.nextElementSibling;
  const icon = row.querySelector(".employe-expand-icon");

  if (nextRow && nextRow.classList.contains("employe-detail-row")) {
    nextRow.remove();
    if (icon) icon.textContent = "▸";
    return;
  }

  row.parentElement
    .querySelectorAll(".employe-detail-row")
    .forEach((r) => r.remove());
  row.parentElement
    .querySelectorAll(".employe-expand-icon")
    .forEach((i) => (i.textContent = "▸"));

  if (icon) icon.textContent = "▾";

  const ventes = sales.filter((s) => (s.employee_nom || "Inconnu") === nom);

  const detailRow = document.createElement("tr");
  detailRow.className = "employe-detail-row";
  const td = document.createElement("td");
  td.colSpan = 4;

  let html = '<div class="employe-detail">';
  if (ventes.length === 0) {
    html += '<em style="color:var(--text-muted);">Aucune vente</em>';
  } else {
    html += `<table class="employe-detail-table">
            <thead><tr><th>Date</th><th>Articles</th><th>Remise</th><th>Total</th></tr></thead>
            <tbody>`;
    ventes.forEach((s) => {
      const date = new Date(s.created_at).toLocaleString("fr-FR");
      const items = (s.items || []).map((i) => `${i.qte}× ${i.nom}`).join(", ");
      const remise =
        Number(s.remise_pourcent) > 0 ? `-${s.remise_pourcent}%` : "-";
      html += `<tr>
                <td style="white-space:nowrap;">${date}</td>
                <td>${items}</td>
                <td style="color:#22c55e;">${remise}</td>
                <td style="color:var(--accent);font-weight:700;">${s.total} S</td>
            </tr>`;
    });
    const totalEmp = ventes.reduce((sum, s) => sum + Number(s.total), 0);
    html += `<tr style="background-color:#000;">
            <td colspan="3" style="text-align:right;font-weight:700;">TOTAL :</td>
            <td style="color:var(--accent);font-weight:700;">${totalEmp} S</td>
        </tr>`;
    html += "</tbody></table>";
  }
  html += "</div>";
  td.innerHTML = html;
  detailRow.appendChild(td);
  row.parentElement.insertBefore(detailRow, row.nextSibling);
}

function calculerStats(sales) {
  const articlesCount = {};
  sales.forEach((s) => {
    (s.items || []).forEach((i) => {
      const nom = i.nom || "Inconnu";
      if (!articlesCount[nom]) articlesCount[nom] = 0;
      articlesCount[nom] += i.qte || 0;
    });
  });
  const topArticles = Object.entries(articlesCount)
    .map(([nom, qte]) => ({ nom, qte }))
    .sort((a, b) => b.qte - a.qte)
    .slice(0, 10);

  const parCategorie = {};
  sales.forEach((s) => {
    (s.items || []).forEach((i) => {
      const cat = devinerCategorie(i.nom);
      if (!parCategorie[cat]) parCategorie[cat] = 0;
      parCategorie[cat] += (i.prix || 0) * (i.qte || 0);
    });
  });
  const parCategorieList = Object.entries(parCategorie)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  const now = new Date();
  const debutSemaineActuelle = new Date(now);
  debutSemaineActuelle.setDate(now.getDate() - now.getDay() + 1);
  debutSemaineActuelle.setHours(0, 0, 0, 0);

  const debutSemainePrecedente = new Date(debutSemaineActuelle);
  debutSemainePrecedente.setDate(debutSemaineActuelle.getDate() - 7);

  let semaineActuelle = 0,
    semainePrecedente = 0;
  sales.forEach((s) => {
    const d = new Date(s.created_at);
    const total = Number(s.total);
    if (d >= debutSemaineActuelle) semaineActuelle += total;
    else if (d >= debutSemainePrecedente && d < debutSemaineActuelle)
      semainePrecedente += total;
  });

  const debutMoisActuel = new Date(now.getFullYear(), now.getMonth(), 1);
  const debutMoisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let moisActuel = 0,
    moisPrecedent = 0;
  sales.forEach((s) => {
    const d = new Date(s.created_at);
    const total = Number(s.total);
    if (d >= debutMoisActuel) moisActuel += total;
    else if (d >= debutMoisPrecedent && d < debutMoisActuel)
      moisPrecedent += total;
  });

  const calcEvolution = (actuel, precedent) => {
    if (precedent === 0) {
      if (actuel === 0) return '<span class="stat-badge neutral">= 0%</span>';
      return '<span class="stat-badge up">+∞</span>';
    }
    const pct = Math.round(((actuel - precedent) / precedent) * 100);
    if (pct > 0) return `<span class="stat-badge up">▲ +${pct}%</span>`;
    if (pct < 0) return `<span class="stat-badge down">▼ ${pct}%</span>`;
    return '<span class="stat-badge neutral">= 0%</span>';
  };

  return {
    topArticles,
    parCategorie: parCategorieList,
    semaineActuelle,
    semainePrecedente,
    moisActuel,
    moisPrecedent,
    evolutionSemaine: calcEvolution(semaineActuelle, semainePrecedente),
    evolutionMois: calcEvolution(moisActuel, moisPrecedent),
  };
}

function devinerCategorie(nom) {
  nom = nom.toLowerCase();
  if (/épée|dague|hache|masse|espadon|marteau|arc|flèche/.test(nom))
    return "⚔️ Armes";
  if (/tête|armure|gants|bottes|bouclier|torse/.test(nom)) return "🛡️ Armures";
  if (
    /bague|collier|couronne|rubis|saphir|émeraude|diamant|améthyste|grenat|pierre/.test(
      nom,
    )
  )
    return "💍 Bijoux";
  if (
    /soupe|ragout|pain|tarte|bière|vin|saumon|lapin|poulet|boeuf|faisan|venaison|hydrommel|tonic/.test(
      nom,
    )
  )
    return "🍲 Nourriture";
  if (/sac|satchel|backpack|pouch|resource/.test(nom)) return "🎒 Sacs";
  if (/robe|tunique|vêtement|pantalon|clothes|habit|tablier|costume/.test(nom))
    return "👕 Vêtements";
  if (/chapeau|bonnet|capuche|toque|cape|cloak|scarf|mask|mantle|cap/.test(nom))
    return "🎩 Couvre-chefs";
  if (/gants|bottes|chaussures|sandales|bandés/.test(nom))
    return "👞 Chaussures";
  if (/pioche|hache|clé|outil/.test(nom)) return "🔧 Outils";
  return "📦 Autres";
}

function renderVentesParJour(parJour, filtre) {
  const target = document.getElementById("jourContent");
  if (!target) return;

  let dates = Object.keys(parJour).sort((a, b) => b.localeCompare(a));

  if (filtre !== "all") {
    const nb = parseInt(filtre);
    const limite = new Date();
    limite.setDate(limite.getDate() - nb + 1);
    limite.setHours(0, 0, 0, 0);
    dates = dates.filter((d) => new Date(d) >= limite);
  }

  if (dates.length === 0) {
    target.innerHTML =
      '<div class="no-data">Aucune vente sur cette période.</div>';
    return;
  }

  const maxTotal = Math.max(...dates.map((d) => parJour[d].total));

  let html = `<div class="compta-header-row">
        <span>Date</span><span>Répartition</span><span>Ventes</span><span>Total</span>
    </div>`;

  dates.forEach((dateStr) => {
    const info = parJour[dateStr];
    const d = new Date(dateStr);
    const jourSemaine = d.toLocaleDateString("fr-FR", { weekday: "short" });
    const dateCourte = d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const pourcentage = maxTotal > 0 ? (info.total / maxTotal) * 100 : 0;

    html += `<div class="jour-row">
            <div class="jour-date">${dateCourte}<small>${jourSemaine}</small></div>
            <div class="jour-bar-container">
                <div class="jour-bar" style="width: ${pourcentage}%"></div>
            </div>
            <div class="jour-ventes">${info.ventes}</div>
            <div class="jour-total">${info.total} S</div>
        </div>`;
  });

  const totalPeriode = dates.reduce((s, d) => s + parJour[d].total, 0);
  const ventesPeriode = dates.reduce((s, d) => s + parJour[d].ventes, 0);
  const moyenne =
    dates.length > 0 ? Math.round(totalPeriode / dates.length) : 0;

  html += `<div class="compta-total">
        <span>${dates.length} jour(s) · ${ventesPeriode} vente(s) · Moy. ${moyenne} S/jour</span>
        <span>${totalPeriode} Septims</span>
    </div>`;

  target.innerHTML = html;
}

async function chargerDashboard() {
  const container = document.getElementById("dashboardContent");
  if (!container) return;
  if (utilisateurCourant?.role !== "patron") {
    container.innerHTML =
      '<div class="no-data">Accès réservé aux patrons.</div>';
    return;
  }

  container.innerHTML = "Chargement...";

  const [resSales, resStock, resArticles] = await Promise.all([
    supabaseClient
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseClient.from("stock").select("*"),
    supabaseClient.from("custom_articles").select("*"),
  ]);

  const sales = resSales.data || [];
  const stocks = resStock.data || [];
  const customs = resArticles.data || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ventesDuJour = sales.filter((s) => new Date(s.created_at) >= today);
  const caDuJour = ventesDuJour.reduce((sum, s) => sum + Number(s.total), 0);
  const nbVentesJour = ventesDuJour.length;

  const hier = new Date(today);
  hier.setDate(hier.getDate() - 1);
  const finHier = new Date(today);
  const ventesHier = sales.filter((s) => {
    const d = new Date(s.created_at);
    return d >= hier && d < finHier;
  });
  const caHier = ventesHier.reduce((sum, s) => sum + Number(s.total), 0);
  let evolutionJour = "";
  if (caHier > 0) {
    const pct = Math.round(((caDuJour - caHier) / caHier) * 100);
    if (pct > 0)
      evolutionJour = `<span class="stat-badge up">▲ +${pct}% vs hier</span>`;
    else if (pct < 0)
      evolutionJour = `<span class="stat-badge down">▼ ${pct}% vs hier</span>`;
    else evolutionJour = '<span class="stat-badge neutral">= 0% vs hier</span>';
  } else if (caDuJour > 0) {
    evolutionJour = '<span class="stat-badge up">▲ Nouveau</span>';
  } else {
    evolutionJour = '<span class="stat-badge neutral">Pas de vente</span>';
  }

  const articlesJour = {};
  ventesDuJour.forEach((s) => {
    (s.items || []).forEach((i) => {
      const nom = i.nom || "Inconnu";
      if (!articlesJour[nom]) articlesJour[nom] = { qte: 0, total: 0 };
      articlesJour[nom].qte += i.qte || 0;
      articlesJour[nom].total += (i.prix || 0) * (i.qte || 0);
    });
  });
  const top3 = Object.entries(articlesJour)
    .map(([nom, d]) => ({ nom, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const ruptures = [];
  const alertes = [];
  stocks.forEach((st) => {
    if (st.categorie === "custom") {
      const art = customs.find((a) => a.id === st.item_index);
      if (art) {
        const label = art.nom;
        if (st.quantite <= 0) ruptures.push({ nom: label, qte: st.quantite });
        else if (st.quantite <= st.seuil_alerte)
          alertes.push({
            nom: label,
            qte: st.quantite,
            seuil: st.seuil_alerte,
          });
      }
    } else {
      const catData = registreData[st.categorie];
      if (catData && catData.items[st.item_index]) {
        const item = catData.items[st.item_index];
        const champLabel =
          st.champ && st.champ !== "default" ? ` (${st.champ})` : "";
        const label = `${item.nom}${champLabel}`;
        if (st.quantite <= 0) ruptures.push({ nom: label, qte: st.quantite });
        else if (st.quantite <= st.seuil_alerte)
          alertes.push({
            nom: label,
            qte: st.quantite,
            seuil: st.seuil_alerte,
          });
      }
    }
  });
  ruptures.sort((a, b) => a.qte - b.qte);
  alertes.sort((a, b) => a.qte - b.qte);

  const dernieres = sales.slice(0, 5);

  const formatHeure = (date) =>
    new Date(date).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  let html = `
        <div class="dash-top">
            <div class="dash-card highlight">
                <span class="dash-card-label">💰 CA du jour</span>
                <span class="dash-card-value">${caDuJour} S</span>
                <span class="dash-card-sub">${nbVentesJour} vente${nbVentesJour > 1 ? "s" : ""} aujourd'hui ${evolutionJour}</span>
            </div>
            <div class="dash-card">
                <span class="dash-card-label">⚠️ Ruptures</span>
                <span class="dash-card-value" style="color:${ruptures.length > 0 ? "#ef4444" : "#22c55e"};">${ruptures.length}</span>
                <span class="dash-card-sub">${ruptures.length === 0 ? "Aucune rupture 🎉" : "article(s) à réapprovisionner"}</span>
            </div>
            <div class="dash-card">
                <span class="dash-card-label">🟠 Stock bas</span>
                <span class="dash-card-value" style="color:${alertes.length > 0 ? "#f59e0b" : "#22c55e"};">${alertes.length}</span>
                <span class="dash-card-sub">${alertes.length === 0 ? "Tout va bien" : "article(s) sous le seuil"}</span>
            </div>
        </div>
    `;

  html += `<div class="dash-grid">`;

  html += `
        <div class="dash-section">
            <h3>🏆 Top 3 ventes du jour</h3>
            ${
              top3.length === 0
                ? '<div class="dash-empty">Aucune vente aujourd\'hui.</div>'
                : top3
                    .map((a, i) => {
                      const medals = ["gold", "silver", "bronze"];
                      return `
                        <div class="dash-liste-item">
                            <span class="dash-item-rang ${medals[i]}">${i + 1}</span>
                            <span class="dash-item-nom">${a.nom}</span>
                            <span class="dash-item-val">${a.qte}× · ${a.total} S</span>
                        </div>
                    `;
                    })
                    .join("")
            }
        </div>
    `;

  html += `
        <div class="dash-section">
            <h3>⚠️ Articles en rupture (${ruptures.length})</h3>
            ${
              ruptures.length === 0
                ? '<div class="dash-empty">Aucune rupture de stock 🎉</div>'
                : ruptures
                    .slice(0, 8)
                    .map(
                      (r) => `
                    <div class="dash-alerte">
                        <span class="dash-alerte-nom">${r.nom}</span>
                        <span class="dash-alerte-qte">${r.qte} en stock</span>
                    </div>
                `,
                    )
                    .join("") +
                  (ruptures.length > 8
                    ? `<div class="dash-empty">+${ruptures.length - 8} autre(s)...</div>`
                    : "")
            }
        </div>
    `;

  html += `
        <div class="dash-section">
            <h3>🟠 Stock bas (${alertes.length})</h3>
            ${
              alertes.length === 0
                ? '<div class="dash-empty">Aucun stock en alerte 🎉</div>'
                : alertes
                    .slice(0, 8)
                    .map(
                      (a) => `
                    <div class="dash-alerte orange">
                        <span class="dash-alerte-nom">${a.nom}</span>
                        <span class="dash-alerte-qte">${a.qte} / seuil ${a.seuil}</span>
                    </div>
                `,
                    )
                    .join("") +
                  (alertes.length > 8
                    ? `<div class="dash-empty">+${alertes.length - 8} autre(s)...</div>`
                    : "")
            }
        </div>
    `;

  html += `
        <div class="dash-section">
            <h3>🕒 Dernières ventes</h3>
            ${
              dernieres.length === 0
                ? '<div class="dash-empty">Aucune vente enregistrée.</div>'
                : dernieres
                    .map((s) => {
                      const date = new Date(s.created_at);
                      const jour = date.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                      const heure = formatHeure(s.created_at);
                      const items = (s.items || [])
                        .map((i) => `${i.qte}× ${i.nom}`)
                        .join(", ");
                      return `
                        <div class="dash-vente-item">
                            <div class="dash-vente-info">
                                <span class="dash-vente-emp">${s.employee_nom || "?"} <span style="color:var(--text-muted);font-weight:400;">· ${jour} ${heure}</span></span>
                                <span class="dash-vente-detail">${items}</span>
                            </div>
                            <span class="dash-vente-total">${s.total} S</span>
                        </div>
                    `;
                    })
                    .join("")
            }
        </div>
    `;

  html += `</div>`;
  container.innerHTML = html;
}
