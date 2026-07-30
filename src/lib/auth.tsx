import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

const Ctx = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
