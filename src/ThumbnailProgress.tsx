import { useEffect, useState, useSyncExternalStore } from "react";
import { mediaQueue } from "./api";

export default function ThumbnailProgress() {
  const progress = useSyncExternalStore(mediaQueue.subscribe, mediaQueue.getProgress);
  const [visible, setVisible] = useState(false);
  const busy = progress.pending > 0;
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(busy), busy ? 180 : 1200);
    return () => window.clearTimeout(timer);
  }, [busy]);
  if (!visible || !progress.total) return null;
  const percent = Math.floor(progress.completed / progress.total * 100);
  const label = busy ? "Thumbnails" : progress.failed ? "Checked" : "Ready";
  return <div className="thumbnail-progress" title={`${progress.completed} of ${progress.total} requested thumbnails processed${progress.failed ? ` · ${progress.failed} unavailable; use Retry on a card` : ''}`}>
    <div className="thumbnail-progress-label"><span>{label}</span><span>{percent}%</span></div>
    <progress aria-label="Thumbnail loading progress" max={progress.total} value={progress.completed} />
  </div>;
}
