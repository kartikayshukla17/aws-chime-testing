// Per-tab identity. Cookies are shared by every tab in a browser, so two tabs would be the same user.
// A signed token kept in sessionStorage is per-tab, which lets one browser host several testers.
const T = 'ct_token';
const N = 'ct_name';

export const getToken = (): string | null => { try { return sessionStorage.getItem(T); } catch { return null; } };
export const getTokenName = (): string | null => { try { return sessionStorage.getItem(N); } catch { return null; } };
export const setToken = (token: string | null, name?: string) => {
  try {
    if (token) { sessionStorage.setItem(T, token); if (name) sessionStorage.setItem(N, name); }
    else { sessionStorage.removeItem(T); sessionStorage.removeItem(N); }
  } catch {}
};
export const authHeaders = (): Record<string, string> => { const t = getToken(); return t ? { 'x-session': t } : {}; };
