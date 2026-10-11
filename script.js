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

const CATEGORIES_BASE = [
  { key: "nourriture", titre: "Nourriture & Boissons", type: "simple" },
  { key: "sacs", titre: "Sacs & Sacoches", type: "simple" },
  { key: "vetements", titre: "Tenues & Vêtements", type: "simple" },
  { key: "chapeaux", titre: "Couvre-chefs & Capes", type: "simple" },
  { key: "chaussures", titre: "Gants & Chaussures", type: "simple" },
  { key: "armes", titre: "Armes", type: "multi" },
  { key: "armures", titre: "Armures & Équipements", type: "multi" },
  { key: "bijoux", titre: "Bijoux & Joaillerie", type: "simple" },
  { key: "outils", titre: "Capes, Accessoires & Outils", type: "simple" },
];
let CATEGORIES = [...CATEGORIES_BASE];

let panier = [];
let materiauxParCat = {};
let articlesParCat = {};
let prixParCell = {};
let stockData = {};
let editMode = false;
let utilisateurCourant = null;
let remisePourcent = 0;

let pendingChanges = {};

let comptaFilter = "all";
let _comptaCache = [];

// =========================================================
// HELPERS NUMÉRIQUES (décimales)
// =========================================================
function arrondir2(n) {
  return Math.round(n * 100) / 100;
}

function formatSeptims(n) {
  return Number(n).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

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
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.view === nomVue),
    );
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
    renderAdmin();
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
  document
    .querySelectorAll(".switch-tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => switchTab(tab.dataset.tab)),
    );
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
      if (target === "stock") renderAdmin();
    });
  });
  const ss = document.getElementById("stockSearch");
  if (ss) ss.addEventListener("input", filtrerStock);
  const bcat = document.getElementById("btnAddCategorie");
  if (bcat) bcat.addEventListener("click", ouvrirModalAddCat);
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
    const outils = document.getElementById("adminOutils");
    if (outils) outils.style.display = "none";
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
  const outils = document.getElementById("adminOutils");
  if (outils) outils.style.display = estPatron ? "block" : "none";
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
    banner.innerHTML = `<span>👁️ Mode lecture seule — Vous pouvez consulter les prix.</span>
            <button onclick="afficherVue('login')" class="btn-lecture">Se connecter</button>`;
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
    const { data: existe } = await supabaseClient.rpc("pseudo_existe", {
      p_pseudo: pseudo,
    });
    if (existe) {
      errorDiv.textContent = "Ce pseudo est déjà pris.";
      btn.disabled = false;
      btn.textContent = "Créer mon compte";
      return;
    }
  } catch (err) {
    errorDiv.textContent = "Erreur.";
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
      errorDiv.textContent = "Compte désactivé.";
    }
  }
}

async function deconnexion() {
  await supabaseClient.auth.signOut();
  panier = [];
  remisePourcent = 0;
  if (typeof mettreAJourPanierUI === "function") mettreAJourPanierUI();
}

async function chargerCategoriesCustom() {
  try {
    const { data } = await supabaseClient
      .from("custom_categories")
      .select("*")
      .order("ordre", { ascending: true });
    const customs = (data || []).map((c) => ({
      key: c.key,
      titre: c.titre,
      type: c.type,
      custom: true,
      id: c.id,
      ordre: c.ordre,
    }));
    CATEGORIES = [...CATEGORIES_BASE, ...customs];
  } catch (e) {
    CATEGORIES = [...CATEGORIES_BASE];
  }
}

async function assurerMateriauxStandards() {
  for (const cat of CATEGORIES) {
    if (cat.type === "simple") {
      const existing = materiauxParCat[cat.key] || [];
      if (existing.length === 0) {
        const { data } = await supabaseClient
          .from("materiaux")
          .insert({ categorie: cat.key, nom: "Prix", ordre: 0 })
          .select()
          .single();
        if (data) {
          materiauxParCat[cat.key] = [data];
        }
      }
    }
  }
}

async function chargerTout() {
  await chargerCategoriesCustom();
  const [resMat, resArt, resPrix, resStock] = await Promise.all([
    supabaseClient
      .from("materiaux")
      .select("*")
      .order("ordre", { ascending: true }),
    supabaseClient
      .from("articles")
      .select("*")
      .order("ordre", { ascending: true }),
    supabaseClient.from("prix_articles").select("*"),
    supabaseClient.from("stock").select("*"),
  ]);

  materiauxParCat = {};
  (resMat.data || []).forEach((m) => {
    if (!materiauxParCat[m.categorie]) materiauxParCat[m.categorie] = [];
    materiauxParCat[m.categorie].push(m);
  });

  articlesParCat = {};
  (resArt.data || []).forEach((a) => {
    if (!articlesParCat[a.categorie]) articlesParCat[a.categorie] = [];
    articlesParCat[a.categorie].push(a);
  });

  prixParCell = {};
  (resPrix.data || []).forEach((p) => {
    prixParCell[`${p.article_id}:${p.materiau_id}`] = p.prix;
  });

  stockData = {};
  (resStock.data || []).forEach((s) => {
    stockData[`${s.item_index}:${s.champ}`] = {
      quantite: s.quantite,
      seuil: s.seuil_alerte,
      id: s.id,
    };
  });

  await assurerMateriauxStandards();
}

function ecouterChangementsTempsReel() {
  supabaseClient
    .channel("db-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prix_articles" },
      () => chargerTout().then(() => renderAllSections()),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "articles" },
      () =>
        chargerTout().then(() => {
          renderTabs();
          renderAllSections();
        }),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "materiaux" },
      () =>
        chargerTout().then(() => {
          renderTabs();
          renderAllSections();
        }),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stock" },
      () =>
        chargerTout().then(() => {
          renderAllSections();
          mettreAJourPanierUI();
          const cv = document.querySelector(".view.active");
          if (cv && cv.id === "view-dashboard") chargerDashboard();
        }),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "custom_categories" },
      () => {
        chargerTout().then(() => {
          renderTabs();
          renderAllSections();
          renderAdmin();
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sales" },
      () => {
        const cv = document.querySelector(".view.active");
        if (cv && cv.id === "view-dashboard") chargerDashboard();
        if (cv && cv.id === "view-admin") {
          const panel = document.getElementById("adminComptabilite");
          if (panel && !panel.classList.contains("hidden"))
            chargerComptabilite();
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "employees" },
      (payload) => {
        if (
          payload.new &&
          utilisateurCourant &&
          payload.new.id === utilisateurCourant.id
        )
          gererChangementMonProfil(payload.new);
      },
    )
    .subscribe();
}

async function gererChangementMonProfil(nouveauProfil) {
  if (nouveauProfil.actif === false) {
    afficherToast("🚫 Compte désactivé.", "error", 5000);
    setTimeout(async () => {
      await supabaseClient.auth.signOut();
      location.reload();
    }, 2500);
    return;
  }
  if (nouveauProfil.valide === false && nouveauProfil.role !== "patron") {
    utilisateurCourant = nouveauProfil;
    setTimeout(() => {
      mettreAJourUIUtilisateur(utilisateurCourant);
      afficherVue("attente");
    }, 1500);
    return;
  }
  if (utilisateurCourant && nouveauProfil.role !== utilisateurCourant.role) {
    utilisateurCourant = nouveauProfil;
    mettreAJourUIUtilisateur(utilisateurCourant);
    return;
  }
  if (
    utilisateurCourant &&
    nouveauProfil.valide === true &&
    utilisateurCourant.valide !== true
  ) {
    utilisateurCourant = nouveauProfil;
    mettreAJourUIUtilisateur(utilisateurCourant);
    afficherVue("catalogue");
  }
}

function renderTabs() {
  const tabsContainer = document.getElementById("tabsContainer");
  if (!tabsContainer) return;
  tabsContainer.innerHTML = "";
  CATEGORIES.forEach(({ key, titre }) => {
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

  CATEGORIES.forEach(({ key, titre, type }) => {
    const section = document.createElement("section");
    section.id = key;
    section.className = "section-content";

    const h2 = document.createElement("h2");
    h2.textContent = titre;
    section.appendChild(h2);

    const materiaux = materiauxParCat[key] || [];
    const articles = articlesParCat[key] || [];

    if (materiaux.length === 0 && articles.length === 0) {
      const empty = document.createElement("p");
      empty.style.cssText =
        "text-align:center;color:var(--text-muted);font-style:italic;padding:2rem;";
      empty.textContent =
        "Aucun article dans cette catégorie. Ajoutez-en depuis l'administration.";
      section.appendChild(empty);
      mainContent.appendChild(section);
      return;
    }

    const tableResponsive = document.createElement("div");
    tableResponsive.className = "table-responsive";
    const table = document.createElement("table");
    table.className = type === "multi" ? "table-grid" : "table-list";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    const thType = document.createElement("th");
    thType.textContent = type === "multi" ? "TYPE" : "ARTICLE";
    trHead.appendChild(thType);

    materiaux.forEach((m) => {
      const th = document.createElement("th");
      th.textContent = m.nom;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    articles.forEach((a) => {
      const tr = document.createElement("tr");
      tr.classList.add("row-clickable");

      const tdNom = document.createElement("td");
      tdNom.innerHTML = `<strong>${a.nom}</strong>`;
      tr.appendChild(tdNom);

      materiaux.forEach((m) => {
        const key2 = `${a.id}:${m.id}`;
        const prix = prixParCell[key2];
        const td = document.createElement("td");
        td.dataset.articleId = a.id;
        td.dataset.materiauId = m.id;
        td.dataset.materiauNom = m.nom;
        td.dataset.articleNom = a.nom;
        td.dataset.cat = key;
        td.dataset.priceCell = "1";

        if (!prix || prix === "-" || prix === "X") {
          td.className = "price cell-vide";
          td.textContent = prix || "-";
        } else {
          td.className = "price cell-clickable";
          td.dataset.prix = prix;
          td.textContent = prix;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableResponsive.appendChild(table);
    section.appendChild(tableResponsive);
    mainContent.appendChild(section);
  });
}

function reRenderSection(cat) {
  renderAllSections();
}

function toggleEditMode() {
  if (editMode && Object.keys(pendingChanges).length > 0) {
    const nb = Object.keys(pendingChanges).length;
    const choix = confirm(
      `Vous avez ${nb} prix modifié(s) non enregistré(s).\n\n` +
        `OK = Enregistrer avant de quitter\n` +
        `Annuler = Ignorer les modifications`,
    );
    if (choix) {
      enregistrerTousLesPrix();
      return;
    } else {
      annulerTousLesPrix(true);
    }
  }

  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);
  const btn = document.getElementById("editToggle");
  if (btn) {
    btn.textContent = editMode ? "Terminer l'édition" : "Modifier les prix";
    btn.classList.toggle("active", editMode);
  }
  document.querySelectorAll("[data-price-cell]").forEach((cell) => {
    cell.contentEditable = editMode ? "true" : "false";
    if (!editMode) cell.blur();
  });
  mettreAJourBarreActions();
}

function setupEditToolbar() {
  const btn = document.getElementById("editToggle");
  if (btn) btn.addEventListener("click", toggleEditMode);

  creerBarreActions();

  document.addEventListener("focusout", (e) => {
    const cell = e.target;
    if (!cell.hasAttribute || !cell.hasAttribute("data-price-cell")) return;
    if (!editMode) return;

    const articleId = parseInt(cell.dataset.articleId);
    const materiauId = parseInt(cell.dataset.materiauId);
    let newValue = (cell.textContent || "").replace(/\s+/g, " ").trim();
    if (!newValue) newValue = "-";

    const key = `${articleId}:${materiauId}`;
    const originalValue = prixParCell[key] || "-";

    if (newValue === originalValue) {
      delete pendingChanges[key];
      cell.classList.remove("cell-modified");
      cell.dataset.prix = newValue;
      mettreAJourBarreActions();
      return;
    }

    pendingChanges[key] = {
      articleId,
      materiauId,
      oldValue: originalValue,
      newValue: newValue,
    };
    cell.dataset.prix = newValue;
    cell.classList.add("cell-modified");
    mettreAJourBarreActions();
  });

  document.addEventListener("keydown", (e) => {
    const cell = e.target;
    const isCell = cell.hasAttribute && cell.hasAttribute("data-price-cell");
    if (isCell && editMode) {
      if (e.key === "Enter") {
        e.preventDefault();
        cell.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const key = `${cell.dataset.articleId}:${cell.dataset.materiauId}`;
        const change = pendingChanges[key];
        const restore = change ? change.oldValue : prixParCell[key] || "-";
        cell.textContent = restore;
        cell.dataset.prix = restore;
        delete pendingChanges[key];
        cell.classList.remove("cell-modified");
        cell.blur();
        mettreAJourBarreActions();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && editMode) {
      e.preventDefault();
      if (Object.keys(pendingChanges).length > 0) enregistrerTousLesPrix();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (Object.keys(pendingChanges).length > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function creerBarreActions() {
  if (document.getElementById("editActionsBar")) return;
  const bar = document.createElement("div");
  bar.id = "editActionsBar";
  bar.className = "edit-actions-bar";
  bar.innerHTML = `
    <span class="edit-actions-info">
      <strong id="editActionsCount">0</strong> modification(s) en attente
    </span>
    <button id="editSaveBtn" class="btn-toolbar btn-save">💾 Enregistrer tout</button>
    <button id="editCancelBtn" class="btn-toolbar btn-danger">↩️ Annuler</button>
  `;
  document.body.appendChild(bar);

  document
    .getElementById("editSaveBtn")
    .addEventListener("click", enregistrerTousLesPrix);
  document
    .getElementById("editCancelBtn")
    .addEventListener("click", () => annulerTousLesPrix(false));
}

function mettreAJourBarreActions() {
  const bar = document.getElementById("editActionsBar");
  if (!bar) return;
  const nb = Object.keys(pendingChanges).length;
  const cnt = document.getElementById("editActionsCount");
  if (cnt) cnt.textContent = nb;
  bar.classList.toggle("visible", editMode && nb > 0);
}

async function enregistrerTousLesPrix() {
  const keys = Object.keys(pendingChanges);
  if (keys.length === 0) return;

  const saveBtn = document.getElementById("editSaveBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ Enregistrement...";
  }

  let succes = 0,
    erreurs = 0;

  for (const key of keys) {
    const { articleId, materiauId, newValue } = pendingChanges[key];
    const existing = prixParCell[key];
    try {
      if (existing !== undefined && existing !== null) {
        const { error } = await supabaseClient
          .from("prix_articles")
          .update({ prix: newValue })
          .eq("article_id", articleId)
          .eq("materiau_id", materiauId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("prix_articles").insert({
          article_id: articleId,
          materiau_id: materiauId,
          prix: newValue,
        });
        if (error) throw error;
      }
      prixParCell[key] = newValue;
      succes++;
    } catch (err) {
      console.error("Erreur sauvegarde", key, err);
      erreurs++;
    }
  }

  pendingChanges = {};
  document.querySelectorAll(".cell-modified").forEach((c) => {
    c.classList.remove("cell-modified");
    c.classList.add("saved-flash");
    setTimeout(() => c.classList.remove("saved-flash"), 600);
  });

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Enregistrer tout";
  }
  mettreAJourBarreActions();

  if (erreurs === 0)
    afficherToast(`✅ ${succes} prix enregistré(s)`, "success");
  else afficherToast(`⚠️ ${succes} ok, ${erreurs} erreur(s)`, "error", 5000);
}

function annulerTousLesPrix(silencieux = false) {
  const keys = Object.keys(pendingChanges);
  if (keys.length === 0) return;
  if (!silencieux && !confirm(`Annuler les ${keys.length} modification(s) ?`))
    return;

  document.querySelectorAll("[data-price-cell]").forEach((cell) => {
    const key = `${cell.dataset.articleId}:${cell.dataset.materiauId}`;
    const change = pendingChanges[key];
    if (change) {
      cell.textContent = change.oldValue;
      cell.dataset.prix = change.oldValue;
      cell.classList.remove("cell-modified");
    }
  });

  pendingChanges = {};
  mettreAJourBarreActions();
  if (!silencieux) afficherToast("↩️ Modifications annulées", "info");
}

function renderAdmin() {
  const container = document.getElementById("stockContent");
  if (!container) return;
  container.innerHTML = "";

  CATEGORIES.forEach(({ key, titre, custom, id: catId }) => {
    const materiaux = materiauxParCat[key] || [];
    const articles = articlesParCat[key] || [];
    const isMulti = key === "armes" || key === "armures";
    const estCustom = custom === true;

    const catDiv = document.createElement("div");
    catDiv.className = "stock-categorie";

    const header = document.createElement("div");
    header.className = "stock-categorie-header";
    header.style.cursor = "pointer";
    header.style.userSelect = "none";
    header.innerHTML = `
            <span class="stock-categorie-titre" style="display:flex;align-items:center;gap:0.5rem;">
                <span class="toggle-icon" style="display:inline-block;width:1em;transition:transform 0.2s;">▶</span>
                ${titre}
                ${estCustom ? `<button class="btn-mini btn-danger" data-action="delete-cat" data-cat="${key}" data-cat-id="${catId}" data-nom="${titre}" title="Supprimer la catégorie">🗑️</button>` : ""}
            </span>
            <span class="stock-categorie-stats">${materiaux.length} colonnes · ${articles.length} articles</span>
        `;

    const body = document.createElement("div");
    body.className = "stock-categorie-body hidden";
    body.style.padding = "1rem";

    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);";
    let toolbarHtml = "";
    if (isMulti) {
      toolbarHtml += `<button class="btn-toolbar" data-action="add-mat" data-cat="${key}" data-titre="${titre}">➕ Ajouter une colonne</button>`;
    }
    toolbarHtml += `<button class="btn-toolbar" data-action="add-art" data-cat="${key}" data-titre="${titre}">➕ Ajouter un article</button>`;
    toolbar.innerHTML = toolbarHtml;
    body.appendChild(toolbar);

    if (isMulti && materiaux.length > 0) {
      const matTitle = document.createElement("div");
      matTitle.style.cssText =
        "font-family: var(--font-title); color: var(--accent); font-size: 0.9rem; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);";
      matTitle.textContent = "📊 Colonnes";
      body.appendChild(matTitle);

      materiaux.forEach((m, idx) => {
        const div = document.createElement("div");
        div.className = "manage-item";
        div.innerHTML = `
                    <span class="manage-item-nom">${m.nom}</span>
                    <div class="manage-item-actions">
                        <button class="btn-mini" data-action="up" data-type="mat" data-id="${m.id}" ${idx === 0 ? "disabled" : ""}>⬆️</button>
                        <button class="btn-mini" data-action="down" data-type="mat" data-id="${m.id}" ${idx === materiaux.length - 1 ? "disabled" : ""}>⬇️</button>
                        <button class="btn-mini" data-action="rename" data-type="mat" data-id="${m.id}" data-nom="${m.nom}">✏️</button>
                        <button class="btn-mini btn-danger" data-action="delete" data-type="mat" data-id="${m.id}" data-nom="${m.nom}">🗑️</button>
                    </div>
                `;
        body.appendChild(div);
      });
    }

    if (articles.length > 0) {
      const artTitle = document.createElement("div");
      artTitle.style.cssText =
        "font-family: var(--font-title); color: var(--accent); font-size: 0.9rem; margin-top: 1rem; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);";
      artTitle.textContent = "📦 Articles & Stocks";
      body.appendChild(artTitle);
    }

    if (articles.length === 0) {
      const empty = document.createElement("p");
      empty.style.cssText =
        "color: var(--text-muted); font-style: italic; text-align: center; padding: 1rem;";
      empty.textContent = "Aucun article dans cette catégorie.";
      body.appendChild(empty);
    } else {
      articles.forEach((a, artIdx) => {
        const artHeader = document.createElement("div");
        artHeader.style.cssText =
          "display: flex; justify-content: space-between; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 0.6rem 0.85rem; border-radius: 8px; margin-top: 0.85rem; margin-bottom: 0.35rem; gap: 0.5rem; flex-wrap: wrap;";
        artHeader.innerHTML = `
                    <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${a.nom}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-mini" data-action="up" data-type="art" data-id="${a.id}" ${artIdx === 0 ? "disabled" : ""}>⬆️</button>
                        <button class="btn-mini" data-action="down" data-type="art" data-id="${a.id}" ${artIdx === articles.length - 1 ? "disabled" : ""}>⬇️</button>
                        <button class="btn-mini" data-action="rename" data-type="art" data-id="${a.id}" data-nom="${a.nom}">✏️</button>
                        <button class="btn-mini btn-danger" data-action="delete" data-type="art" data-id="${a.id}" data-nom="${a.nom}">🗑️</button>
                    </div>
                `;
        body.appendChild(artHeader);

        materiaux.forEach((m) => {
          const key2 = `${a.id}:${m.id}`;
          const st = stockData[key2] || { quantite: 0, seuil: 5 };
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

          const itemDiv = document.createElement("div");
          itemDiv.className = `stock-item ${etatClass}`;
          itemDiv.dataset.nom = `${a.nom} (${m.nom})`;
          itemDiv.innerHTML = `
            <div class="stock-item-nom">${m.nom}${badge}</div>
            <div class="stock-input-group">
              <label class="stock-input-label">Quantité</label>
              <input type="number" min="0" class="stock-input" value="${st.quantite}" data-article="${a.id}" data-materiau="${m.id}" data-field="quantite">
            </div>
            <div class="stock-input-group">
              <label class="stock-input-label">Seuil</label>
              <input type="number" min="0" class="stock-input" value="${st.seuil}" data-article="${a.id}" data-materiau="${m.id}" data-field="seuil">
            </div>
            <button
              class="btn-mini btn-danger btn-del-mat-art"
              data-article="${a.id}"
              data-materiau="${m.id}"
              data-nom-article="${a.nom}"
              data-nom-materiau="${m.nom}"
              data-cat="${key}"
              title="Supprimer ${m.nom} pour ${a.nom}"
              style="margin-left: 8px;"
            >🗑️</button>
          `;
          body.appendChild(itemDiv);
        });
      });
    }

    header.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-mini")) return;
      const isHidden = body.classList.contains("hidden");
      body.classList.toggle("hidden");
      const icon = header.querySelector(".toggle-icon");
      if (icon)
        icon.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
    });

    catDiv.appendChild(header);
    catDiv.appendChild(body);
    container.appendChild(catDiv);
  });

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      const type = e.currentTarget.dataset.type;
      const id = e.currentTarget.dataset.id;
      const nom = e.currentTarget.dataset.nom;
      const cat = e.currentTarget.dataset.cat;
      const titre = e.currentTarget.dataset.titre;
      const catId = e.currentTarget.dataset.catId;

      if (action === "add-mat") return ouvrirModalAddMat(cat, titre);
      if (action === "add-art") return ouvrirModalAddArt(cat, titre);
      if (action === "delete-cat") return supprimerCategorie(cat, catId, nom);

      await executerActionDirecte(type, action, id, nom);
    });
  });

  // 🆕 Suppression d'un matériau pour UN article spécifique
  container.querySelectorAll(".btn-del-mat-art").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const articleId = parseInt(e.currentTarget.dataset.article);
      const materiauId = parseInt(e.currentTarget.dataset.materiau);
      const nomArticle = e.currentTarget.dataset.nomArticle;
      const nomMateriau = e.currentTarget.dataset.nomMateriau;

      if (
        !confirm(
          `⚠️ Supprimer "${nomMateriau}" pour "${nomArticle}" ?\n\n` +
            `Le prix ET le stock de cette combinaison seront supprimés.`,
        )
      )
        return;

      // Supprimer le prix
      await supabaseClient
        .from("prix_articles")
        .delete()
        .eq("article_id", articleId)
        .eq("materiau_id", materiauId);

      // Supprimer le stock
      await supabaseClient
        .from("stock")
        .delete()
        .eq("item_index", articleId)
        .eq("champ", String(materiauId));

      // Mettre à jour le cache local
      delete prixParCell[`${articleId}:${materiauId}`];
      delete stockData[`${articleId}:${materiauId}`];

      afficherToast(`✅ ${nomMateriau} retiré de ${nomArticle}`, "success");
      await chargerTout();
      renderAllSections();
      renderAdmin();
    });
  });

  container.querySelectorAll(".stock-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const articleId = parseInt(e.target.dataset.article);
      const materiauId = parseInt(e.target.dataset.materiau);
      const field = e.target.dataset.field;
      const value = parseInt(e.target.value) || 0;

      const key = `${articleId}:${materiauId}`;
      const current = stockData[key] || { quantite: 0, seuil: 5 };
      if (field === "quantite") current.quantite = value;
      else current.seuil = value;
      stockData[key] = current;

      await supabaseClient.from("stock").upsert(
        {
          categorie: "",
          item_index: articleId,
          champ: String(materiauId),
          item_nom: "",
          quantite: current.quantite,
          seuil_alerte: current.seuil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "categorie,item_index,champ" },
      );

      e.target.classList.add("saved-flash");
      setTimeout(() => e.target.classList.remove("saved-flash"), 500);
    });
  });
}

async function supprimerCategorie(catKey, catId, nom) {
  if (
    !confirm(
      `⚠️ Supprimer la catégorie "${nom}" ?\n\nTous ses articles, prix et stocks seront supprimés.`,
    )
  )
    return;
  if (!confirm("Confirmer définitivement ?")) return;

  const articles = articlesParCat[catKey] || [];
  const materiaux = materiauxParCat[catKey] || [];

  for (const a of articles) {
    for (const m of materiaux) {
      await supabaseClient
        .from("stock")
        .delete()
        .eq("item_index", a.id)
        .eq("champ", String(m.id));
      await supabaseClient
        .from("prix_articles")
        .delete()
        .eq("article_id", a.id)
        .eq("materiau_id", m.id);
    }
  }
  await supabaseClient.from("articles").delete().eq("categorie", catKey);
  await supabaseClient.from("materiaux").delete().eq("categorie", catKey);
  await supabaseClient
    .from("custom_categories")
    .delete()
    .eq("id", parseInt(catId));

  await chargerTout();
  renderTabs();
  renderAllSections();
  renderAdmin();
  afficherToast("✅ Catégorie supprimée", "success");
}

async function executerActionDirecte(type, action, id, nom) {
  const idNum = parseInt(id);
  const table = type === "mat" ? "materiaux" : "articles";

  let cat = null;
  let list = null;
  if (type === "mat") {
    for (const [k, arr] of Object.entries(materiauxParCat)) {
      if (arr.find((m) => m.id === idNum)) {
        cat = k;
        list = arr;
        break;
      }
    }
  } else {
    for (const [k, arr] of Object.entries(articlesParCat)) {
      if (arr.find((a) => a.id === idNum)) {
        cat = k;
        list = arr;
        break;
      }
    }
  }
  if (!cat) return;

  const idx = list.findIndex((x) => x.id === idNum);
  if (idx === -1) return;

  if (action === "up" && idx > 0) {
    const prev = list[idx - 1];
    const curr = list[idx];
    const newOrdre = parseFloat(prev.ordre) - 1;
    await supabaseClient
      .from(table)
      .update({ ordre: newOrdre })
      .eq("id", curr.id);
  } else if (action === "down" && idx < list.length - 1) {
    const next = list[idx + 1];
    const curr = list[idx];
    const newOrdre = parseFloat(next.ordre) + 1;
    await supabaseClient
      .from(table)
      .update({ ordre: newOrdre })
      .eq("id", curr.id);
  } else if (action === "rename") {
    const nouveau = prompt(`Renommer "${nom}" en :`, nom);
    if (!nouveau || !nouveau.trim() || nouveau.trim() === nom) return;
    const { error } = await supabaseClient
      .from(table)
      .update({ nom: nouveau.trim() })
      .eq("id", idNum);
    if (error) {
      afficherToast("Erreur : " + error.message, "error");
      return;
    }
  } else if (action === "delete") {
    const msg =
      type === "mat"
        ? `⚠️ Supprimer la colonne "${nom}" ?\n\nTous les prix associés seront supprimés.`
        : `⚠️ Supprimer l'article "${nom}" ?\n\nTous ses prix et stocks seront supprimés.`;
    if (!confirm(msg)) return;
    if (!confirm("Confirmer ?")) return;

    // Si c'est un article, nettoyer aussi le stock (orphelin sinon)
    if (type === "art") {
      const materiauxDeLaCat = materiauxParCat[cat] || [];
      for (const m of materiauxDeLaCat) {
        await supabaseClient
          .from("stock")
          .delete()
          .eq("item_index", idNum)
          .eq("champ", String(m.id));
      }
    }

    const { error } = await supabaseClient.from(table).delete().eq("id", idNum);
    if (error) {
      afficherToast("Erreur : " + error.message, "error");
      return;
    }
  }

  await chargerTout();
  renderTabs();
  renderAllSections();
  renderAdmin();
  afficherToast("✅ Modifié", "success");
}

function fermerModal(id) {
  document.getElementById(id).classList.add("hidden");
}

let _modalCat = "",
  _modalTitre = "";

function ouvrirModalAddMat(cat, titre) {
  _modalCat = cat;
  _modalTitre = titre;
  document.getElementById("modalAddMatCat").textContent = titre;
  document.getElementById("addMatNom").value = "";

  const select = document.getElementById("addMatPosition");
  select.innerHTML = '<option value="end">À la fin</option>';
  const materiaux = materiauxParCat[cat] || [];
  materiaux.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = `before_${m.ordre}_${m.id}`;
    opt.textContent = `Avant "${m.nom}"`;
    select.appendChild(opt);
  });
  materiaux.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = `after_${m.ordre}_${m.id}`;
    opt.textContent = `Après "${m.nom}"`;
    select.appendChild(opt);
  });

  document.getElementById("modalAddMat").classList.remove("hidden");
  setTimeout(() => document.getElementById("addMatNom").focus(), 100);
}

function ouvrirModalAddArt(cat, titre) {
  _modalCat = cat;
  _modalTitre = titre;
  document.getElementById("modalAddArtCat").textContent = titre;
  document.getElementById("addArtNom").value = "";
  document.getElementById("addArtStock").value = "0";

  const select = document.getElementById("addArtPosition");
  select.innerHTML = '<option value="end">À la fin</option>';
  const articles = articlesParCat[cat] || [];
  articles.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = `before_${a.ordre}_${a.id}`;
    opt.textContent = `Avant "${a.nom}"`;
    select.appendChild(opt);
  });
  articles.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = `after_${a.ordre}_${a.id}`;
    opt.textContent = `Après "${a.nom}"`;
    select.appendChild(opt);
  });

  const catInfo = CATEGORIES.find((c) => c.key === cat);
  const isMulti = catInfo && catInfo.type === "multi";
  const materiaux = materiauxParCat[cat] || [];

  const zoneSimple = document.getElementById("addArtPrixSimple");
  const zoneMulti = document.getElementById("addArtPrixMulti");
  const grid = document.getElementById("addArtPrixGrid");

  if (isMulti && materiaux.length > 0) {
    zoneSimple.classList.add("hidden");
    zoneMulti.classList.remove("hidden");
    grid.innerHTML = "";

    materiaux.forEach((m) => {
      const item = document.createElement("div");
      item.className = "prix-grid-item";
      item.innerHTML = `
        <label>${m.nom}</label>
        <input type="text" class="addArtPrixInput" data-materiau="${m.id}" placeholder="-">
      `;
      grid.appendChild(item);
    });
  } else {
    zoneSimple.classList.remove("hidden");
    zoneMulti.classList.add("hidden");
    document.getElementById("addArtPrix").value = "";
  }

  document.getElementById("modalAddArt").classList.remove("hidden");
  setTimeout(() => document.getElementById("addArtNom").focus(), 100);
}

function ouvrirModalAddCat() {
  document.getElementById("addCatNom").value = "";
  document.getElementById("addCatType").value = "simple";
  document.getElementById("modalAddCat").classList.remove("hidden");
  setTimeout(() => document.getElementById("addCatNom").focus(), 100);
}

function genererKey(titre) {
  return (
    titre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") +
    "_" +
    Date.now().toString(36)
  );
}

function setupFormsAdmin() {
  const formMat = document.getElementById("formAddMat");
  if (formMat) {
    formMat.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nom = document.getElementById("addMatNom").value.trim();
      if (!nom) return;

      const position = document.getElementById("addMatPosition").value;
      const materiaux = materiauxParCat[_modalCat] || [];

      let ordre = materiaux.length
        ? Math.max(...materiaux.map((m) => parseFloat(m.ordre))) + 1
        : 0;

      if (position !== "end") {
        const parts = position.split("_");
        const direction = parts[0];
        const prevOrdre = parseFloat(parts[1]);
        if (direction === "before") ordre = prevOrdre - 0.5;
        else ordre = prevOrdre + 0.5;
      }

      const { error } = await supabaseClient
        .from("materiaux")
        .insert({ categorie: _modalCat, nom, ordre });
      if (error) {
        afficherToast("Erreur : " + error.message, "error");
        return;
      }

      fermerModal("modalAddMat");
      afficherToast("✅ Colonne ajoutée", "success");
      await chargerTout();
      renderTabs();
      renderAllSections();
      renderAdmin();
    });
  }

  const formArt = document.getElementById("formAddArt");
  if (formArt) {
    formArt.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nom = document.getElementById("addArtNom").value.trim();
      const stockInit =
        parseInt(document.getElementById("addArtStock").value) || 0;
      if (!nom) return;

      const position = document.getElementById("addArtPosition").value;
      const articles = articlesParCat[_modalCat] || [];

      let ordre = articles.length
        ? Math.max(...articles.map((a) => parseFloat(a.ordre))) + 1
        : 0;

      if (position !== "end") {
        const parts = position.split("_");
        const direction = parts[0];
        const prevOrdre = parseFloat(parts[1]);
        if (direction === "before") ordre = prevOrdre - 0.5;
        else ordre = prevOrdre + 0.5;
      }

      const { data: newArticle, error } = await supabaseClient
        .from("articles")
        .insert({ categorie: _modalCat, nom, ordre })
        .select()
        .single();
      if (error) {
        afficherToast("Erreur : " + error.message, "error");
        return;
      }

      const catInfo = CATEGORIES.find((c) => c.key === _modalCat);
      const isMulti = catInfo && catInfo.type === "multi";
      const materiaux = materiauxParCat[_modalCat] || [];

      let premierMateriauAvecPrix = null;

      if (isMulti && materiaux.length > 0) {
        const inputs = document.querySelectorAll(
          "#addArtPrixGrid .addArtPrixInput",
        );
        const prixInserts = [];
        inputs.forEach((inp) => {
          const val = inp.value.trim();
          if (!val) return;
          const mid = parseInt(inp.dataset.materiau);
          prixInserts.push({
            article_id: newArticle.id,
            materiau_id: mid,
            prix: val,
          });
          if (premierMateriauAvecPrix === null) premierMateriauAvecPrix = mid;
        });

        if (prixInserts.length > 0) {
          const { error: errPrix } = await supabaseClient
            .from("prix_articles")
            .insert(prixInserts);
          if (errPrix) {
            afficherToast("Erreur prix : " + errPrix.message, "error");
          }
        }
      } else {
        const prix = document.getElementById("addArtPrix").value.trim();
        const materiauId = materiaux[0]?.id;
        if (materiauId && prix) {
          await supabaseClient.from("prix_articles").insert({
            article_id: newArticle.id,
            materiau_id: materiauId,
            prix: prix,
          });
          premierMateriauAvecPrix = materiauId;
        }
      }

      if (stockInit > 0 && premierMateriauAvecPrix !== null) {
        await supabaseClient.from("stock").upsert(
          {
            categorie: _modalCat,
            item_index: newArticle.id,
            champ: String(premierMateriauAvecPrix),
            item_nom: nom,
            quantite: stockInit,
            seuil_alerte: 5,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "categorie,item_index,champ" },
        );
      }

      fermerModal("modalAddArt");
      afficherToast("✅ Article ajouté", "success");
      await chargerTout();
      renderTabs();
      renderAllSections();
      renderAdmin();
    });
  }

  const formCat = document.getElementById("formAddCat");
  if (formCat) {
    formCat.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titre = document.getElementById("addCatNom").value.trim();
      const type = document.getElementById("addCatType").value;
      if (!titre) return;

      const key = genererKey(titre);
      const ordre = CATEGORIES.length;

      const { error } = await supabaseClient
        .from("custom_categories")
        .insert({ key, titre, type, ordre });
      if (error) {
        afficherToast("Erreur : " + error.message, "error");
        return;
      }

      if (type === "simple") {
        await supabaseClient
          .from("materiaux")
          .insert({ categorie: key, nom: "Prix", ordre: 0 });
      }

      fermerModal("modalAddCat");
      afficherToast('✅ Catégorie "' + titre + '" créée', "success");
      await chargerTout();
      renderTabs();
      renderAllSections();
      renderAdmin();
    });
  }
}

function filtrerStock() {
  const q = document.getElementById("stockSearch").value.toLowerCase().trim();
  document.querySelectorAll(".stock-categorie").forEach((cat) => {
    const items = cat.querySelectorAll(".stock-item, .manage-item");
    let visible = false;
    items.forEach((item) => {
      const match = item.textContent.toLowerCase().includes(q);
      item.style.display = match ? "" : "none";
      if (match) visible = true;
    });
    if (q === "") {
      cat.style.display = "";
      items.forEach((item) => (item.style.display = ""));
    } else {
      cat.style.display = visible ? "" : "none";
      const body = cat.querySelector(".stock-categorie-body");
      if (body && visible) body.classList.remove("hidden");
    }
  });
}

// =========================================================
// PANIER & VENTE
// =========================================================
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
  if (typeof prixTexte === "number") return arrondir2(prixTexte);
  if (typeof prixTexte === "string") {
    const clean = prixTexte.replace(",", ".");
    const m = clean.match(/\d+(\.\d+)?/);
    return m ? arrondir2(parseFloat(m[0])) : 0;
  }
  return 0;
}

function ajouterAuPanier(nom, prixTexte, details = "", key = null) {
  const prix = extrairePrix(prixTexte);
  if (prix <= 0) return;
  const nomComplet = details ? `${nom} (${details})` : nom;
  const ex = panier.find(
    (i) =>
      i.nom === nomComplet &&
      i.articleId === key?.articleId &&
      i.materiauId === key?.materiauId,
  );
  if (ex) ex.quantite += 1;
  else
    panier.push({
      nom: nomComplet,
      prixUnitaire: prix,
      quantite: 1,
      articleId: key?.articleId || null,
      materiauId: key?.materiauId || null,
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
      const st = arrondir2(item.prixUnitaire * item.quantite);
      totalAvantRemise = arrondir2(totalAvantRemise + st);
      count += item.quantite;
      let stockInfo = "";
      if (item.articleId && item.materiauId) {
        const sk = `${item.articleId}:${item.materiauId}`;
        const s = stockData[sk];
        if (s) {
          if (s.quantite <= 0)
            stockInfo = `<span class="item-stock-info rupture">⚠ Rupture (${s.quantite})</span>`;
          else if (s.quantite < item.quantite)
            stockInfo = `<span class="item-stock-info rupture">⚠ Seulement ${s.quantite}</span>`;
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
                    <span class="item-details">${formatSeptims(item.prixUnitaire)} S × ${item.quantite}</span>
                    ${stockInfo}
                </div>
                <div class="item-action">
                    <span class="item-prix">${formatSeptims(st)} S</span>
                    <button class="btn-remove-item" data-index="${index}">✕</button>
                </div>`;
      list.appendChild(li);
    });
    if (btnValider) btnValider.disabled = false;
  }
  const montantRemise = arrondir2(totalAvantRemise * (remisePourcent / 100));
  const totalFinal = arrondir2(totalAvantRemise - montantRemise);
  if (totalSpan) totalSpan.textContent = formatSeptims(totalFinal);
  if (badge) badge.textContent = count;
  if (remiseInfo) {
    if (remisePourcent > 0 && totalAvantRemise > 0) {
      remiseInfo.style.display = "block";
      remiseInfo.textContent = `(-${formatSeptims(montantRemise)} S)`;
    } else remiseInfo.style.display = "none";
  }
  list.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      retirerDuPanier(parseInt(e.target.dataset.index, 10));
    });
  });
}

document.addEventListener("click", (e) => {
  if (editMode) return;
  const estValide =
    utilisateurCourant &&
    (utilisateurCourant.valide === true ||
      utilisateurCourant.role === "patron");
  if (e.target.classList.contains("cell-clickable")) {
    if (!estValide) return avertirLectureSeule();
    const articleId = parseInt(e.target.dataset.articleId);
    const materiauId = parseInt(e.target.dataset.materiauId);
    const prix = e.target.dataset.prix;
    const nom = e.target.dataset.articleNom;
    const matNom = e.target.dataset.materiauNom;
    ajouterAuPanier(nom, prix, matNom, { articleId, materiauId });
    e.target.style.backgroundColor = "rgba(245, 158, 11, 0.3)";
    setTimeout(() => {
      e.target.style.backgroundColor = "";
    }, 300);
  }
});

function avertirLectureSeule() {
  const banner = document.getElementById("lectureBanner");
  if (banner) {
    banner.style.transform = "scale(1.02)";
    banner.style.borderColor = "#ef4444";
    setTimeout(() => {
      banner.style.transform = "";
      banner.style.borderColor = "";
    }, 600);
  }
}

async function validerVente() {
  if (!utilisateurCourant) {
    afficherToast("Connectez-vous.", "error");
    return;
  }
  if (panier.length === 0) {
    afficherToast("Panier vide.", "error");
    return;
  }
  const estValide =
    utilisateurCourant.valide === true || utilisateurCourant.role === "patron";
  if (!estValide) {
    afficherToast("Compte non validé.", "error");
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
    cat: "",
    idx: i.articleId,
    champ: String(i.materiauId),
  }));

  let totalAvantRemise = 0;
  panier.forEach((i) => {
    totalAvantRemise = arrondir2(
      totalAvantRemise + i.prixUnitaire * i.quantite,
    );
  });
  const montantRemise = arrondir2(totalAvantRemise * (remisePourcent / 100));
  const totalFinal = arrondir2(totalAvantRemise - montantRemise);

  const { error } = await supabaseClient.rpc("valider_vente", {
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
    afficherToast(error.message || "Erreur.", "error", 5000);
    return;
  }

  afficherToast(`✅ Vente : ${formatSeptims(totalFinal)} S`, "success", 4000);
  panier = [];
  remisePourcent = 0;
  const ri = document.getElementById("remiseInput");
  if (ri) ri.value = 0;
  mettreAJourPanierUI();
  await chargerTout();
  renderAllSections();
}

// =========================================================
// EMPLOYÉS
// =========================================================
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
      confirmation = "Valider ?";
      updates = { valide: true };
      break;
    case "invalider":
      confirmation = "Invalider ?";
      updates = { valide: false };
      break;
    case "promote":
      confirmation = "Passer Patron ?";
      updates = { role: "patron", valide: true };
      break;
    case "demote":
      confirmation = "Rétrograder ?";
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
  await supabaseClient.from("employees").update(updates).eq("id", id);
  chargerListeEmployes();
}

// =========================================================
// COMPTABILITÉ
// =========================================================
async function reinitialiserComptabilite() {
  if (utilisateurCourant?.role !== "patron") return;
  if (!confirm("⚠️ Supprimer TOUTES les ventes ?")) return;
  if (!confirm("⚠️ Confirmer ?")) return;
  await supabaseClient.from("sales").delete().neq("id", 0);
  afficherToast("✅ Réinitialisé", "success");
  chargerComptabilite();
}

function exporterComptabiliteCSV() {
  if (!window._comptaSales || window._comptaSales.length === 0) {
    afficherToast("Aucune vente", "error");
    return;
  }
  const escapeCSV = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  let csv = "\uFEFFDate;Employé;Articles;Total;Remise;Avant remise\n";
  window._comptaSales.forEach((s) => {
    const date = new Date(s.created_at)
      .toLocaleString("fr-FR")
      .replace(/,/g, "");
    const items = (s.items || []).map((i) => `${i.qte}x ${i.nom}`).join(" | ");
    const remise = Number(s.remise_pourcent || 0);
    const avantRemise = Number(s.total_avant_remise || s.total);
    csv +=
      [
        escapeCSV(date),
        escapeCSV(s.employee_nom),
        escapeCSV(items),
        escapeCSV(s.total),
        escapeCSV(remise > 0 ? remise + "%" : ""),
        escapeCSV(remise > 0 ? avantRemise : ""),
      ].join(";") + "\n";
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `comptabilite_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  afficherToast("✅ Export", "success");
}

async function annulerDerniereVente() {
  if (utilisateurCourant?.role !== "patron") return;
  const { data: sales } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (!sales || !sales.length) {
    afficherToast("Aucune vente", "error");
    return;
  }
  if (!confirm("Annuler la dernière vente ?")) return;
  await supabaseClient.rpc("annuler_vente", { p_sale_id: sales[0].id });
  afficherToast("✅ Annulée", "success");
  await chargerTout();
  renderAllSections();
  chargerComptabilite();
}

async function chargerComptabilite() {
  const container = document.getElementById("comptabiliteContent");
  if (!container) return;
  const estPatron = utilisateurCourant?.role === "patron";

  container.innerHTML = `
    ${
      estPatron
        ? `<div style="text-align:center;margin-bottom:1.5rem;display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
            <button id="exportCsvBtn" class="btn-toolbar">📥 Export CSV</button>
            <button id="annulerVenteBtn" class="btn-toolbar">↩️ Annuler dernière</button>
            <button id="resetComptaBtn" class="btn-toolbar btn-danger">🗑️ Réinitialiser</button>
        </div>`
        : ""
    }
    <div class="compta-filter" id="comptaFilter">
      <button data-periode="today">Aujourd'hui</button>
      <button data-periode="7d">7 jours</button>
      <button data-periode="30d">30 jours</button>
      <button data-periode="all" class="active">Tout</button>
    </div>
    <div id="comptaData">Chargement...</div>
  `;

  const { data: sales } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });

  _comptaCache = sales || [];

  document.querySelectorAll("#comptaFilter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      comptaFilter = btn.dataset.periode;
      document
        .querySelectorAll("#comptaFilter button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderComptaData();
    });
  });

  renderComptaData();
}

function filtrerParPeriode(sales, periode) {
  if (periode === "all") return sales;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let debut;
  if (periode === "today") debut = today;
  else if (periode === "7d") {
    debut = new Date(today);
    debut.setDate(debut.getDate() - 7);
  } else if (periode === "30d") {
    debut = new Date(today);
    debut.setDate(debut.getDate() - 30);
  }
  return sales.filter((s) => new Date(s.created_at) >= debut);
}

function getVentesPeriodePrecedente(sales, periode) {
  if (periode === "all") return [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let debutPrec, finPrec;

  if (periode === "today") {
    finPrec = today;
    debutPrec = new Date(today);
    debutPrec.setDate(debutPrec.getDate() - 1);
  } else if (periode === "7d") {
    finPrec = new Date(today);
    finPrec.setDate(finPrec.getDate() - 7);
    debutPrec = new Date(finPrec);
    debutPrec.setDate(debutPrec.getDate() - 7);
  } else if (periode === "30d") {
    finPrec = new Date(today);
    finPrec.setDate(finPrec.getDate() - 30);
    debutPrec = new Date(finPrec);
    debutPrec.setDate(debutPrec.getDate() - 30);
  } else {
    return [];
  }

  return sales.filter((s) => {
    const d = new Date(s.created_at);
    return d >= debutPrec && d < finPrec;
  });
}

function renderComptaData() {
  const dataContainer = document.getElementById("comptaData");
  if (!dataContainer) return;

  const ventesFiltrees = filtrerParPeriode(_comptaCache, comptaFilter);
  window._comptaSales = ventesFiltrees;

  if (!ventesFiltrees.length) {
    dataContainer.innerHTML =
      '<div class="no-data">Aucune vente sur cette période.</div>';
    return;
  }

  let caTotal = 0;
  ventesFiltrees.forEach((v) => {
    caTotal = arrondir2(caTotal + Number(v.total));
  });
  const nbVentes = ventesFiltrees.length;
  const panierMoyen = arrondir2(caTotal / nbVentes);

  const ventesAvecRemise = ventesFiltrees.filter(
    (s) => Number(s.remise_pourcent) > 0,
  );
  const nbRemises = ventesAvecRemise.length;
  let totalRemises = 0;
  ventesAvecRemise.forEach((s) => {
    const avant = Number(s.total_avant_remise || s.total);
    const apres = Number(s.total);
    totalRemises = arrondir2(totalRemises + (avant - apres));
  });

  const ventesPrecedentes = getVentesPeriodePrecedente(
    _comptaCache,
    comptaFilter,
  );
  let caPrecedent = 0;
  ventesPrecedentes.forEach((v) => {
    caPrecedent = arrondir2(caPrecedent + Number(v.total));
  });

  let evolution = 0;
  let badgeClass = "neutral";
  let badgeText = "—";

  if (caPrecedent > 0) {
    evolution = Math.round(((caTotal - caPrecedent) / caPrecedent) * 100);
    badgeClass = evolution > 0 ? "up" : evolution < 0 ? "down" : "neutral";
    badgeText = `${evolution > 0 ? "+" : ""}${evolution}%`;
  } else if (caTotal > 0 && comptaFilter !== "all") {
    badgeClass = "up";
    badgeText = "Nouveau";
  }

  const parJour = {};
  ventesFiltrees.forEach((s) => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!parJour[key]) parJour[key] = { ca: 0, ventes: 0, date: d };
    parJour[key].ca = arrondir2(parJour[key].ca + Number(s.total));
    parJour[key].ventes++;
  });
  const joursTries = Object.values(parJour)
    .sort((a, b) => b.date - a.date)
    .slice(0, 14);
  const maxCA = Math.max(...joursTries.map((j) => j.ca), 1);

  const topArticles = {};
  ventesFiltrees.forEach((s) => {
    (s.items || []).forEach((item) => {
      const key = item.nom;
      if (!topArticles[key]) topArticles[key] = { qte: 0, ca: 0 };
      topArticles[key].qte += item.qte || 1;
      topArticles[key].ca = arrondir2(
        topArticles[key].ca + (item.prix || 0) * (item.qte || 1),
      );
    });
  });
  const topArticlesArray = Object.entries(topArticles)
    .map(([nom, d]) => ({ nom, ...d }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 8);

  const parEmploye = {};
  ventesFiltrees.forEach((s) => {
    const nom = s.employee_nom || "?";
    if (!parEmploye[nom]) parEmploye[nom] = { ventes: [], ca: 0 };
    parEmploye[nom].ventes.push(s);
    parEmploye[nom].ca = arrondir2(parEmploye[nom].ca + Number(s.total));
  });
  const employesTries = Object.entries(parEmploye).sort(
    (a, b) => b[1].ca - a[1].ca,
  );

  let html = "";

  html += `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-title">💰 Chiffre d'affaires</div>
        <div style="font-family: var(--font-title); font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1;">
          ${formatSeptims(caTotal)} S
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
          ${
            comptaFilter === "all"
              ? `${ventesFiltrees.length} vente(s) au total`
              : `vs ${formatSeptims(caPrecedent)} S période préc.`
          }
          <span class="stat-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">🧾 Nombre de ventes</div>
        <div style="font-family: var(--font-title); font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1;">
          ${nbVentes}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
          transactions enregistrées
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">🎯 Panier moyen</div>
        <div style="font-family: var(--font-title); font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1;">
          ${formatSeptims(panierMoyen)} S
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
          par transaction
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">🏷️ Remises accordées</div>
        <div style="font-family: var(--font-title); font-size: 2rem; font-weight: 700; color: #ef4444; line-height: 1;">
          -${formatSeptims(totalRemises)} S
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
          ${nbRemises} vente(s) avec remise
        </div>
      </div>
    </div>
  `;

  html += `
    <div class="compta-section">
      <h3>📅 Ventes par jour <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(14 derniers jours)</span></h3>
      <div style="background-color: var(--bg-header); border-radius: 8px; overflow: hidden;">
        <div class="compta-header-row">
          <span>Date</span>
          <span>Volume</span>
          <span>Ventes</span>
          <span>Total</span>
        </div>
        ${joursTries
          .map((j) => {
            const pourcentage = (j.ca / maxCA) * 100;
            const jour = j.date.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            });
            const annee = j.date.getFullYear();
            return `
              <div class="jour-row">
                <div class="jour-date">${jour}<small>${annee}</small></div>
                <div class="jour-bar-container"><div class="jour-bar" style="width: ${pourcentage}%"></div></div>
                <div class="jour-ventes">${j.ventes}</div>
                <div class="jour-total">${formatSeptims(j.ca)} S</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  html += `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-title">🏆 Top articles (par CA)</div>
        ${
          topArticlesArray.length
            ? topArticlesArray
                .map(
                  (a, i) => `
              <div class="stat-ligne">
                <span class="stat-ligne-nom">${i + 1}. ${a.nom}</span>
                <span class="stat-ligne-valeur">${formatSeptims(a.ca)} S <small style="color: var(--text-muted); font-weight: 400;">×${a.qte}</small></span>
              </div>
            `,
                )
                .join("")
            : '<div class="no-data" style="padding: 1rem;">Aucune vente</div>'
        }
      </div>
      <div class="stat-card">
        <div class="stat-card-title">👥 Répartition par employé</div>
        ${employesTries
          .map(
            ([nom, d]) => `
          <div class="stat-ligne">
            <span class="stat-ligne-nom">${nom}</span>
            <span class="stat-ligne-valeur">${formatSeptims(d.ca)} S <small style="color: var(--text-muted); font-weight: 400;">(${d.ventes.length})</small></span>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  html += `
    <div class="compta-section">
      <h3>👥 Détail par employé</h3>
      <table class="compta-table">
        <thead>
          <tr><th>Employé</th><th>Ventes</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${employesTries
            .map(([nom, d], idx) => {
              const detailsHtml = d.ventes
                .slice(0, 20)
                .map((s) => {
                  const date = new Date(s.created_at).toLocaleString("fr-FR");
                  const items = (s.items || [])
                    .map((i) => `${i.qte}× ${i.nom}`)
                    .join(", ");
                  const remise = Number(s.remise_pourcent || 0);
                  const badgeRemise =
                    remise > 0
                      ? `<span class="stat-badge down" style="margin-left:6px;">-${remise}%</span>`
                      : "";
                  return `<tr><td style="font-size:0.75rem;">${date}</td><td style="font-size:0.8rem;">${items}</td><td style="color:var(--accent);font-weight:700;white-space:nowrap;text-align:right;">${formatSeptims(s.total)} S ${badgeRemise}</td></tr>`;
                })
                .join("");
              return `
                <tr class="compta-employe-row" data-employe-idx="${idx}">
                  <td><span class="employe-expand-icon">▶</span> <strong>${nom}</strong></td>
                  <td>${d.ventes.length}</td>
                  <td style="color:var(--accent);font-weight:700;">${formatSeptims(d.ca)} S</td>
                </tr>
                <tr class="employe-detail-row hidden" data-detail-idx="${idx}">
                  <td colspan="3">
                    <div class="employe-detail">
                      <table class="employe-detail-table">
                        <thead><tr><th>Date</th><th>Articles</th><th>Total</th></tr></thead>
                        <tbody>${detailsHtml || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem;">Aucune vente</td></tr>'}</tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  html += `
    <div class="compta-section">
      <h3>📜 Historique <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(${Math.min(ventesFiltrees.length, 100)} dernières)</span></h3>
      <table class="compta-table">
        <thead><tr><th>Date</th><th>Employé</th><th>Articles</th><th>Total</th></tr></thead>
        <tbody>
          ${ventesFiltrees
            .slice(0, 100)
            .map((s) => {
              const date = new Date(s.created_at).toLocaleString("fr-FR");
              const items = (s.items || [])
                .map((i) => `${i.qte}× ${i.nom}`)
                .join(", ");
              const remise = Number(s.remise_pourcent || 0);
              const avantRemise = Number(s.total_avant_remise || s.total);
              const badgeRemise =
                remise > 0
                  ? `<span class="stat-badge down" style="margin-left:6px;">-${remise}%</span>`
                  : "";
              const detailPrix =
                remise > 0
                  ? `<div style="font-size:0.7rem;color:var(--text-muted);text-decoration:line-through;">${formatSeptims(avantRemise)} S</div>`
                  : "";
              return `<tr><td style="font-size:0.8rem;white-space:nowrap;">${date}</td><td><strong>${s.employee_nom}</strong></td><td style="font-size:0.8rem;color:var(--text-muted);">${items}</td><td style="color:var(--accent);font-weight:700;white-space:nowrap;text-align:right;">${detailPrix}${formatSeptims(s.total)} S ${badgeRemise}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  dataContainer.innerHTML = html;

  document.querySelectorAll(".compta-employe-row").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = row.dataset.employeIdx;
      const detailRow = document.querySelector(`[data-detail-idx="${idx}"]`);
      if (!detailRow) return;
      const isHidden = detailRow.classList.contains("hidden");
      detailRow.classList.toggle("hidden");
      const icon = row.querySelector(".employe-expand-icon");
      if (icon) icon.textContent = isHidden ? "▼" : "▶";
    });
  });
}

async function chargerDashboard() {
  const container = document.getElementById("dashboardContent");
  if (!container) return;
  if (utilisateurCourant?.role !== "patron") {
    container.innerHTML = '<div class="no-data">Patrons uniquement.</div>';
    return;
  }
  container.innerHTML = "Chargement...";

  const { data: sales } = await supabaseClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });

  const toutesVentes = sales || [];

  const now = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const debutHier = new Date(debutJour);
  debutHier.setDate(debutHier.getDate() - 1);
  const finHier = new Date(debutJour);

  const ventesJour = toutesVentes.filter(
    (s) => new Date(s.created_at) >= debutJour,
  );
  const ventesHier = toutesVentes.filter((s) => {
    const d = new Date(s.created_at);
    return d >= debutHier && d < finHier;
  });

  let caJour = 0;
  ventesJour.forEach((s) => {
    caJour = arrondir2(caJour + Number(s.total));
  });
  let caHier = 0;
  ventesHier.forEach((s) => {
    caHier = arrondir2(caHier + Number(s.total));
  });
  const nbVentesJour = ventesJour.length;
  const panierMoyen = nbVentesJour > 0 ? arrondir2(caJour / nbVentesJour) : 0;

  let evolBadge = "";
  if (caHier > 0) {
    const evol = Math.round(((caJour - caHier) / caHier) * 100);
    const cls = evol > 0 ? "up" : evol < 0 ? "down" : "neutral";
    const signe = evol > 0 ? "+" : "";
    evolBadge = `<span class="stat-badge ${cls}">${signe}${evol}%</span>`;
  } else if (caJour > 0) {
    evolBadge = `<span class="stat-badge up">Nouveau</span>`;
  }

  const topArticles = {};
  ventesJour.forEach((s) => {
    (s.items || []).forEach((item) => {
      const key = item.nom;
      if (!topArticles[key]) topArticles[key] = { qte: 0, ca: 0 };
      topArticles[key].qte += item.qte || 1;
      topArticles[key].ca = arrondir2(
        topArticles[key].ca + (item.prix || 0) * (item.qte || 1),
      );
    });
  });
  const topArray = Object.entries(topArticles)
    .map(([nom, d]) => ({ nom, ...d }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5);

  const alertes = [];
  Object.entries(stockData).forEach(([key, st]) => {
    if (st.quantite > st.seuil) return;
    const [articleId, materiauId] = key.split(":").map(Number);
    let nomArticle = "?";
    let nomMateriau = "";
    for (const cat of CATEGORIES) {
      const arts = articlesParCat[cat.key] || [];
      const art = arts.find((a) => a.id === articleId);
      if (art) {
        nomArticle = art.nom;
        const mats = materiauxParCat[cat.key] || [];
        const mat = mats.find((m) => m.id === materiauId);
        if (mat) nomMateriau = mat.nom;
        break;
      }
    }
    alertes.push({
      nom: nomArticle,
      materiau: nomMateriau,
      quantite: st.quantite,
      seuil: st.seuil,
    });
  });
  alertes.sort((a, b) => a.quantite - b.quantite);
  const alertesAffichees = alertes.slice(0, 8);

  const parEmploye = {};
  ventesJour.forEach((s) => {
    const nom = s.employee_nom || "?";
    if (!parEmploye[nom]) parEmploye[nom] = { ventes: 0, ca: 0 };
    parEmploye[nom].ventes++;
    parEmploye[nom].ca = arrondir2(parEmploye[nom].ca + Number(s.total));
  });
  const employesTries = Object.entries(parEmploye).sort(
    (a, b) => b[1].ca - a[1].ca,
  );

  const dernieresVentes = ventesJour.slice(0, 8);

  let html = "";

  html += `
    <div class="dash-top">
      <div class="dash-card highlight">
        <span class="dash-card-label">💰 CA du jour</span>
        <span class="dash-card-value">${formatSeptims(caJour)} S</span>
        <span class="dash-card-sub">${nbVentesJour} vente(s) ${evolBadge}</span>
      </div>
      <div class="dash-card">
        <span class="dash-card-label">🧾 Ventes</span>
        <span class="dash-card-value">${nbVentesJour}</span>
        <span class="dash-card-sub">transactions aujourd'hui</span>
      </div>
      <div class="dash-card">
        <span class="dash-card-label">🎯 Panier moyen</span>
        <span class="dash-card-value">${formatSeptims(panierMoyen)} S</span>
        <span class="dash-card-sub">par transaction</span>
      </div>
      <div class="dash-card">
        <span class="dash-card-label">📅 CA d'hier</span>
        <span class="dash-card-value">${formatSeptims(caHier)} S</span>
        <span class="dash-card-sub">${ventesHier.length} vente(s)</span>
      </div>
    </div>
  `;

  html += `<div class="dash-grid">`;

  html += `
    <div class="dash-section">
      <h3>🏆 Top articles du jour</h3>
      ${
        topArray.length
          ? topArray
              .map((a, i) => {
                const rangClass =
                  i === 0
                    ? "gold"
                    : i === 1
                      ? "silver"
                      : i === 2
                        ? "bronze"
                        : "";
                return `
                <div class="dash-liste-item">
                  <span class="dash-item-rang ${rangClass}">${i + 1}</span>
                  <span class="dash-item-nom">${a.nom}</span>
                  <span class="dash-item-val">${formatSeptims(a.ca)} S <small style="color:var(--text-muted);font-weight:400;">×${a.qte}</small></span>
                </div>
              `;
              })
              .join("")
          : '<div class="dash-empty">Aucune vente aujourd\'hui</div>'
      }
    </div>
  `;

  html += `
    <div class="dash-section">
      <h3>⚠️ Alertes stock ${
        alertes.length > 0
          ? `<span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;">(${alertes.length})</span>`
          : ""
      }</h3>
      ${
        alertesAffichees.length
          ? alertesAffichees
              .map((a) => {
                const estRupture = a.quantite <= 0;
                const cls = estRupture ? "" : "orange";
                const badge = estRupture ? "Rupture" : "Stock bas";
                const label = a.materiau ? `${a.nom} (${a.materiau})` : a.nom;
                return `
                <div class="dash-alerte ${cls}">
                  <span class="dash-alerte-nom">${label}</span>
                  <span class="dash-alerte-qte">${badge} · ${a.quantite}</span>
                </div>
              `;
              })
              .join("")
          : '<div class="dash-empty">✅ Aucune alerte, tout va bien !</div>'
      }
    </div>
  `;

  html += `
    <div class="dash-section">
      <h3>👥 Employés du jour</h3>
      ${
        employesTries.length
          ? employesTries
              .map(([nom, d], i) => {
                const rangClass =
                  i === 0
                    ? "gold"
                    : i === 1
                      ? "silver"
                      : i === 2
                        ? "bronze"
                        : "";
                return `
                <div class="dash-liste-item">
                  <span class="dash-item-rang ${rangClass}">${i + 1}</span>
                  <span class="dash-item-nom">${nom}</span>
                  <span class="dash-item-val">${formatSeptims(d.ca)} S <small style="color:var(--text-muted);font-weight:400;">(${d.ventes})</small></span>
                </div>
              `;
              })
              .join("")
          : '<div class="dash-empty">Aucune vente aujourd\'hui</div>'
      }
    </div>
  `;

  html += `
    <div class="dash-section">
      <h3>🕐 Dernières ventes</h3>
      ${
        dernieresVentes.length
          ? dernieresVentes
              .map((s) => {
                const heure = new Date(s.created_at).toLocaleTimeString(
                  "fr-FR",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                );
                const nbArticles = (s.items || []).reduce(
                  (sum, i) => sum + (i.qte || 1),
                  0,
                );
                const detail = `${nbArticles} article${nbArticles > 1 ? "s" : ""}`;
                const remise = Number(s.remise_pourcent || 0);
                const badgeRemise =
                  remise > 0
                    ? ` <span class="stat-badge down" style="margin-left:4px;">-${remise}%</span>`
                    : "";
                return `
                <div class="dash-vente-item">
                  <div class="dash-vente-info">
                    <span class="dash-vente-emp">${s.employee_nom}</span>
                    <span class="dash-vente-detail">${heure} · ${detail}</span>
                  </div>
                  <span class="dash-vente-total">${formatSeptims(s.total)} S${badgeRemise}</span>
                </div>
              `;
              })
              .join("")
          : '<div class="dash-empty">Aucune vente aujourd\'hui</div>'
      }
    </div>
  `;

  html += `</div>`;

  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await chargerTout();
    renderTabs();
    renderAllSections();
    setupSearch();
    setupPanier();
    setupEditToolbar();
    setupFormsAdmin();
  } catch (e) {
    console.error(e);
  }

  try {
    await initAuth();
    verifierModeLecture();
  } catch (e) {}
  try {
    ecouterChangementsTempsReel();
  } catch (e) {}

  const firstTab = document.querySelector(".tab-btn");
  if (firstTab) firstTab.click();
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
