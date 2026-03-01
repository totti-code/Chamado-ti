import { requireAuth, logout, getSession } from "./auth.js";

/* ✅ BLOQUEIA ACESSO SEM LOGIN (redireciona para login.html) */
const session = requireAuth("login.html");

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "helpdesk_mini_v2";
const PREFS_KEY = "helpdesk_prefs_v2";

function pad(n){ return String(n).padStart(2,"0"); }
function nowISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function uid(){
  return "C" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function parseTags(str){
  return (str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}
function priorityRank(p){
  if(p === "Alta") return 3;
  if(p === "Média") return 2;
  return 1;
}
function statusClass(s){
  if(s === "Aberto") return "b-open";
  if(s === "Em andamento") return "b-prog";
  return "b-done";
}
function priorityClass(p){
  if(p === "Alta") return "p-alta";
  if(p === "Média") return "p-media";
  return "p-baixa";
}

function loadTickets(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch{ return []; }
}
function saveTickets(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadPrefs(){
  try{ return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }
  catch{ return {}; }
}
function savePrefs(prefs){
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function setMsg(text, ok=true){
  const el = $("msg");
  if(!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#2ee59d" : "#ff8080";
  if(text){
    clearTimeout(setMsg._t);
    setMsg._t = setTimeout(()=> el.textContent = "", 2500);
  }
}

/* ✅ MOSTRA "Logado como..." (se existir #loggedAs no HTML) + botão sair */
function renderAuthUI(){
  const s = session || getSession?.() || null;

  const who = $("loggedAs");
  if(who){
    const label = s?.name || s?.email || "Usuário";
    who.textContent = `Logado como: ${label}`;
  }

  const btnLogout = $("btnLogout");
  if(btnLogout){
    btnLogout.addEventListener("click", () => {
      logout();
      location.href = "login.html";
    });
  }
}

let editingId = null;
let modalId = null;

function addHistory(ticket, action){
  ticket.history = ticket.history || [];
  ticket.history.push({ at: nowISO(), action });
}

function formData(){
  return {
    title: $("title")?.value.trim() || "",
    requester: $("requester")?.value.trim() || "",
    desc: $("desc")?.value.trim() || "",
    branch: $("branch")?.value || "1",     // 1..7
    pdv: $("pdv")?.value || "1",           // 1..5
    category: $("category")?.value || "PDV",
    priority: $("priority")?.value || "Média",
    status: $("status")?.value || "Aberto",
    assignedTo: $("assignedTo")?.value.trim() || "",
    tags: parseTags($("tags")?.value || "")
  };
}

function validate(data){
  if(!data.title || data.title.length < 4) return "Informe um título (mín. 4 letras).";
  if(!data.requester) return "Informe o solicitante.";
  if(!data.desc || data.desc.length < 8) return "Informe a descrição (mín. 8 letras).";
  if(!data.branch) return "Selecione a filial.";
  if(!data.pdv) return "Selecione o PDV.";
  return null;
}

function clearForm(){
  $("form")?.reset();
  if($("status")) $("status").value = "Aberto";
  if($("priority")) $("priority").value = "Média";
  if($("category")) $("category").value = "PDV";
  if($("branch")) $("branch").value = "1";
  if($("pdv")) $("pdv").value = "1";
  editingId = null;

  if($("formTitle")) $("formTitle").textContent = "Abrir chamado";
  if($("btnCancel")) $("btnCancel").hidden = true;
  if($("editingPill")) $("editingPill").hidden = true;
  if($("btnSave")) $("btnSave").textContent = "Salvar chamado";
}

function fillForm(ticket){
  if($("title")) $("title").value = ticket.title;
  if($("requester")) $("requester").value = ticket.requester;
  if($("desc")) $("desc").value = ticket.desc;

  if($("branch")) $("branch").value = String(ticket.branch || "1");
  if($("pdv")) $("pdv").value = String(ticket.pdv || "1");

  if($("category")) $("category").value = ticket.category;
  if($("priority")) $("priority").value = ticket.priority;
  if($("status")) $("status").value = ticket.status;
  if($("assignedTo")) $("assignedTo").value = ticket.assignedTo || "";
  if($("tags")) $("tags").value = (ticket.tags || []).join(", ");

  editingId = ticket.id;
  if($("formTitle")) $("formTitle").textContent = "Editar chamado";
  if($("btnCancel")) $("btnCancel").hidden = false;
  if($("editingPill")) $("editingPill").hidden = false;
  if($("btnSave")) $("btnSave").textContent = "Atualizar chamado";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== Filtros (inclui Filial/PDV) ===== */
function applyFilters(list){
  const q = ($("q")?.value || "").trim().toLowerCase();
  const fStatus = $("fStatus")?.value || "Todos";
  const fPriority = $("fPriority")?.value || "Todos";
  const fCategory = $("fCategory")?.value || "Todos";
  const fBranch = $("fBranch")?.value || "Todos";
  const fPDV = $("fPDV")?.value || "Todos";

  let out = list;

  if(fStatus !== "Todos") out = out.filter(t => t.status === fStatus);
  if(fPriority !== "Todos") out = out.filter(t => t.priority === fPriority);
  if(fCategory !== "Todos") out = out.filter(t => t.category === fCategory);
  if(fBranch !== "Todos") out = out.filter(t => String(t.branch) === String(fBranch));
  if(fPDV !== "Todos") out = out.filter(t => String(t.pdv) === String(fPDV));

  if(q){
    out = out.filter(t => {
      const hay = [
        t.id, t.title, t.requester, t.desc, t.category, t.priority, t.status,
        `filial ${t.branch}`, `pdv ${t.pdv}`,
        t.assignedTo || "",
        ...(t.tags || [])
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const sort = $("sort")?.value || "atendimento";

  if(sort === "novo"){
    out = out.slice().sort((a,b) => b.createdAtMs - a.createdAtMs);
  }else if(sort === "antigo"){
    out = out.slice().sort((a,b) => a.createdAtMs - b.createdAtMs);
  }else{
    out = out.slice().sort((a,b) => {
      const pr = priorityRank(b.priority) - priorityRank(a.priority);
      if(pr !== 0) return pr;
      return a.createdAtMs - b.createdAtMs;
    });
  }

  // ✅ Só atualiza o contador se ele existir (pra não quebrar)
  const countEl = $("count");
  if(countEl) countEl.textContent = `${out.length} exibido(s)`;

  return out;
}

function renderKpis(list){
  if($("kpiOpen")) $("kpiOpen").textContent = list.filter(t => t.status === "Aberto").length;
  if($("kpiProg")) $("kpiProg").textContent = list.filter(t => t.status === "Em andamento").length;
  if($("kpiDone")) $("kpiDone").textContent = list.filter(t => t.status === "Resolvido").length;
  if($("kpiTotal")) $("kpiTotal").textContent = list.length;
}

/* ✅ Cards agora são opcionais (se #list não existir, não quebra) */
function renderCards(){
  const all = loadTickets();
  renderKpis(all);

  const host = $("list");
  if(!host){
    // lista de cards removida do HTML → OK, não renderiza cards
    return;
  }

  const list = applyFilters(all);
  host.innerHTML = "";

  if(list.length === 0){
    host.innerHTML = `<div class="muted">Nenhum chamado encontrado com esses filtros.</div>`;
    return;
  }

  for(const t of list){
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.id = t.id;

    const tags = (t.tags || []).slice(0,4).map(x => `<span class="tag">#${escapeHtml(x)}</span>`).join("");

    el.innerHTML = `
      <div class="itemTop">
        <div>
          <p class="itemTitle">${escapeHtml(t.title)}</p>
          <div class="muted small">${escapeHtml(t.id)} • ${escapeHtml(t.requester)}</div>
        </div>
        <div class="badges">
          <span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
          <span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span>
        </div>
      </div>

      <div class="itemMeta">
        <div>🏬 Filial: <strong>${escapeHtml(t.branch)}</strong> • 🧾 PDV: <strong>${escapeHtml(t.pdv)}</strong></div>
        <div>📌 Categoria: <strong>${escapeHtml(t.category)}</strong> • 👤 Resp.: <strong>${escapeHtml(t.assignedTo || "-")}</strong></div>
        <div>🕒 Criado: <strong>${escapeHtml(t.createdAt)}</strong></div>
      </div>

      <div class="tags">${tags}</div>
    `;

    el.addEventListener("click", () => openModal(t.id));
    host.appendChild(el);
  }
}

/* ===== Fila (Tabela) ===== */
function renderQueue(){
  const all = loadTickets();
  const filtered = applyFilters(all);
  const list = filtered.filter(t => t.status !== "Resolvido");

  const body = $("queueBody");
  if(!body) return;

  body.innerHTML = "";

  const qc = $("queueCount");
  if(qc) qc.textContent = `${list.length} na fila (com filtros atuais)`;

  for(let i = 0; i < list.length; i++){
    const t = list[i];
    const pos = i + 1;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${pos}º</strong></td>
      <td>${escapeHtml(t.createdAt)}</td>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.branch)}</td>
      <td>${escapeHtml(t.pdv)}</td>
      <td><span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td>
      <td><span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span></td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.requester)}</td>
      <td>${escapeHtml(t.assignedTo || "-")}</td>
      <td>
        <div class="tActions">
          <button class="linkBtn" data-act="open" data-id="${escapeHtml(t.id)}">Abrir</button>
          <button class="linkBtn" data-act="next" data-id="${escapeHtml(t.id)}">Status+</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(act === "open") openModal(id);
      if(act === "next") advanceStatus(id);
    });
  });
}

/* ===== Modal ===== */
function openModal(id){
  const all = loadTickets();
  const t = all.find(x => x.id === id);
  if(!t) return;

  modalId = id;

  if($("mTitle")) $("mTitle").textContent = `${t.title} (${t.id})`;

  if($("mMeta")){
    $("mMeta").innerHTML = `
      <span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
      <span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span>
      <span class="badge">Filial ${escapeHtml(t.branch)}</span>
      <span class="badge">PDV ${escapeHtml(t.pdv)}</span>
      <span class="badge">${escapeHtml(t.category)}</span>
      <span class="badge">Solic.: ${escapeHtml(t.requester)}</span>
      <span class="badge">Resp.: ${escapeHtml(t.assignedTo || "-")}</span>
      <span class="badge">Criado: ${escapeHtml(t.createdAt)}</span>
    `;
  }

  if($("mDesc")) $("mDesc").textContent = t.desc;

  const tags = (t.tags || []).map(x => `<span class="tag">#${escapeHtml(x)}</span>`).join("");
  if($("mTags")) $("mTags").innerHTML = tags || `<span class="muted small">Sem tags</span>`;

  const hist = (t.history || []).slice().reverse().map(h =>
    `<div class="hItem"><strong>${escapeHtml(h.at)}</strong> — ${escapeHtml(h.action)}</div>`
  ).join("");
  if($("mHistory")) $("mHistory").innerHTML = hist || `<div class="muted small">Sem histórico ainda.</div>`;

  $("modal")?.showModal();
}
function closeModal(){
  $("modal")?.close();
  modalId = null;
}

function advanceStatus(id){
  const list = loadTickets();
  const t = list.find(x => x.id === id);
  if(!t) return;

  const old = t.status;
  if(t.status === "Aberto") t.status = "Em andamento";
  else if(t.status === "Em andamento") t.status = "Resolvido";
  else t.status = "Aberto";

  t.updatedAt = nowISO();
  addHistory(t, `Status alterado: ${old} → ${t.status}`);

  saveTickets(list);
  renderAll();
  if(modalId === id) openModal(id);
}

function deleteTicket(id){
  const ok = confirm("Deseja excluir este chamado?");
  if(!ok) return;

  const list = loadTickets().filter(x => x.id !== id);
  saveTickets(list);

  if(editingId === id) clearForm();
  closeModal();
  renderAll();
  setMsg("Chamado excluído.", true);
}

/* ===== CSV / JSON ===== */
function buildCSVFrom(list){
  const header = [
    "createdAt","id","branch","pdv","status","priority","category",
    "title","requester","assignedTo","tags","desc",
    "ownerUserId","ownerName","ownerEmail"
  ];
  const rows = list.map(t => ([
    t.createdAt, t.id, t.branch, t.pdv, t.status, t.priority, t.category,
    t.title, t.requester, t.assignedTo || "", (t.tags||[]).join("|"), t.desc,
    t.owner?.userId || "", t.owner?.name || "", t.owner?.email || ""
  ]));
  return [header.join(","), ...rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(","))].join("\n");
}

function exportCSV(){
  const all = loadTickets();
  const list = applyFilters(all);
  if(list.length === 0){
    setMsg("Não há chamados (com esses filtros) para exportar.", false);
    return;
  }
  const csv = buildCSVFrom(list);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `helpdesk_fila_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setMsg("CSV exportado!", true);
}

function exportJSON(){
  const data = {
    exportedAt: new Date().toISOString(),
    tickets: loadTickets()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `helpdesk_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setMsg("Backup JSON baixado!", true);
}

async function importJSONFile(file){
  try{
    const text = await file.text();
    const data = JSON.parse(text);

    const incoming = Array.isArray(data) ? data : (data.tickets || []);
    if(!Array.isArray(incoming)) throw new Error("Formato inválido");

    const cleaned = incoming.map(t => ({
      id: String(t.id || uid()),
      createdAt: String(t.createdAt || nowISO()),
      createdAtMs: Number(t.createdAtMs || Date.now()),
      updatedAt: String(t.updatedAt || t.createdAt || nowISO()),
      title: String(t.title || "Sem título"),
      requester: String(t.requester || "N/A"),
      desc: String(t.desc || ""),
      branch: String(t.branch || "1"),
      pdv: String(t.pdv || "1"),
      category: String(t.category || "Outros"),
      priority: String(t.priority || "Média"),
      status: String(t.status || "Aberto"),
      assignedTo: String(t.assignedTo || ""),
      tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
      history: Array.isArray(t.history) ? t.history : [],
      owner: t.owner ? {
        userId: String(t.owner.userId || ""),
        name: String(t.owner.name || ""),
        email: String(t.owner.email || "")
      } : null
    }));

    saveTickets(cleaned);
    clearForm();
    closeModal();
    renderAll();
    setMsg("Importado com sucesso!", true);
  }catch(err){
    setMsg("Falha ao importar JSON. Verifique o arquivo.", false);
  }
}

/* ===== Seed / Reset ===== */
function seed(){
  const list = loadTickets();
  if(list.length > 0){
    const ok = confirm("Já existem chamados. Quer adicionar exemplos mesmo assim?");
    if(!ok) return;
  }

  const now = Date.now();
  const examples = [
    {
      title:"PDV 2 não imprime NFC-e",
      requester:"Caixa 02",
      desc:"Impressão travando. Checar spooler/porta e reiniciar serviço.",
      branch:"3",
      pdv:"2",
      category:"PDV",
      priority:"Alta",
      status:"Aberto",
      assignedTo:"TI",
      tags:["nfc-e","impressora","pdv"]
    },
    {
      title:"Queda de rede na filial",
      requester:"Gerência",
      desc:"Sem internet em alguns caixas. Verificar switch/cabo/ONU.",
      branch:"1",
      pdv:"1",
      category:"Rede",
      priority:"Média",
      status:"Em andamento",
      assignedTo:"CPD",
      tags:["rede","switch"]
    },
    {
      title:"Sistema lento no final do dia",
      requester:"Supervisor",
      desc:"Lentidão entre 18h-20h. Monitorar uso e logs.",
      branch:"6",
      pdv:"5",
      category:"Sistema",
      priority:"Baixa",
      status:"Resolvido",
      assignedTo:"TI",
      tags:["performance","logs"]
    },
  ];

  const add = examples.map((e, i) => {
    const id = uid();
    const createdAtMs = now - (i * 1000 * 60 * 40);
    const d = new Date(createdAtMs);
    const createdAt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const t = {
      id,
      createdAt,
      createdAtMs,
      updatedAt: createdAt,
      title: e.title,
      requester: e.requester,
      desc: e.desc,
      branch: e.branch,
      pdv: e.pdv,
      category: e.category,
      priority: e.priority,
      status: e.status,
      assignedTo: e.assignedTo,
      tags: e.tags || [],
      history: [],
      owner: {
        userId: session?.userId || "seed",
        name: session?.name || "Sistema",
        email: session?.email || ""
      }
    };
    addHistory(t, "Chamado criado (exemplo)");
    addHistory(t, `Status inicial: ${t.status}`);
    return t;
  });

  saveTickets(loadTickets().concat(add));
  renderAll();
  setMsg("Exemplos criados!", true);
}

function resetAll(){
  const ok = confirm("Isso vai apagar TODOS os chamados. Continuar?");
  if(!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  clearForm();
  closeModal();
  renderAll();
  setMsg("Sistema resetado.", true);
}

/* ===== Abas ===== */
function setTab(tabId){
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".tabPane").forEach(pane => {
    pane.classList.toggle("hidden", pane.id !== tabId);
  });

  if(tabId === "tabFila") renderQueue();
}

/* ===== Tema (simples) ===== */
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  const prefs = loadPrefs();
  prefs.theme = theme;
  savePrefs(prefs);

  if(theme === "light"){
    document.documentElement.style.setProperty("--bg", "#f5f7ff");
    document.documentElement.style.setProperty("--card", "#ffffff");
    document.documentElement.style.setProperty("--text", "#0b1220");
    document.documentElement.style.setProperty("--muted", "#44506b");
  }else{
    document.documentElement.style.setProperty("--bg", "#0b1220");
    document.documentElement.style.setProperty("--card", "#111a2e");
    document.documentElement.style.setProperty("--text", "#eaf2ff");
    document.documentElement.style.setProperty("--muted", "#a7b7d6");
  }
}

function toggleTheme(){
  const prefs = loadPrefs();
  const cur = prefs.theme || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

/* ===== Render geral ===== */
function renderAll(){
  renderCards();
  renderQueue();
}

/* ===== Eventos ===== */
$("form")?.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = formData();
  const err = validate(data);
  if(err){ setMsg(err, false); return; }

  const list = loadTickets();

  if(editingId){
    const t = list.find(x => x.id === editingId);
    if(!t){ setMsg("Chamado não encontrado.", false); clearForm(); return; }

    const oldStatus = t.status;
    const oldPriority = t.priority;

    t.title = data.title;
    t.requester = data.requester;
    t.desc = data.desc;
    t.branch = data.branch;
    t.pdv = data.pdv;
    t.category = data.category;
    t.priority = data.priority;
    t.status = data.status;
    t.assignedTo = data.assignedTo;
    t.tags = data.tags;

    t.updatedAt = nowISO();
    addHistory(t, "Chamado editado");
    if(oldStatus !== t.status) addHistory(t, `Status alterado: ${oldStatus} → ${t.status}`);
    if(oldPriority !== t.priority) addHistory(t, `Prioridade alterada: ${oldPriority} → ${t.priority}`);

    saveTickets(list);
    setMsg("Chamado atualizado!", true);
    clearForm();
    renderAll();
    return;
  }

  const createdAtMs = Date.now();

  /* ✅ SALVA O CHAMADO COM O DONO (owner) */
  const t = {
    id: uid(),
    createdAt: nowISO(),
    createdAtMs,
    updatedAt: nowISO(),
    ...data,
    owner: {
      userId: session.userId,
      name: session.name,
      email: session.email
    },
    history: []
  };

  addHistory(t, "Chamado criado");
  addHistory(t, `Status inicial: ${t.status}`);

  list.push(t);
  saveTickets(list);

  setMsg("Chamado criado com sucesso!", true);
  clearForm();
  renderAll();
});

$("btnCancel")?.addEventListener("click", () => {
  clearForm();
  setMsg("Edição cancelada.", true);
});

["q","fStatus","fPriority","fCategory","fBranch","fPDV","sort"].forEach(id => {
  const el = $(id);
  if(!el) return;
  el.addEventListener("input", renderAll);
  el.addEventListener("change", renderAll);
});

$("btnClearFilters")?.addEventListener("click", () => {
  if($("q")) $("q").value = "";
  if($("fStatus")) $("fStatus").value = "Todos";
  if($("fPriority")) $("fPriority").value = "Todos";
  if($("fCategory")) $("fCategory").value = "Todos";
  if($("fBranch")) $("fBranch").value = "Todos";
  if($("fPDV")) $("fPDV").value = "Todos";
  if($("sort")) $("sort").value = "atendimento";
  renderAll();
});

$("btnSeed")?.addEventListener("click", seed);
$("btnReset")?.addEventListener("click", resetAll);

$("btnExportCSV")?.addEventListener("click", exportCSV);
$("btnExportJSON")?.addEventListener("click", exportJSON);
$("importJSON")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if(file) importJSONFile(file);
  e.target.value = "";
});

/* Modal */
$("mClose")?.addEventListener("click", closeModal);
$("mEdit")?.addEventListener("click", () => {
  if(!modalId) return;
  const t = loadTickets().find(x => x.id === modalId);
  if(!t) return;
  closeModal();
  fillForm(t);
  setMsg("Editando chamado.", true);
  setTab("tabChamados");
});
$("mNext")?.addEventListener("click", () => {
  if(modalId) advanceStatus(modalId);
});
$("mDelete")?.addEventListener("click", () => {
  if(modalId) deleteTicket(modalId);
});

/* Tabs */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

/* Tema */
$("btnTheme")?.addEventListener("click", toggleTheme);

/* Inicial */
(function init(){
  renderAuthUI();                 // ✅ mostra “Logado como…”
  const prefs = loadPrefs();
  applyTheme(prefs.theme || "dark");
  clearForm();
  renderAll();
  setTab("tabChamados");
})();
