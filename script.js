// script.js (MODULE)
// ✅ Sem editar chamado
// ✅ Login obrigatório via auth.js
import { requireAuth, logout } from "./auth.js";

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "helpdeskmini_tickets_v1";
const THEME_KEY = "helpdeskmini_theme_v1";

// ===== Auth gate =====
let session = null;
try {
  session = await requireAuth({ redirectTo: "login.html" });
} catch (e) {
  // requireAuth já redireciona
}

// ===== Header (opcionais, se existirem no HTML) =====
const btnLogout = $("btnLogout");
const btnAdmin = $("btnAdmin");
const who = $("who");

// ===== Elements =====
const tabs = Array.from(document.querySelectorAll(".tab"));
const tabChamados = $("tabChamados");
const tabFila = $("tabFila");

const btnTheme = $("btnTheme");

const form = $("form");
const msg = $("msg");

const btnSeed = $("btnSeed");

const titleEl = $("title");
const requesterEl = $("requester");
const descEl = $("desc");
const branchEl = $("branch");
const pdvEl = $("pdv");
const categoryEl = $("category");
const priorityEl = $("priority");
const statusEl = $("status");
const assignedToEl = $("assignedTo");
const tagsEl = $("tags");

const kpiOpen = $("kpiOpen");
const kpiProg = $("kpiProg");
const kpiDone = $("kpiDone");
const kpiTotal = $("kpiTotal");

const listEl = $("list");
const countEl = $("count");

const qEl = $("q");
const fStatusEl = $("fStatus");
const fPriorityEl = $("fPriority");
const fBranchEl = $("fBranch");
const fPDVEl = $("fPDV");
const fCategoryEl = $("fCategory");
const sortEl = $("sort");
const btnClearFilters = $("btnClearFilters");

const queueBody = $("queueBody");
const queueCount = $("queueCount");
const tableCount = $("tableCount");

const btnExportCSV = $("btnExportCSV");
const btnExportJSON = $("btnExportJSON");
const importJSON = $("importJSON");

// Modal
const modal = $("modal");
const mClose = $("mClose");
const mTitle = $("mTitle");
const mMeta = $("mMeta");
const mDesc = $("mDesc");
const mTags = $("mTags");
const mHistory = $("mHistory");
const mNext = $("mNext");
const mDelete = $("mDelete");

// ===== State =====
let tickets = loadTickets();
let viewingId = null;

// ===== Header wiring =====
if (who && session) {
  who.textContent = `👤 ${session.name} (@${session.username})`;
}
if (btnLogout) {
  btnLogout.addEventListener("click", () => logout("login.html"));
}
if (btnAdmin) {
  const isAdmin = session?.role === "admin";
  btnAdmin.style.display = isAdmin ? "inline-flex" : "none";
  btnAdmin.addEventListener("click", () => (location.href = "admin.html"));
}

// ===== Utils =====
function toast(text, ok = true) {
  if (!msg) return;
  msg.style.color = ok ? "#2ee59d" : "#ff3b3b";
  msg.textContent = text;
  if (text) setTimeout(() => (msg.textContent = ""), 2500);
}

function uid() {
  return Math.random().toString(16).slice(2, 10) + "-" + Date.now().toString(16);
}

function nowISO() {
  return new Date().toISOString();
}

function fmtDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function priWeight(p) {
  if (p === "Alta") return 3;
  if (p === "Média") return 2;
  return 1;
}

function statusNext(s) {
  if (s === "Aberto") return "Em andamento";
  if (s === "Em andamento") return "Resolvido";
  return "Resolvido";
}

function normalizeTags(raw) {
  return String(raw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function safeText(s) {
  return String(s ?? "").trim();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== Storage =====
function loadTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}
function saveTheme(t) {
  localStorage.setItem(THEME_KEY, t);
}

// ===== Tabs =====
function setTab(tabId) {
  tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  if (tabChamados) tabChamados.classList.toggle("hidden", tabId !== "tabChamados");
  if (tabFila) tabFila.classList.toggle("hidden", tabId !== "tabFila");
}

tabs.forEach((b) => {
  b.addEventListener("click", () => setTab(b.dataset.tab));
});

// ===== CRUD =====
function resetForm() {
  if (titleEl) titleEl.value = "";
  if (requesterEl) requesterEl.value = "";
  if (descEl) descEl.value = "";
  if (branchEl) branchEl.value = "1";
  if (pdvEl) pdvEl.value = "1";
  if (categoryEl) categoryEl.value = "PDV";
  if (priorityEl) priorityEl.value = "Média";
  if (statusEl) statusEl.value = "Aberto";
  if (assignedToEl) assignedToEl.value = "";
  if (tagsEl) tagsEl.value = "";
}

function getFormData() {
  const title = safeText(titleEl?.value);
  const requester = safeText(requesterEl?.value);
  const desc = safeText(descEl?.value);

  if (!title) return { error: "Preencha o título." };
  if (!requester) return { error: "Preencha o solicitante." };
  if (!desc) return { error: "Preencha a descrição." };

  const data = {
    title,
    requester,
    desc,
    branch: branchEl?.value || "1",
    pdv: pdvEl?.value || "1",
    category: categoryEl?.value || "PDV",
    priority: priorityEl?.value || "Média",
    status: statusEl?.value || "Aberto",
    assignedTo: safeText(assignedToEl?.value),
    tags: normalizeTags(tagsEl?.value),
  };
  return { data };
}

function addHistory(t, action) {
  t.history = Array.isArray(t.history) ? t.history : [];
  t.history.unshift({
    at: nowISO(),
    action,
  });
}

// ✅ SEM edição: sempre cria um novo chamado
form?.addEventListener("submit", (e) => {
  e.preventDefault();

  const { data, error } = getFormData();
  if (error) return toast(error, false);

  const t = {
    id: uid(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...data,
    history: [],
  };

  addHistory(t, `Chamado criado por ${session?.username || "usuário"}`);

  tickets.unshift(t);
  saveTickets();
  toast("Chamado criado ✅");
  resetForm();
  renderAll();
});

btnSeed?.addEventListener("click", () => {
  const examples = [
    {
      title: "PDV 2 não imprime NFC-e",
      requester: "Ismael",
      desc: "Ao finalizar a venda, a NFC-e fica pendente e não imprime. Verificar impressora/serviço.",
      branch: "2",
      pdv: "2",
      category: "PDV",
      priority: "Alta",
      status: "Aberto",
      assignedTo: "TI",
      tags: ["nfc-e", "pdv", "impressora"],
    },
    {
      title: "Queda de rede na Filial 4",
      requester: "Maria",
      desc: "Perda de conexão intermitente. Caixa perde acesso ao sistema em horários aleatórios.",
      branch: "4",
      pdv: "1",
      category: "Rede",
      priority: "Alta",
      status: "Em andamento",
      assignedTo: "CPD",
      tags: ["rede", "switch", "link"],
    },
    {
      title: "Sistema lento no PDV 5",
      requester: "João",
      desc: "Sistema demora muito para abrir a tela de pagamento. Possível problema de banco/rede.",
      branch: "1",
      pdv: "5",
      category: "Sistema",
      priority: "Média",
      status: "Aberto",
      assignedTo: "TI",
      tags: ["lento", "pdv"],
    },
  ];

  examples.forEach((ex) => {
    const t = {
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      ...ex,
      history: [],
    };
    addHistory(t, `Chamado criado (exemplo) por ${session?.username || "usuário"}`);
    tickets.unshift(t);
  });

  saveTickets();
  toast("Exemplos gerados ✅");
  renderAll();
});

// ===== Filters =====
function getFilteredTickets() {
  const q = safeText(qEl?.value).toLowerCase();
  const fs = fStatusEl?.value || "Todos";
  const fp = fPriorityEl?.value || "Todos";
  const fb = fBranchEl?.value || "Todos";
  const fpdv = fPDVEl?.value || "Todos";
  const fc = fCategoryEl?.value || "Todos";

  let arr = [...tickets];

  if (q) {
    arr = arr.filter((t) => {
      const hay = [t.title, t.desc, t.requester, t.assignedTo, ...(t.tags || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (fs !== "Todos") arr = arr.filter((t) => t.status === fs);
  if (fp !== "Todos") arr = arr.filter((t) => t.priority === fp);
  if (fb !== "Todos") arr = arr.filter((t) => t.branch === fb);
  if (fpdv !== "Todos") arr = arr.filter((t) => t.pdv === fpdv);
  if (fc !== "Todos") arr = arr.filter((t) => t.category === fc);

  const s = sortEl?.value || "atendimento";
  if (s === "novo") {
    arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (s === "antigo") {
    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    // prioridade desc + tempo asc
    arr.sort((a, b) => {
      const pw = priWeight(b.priority) - priWeight(a.priority);
      if (pw !== 0) return pw;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  return arr;
}

[qEl, fStatusEl, fPriorityEl, fBranchEl, fPDVEl, fCategoryEl, sortEl].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", renderAll);
  el.addEventListener("change", renderAll);
});

btnClearFilters?.addEventListener("click", () => {
  if (qEl) qEl.value = "";
  if (fStatusEl) fStatusEl.value = "Todos";
  if (fPriorityEl) fPriorityEl.value = "Todos";
  if (fBranchEl) fBranchEl.value = "Todos";
  if (fPDVEl) fPDVEl.value = "Todos";
  if (fCategoryEl) fCategoryEl.value = "Todos";
  if (sortEl) sortEl.value = "atendimento";
  renderAll();
});

// ===== Render =====
function badgeStatus(s) {
  if (s === "Aberto") return "b-open";
  if (s === "Em andamento") return "b-prog";
  return "b-done";
}
function badgePri(p) {
  if (p === "Alta") return "p-alta";
  if (p === "Média") return "p-media";
  return "p-baixa";
}

function renderKPIs() {
  const open = tickets.filter((t) => t.status === "Aberto").length;
  const prog = tickets.filter((t) => t.status === "Em andamento").length;
  const done = tickets.filter((t) => t.status === "Resolvido").length;
  if (kpiOpen) kpiOpen.textContent = open;
  if (kpiProg) kpiProg.textContent = prog;
  if (kpiDone) kpiDone.textContent = done;
  if (kpiTotal) kpiTotal.textContent = tickets.length;
}

function renderCards() {
  const recent = [...tickets]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  if (countEl) countEl.textContent = `${tickets.length} no total`;

  if (!listEl) return;

  if (!recent.length) {
    listEl.innerHTML = `<p class="muted small">Nenhum chamado ainda. Crie um no formulário.</p>`;
    return;
  }

  listEl.innerHTML = recent
    .map(
      (t) => `
    <div class="item" data-id="${t.id}">
      <div class="itemTop">
        <p class="itemTitle">${escapeHtml(t.title)}</p>
        <div class="badges">
          <span class="badge ${badgeStatus(t.status)}">${escapeHtml(t.status)}</span>
          <span class="badge ${badgePri(t.priority)}">${escapeHtml(t.priority)}</span>
        </div>
      </div>
      <div class="itemMeta">
        <div>📍 Filial ${escapeHtml(t.branch)} • PDV ${escapeHtml(t.pdv)} • ${escapeHtml(t.category)}</div>
        <div>👤 ${escapeHtml(t.requester)} • 🕒 ${fmtDate(t.createdAt)}</div>
      </div>
      <div class="tags">
        ${(t.tags || [])
          .slice(0, 5)
          .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
          .join("")}
      </div>
    </div>
  `
    )
    .join("");

  Array.from(listEl.querySelectorAll(".item")).forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}

function renderTable() {
  const arr = getFilteredTickets();

  if (queueCount) queueCount.textContent = `${arr.length} encontrados`;
  if (tableCount) tableCount.textContent = `${arr.length} na tabela`;

  if (!queueBody) return;

  if (!arr.length) {
    queueBody.innerHTML = `
      <tr>
        <td colspan="12" class="muted">Nenhum chamado com os filtros atuais.</td>
      </tr>
    `;
    return;
  }

  // ✅ SEM "Editar" na tabela
  queueBody.innerHTML = arr
    .map(
      (t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtDate(t.createdAt)}</td>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.branch)}</td>
      <td>${escapeHtml(t.pdv)}</td>
      <td>${escapeHtml(t.status)}</td>
      <td>${escapeHtml(t.priority)}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.requester)}</td>
      <td>${escapeHtml(t.assignedTo || "-")}</td>
      <td>
        <div class="tActions">
          <button class="linkBtn" data-act="view" data-id="${t.id}">Ver</button>
          <button class="linkBtn" data-act="next" data-id="${t.id}">Avançar</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  Array.from(queueBody.querySelectorAll("button")).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "view") openModal(id);
      if (act === "next") nextStatus(id);
    });
  });
}

function renderAll() {
  renderKPIs();
  renderCards();
  renderTable();
}

// ===== Modal =====
function openModal(id) {
  const t = tickets.find((x) => x.id === id);
  if (!t) return;

  viewingId = id;

  if (mTitle) mTitle.textContent = t.title;

  if (mMeta) {
    mMeta.innerHTML = `
      <span class="badge ${badgeStatus(t.status)}">${escapeHtml(t.status)}</span>
      <span class="badge ${badgePri(t.priority)}">${escapeHtml(t.priority)}</span>
      <span class="badge">Filial ${escapeHtml(t.branch)}</span>
      <span class="badge">PDV ${escapeHtml(t.pdv)}</span>
      <span class="badge">${escapeHtml(t.category)}</span>
      <span class="badge">Solic.: ${escapeHtml(t.requester)}</span>
      <span class="badge">Resp.: ${escapeHtml(t.assignedTo || "-")}</span>
      <span class="badge">Criado: ${fmtDate(t.createdAt)}</span>
    `;
  }

  if (mDesc) mDesc.textContent = t.desc || "";

  if (mTags) {
    mTags.innerHTML = (t.tags || [])
      .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
      .join("");
  }

  const hist = Array.isArray(t.history) ? t.history : [];
  if (mHistory) {
    mHistory.innerHTML = hist.length
      ? hist
          .map((h) => `<div class="hItem">🕒 ${fmtDate(h.at)} — ${escapeHtml(h.action)}</div>`)
          .join("")
      : `<div class="hItem">Sem histórico ainda.</div>`;
  }

  modal?.showModal();
}

mClose?.addEventListener("click", () => modal.close());
modal?.addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
});

mNext?.addEventListener("click", () => {
  if (!viewingId) return;
  nextStatus(viewingId);
  openModal(viewingId);
});

mDelete?.addEventListener("click", () => {
  if (!viewingId) return;

  // ✅ recomendado: só admin pode excluir
  if (session?.role !== "admin") {
    return toast("Somente admin pode excluir chamados.", false);
  }

  if (!confirm("Tem certeza que deseja excluir este chamado?")) return;

  tickets = tickets.filter((x) => x.id !== viewingId);
  saveTickets();
  modal.close();
  toast("Chamado excluído ✅");
  renderAll();
});

// ===== Next =====
function nextStatus(id) {
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx === -1) return toast("Chamado não encontrado.", false);

  const t = tickets[idx];
  const old = t.status;

  t.status = statusNext(t.status);
  t.updatedAt = nowISO();

  addHistory(t, `Status: ${old} → ${t.status} (por ${session?.username || "usuário"})`);

  saveTickets();
  toast("Status atualizado ✅");
  renderAll();
}

// ===== Export / Import =====
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

btnExportJSON?.addEventListener("click", () => {
  const data = JSON.stringify(tickets, null, 2);
  downloadFile("helpdeskmini_backup.json", data, "application/json");
});

importJSON?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) throw new Error("JSON inválido (não é array).");
    const ok = data.every((x) => x && typeof x === "object" && x.id && x.title);
    if (!ok) throw new Error("JSON inválido (estrutura inesperada).");

    tickets = data;
    saveTickets();
    toast("Importado com sucesso ✅");
    renderAll();
  } catch (err) {
    toast(`Erro ao importar: ${err.message}`, false);
  } finally {
    importJSON.value = "";
  }
});

btnExportCSV?.addEventListener("click", () => {
  const arr = getFilteredTickets();

  const header = [
    "#",
    "Data",
    "ID",
    "Filial",
    "PDV",
    "Status",
    "Prioridade",
    "Categoria",
    "Título",
    "Solicitante",
    "Responsável",
    "Tags",
    "Descrição",
  ];

  const rows = arr.map((t, i) => [
    i + 1,
    fmtDate(t.createdAt),
    t.id,
    `Filial ${t.branch}`,
    `PDV ${t.pdv}`,
    t.status,
    t.priority,
    t.category,
    t.title,
    t.requester,
    t.assignedTo || "",
    (t.tags || []).join(" | "),
    t.desc,
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  downloadFile("helpdeskmini_chamados.csv", csv, "text/csv;charset=utf-8");
});

// ===== Theme =====
function applyTheme() {
  const t = loadTheme();
  document.body.classList.toggle("light", t === "light");
}
btnTheme?.addEventListener("click", () => {
  const current = loadTheme();
  const next = current === "dark" ? "light" : "dark";
  saveTheme(next);
  applyTheme();
});

// ===== Init =====
(function init() {
  applyTheme();
  resetForm();
  renderAll();
})();
