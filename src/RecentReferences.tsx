import { useEffect, useState } from "react";
import { media } from "./api";
import type { Item } from "./model";

function RecentRow({ item, open }: { item: Item; open: () => void }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setImage("");
    if (!item.missing && (item.kind !== "link" || item.thumbnail))
      void media(item, "thumbnail", abort.signal)
        .then((url) => {
          if (!abort.signal.aborted) setImage(url);
        })
        .catch(() => {});
    return () => abort.abort();
  }, [item.id, item.modified, item.thumbnail, item.path, item.missing]);
  return (
    <button data-item-id={item.id} className="recent-reference" onClick={open}>
      {image ? <img alt="" src={image} /> : <small>{item.kind}</small>}
      <span>
        {item.name}
        <small>{item.source || "Links"}</small>
      </span>
    </button>
  );
}
export default function RecentReferences({
  items,
  added,
  open,
}: {
  items: Item[];
  added: boolean;
  open: (item: Item) => void;
}) {
  const [limit, setLimit] = useState(60);
  const groups = new Map<string, Item[]>();
  for (const item of items.slice(0, limit)) {
    const day = added
      ? item.added
        ? new Date(item.added).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Date unavailable"
      : "Last opened";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return (
    <div className="recent-list">
      {[...groups].map(([day, rows]) => (
        <section key={day}>
          <h3>{day}</h3>
          {rows.map((item) => (
            <RecentRow key={item.id} item={item} open={() => open(item)} />
          ))}
        </section>
      ))}
      {!items.length && (
        <p>
          {added
            ? "No matching references."
            : "No matching viewing history. Open or preview a reference to see it here."}
        </p>
      )}
      {items.length > limit && (
        <button onClick={() => setLimit(limit + 60)}>Show more</button>
      )}
    </div>
  );
}
