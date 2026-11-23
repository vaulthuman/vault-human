// Who is signed in. The app starts by reading the stored token; screens redirect to sign-in when there is none.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken } from './api';

type Auth = { ready: boolean; signedIn: boolean; signIn: (token: string) => Promise<void>; signOut: () => Promise<void> };
const Ctx = createContext<Auth>({ ready: false, signedIn: false, signIn: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    getToken().then((t) => { setSignedIn(!!t); setReady(true); }).catch(() => setReady(true));
  }, []);
  const signIn = useCallback(async (t: string) => { await setToken(t); setSignedIn(true); }, []);
  const signOut = useCallback(async () => { await clearToken(); setSignedIn(false); }, []);
  return <Ctx.Provider value={{ ready, signedIn, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
