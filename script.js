const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "helpdesk_chamados_v1";

function pad(n){ return String(n).padStart(2,"0"); }
function nowISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function uid(){
  return "C" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function loadTickets(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch{ return []; }
}
function saveTickets(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function setMsg(text, ok=true){
  const el = $("msg");
  el.textContent = text || "";
  el.style.color = ok ? "#2ee59d" : "#ff8080";
  if(text){
    clearTimeout(setMsg._t);
    setMsg._t = setTimeout(()=> el.textContent = "", 2500);
  }
}

function parseTags(str){
  return (str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function priorityRank(p){
  // maior primeiro
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

let editingId = null;
let modalId = null;

function formData(){
  return {
    title: $("title").value.trim(),
    requester: $("requester").value.trim(),
    desc: $("desc").value.trim(),
    category: $("category").value,
    priority: $("priority").value,
    status: $("status").value,
    tags: parseTags($("tags").value)
  };
}

function validate(data){
  if(!data.title) return "Informe o título.";
  if(!data.requester) return "Informe o solicitante.";
  if(!data.desc) return "Informe a descrição.";
  return null;
}

function addHistory(ticket, action){
  ticket.history = ticket.history || [];
  ticket.history.push({ at: nowISO(), action });
}

function clearForm(){
  $("form").reset();
  $("status").value = "Aberto";
  $("priority").value = "Média";
  editingId = null;

  $("formTitle").textContent = "Abrir chamado";
  $("btnCancel").hidden = true;
  $("editingPill").hidden = true;
  $("btnSave").textContent = "Salvar chamado";
}

function fillForm(ticket){
  $("title").value = ticket.title;
  $("requester").value = ticket.requester;
  $("desc").value = ticket.desc;
  $("category").value = ticket.category;
  $("priority").value = ticket.priority;
  $("status").value = ticket.status;
  $("tags").value = (ticket.tags || []).join(", ");

  editingId = ticket.id;
  $("formTitle").textContent = "Editar chamado";
  $("btnCancel").hidden = false;
  $("editingPill").hidden = false;
  $("btnSave").textContent = "Atualizar chamado";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyFilters(list){
  const q = $("q").value.trim().toLowerCase();
  const fStatus = $("fStatus").value;
  const fPriority = $("fPriority").value;
  const fCategory = $("fCategory").value;

  let out = list;

  if(fStatus !== "Todos") out = out.filter(t => t.status === fStatus);
  if(fPriority !== "Todos") out = out.filter(t => t.priority === fPriority);
  if(fCategory !== "Todos") out = out.filter(t => t.category === fCategory);

  if(q){
    out = out.filter(t => {
      const hay = [
        t.id, t.title, t.requester, t.desc, t.category, t.priority, t.status,
        ...(t.tags || [])
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const sort = $("sort").value;
  if(sort === "novo"){
    out = out.slice().sort((a,b) => b.createdAtMs - a.createdAtMs);
  }else if(sort === "antigo"){
    out = out.slice().sort((a,b) => a.createdAtMs - b.createdAtMs);
  }else{
    out = out.slice().sort((a,b) => {
      const pr = priorityRank(b.priority) - priorityRank(a.priority);
      if(pr !== 0) return pr;
      return b.createdAtMs - a.createdAtMs;
    });
  }

  $("count").textContent = `${out.length} exibido(s)`;
  return out;
}

function renderKpis(list){
  const open = list.filter(t => t.status === "Aberto").length;
  const prog = list.filter(t => t.status === "Em andamento").length;
  const done = list.filter(t => t.status === "Resolvido").length;

  $("kpiOpen").textContent = open;
  $("kpiProg").textContent = prog;
  $("kpiDone").textContent = done;
  $("kpiTotal").textContent = list.length;
}

function renderList(){
  const all = loadTickets();
  renderKpis(all);

  const list = applyFilters(all);
  const host = $("list");
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
        <div>📌 Categoria: <strong>${escapeHtml(t.category)}</strong></div>
        <div>🕒 Criado: <strong>${escapeHtml(t.createdAt)}</strong></div>
      </div>

      <div class="tags">${tags}</div>
    `;

    el.addEventListener("click", () => openModal(t.id));
    host.appendChild(el);
  }
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* Modal */
function openModal(id){
  const all = loadTickets();
  const t = all.find(x => x.id === id);
  if(!t) return;

  modalId = id;

  $("mTitle").textContent = `${t.title} (${t.id})`;

  $("mMeta").innerHTML = `
    <span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
    <span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span>
    <span class="badge">${escapeHtml(t.category)}</span>
    <span class="badge">Solicitante: ${escapeHtml(t.requester)}</span>
    <span class="badge">Criado: ${escapeHtml(t.createdAt)}</span>
  `;

  $("mDesc").textContent = t.desc;

  const tags = (t.tags || []).map(x => `<span class="tag">#${escapeHtml(x)}</span>`).join("");
  $("mTags").innerHTML = tags || `<span class="muted small">Sem tags</span>`;

  const hist = (t.history || []).slice().reverse().map(h =>
    `<div class="hItem"><strong>${escapeHtml(h.at)}</strong> — ${escapeHtml(h.action)}</div>`
  ).join("");
  $("mHistory").innerHTML = hist || `<div class="muted small">Sem histórico ainda.</div>`;

  $("modal").showModal();
}
function closeModal(){
  $("modal").close();
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

  addHistory(t, `Status alterado: ${old} → ${t.status}`);
  saveTickets(list);
  renderList();
  openModal(id);
}

function deleteTicket(id){
  const ok = confirm("Deseja excluir este chamado?");
  if(!ok) return;

  const list = loadTickets().filter(x => x.id !== id);
  saveTickets(list);
  closeModal();
  renderList();
  setMsg("Chamado excluído.", true);

  if(editingId === id) clearForm();
}

/* CSV */
function exportCSV(){
  const list = loadTickets();
  if(list.length === 0){
    setMsg("Não há chamados para exportar.", false);
    return;
  }

  const header = ["id","createdAt","requester","category","priority","status","title","desc","tags"];
  const rows = list.map(t => ([
    t.id, t.createdAt, t.requester, t.category, t.priority, t.status, t.title, t.desc, (t.tags||[]).join("|")
  ]));

  const csv = [header.join(","), ...rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `helpdesk_chamados_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setMsg("CSV exportado com sucesso!", true);
}

/* Seed */
function seed(){
  const list = loadTickets();
  if(list.length > 0){
    const ok = confirm("Já existem chamados. Quer adicionar exemplos mesmo assim?");
    if(!ok) return;
  }

  const examples = [
    {
      title:"PDV sem comunicação com servidor",
      requester:"Frente de caixa",
      desc:"PDV apresenta erro de conexão. Verificar rede e serviços.",
      category:"PDV",
      priority:"Alta",
      status:"Aberto",
      tags:["pdv","rede","urgente"]
    },
    {
      title:"Impressora fiscal não imprime",
      requester:"Caixa 02",
      desc:"Impressora não responde após reiniciar. Conferir cabo/porta e driver.",
      category:"Impressora",
      priority:"Média",
      status:"Em andamento",
      tags:["impressora","driver"]
    },
    {
      title:"Sistema lento no horário de pico",
      requester:"Gerência",
      desc:"Relatos de lentidão entre 18h e 20h. Coletar evidências e checar recursos.",
      category:"Sistema",
      priority:"Baixa",
      status:"Resolvido",
      tags:["performance","monitoramento"]
    },
  ];

  const now = Date.now();
  const add = examples.map((e, i) => {
    const id = uid();
    const createdAtMs = now - (i * 1000 * 60 * 45);
    const createdAt = new Date(createdAtMs);
    const createdAtStr = `${createdAt.getFullYear()}-${pad(createdAt.getMonth()+1)}-${pad(createdAt.getDate())} ${pad(createdAt.getHours())}:${pad(createdAt.getMinutes())}:${pad(createdAt.getSeconds())}`;

    const t = {
      id,
      createdAt: createdAtStr,
      createdAtMs,
      ...e,
      tags: e.tags || [],
      history: []
    };
    addHistory(t, "Chamado criado (exemplo)");
    addHistory(t, `Status inicial: ${t.status}`);
    return t;
  });

  saveTickets(loadTickets().concat(add));
  renderList();
  setMsg("Exemplos criados!", true);
}

/* Reset */
function resetAll(){
  const ok = confirm("Isso vai apagar TODOS os chamados. Continuar?");
  if(!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  clearForm();
  closeModal();
  renderList();
  setMsg("Sistema resetado.", true);
}

/* Form submit */
$("form").addEventListener("submit", (e) => {
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
    t.category = data.category;
    t.priority = data.priority;
    t.status = data.status;
    t.tags = data.tags;

    addHistory(t, "Chamado editado");
    if(oldStatus !== t.status) addHistory(t, `Status alterado: ${oldStatus} → ${t.status}`);
    if(oldPriority !== t.priority) addHistory(t, `Prioridade alterada: ${oldPriority} → ${t.priority}`);

    saveTickets(list);
    setMsg("Chamado atualizado!", true);
    clearForm();
    renderList();
    return;
  }

  const createdAtMs = Date.now();
  const t = {
    id: uid(),
    createdAt: nowISO(),
    createdAtMs,
    ...data,
    history: []
  };
  addHistory(t, "Chamado criado");
  addHistory(t, `Status inicial: ${t.status}`);

  list.push(t);
  saveTickets(list);

  setMsg("Chamado criado com sucesso!", true);
  clearForm();
  renderList();
});

/* Botões form */
$("btnCancel").addEventListener("click", () => {
  clearForm();
  setMsg("Edição cancelada.", true);
});

/* Filtros */
["q","fStatus","fPriority","fCategory","sort"].forEach(id => {
  $(id).addEventListener("input", renderList);
  $(id).addEventListener("change", renderList);
});

$("btnClearFilters").addEventListener("click", () => {
  $("q").value = "";
  $("fStatus").value = "Todos";
  $("fPriority").value = "Todos";
  $("fCategory").value = "Todos";
  $("sort").value = "novo";
  renderList();
});

/* Top actions */
$("btnExport").addEventListener("click", exportCSV);
$("btnReset").addEventListener("click", resetAll);
$("btnSeed").addEventListener("click", seed);

/* Modal events */
$("mClose").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
  // fecha clicando fora do card
  const rect = $(".modalCard")?.getBoundingClientRect?.();
  if(!rect) return;
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if(!inside) closeModal();
});

$("mEdit").addEventListener("click", () => {
  if(!modalId) return;
  const t = loadTickets().find(x => x.id === modalId);
  if(!t) return;
  closeModal();
  fillForm(t);
  setMsg("Editando chamado.", true);
});

$("mNext").addEventListener("click", () => {
  if(!modalId) return;
  advanceStatus(modalId);
});

$("mDelete").addEventListener("click", () => {
  if(!modalId) return;
  deleteTicket(modalId);
});

/* Inicial */
clearForm();
renderList();
