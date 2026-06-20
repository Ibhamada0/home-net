// Browser-only authentication backed by Dexie + bcrypt.
// Session lives in localStorage; no server, no cookies.

import bcrypt from "bcryptjs";
import { db, uid, type AppUser } from "./local-db";

const SESSION_KEY = "homenet_session_v1";

export type Session = { user_id: string; username: string; role: AppUser["role"] } | null;

type Listener = (s: Session) => void;
const listeners = new Set<Listener>();

export function getSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((l) => l(s));
}

export function onAuthChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const validUsername = (u: string) => /^[a-zA-Z0-9_.-]{3,30}$/.test(u);

export async function ensureBootstrap() {
  // Seed a default admin on first run so users can log in immediately.
  const count = await db.users.count();
  if (count === 0) {
    await db.users.add({
      id: uid(),
      username: "admin",
      full_name: "Administrator",
      password_hash: bcrypt.hashSync("admin", 8),
      role: "admin",
      created_at: new Date().toISOString(),
    });
  }
}

export async function signIn(username: string, password: string): Promise<Session> {
  if (!validUsername(username)) throw new Error("اسم المستخدم غير صالح");
  await ensureBootstrap();
  const u = await db.users.where("username").equalsIgnoreCase(username.trim()).first();
  if (!u) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
  const ok = bcrypt.compareSync(password, u.password_hash);
  if (!ok) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
  const s: Session = { user_id: u.id, username: u.username, role: u.role };
  setSession(s);
  return s;
}

export async function signUp(p: { username: string; password: string; full_name: string }): Promise<Session> {
  if (!validUsername(p.username)) throw new Error("اسم المستخدم: 3-30 حرف إنجليزي/أرقام");
  if (p.password.length < 6) throw new Error("كلمة المرور 6 أحرف على الأقل");
  await ensureBootstrap();
  const exists = await db.users.where("username").equalsIgnoreCase(p.username.trim()).first();
  if (exists) throw new Error("اسم المستخدم مستخدم بالفعل");
  // First-ever signup becomes admin; subsequent are staff.
  const count = await db.users.count();
  const role: AppUser["role"] = count === 0 ? "admin" : "staff";
  const u: AppUser = {
    id: uid(),
    username: p.username.trim(),
    full_name: p.full_name.trim() || p.username.trim(),
    password_hash: bcrypt.hashSync(p.password, 8),
    role,
    created_at: new Date().toISOString(),
  };
  await db.users.add(u);
  const s: Session = { user_id: u.id, username: u.username, role: u.role };
  setSession(s);
  return s;
}

export function signOut() {
  setSession(null);
}

export async function changeMyPassword(newPassword: string) {
  if (newPassword.length < 6) throw new Error("كلمة المرور 6 أحرف على الأقل");
  const s = getSession();
  if (!s) throw new Error("غير مسجل الدخول");
  await db.users.update(s.user_id, { password_hash: bcrypt.hashSync(newPassword, 8) });
}
