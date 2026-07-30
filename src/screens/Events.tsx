import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDecks, fetchEvents, saveEvent, deleteEvent } from '../lib/data';
import type { Deck, EventDoc } from '../lib/types';

const emptyForm = { type: 'recit' as EventDoc['type'], subject: '', title: '', date: '', tags: '' };

export default function Events() {
  const { user } = useUser();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deckIds, setDeckIds] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!user) return;
    void fetchDecks(user.uid).then(setDecks);
    void fetchEvents(user.uid).then(setEvents);
  }, [user]);

  function refresh() {
    if (user) void fetchEvents(user.uid).then(setEvents);
  }

  function toggleDeck(id: string) {
    setDeckIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function resetForm() {
    setForm(emptyForm);
    setDeckIds([]);
    setEditingId(null);
  }

  function startEdit(ev: EventDoc) {
    const d = new Date(ev.date);
    const pad = (n: number) => String(n).padStart(2, '0');
    setForm({
      type: ev.type, subject: ev.subject, title: ev.title,
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      tags: ev.coverage.tags.join(', '),
    });
    setDeckIds(ev.coverage.deckIds);
    setEditingId(ev.id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.date) return;
    const [y, m, d] = form.date.split('-').map(Number);
    const date = new Date(y, m - 1, d).getTime();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const event = {
      ...(editingId ? { id: editingId } : {}),
      type: form.type, subject: form.subject, title: form.title, date,
      coverage: { deckIds, tags },
    };
    void saveEvent(user.uid, event).then(() => { resetForm(); refresh(); });
  }

  function handleDelete(id: string) {
    if (!user) return;
    void deleteEvent(user.uid, id).then(refresh);
  }

  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">Events</h1>
        <Link to="/" className="text-sm underline">back</Link>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-8 border-b border-gray-300/50 pb-6">
        <label className="flex flex-col text-sm gap-1">
          Title
          <input className="border rounded px-2 py-1" value={form.title} required
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </label>
        <label className="flex flex-col text-sm gap-1">
          Subject
          <input className="border rounded px-2 py-1" value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </label>
        <label className="flex flex-col text-sm gap-1">
          Type
          <select className="border rounded px-2 py-1" value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventDoc['type'] }))}>
            <option value="recit">recit</option>
            <option value="exam">exam</option>
            <option value="quiz">quiz</option>
          </select>
        </label>
        <label className="flex flex-col text-sm gap-1">
          Date
          <input type="date" className="border rounded px-2 py-1" value={form.date} required
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </label>
        <fieldset className="text-sm">
          <legend>Coverage decks</legend>
          {decks.map((deck) => (
            <label key={deck.id} className="flex items-center gap-2">
              <input type="checkbox" checked={deckIds.includes(deck.id)} onChange={() => toggleDeck(deck.id)} />
              {deck.title}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col text-sm gap-1">
          Tags (comma separated)
          <input className="border rounded px-2 py-1" value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-mustard text-maroon font-semibold rounded-lg px-4 py-2 text-sm">
            {editingId ? 'Save changes' : 'Save event'}
          </button>
          {editingId && (
            <button type="button" className="text-sm underline" onClick={resetForm}>cancel</button>
          )}
        </div>
      </form>

      {events.length === 0 && <p className="text-sm opacity-70">No events yet.</p>}
      <ul className="divide-y divide-gray-300/50">
        {events.map((ev) => (
          <li key={ev.id} className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{ev.title}</p>
              <p className="text-xs opacity-60">
                {ev.subject}: {ev.type}: {new Date(ev.date).toLocaleDateString()}
                {ev.coverage.tags.length > 0 && `: ${ev.coverage.tags.join(', ')}`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link to={`/prep/${ev.id}`} className="bg-mustard text-maroon font-semibold rounded-lg px-3 py-1">
                Prepare
              </Link>
              <button className="underline" onClick={() => startEdit(ev)}>Edit</button>
              <button className="underline" onClick={() => handleDelete(ev.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
