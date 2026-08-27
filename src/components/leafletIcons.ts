import L from 'leaflet';

// Simple colored-dot divIcons instead of Leaflet's default marker image — avoids the
// well-known bundler issue where Leaflet's default marker PNGs resolve to broken paths.
function dotIcon(color: string, size = 24) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const hotelIcon = dotIcon('#b5652b', 20);

export function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#2f6659;color:#fff;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
