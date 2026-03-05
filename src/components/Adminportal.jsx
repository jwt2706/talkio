import React, { useMemo, useState } from "react";

export default function AdminPortal({
  open,
  onClose,
  channels = [],
  users = [],
  setUsers,
  memberships = {},
  setMemberships,
}) {
  if (!open) return null;

  const [activeChannelId, setActiveChannelId] = useState(channels?.[0]?.id || null);
  const [newEmail, setNewEmail] = useState("");

  const activeMembers = memberships?.[activeChannelId] || [];

  const availableUsers = useMemo(() => {
    const memberSet = new Set(activeMembers);
    return users.filter((u) => !memberSet.has(u.id));
  }, [users, activeMembers]);

  const canCreateUser = useMemo(() => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return false;
    if (!email.includes("@") || !email.includes(".")) return false;
    return !users.some((u) => (u.email || "").toLowerCase() === email);
  }, [newEmail, users]);

  const createUser = () => {
    if (!canCreateUser) return;
    const email = newEmail.trim().toLowerCase();

    const u = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      email,
    };

    setUsers?.((prev) => [...prev, u]);
    setNewEmail("");
  };

  const addUserToChannel = (channelId, userId) => {
    setMemberships?.((prev) => {
      const next = { ...(prev || {}) };
      const cur = next[channelId] || [];
      if (cur.includes(userId)) return prev;
      next[channelId] = [...cur, userId];
      return next;
    });
  };

  const removeUserFromChannel = (channelId, userId) => {
    setMemberships?.((prev) => {
      const next = { ...(prev || {}) };
      const cur = next[channelId] || [];
      const updated = cur.filter((id) => id !== userId);
      if (updated.length === 0) delete next[channelId];
      else next[channelId] = updated;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Window */}
      <div className="absolute inset-6 bg-zinc-950 text-white rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-800">
          <div>
            <div className="text-xs text-zinc-400">Support</div>
            <div className="text-lg font-semibold">Admin Portal</div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        {/* Desktop layout */}
        <div className="grid grid-cols-[320px_1fr_360px] h-[calc(100%-64px)]">
          {/* LEFT: Channels */}
          <div className="border-r border-zinc-800 p-4 overflow-auto">
            <div className="text-xs text-zinc-400 mb-2">Channels</div>

            <div className="space-y-2">
              {channels.map((c) => {
                const active = c.id === activeChannelId;
                const count = (memberships?.[c.id] || []).length;

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveChannelId(c.id)}
                    className={`w-full text-left rounded-2xl px-4 py-3 border transition ${
                      active
                        ? "border-blue-400/50 bg-blue-500/10"
                        : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-zinc-400">{count} members</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER: Membership management */}
          <div className="p-6 overflow-auto">
            <div className="text-xl font-semibold">
              {channels.find((c) => c.id === activeChannelId)?.name || "Select a channel"}
            </div>
            <div className="text-sm text-zinc-400 mt-1">
              Assign users to this channel using the dropdown.
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
              <div className="text-sm font-medium">Add user</div>

              <select
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                defaultValue=""
                onChange={(e) => {
                  const userId = e.target.value;
                  if (!userId || !activeChannelId) return;
                  addUserToChannel(activeChannelId, userId);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  {availableUsers.length ? "Select a user…" : "No available users"}
                </option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>

              <div className="mt-4">
                <div className="text-sm font-medium">Users in this channel</div>

                {activeMembers.length === 0 ? (
                  <div className="text-sm text-zinc-400 mt-2">No users assigned yet.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {activeMembers.map((uid) => {
                      const user = users.find((x) => x.id === uid);
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                        >
                          <div className="text-sm">{user?.email || uid}</div>
                          <button
                            onClick={() => removeUserFromChannel(activeChannelId, uid)}
                            className="text-xs px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Create users by email */}
          <div className="border-l border-zinc-800 p-4 overflow-auto">
            <div className="text-xs text-zinc-400 mb-2">Create user (email)</div>

            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ex: user@company.com"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") createUser();
              }}
            />

            <button
              onClick={createUser}
              disabled={!canCreateUser}
              className={`mt-3 w-full rounded-xl px-3 py-2 border transition ${
                !canCreateUser
                  ? "border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed"
                  : "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100"
              }`}
            >
              Create User
            </button>

            {!canCreateUser && newEmail.trim() !== "" && (
              <div className="mt-2 text-xs text-red-300">
                Invalid email or already exists.
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm font-medium">All users</div>
              <div className="mt-2 space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    {u.email}
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-sm text-zinc-400">No users yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}