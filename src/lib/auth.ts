export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  authenticatedAt: number;
}

export const AUTHORIZED_USER: AuthUser = {
  id: "usr_anshul_01",
  name: "Anshul Parate",
  email: "anshulnparate@gmail.com",
  role: "Lead Quantitative Trader",
  avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Anshul",
  authenticatedAt: Date.now(),
};

// Check email and password against verified master credentials
export function verifyCredentials(email?: string, password?: string): boolean {
  if (!email || !password) return false;
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();
  return cleanEmail === "anshulnparate@gmail.com" && cleanPass === "20102004";
}

export const AUTH_COOKIE_NAME = "trader_pro_session";
