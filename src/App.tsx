import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useUser } from './lib/auth';
import SignIn from './screens/SignIn';
import Home from './screens/Home';
import Review from './screens/Review';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return <p className="p-6 text-sm opacity-60">Loading...</p>;
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/review/:deckId" element={<RequireAuth><Review /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
