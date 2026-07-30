import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchRecentLogs } from '../lib/data';
import { weakSpots, type LogLike } from '../lib/stats';

export default function Weak() {
  const { user } = useUser();
  const [logs, setLogs] = useState<LogLike[]>([]);
  useEffect(() => {
    if (!user) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    void fetchRecentLogs(user.uid, cutoff).then(setLogs);
  }, [user]);

  const ranked = weakSpots(logs);

  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">Weak topics</h1>
        <Link to="/" className="text-sm underline">back</Link>
      </header>
      {ranked.length === 0 ? (
        <p className="text-sm opacity-60">No weak topics yet.</p>
      ) : (
        <ul className="divide-y divide-gray-300/50">
          {ranked.map((w) => (
            <li key={w.tag} className="py-3 flex justify-between text-sm">
              <span>{w.tag}</span>
              <span className="opacity-70">{Math.round(w.failRate * 100)}% fail, {w.attempts} attempts</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
