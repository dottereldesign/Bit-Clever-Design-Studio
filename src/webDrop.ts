export function acceptsExternalDrop(data: DataTransfer): boolean {
  return !data.types.some(type => type.startsWith('application/design-')) &&
    data.types.some(type => ['Files', 'text/uri-list', 'text/html', 'text/plain'].includes(type));
}

export function readWebDrop(data: DataTransfer) {
  const urls = (data.getData('text/uri-list') || data.getData('text/plain')).split(/\r?\n/);
  const url = urls.find(value => /^https?:\/\//i.test(value.trim()))?.trim() || '';
  const html = new DOMParser().parseFromString(data.getData('text/html'), 'text/html');
  const image = html.querySelector('img');
  const src = image?.getAttribute('src') || '';
  let imageUrl = '';
  try {
    const resolved = new URL(src, url || undefined);
    if (src && /^https?:$/.test(resolved.protocol)) imageUrl = resolved.href;
  } catch { /* Missing or inaccessible image address. */ }
  if (!imageUrl && /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|ico)(?:[?#]|$)/i.test(url)) imageUrl = url;
  return { files: Array.from(data.files), imageUrl, sourceUrl: url || imageUrl };
}
