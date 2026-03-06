'use client';

import { auth } from '@/lib/firebase';

/**
 * Fetch wrapper that attaches the Firebase ID token as a Bearer header.
 * Falls back to a regular fetch when no user is signed in (demo mode).
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);

  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // No auth available — proceed without token (demo mode)
  }

  return fetch(url, { ...options, headers });
}
