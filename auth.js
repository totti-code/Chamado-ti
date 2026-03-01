// auth.js
const USERS_KEY = "hd_users_v1";
const SESSION_KEY = "hd_session_v1";

function loadUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}
function saveUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function uid(){
  return "U" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function hashSimple(s){
  // ⚠️ fraco, apenas para projeto acadêmico (não é criptografia real)
  let h = 0;
  for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return String(h);
}

export function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
export function requireAuth(redirectTo="login.html"){
  const ses = getSession();
  if(!ses || !ses.userId) {
    location.href = redirectTo;
    return null;
  }
  return ses;
}
export function logout(){
  localStorage.removeItem(SESSION_KEY);
}

export function register({name, email, password}){
  name = (name||"").trim();
  email = (email||"").trim().toLowerCase();
  password = (password||"");

  if(name.length < 2) return { ok:false, msg:"Nome muito curto." };
  if(!email.includes("@")) return { ok:false, msg:"Email inválido." };
  if(password.length < 4) return { ok:false, msg:"Senha muito curta (mín. 4)." };

  const users = loadUsers();
  if(users.some(u => u.email === email)) return { ok:false, msg:"Email já cadastrado." };

  const user = { id: uid(), name, email, pass: hashSimple(password), createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  return { ok:true, msg:"Conta criada!" };
}

export function login({email, password}){
  email = (email||"").trim().toLowerCase();
  password = (password||"");

  const users = loadUsers();
  const u = users.find(x => x.email === email);
  if(!u) return { ok:false, msg:"Usuário não encontrado." };

  if(u.pass !== hashSimple(password)) return { ok:false, msg:"Senha incorreta." };

  const session = { userId: u.id, name: u.name, email: u.email, at: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok:true, msg:"Login OK!" };
}
