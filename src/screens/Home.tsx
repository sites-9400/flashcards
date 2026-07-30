import { useUser, signOutUser } from '../lib/auth';

export default function Home() {
  const { user } = useUser();
  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">LawDeck</h1>
        <button className="text-sm underline" onClick={() => void signOutUser()}>
          {user?.displayName ?? 'account'}: sign out
        </button>
      </header>
      <p className="text-sm opacity-70">Decks load here (Task 9).</p>
    </main>
  );
}
