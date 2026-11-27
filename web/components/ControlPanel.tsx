"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRoom, useTick, useWakeLock } from "@/hooks/useRoom";
import { type Command, getPresets, sendCommand } from "@/lib/api";
import { controlLink, displayLink, recallToken, rememberToken, tokenFromHash } from "@/lib/controlTokens";
import {
  currentLight,
  elapsedMs,
  formatDuration,
  formatSeconds,
  isOvertime,
  type Light,
  LIGHT_COLOURS,
  LIGHT_LABELS,
  parseDuration,
  type Preset,
} from "@/lib/timer";

const MANUAL_LIGHTS: Light[] = ["off", "green", "amber", "red"];

/** The timekeeper's view: runs the clock and overrides the light. */
export default function ControlPanel({ code }: { code: string }) {
  const { room, status, serverNow, applySnapshot } = useRoom(code);
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useTick(room?.status === "running");
  useWakeLock(status === "live");

  useEffect(() => {
    // A shared control link carries the token in the fragment; keep it and tidy the address bar.
    const fromHash = tokenFromHash(window.location.hash);
    if (fromHash) {
      rememberToken(code, fromHash);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setToken(fromHash ?? recallToken(code));
    setTokenChecked(true);
    setOrigin(window.location.origin);
    getPresets()
      .then((r) => setPresets(r.presets))
      .catch(() => setPresets([]));
  }, [code]);

  const run = async (command: Command) => {
    if (!token) return;
    setError(null);
    try {
      applySnapshot(await sendCommand(code, token, command));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    }
  };

  if (status === "not-found") {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Room {code} isn&apos;t running</h1>
        <p className="text-gray-600 dark:text-gray-400">Rooms expire after a few idle hours.</p>
        <Link href="/" className="text-brand-primary underline dark:text-sky-300">
          Start a new room
        </Link>
      </Centered>
    );
  }

  if (tokenChecked && !token) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">This device can&apos;t run room {code}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Only the timekeeper&apos;s device, or someone they shared the control link with, can run the clock.
        </p>
        <Link href={`/room/${code}`} className="text-brand-primary underline dark:text-sky-300">
          Show the light instead
        </Link>
      </Centered>
    );
  }

  if (!room) {
    return <Centered>Connecting to room {code}…</Centered>;
  }

  const now = serverNow();
  const elapsed = elapsedMs(room, now);
  const light = currentLight(room, now);
  const overtime = isOvertime(room.thresholds, elapsed);
  const running = room.status === "running";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Room <span className="font-mono tracking-widest">{code}</span>
        </h1>
        <span className="text-sm text-gray-500">{status === "live" ? "Live" : "Reconnecting…"}</span>
      </header>

      <section
        className="flex flex-col items-center gap-2 rounded-2xl p-6 text-white transition-colors"
        style={{ backgroundColor: LIGHT_COLOURS[light] }}
      >
        <p data-testid="control-clock" className="font-mono text-7xl font-bold tabular-nums sm:text-8xl">
          {formatDuration(elapsed)}
        </p>
        <p data-testid="control-light" className="text-lg">
          {LIGHT_LABELS[light]}
          {room.manualLight && " (set by hand)"}
          {overtime && " · over time"}
        </p>
        <p className="text-sm text-white/80">
          {room.label}: green {formatSeconds(room.thresholds.greenSec)} · amber {formatSeconds(room.thresholds.amberSec)} ·
          red {formatSeconds(room.thresholds.redSec)}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => run({ type: running ? "pause" : "start" })}
          className="rounded-xl bg-brand-primary py-4 text-xl font-semibold text-white hover:bg-[#00324e]"
        >
          {running ? "Pause" : room.status === "paused" ? "Resume" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => run({ type: "reset" })}
          className="rounded-xl border-2 border-brand-secondary py-4 text-xl font-semibold text-brand-secondary dark:border-rose-300 dark:text-rose-300"
        >
          {elapsed > 0 ? "Stop & reset" : "Reset"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Light</h2>
        <div className="flex flex-wrap gap-2">
          <LightButton active={room.manualLight === null} onClick={() => run({ type: "set-light", light: null })}>
            Automatic
          </LightButton>
          {MANUAL_LIGHTS.map((l) => (
            <LightButton
              key={l}
              active={room.manualLight === l}
              colour={LIGHT_COLOURS[l]}
              onClick={() => run({ type: "set-light", light: l })}
            >
              {LIGHT_LABELS[l]}
            </LightButton>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <SpeakerField key={room.history.length} initial={room.speaker} onSave={(speaker) => run({ type: "set-speaker", speaker })} />
        <div className="space-y-1">
          <label htmlFor="preset" className="block font-semibold">
            Timing
          </label>
          <select
            id="preset"
            value={room.presetId ?? "custom"}
            onChange={(e) => e.target.value !== "custom" && run({ type: "set-preset", presetId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">{room.presetId === null ? room.label : "Custom…"}</option>
          </select>
        </div>
      </section>

      <CustomTimes
        key={`${room.thresholds.greenSec}-${room.thresholds.amberSec}-${room.thresholds.redSec}`}
        initial={room.thresholds}
        onSave={(label, thresholds) => run({ type: "set-thresholds", label, thresholds })}
      />

      {origin && (
        <section className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
          <h2 className="font-semibold">Share</h2>
          <ShareRow label="Light for the speaker" url={displayLink(origin, code)} />
          {token && <ShareRow label="Control (gives timer access)" url={controlLink(origin, code, token)} />}
        </section>
      )}

      {room.history.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Timed so far</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 font-medium">Speaker</th>
                <th className="py-1 font-medium">Timing</th>
                <th className="py-1 text-right font-medium">Time</th>
                <th className="py-1 text-right font-medium">Within time</th>
              </tr>
            </thead>
            <tbody data-testid="history">
              {room.history.map((h) => (
                <tr key={h.finishedAt} className="border-t border-gray-200 dark:border-gray-800">
                  <td className="py-1">{h.speaker || "—"}</td>
                  <td className="py-1">{h.label}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatDuration(h.durationMs)}</td>
                  <td className="py-1 text-right">{h.qualified ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}

function LightButton({
  active,
  colour,
  onClick,
  children,
}: {
  active: boolean;
  colour?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 font-medium ${
        active ? "border-brand-primary bg-brand-primary text-white" : "border-gray-300 dark:border-gray-700"
      }`}
    >
      {colour && <span className="h-3 w-3 rounded-full ring-1 ring-white/50" style={{ backgroundColor: colour }} />}
      {children}
    </button>
  );
}

function SpeakerField({ initial, onSave }: { initial: string; onSave: (speaker: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-1">
      <label htmlFor="speaker" className="block font-semibold">
        Speaker
      </label>
      <input
        id="speaker"
        value={value}
        maxLength={80}
        placeholder="Name (optional)"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() !== initial && onSave(value.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
      />
    </div>
  );
}

function CustomTimes({
  initial,
  onSave,
}: {
  initial: { greenSec: number; amberSec: number; redSec: number };
  onSave: (label: string, thresholds: { greenSec: number; amberSec: number; redSec: number }) => void;
}) {
  const [green, setGreen] = useState(formatSeconds(initial.greenSec));
  const [amber, setAmber] = useState(formatSeconds(initial.amberSec));
  const [red, setRed] = useState(formatSeconds(initial.redSec));
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const [g, a, r] = [green, amber, red].map(parseDuration);
    if (g === null || a === null || r === null) {
      setProblem("Use minutes and seconds, like 4:30.");
      return;
    }
    if (!(g <= a && a <= r) || r === 0) {
      setProblem("Green must come before amber, and amber before red.");
      return;
    }
    setProblem(null);
    onSave(`Custom (${formatSeconds(g)}–${formatSeconds(r)})`, { greenSec: g, amberSec: a, redSec: r });
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-gray-600 dark:text-gray-400">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode="decimal"
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 font-mono dark:border-gray-700"
      />
    </div>
  );

  return (
    <details className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <summary className="cursor-pointer font-semibold">Custom times</summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {field("green-at", "Green at", green, setGreen)}
          {field("amber-at", "Amber at", amber, setAmber)}
          {field("red-at", "Red at", red, setRed)}
        </div>
        {problem && (
          <p role="alert" className="text-sm text-red-600">
            {problem}
          </p>
        )}
        <button type="submit" className="rounded-lg border border-brand-primary px-4 py-2 font-semibold text-brand-primary dark:border-sky-300 dark:text-sky-300">
          Use these times
        </button>
      </form>
    </details>
  );
}

function ShareRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full text-gray-600 sm:w-56 dark:text-gray-400">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{url}</code>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          )
        }
        className="rounded border border-gray-300 px-2 py-1 dark:border-gray-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
