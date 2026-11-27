"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createRoom } from "@/lib/api";
import { normaliseRoomCode, rememberToken } from "@/lib/controlTokens";
import { LIGHT_COLOURS } from "@/lib/timer";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Buttons stay disabled until React has hydrated, so an early tap isn't silently lost.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const onCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const { room, controlToken } = await createRoom();
      rememberToken(room.code, controlToken);
      router.push(`/room/${room.code}/control`);
    } catch {
      setCreateError("Couldn't create a room. Check your connection and try again.");
      setCreating(false);
    }
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    const code = normaliseRoomCode(joinCode);
    if (!code) {
      setJoinError("Room codes are 5 letters and numbers, like K7QXM.");
      return;
    }
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-10 p-6">
      <header className="space-y-3">
        <div className="flex gap-2" aria-hidden>
          {(["green", "amber", "red"] as const).map((light) => (
            <span key={light} className="h-4 w-4 rounded-full" style={{ backgroundColor: LIGHT_COLOURS[light] }} />
          ))}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-brand-primary dark:text-sky-300">Peachy Timer</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A live timing light for Toastmasters meetings. The timekeeper runs the clock on one device; the speaker
          watches the light on any other.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold">I&apos;m the timekeeper</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Start a room, then show its code or link to the speaker&apos;s screen.
        </p>
        <button
          type="button"
          onClick={onCreate}
          disabled={!ready || creating}
          className="w-full rounded-lg bg-brand-primary px-4 py-3 font-semibold text-white hover:bg-[#00324e] disabled:opacity-60"
        >
          {creating ? "Creating…" : "Start a timing room"}
        </button>
        {createError && (
          <p role="alert" className="text-sm text-red-600">
            {createError}
          </p>
        )}
      </section>

      <form
        onSubmit={onJoin}
        className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-semibold">Show the light</h2>
        <label htmlFor="room-code" className="block text-sm text-gray-600 dark:text-gray-400">
          Room code
        </label>
        <div className="flex gap-2">
          <input
            id="room-code"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value);
              setJoinError(null);
            }}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            placeholder="K7QXM"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 font-mono text-lg uppercase tracking-widest dark:border-gray-700"
          />
          <button type="submit" disabled={!ready} className="rounded-lg border border-brand-primary px-4 py-2 font-semibold text-brand-primary dark:border-sky-300 dark:text-sky-300">
            Join
          </button>
        </div>
        {joinError && (
          <p role="alert" className="text-sm text-red-600">
            {joinError}
          </p>
        )}
      </form>
    </main>
  );
}
