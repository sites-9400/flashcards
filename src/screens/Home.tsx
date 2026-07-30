import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser, signOutUser } from '../lib/auth';
import { fetchDecks } from '../lib/data';
import type { Deck } from '../lib/types';

export default function Home() {
  const { user } = useUser();
  const [decks, setDecks] = useState<Deck[]>([]);
  useEffect(() => {
    if (user) void fetchDecks(user.uid).then(setDecks);
  }, [user]);
  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">LawDeck</h1>
        <div>
          <Link to="/events" className="text-sm underline mr-3">events</Link>
          <button className="text-sm underline" onClick={() => void signOutUser()}>
            {user?.displayName ?? 'account'}: sign out
          </button>
        </div>
      </header>
      {decks.length === 0 && <p className="text-sm opacity-70">No decks yet.</p>}
      <ul className="divide-y divide-gray-300/50">
        {decks.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs opacity-60">{d.subject}: {d.cardCount} cards</p>
            </div>
            <Link to={`/review/${d.id}`} className="bg-mustard text-maroon font-semibold rounded-lg px-4 py-2 text-sm">
              Study
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
