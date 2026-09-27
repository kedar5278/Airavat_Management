"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ClerkGuard = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username: string | null;
  imageUrl: string;
  createdAt: number;
};

export default function ClerkGuardProfiles() {
  const [users, setUsers] = useState<ClerkGuard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ClerkGuard | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/clerk-users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load Clerk profiles.");
      setUsers(data.users ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Clerk profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.fullName, user.email, user.phone, user.username, user.id].filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [users, query]);

  return <section className="clerk-guard-section">
    <div className="section-heading">
      <div>
        <h2>Clerk Registered Guards</h2>
        <p>Profiles created through the Clerk Guard signup.</p>
      </div>
      <div className="clerk-section-actions">
        <span className="live-pill">{users.length} CLERK USERS</span>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
      </div>
    </div>

    <div className="clerk-toolbar">
      <div className="search-wrap">
        <span>⌕</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone, username, or Clerk ID…" />
      </div>
    </div>

    {loading && <div className="clerk-empty">Loading Clerk profiles…</div>}
    {!loading && error && <div className="clerk-error">{error}</div>}
    {!loading && !error && !filtered.length && <div className="clerk-empty">No Clerk guard accounts found.</div>}

    {!loading && !error && filtered.length > 0 && <div className="clerk-profile-grid">
      {filtered.map(user => <button key={user.id} className="clerk-profile-card" onClick={() => setSelected(user)}>
        <Image src={user.imageUrl} alt={user.fullName} width={56} height={56} unoptimized className="clerk-profile-photo" />
        <div className="clerk-profile-info">
          <strong>{user.fullName}</strong>
          <small>{user.email || "No email"}</small>
          <small>{user.phone || "No phone"}</small>
        </div>
        <span className="clerk-view">View ›</span>
      </button>)}
    </div>}

    {selected && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div className="modal-card clerk-profile-modal">
        <div className="modal-title">
          <div>
            <Image src={selected.imageUrl} alt={selected.fullName} width={66} height={66} unoptimized className="clerk-profile-modal-photo" />
            <div>
              <h2>{selected.fullName}</h2>
              <p>Clerk guard profile</p>
            </div>
          </div>
          <button onClick={() => setSelected(null)} aria-label="Close profile">×</button>
        </div>
        <div className="profile-grid">
          <div><small>Full name</small><strong>{selected.fullName}</strong></div>
          <div><small>Email</small><strong>{selected.email || "—"}</strong></div>
          <div><small>Phone</small><strong>{selected.phone || "—"}</strong></div>
          <div><small>Username</small><strong>{selected.username || "—"}</strong></div>
          <div><small>Clerk User ID</small><strong>{selected.id}</strong></div>
          <div><small>Signup date</small><strong>{new Date(selected.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setSelected(null)}>Close</button>
        </div>
      </div>
    </div>}
  </section>;
}
