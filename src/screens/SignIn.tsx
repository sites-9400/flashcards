import { Navigate } from 'react-router-dom';
import { signIn, useUser } from '../lib/auth';

export default function SignIn() {
  const { user, loading } = useUser();
  if (loading) return <p className="p-6 text-sm opacity-60">Loading...</p>;
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-maroon">LawDeck</h1>
      <p className="text-sm opacity-70">Active recall for law school.</p>
      <button
        onClick={() => void signIn()}
        className="bg-mustard text-maroon font-semibold rounded-lg px-6 py-3 hover:bg-mustard-dark"
      >
        Sign in with Google
      </button>
    </main>
  );
}
