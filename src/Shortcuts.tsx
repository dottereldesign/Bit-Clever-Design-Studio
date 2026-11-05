import { useEffect, useRef, useState, type ReactNode } from "react";
import { boardNames } from "./model";
import type { CollectionLayout } from './appearance';
export type GeneralTarget={kind:'view'|'project'|'category'|'website';value:string};

export const collectionNames = {
  links: "Links",
  resources: "Resources",
  ...boardNames,
  facebook: "Facebook Videos",
  added: "Recently added",
  viewed: "Recently viewed",
};
export type Shortcut = {
  key: string;
  name: string;
  url?: string;
  pinned?: boolean;
  hidden?: boolean;
  target?: GeneralTarget;
  layout?: CollectionLayout;
  content?: 'all'|'image'|'video'|'link';
};
export const collections: Shortcut[] = Object.entries(collectionNames).map(
  ([key, name]) => ({ key, name }),
);
export const sites: Shortcut[] = [
  { key: "pinterest", name: "Pinterest", url: "https://www.pinterest.com/" },
  { key: "dribbble", name: "Dribbble", url: "https://dribbble.com/" },
  { key: "awwwards", name: "Awwwards", url: "https://www.awwwards.com/" },
];
export function useLocalList<T>(key: string, defaults: T[]) {
  const [list, setList] = useState<T[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      return Array.isArray(value) ? value : defaults;
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(list));
  }, [key, list]);
  return [list, setList] as const;
}
export function ordered(list: Shortcut[]) {
  return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
}
export function StudioDialog({
  title,
  close,
  children,
  busy = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="studio-dialog"
      aria-label={title}
      ref={ref}
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close dialog" disabled={busy} onClick={close}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ShortcutEditor({
  list,
  change,
  web,
}: {
  list: Shortcut[];
  change: (list: Shortcut[]) => void;
  web?: boolean;
}) {
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const rows = ordered(list);
  function update(key: string, patch: Partial<Shortcut>) {
    change(rows.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function move(i: number, delta: number) {
    const next = [...rows];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    change(next);
  }
  return (
    <section>
      <h3>{web ? "Favourite websites" : "Sidebar collections"}</h3>
      {rows.map((s, i) => (
        <div className="shortcut-row" key={s.key}>
          <span>{s.name}</span>
          <button
            aria-pressed={!!s.pinned}
            onClick={() => update(s.key, { pinned: !s.pinned })}
          >
            {s.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            aria-label={"Move " + s.name + " up"}
            disabled={!i || !!rows[i - 1].pinned !== !!s.pinned}
            onClick={() => move(i, -1)}
          >
            ↑
          </button>
          <button
            aria-label={"Move " + s.name + " down"}
            disabled={
              i === rows.length - 1 || !!rows[i + 1].pinned !== !!s.pinned
            }
            onClick={() => move(i, 1)}
          >
            ↓
          </button>
          <label>
            <input
              type="checkbox"
              checked={!s.hidden}
              onChange={() => update(s.key, { hidden: !s.hidden })}
            />{" "}
            Show
          </label>
          {web && !sites.some((site) => site.key === s.key) && (
            <button
              onClick={() => change(rows.filter((site) => site.key !== s.key))}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {web && (
        <form
          className="shortcut-add"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const site = new URL(url);
              if (!["https:", "http:"].includes(site.protocol))
                throw Error("Enter an http or https address.");
              if (!name.trim()) throw Error("Enter a shortcut name.");
              if (rows.some((s) => s.url === site.href))
                throw Error("That website is already listed.");
              change([
                ...rows,
                { key: crypto.randomUUID(), name: name.trim(), url: site.href },
              ]);
              setUrl("");
              setName("");
              setError("");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <input
            required
            aria-label="Shortcut name"
            placeholder="Website name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            type="url"
            aria-label="Shortcut URL"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button>Add website</button>
          {error && <small role="alert">{error}</small>}
        </form>
      )}
    </section>
  );
}
