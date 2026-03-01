// auth.js
const USERS_KEY = "martree_users_v1";
const SESSION_KEY = "martree_session_v1";

// ===== Utils =====
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// hash simples com SHA-256 (melhor que texto puro, mas ainda é front-end)
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function ensureAdminSeed() {
  const users = loadJSON(USERS_KEY, []);
  if (users.length) return;

  const admin = {
    id: "u_admin",
    username: "admin",
    name: "Administrador",
    role: "admin",
    passHash: await sha256("admin123"),
    createdAt: new Date().toISOString(),
  };
  saveJSON(USERS_KEY, [admin]);
}

// ===== Session =====
export function getSession() {
  return loadJSON(SESSION_KEY, null);
}
export function logout(redirectTo = "login.html") {
  localStorage.removeItem(SESSION_KEY);
  location.href = redirectTo;
}

export async function login(username, password) {
  await ensureAdminSeed();

  const users = loadJSON(USERS_KEY, []);
  const u = users.find(x => x.username.toLowerCase() === String(username).toLowerCase());
  if (!u) return { ok: false, error: "Usuário não encontrado." };

  const passHash = await sha256(password);
  if (passHash !== u.passHash) return { ok: false, error: "Senha incorreta." };

  const session = {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    at: new Date().toISOString(),
  };
  saveJSON(SESSION_KEY, session);
  return { ok: true, session };
}

// Protege página
export async function requireAuth({ redirectTo = "login.html", role = null } = {}) {
  await ensureAdminSeed();
  const s = getSession();
  if (!s) {
    location.href = redirectTo;
    throw new Error("no-session");
  }
  if (role && s.role !== role) {
    location.href = redirectTo;
    throw new Error("no-permission");
  }
  return s;
}

// ===== Users (admin) =====
export function listUsers() {
  return loadJSON(USERS_KEY, []);
}

export async function createUser({ name, username, password, role = "user" }) {
  await ensureAdminSeed();
  const session = getSession();
  if (!session || session.role !== "admin") {
    return { ok:false, error:"Sem permissão (somente admin)." };
  }

  name = String(name || "").trim();
  username = String(username || "").trim();
  password = String(password || "").trim();

  if (!name) return { ok:false, error:"Informe o nome." };
  if (!username) return { ok:false, error:"Informe o usuário." };
  if (password.length < 4) return { ok:false, error:"Senha muito curta (mín. 4)." };

  const users = loadJSON(USERS_KEY, []);
  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return { ok:false, error:"Usuário já existe." };

  const u = {
    id: "u_" + Math.random().toString(16).slice(2, 10),
    username,
    name,
    role: role === "admin" ? "admin" : "user",
    passHash: await sha256(password),
    createdAt: new Date().toISOString(),
  };

  users.push(u);
  saveJSON(USERS_KEY, users);
  return { ok:true, user: u };
}

export function deleteUser(userId) {
  const session = getSession();
  if (!session || session.role !== "admin") {
    return { ok:false, error:"Sem permissão (somente admin)." };
  }
  let users = loadJSON(USERS_KEY, []);
  const before = users.length;
  users = users.filter(u => u.id !== userId);

  // não deixa apagar o último admin
  const admins = users.filter(u => u.role === "admin");
  if (admins.length === 0) {
    return { ok:false, error:"Não é possível remover o último admin." };
  }

  saveJSON(USERS_KEY, users);
  return { ok: users.length !== before };
}
