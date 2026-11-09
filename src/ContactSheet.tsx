import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { media } from "./api";
import type { Item } from "./model";
import { StudioDialog } from "./Shortcuts";

async function poster(item: Item, signal: AbortSignal) {
  if (item.missing || (item.kind === "link" && !item.thumbnail)) return null;
  const url = await media(item, "thumbnail", signal);
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  return image;
}

function draw(
  canvas: HTMLCanvasElement,
  title: string,
  items: Item[],
  images: (HTMLImageElement | null)[],
  names: boolean,
  urls: boolean,
) {
  const columns = Math.min(3, Math.max(1, items.length)),
    width = 440,
    gap = 20,
    height = 290;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "16px Segoe UI";
  const captions = items.map((item) => {
    const lines: string[] = [];
    if (urls) {
      let line = "";
      const address = item.kind === "link" ? item.path : item.source_url ?? "";
      for (const char of address) {
        if (ctx.measureText(line + char).width > width && line) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      if (line) lines.push(line);
    }
    return lines;
  });
  const rowHeights = Array.from(
    { length: Math.ceil(items.length / columns) },
    (_, row) =>
      height +
      gap +
      (names ? 32 : 0) +
      Math.max(
        0,
        ...captions
          .slice(row * columns, (row + 1) * columns)
          .map((lines) => lines.length),
      ) *
        21,
  );
  canvas.width = columns * (width + gap) + gap;
  canvas.height = 84 + rowHeights.reduce((a, b) => a + b, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#172321";
  ctx.font = "600 31px Segoe UI";
  ctx.fillText(title, gap, 49, canvas.width - 2 * gap);
  let y = 72;
  items.forEach((item, i) => {
    const x = gap + (i % columns) * (width + gap),
      img = images[i];
    ctx.fillStyle = "#ecf0ef";
    ctx.fillRect(x, y, width, height);
    if (img) {
      const scale = Math.min(width / img.width, height / img.height);
      ctx.drawImage(
        img,
        x + (width - img.width * scale) / 2,
        y + (height - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
    } else {
      ctx.font = "20px Segoe UI";
      ctx.fillStyle = "#52635f";
      ctx.fillText(
        item.kind === "link"
          ? new URL(item.path).hostname
          : "Preview unavailable",
        x + 16,
        y + height / 2,
        width - 32,
      );
    }
    if (names) {
      ctx.fillStyle = "#172321";
      ctx.font = "600 20px Segoe UI";
      ctx.fillText(item.name, x, y + height + 24, width);
    }
    ctx.fillStyle = "#516560";
    ctx.font = "16px Segoe UI";
    captions[i].forEach((line, j) =>
      ctx.fillText(line, x, y + height + (names ? 32 : 0) + 18 + j * 21),
    );
    if (i % columns === columns - 1) y += rowHeights[Math.floor(i / columns)];
  });
}
export default function ContactSheet({
  title,
  items,
  initial,
  close,
}: {
  title: string;
  items: Item[];
  initial: Set<number>;
  close: () => void;
}) {
  const [ids, setIds] = useState(() =>
    items
      .filter((i) => initial.has(i.id))
      .slice(0, 24)
      .map((i) => i.id),
  );
  const [search, setSearch] = useState(""),
    [names, setNames] = useState(true),
    [urls, setUrls] = useState(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<number | null>(null);
  const selected = useMemo(
    () => ids.flatMap((id) => items.find((i) => i.id === id) ?? []),
    [ids, items],
  );
  const [limit, setLimit] = useState(60);
  const matches = items.filter((i) =>
    i.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    const abort = new AbortController();
    setReady(false);
    setStatus("");
    if (selected.length)
      void Promise.all(
        selected.map((i) => poster(i, abort.signal).catch(() => null)),
      )
        .then((images) => {
          if (abort.signal.aborted) return;
          draw(canvas.current!, title, selected, images, names, urls);
          setReady(true);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setStatus(String(e));
        });
    return () => abort.abort();
  }, [selected, title, names, urls]);
  function move(from: number, to: number) {
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setIds(next);
  }
  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Could not create PNG."))),
          "image/png",
        ),
      );
      const path = await invoke<string | null>(
        "save_contact_sheet",
        new Uint8Array(await blob.arrayBuffer()),
      );
      if (path) setStatus("Saved to " + path);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <StudioDialog title="Project contact sheet" close={close} busy={busy}>
      <p>
        {title} · Choose up to 24 references. Drag the selected rows or use the
        arrows to order them.
      </p>
      <fieldset disabled={busy}>
        <div className="sheet-columns">
          <section>
            <input
              placeholder="Find a project reference"
              aria-label="Find a project reference"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(60);
              }}
            />
            <div className="sheet-picker">
              {matches.slice(0, limit).map((i) => (
                <label key={i.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(i.id)}
                    disabled={!ids.includes(i.id) && ids.length >= 24}
                    onChange={() =>
                      setIds(
                        ids.includes(i.id)
                          ? ids.filter((id) => id !== i.id)
                          : [...ids, i.id],
                      )
                    }
                  />
                  {i.name}
                </label>
              ))}
              {matches.length > limit && (
                <button onClick={() => setLimit(limit + 60)}>Show more</button>
              )}
            </div>
          </section>
          <section aria-label="Sheet order">
            {selected.map((item, i) => (
              <div
                className="shortcut-row"
                key={item.id}
                draggable={!busy}
                onDragStart={() => {
                  drag.current = i;
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag.current !== null) move(drag.current, i);
                  drag.current = null;
                }}
              >
                <span>
                  {i + 1}. {item.name}
                </span>
                <button
                  aria-label={"Move " + item.name + " up"}
                  disabled={!i}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  aria-label={"Move " + item.name + " down"}
                  disabled={i === ids.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
              </div>
            ))}
          </section>
        </div>
        <label>
          <input
            type="checkbox"
            checked={names}
            onChange={(e) => setNames(e.target.checked)}
          />{" "}
          Names
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={urls}
            onChange={(e) => setUrls(e.target.checked)}
          />{" "}
          Source URLs
        </label>
      </fieldset>
      <canvas
        className="sheet-preview"
        hidden={!selected.length}
        aria-label="Contact sheet preview"
        ref={canvas}
      />
      <footer>
        <span role="status">{status || selected.length + " selected"}</span>
        <button
          className="primary"
          disabled={!ready || busy || !selected.length}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Export PNG"}
        </button>
      </footer>
    </StudioDialog>
  );
}
