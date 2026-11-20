const TOKEN_STORAGE_KEY = 'margamukti_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    setAdminToken(null);
    window.dispatchEvent(new CustomEvent('margamukti:unauthorized'));
  }

  return res;
}
