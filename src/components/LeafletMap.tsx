import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { MapMarkerItem } from '../types';

interface GeocodeSearchResult {
  place_id: number;
  display_name: string;
  short_name: string;
  type: string;
  lat: number;
  lng: number;
}

interface LeafletMapProps {
  centerLat: number;
  centerLng: number;
  locations: MapMarkerItem[];
  selectedLocationId?: number | string | null;
  onSelectLocation?: (loc: MapMarkerItem) => void;
  onResetView?: () => void;
  pickerMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  focusCoords?: { lat: number; lng: number } | null;
  heightClass?: string;
  showLegend?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Pemerintahan: '#0F2744',
  Pendidikan: '#1D4ED8',
  Kesehatan: '#047857',
  Ibadah: '#B48A1E',
  'Fasilitas Umum': '#475569',
  'Wilayah Dusun': '#9A3412',
  'Wilayah RW': '#9A3412',
  'Wilayah RT': '#9A3412',
  'Wilayah Dusun / RT / RW': '#9A3412',
  'Pembangunan Desa': '#0284C7',
};

const LEGEND_ITEMS = [
  { label: 'Pemerintahan', color: '#0F2744' },
  { label: 'Kesehatan', color: '#047857' },
  { label: 'Pendidikan', color: '#1D4ED8' },
  { label: 'Ibadah', color: '#B48A1E' },
  { label: 'Fasilitas Umum', color: '#475569' },
  { label: 'Dusun / RT / RW', color: '#9A3412' },
  { label: 'Pembangunan Desa', color: '#0284C7' },
];

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDirectionsUrls(
  destLat: number,
  destLng: number,
  origin: { lat: number; lng: number } | null
) {
  const dLat = destLat.toFixed(6);
  const dLng = destLng.toFixed(6);
  const osmUrl = origin
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat.toFixed(
        6
      )}%2C${origin.lng.toFixed(6)}%3B${dLat}%2C${dLng}`
    : `https://www.openstreetmap.org/directions?to=${dLat}%2C${dLng}`;
  const googleUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat.toFixed(
        6
      )},${origin.lng.toFixed(6)}&destination=${dLat},${dLng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dLat},${dLng}`;
  return { osmUrl, googleUrl };
}

function buildRouteButtonsHtml(
  destLat: number,
  destLng: number,
  origin: { lat: number; lng: number } | null
): string {
  const { osmUrl, googleUrl } = buildDirectionsUrls(destLat, destLng, origin);
  return `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;gap:6px;flex-wrap:wrap;">
      <a
        href="${escapeHtml(osmUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        style="flex:1;min-width:96px;display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;background:#0f2744;color:#ffffff;font-size:11px;font-weight:600;border-radius:6px;text-decoration:none;white-space:nowrap;"
      >Rute OSM</a>
      <a
        href="${escapeHtml(googleUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        style="flex:1;min-width:96px;display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;background:#ffffff;color:#0f2744;border:1px solid #cbd5e1;font-size:11px;font-weight:600;border-radius:6px;text-decoration:none;white-space:nowrap;"
      >Google Maps</a>
    </div>
  `;
}

export function LeafletMap({
  centerLat,
  centerLng,
  locations,
  selectedLocationId,
  onSelectLocation,
  onResetView,
  pickerMode = false,
  pickedCoords = null,
  onPickCoords,
  focusCoords = null,
  heightClass = 'h-[440px]',
  showLegend = true,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const pickerMarkerRef = useRef<L.CircleMarker | null>(null);
  const gpsLayerRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const defaultCenterRef = useRef<{ lat: number; lng: number }>({
    lat: Number.isFinite(centerLat) ? centerLat : -6.8283,
    lng: Number.isFinite(centerLng) ? centerLng : 107.9,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [osmResults, setOsmResults] = useState<GeocodeSearchResult[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [userGpsCoords, setUserGpsCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!pickerMode && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      defaultCenterRef.current = { lat: centerLat, lng: centerLng };
    }
  }, [centerLat, centerLng, pickerMode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initLat = defaultCenterRef.current.lat || -6.8283;
    const initLng = defaultCenterRef.current.lng || 107.9;

    const map = L.map(containerRef.current, {
      center: [initLat, initLng],
      zoom: 15,
      scrollWheelZoom: false,
    });

    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    });

    const esriSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Citra Satelit &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    );

    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Topografi &copy; OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
    });

    const cartoVoyager = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }
    );

    osmStandard.addTo(map);

    // Layer batas wilayah administratif Desa Margamukti
    const boundaryLayer = L.layerGroup().addTo(map);
    const boundaryCoords: [number, number][] = [
      [-6.8235, 107.8945],
      [-6.8238, 107.9055],
      [-6.8328, 107.907],
      [-6.8342, 107.8958],
    ];
    L.polygon(boundaryCoords, {
      color: '#0F2744',
      weight: 2,
      dashArray: '6 4',
      fillColor: '#C59B27',
      fillOpacity: 0.08,
    })
      .bindTooltip('Wilayah Administratif Desa Margamukti', { sticky: true })
      .addTo(boundaryLayer);

    L.control
      .layers(
        {
          'Peta Jalan (OSM)': osmStandard,
          'Citra Satelit': esriSatellite,
          'Topografi / Kontur': openTopo,
          'Peta Bersih': cartoVoyager,
        },
        {
          'Batas Wilayah Desa': boundaryLayer,
        },
        { position: 'topright', collapsed: true }
      )
      .addTo(map);

    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);
    gpsLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      searchLayerRef.current = null;
      gpsLayerRef.current = null;
      markerMapRef.current.clear();
    };
  }, []);

  // Handle picker clicks
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickerMode || !onPickCoords) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onPickCoords({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [pickerMode, onPickCoords]);

  // Smooth pan when focusCoords updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    if (Number.isFinite(focusCoords.lat) && Number.isFinite(focusCoords.lng)) {
      map.flyTo([focusCoords.lat, focusCoords.lng], 16, { duration: 0.5 });
    }
  }, [focusCoords]);

  // Render picked coordinate pin in pickerMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.remove();
      pickerMarkerRef.current = null;
    }

    if (
      pickerMode &&
      pickedCoords &&
      Number.isFinite(pickedCoords.lat) &&
      Number.isFinite(pickedCoords.lng)
    ) {
      pickerMarkerRef.current = L.circleMarker([pickedCoords.lat, pickedCoords.lng], {
        radius: 10,
        color: '#0F2744',
        weight: 3,
        fillColor: '#C59B27',
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;min-width:210px;">
            <div style="font-weight:700;color:#0F2744;margin-bottom:2px;">Titik Koordinat Terpilih</div>
            <div style="font-family:monospace;color:#475569;">${pickedCoords.lat.toFixed(
              6
            )}, ${pickedCoords.lng.toFixed(6)}</div>
            ${buildRouteButtonsHtml(pickedCoords.lat, pickedCoords.lng, userGpsCoords)}
          </div>`
        )
        .addTo(map)
        .openPopup();
    }
  }, [pickerMode, pickedCoords, userGpsCoords]);

  // Render user GPS marker + accuracy radius
  useEffect(() => {
    const gpsLayer = gpsLayerRef.current;
    if (!gpsLayer) return;
    gpsLayer.clearLayers();

    if (!userGpsCoords) return;
    const { lat, lng, accuracy } = userGpsCoords;

    L.circle([lat, lng], {
      radius: Math.min(Math.max(accuracy, 15), 800),
      color: '#1D4ED8',
      weight: 1.5,
      fillColor: '#3B82F6',
      fillOpacity: 0.14,
    }).addTo(gpsLayer);

    const gpsPin = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#1D4ED8',
      fillOpacity: 1,
    })
      .bindPopup(
        `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;">
          <div style="font-weight:700;color:#1E3A8A;margin-bottom:2px;">Lokasi GPS Anda</div>
          <div style="color:#475569;">Akurasi ±${Math.round(accuracy)} meter</div>
          <div style="font-family:monospace;color:#64748b;margin-top:2px;">${lat.toFixed(
            6
          )}, ${lng.toFixed(6)}</div>
        </div>`
      )
      .addTo(gpsLayer);

    gpsPin.openPopup();
  }, [userGpsCoords]);

  // Render locations & wilayah markers with Route buttons
  useEffect(() => {
    const layer = markersLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    markerMapRef.current.clear();

    locations.forEach((loc) => {
      if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
      const locKey = String(loc.id);
      const isSelected =
        selectedLocationId !== null &&
        selectedLocationId !== undefined &&
        String(selectedLocationId) === locKey;
      const color = CATEGORY_COLORS[loc.category] || '#0F2744';

      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius: isSelected ? 11 : 8,
        color: isSelected ? '#C59B27' : '#FFFFFF',
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.95,
      });

      const leadersHtml = loc.leaders
        ? `
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:11px;color:#334155;line-height:1.45;">
            ${
              loc.leaders.kepala_dusun
                ? `<div><strong style="color:#0f2744;">Kepala Dusun:</strong> ${escapeHtml(
                    loc.leaders.kepala_dusun
                  )}</div>`
                : ''
            }
            ${
              loc.leaders.ketua_rw
                ? `<div><strong style="color:#0f2744;">Ketua RW:</strong> ${escapeHtml(
                    loc.leaders.ketua_rw
                  )}</div>`
                : ''
            }
            ${
              loc.leaders.ketua_rt
                ? `<div><strong style="color:#0f2744;">Ketua RT:</strong> ${escapeHtml(
                    loc.leaders.ketua_rt
                  )}</div>`
                : ''
            }
          </div>
        `
        : '';

      const popupHtml = `
        <div style="min-width:225px;max-width:280px;font-family:'Plus Jakarta Sans',sans-serif;">
          <div style="font-size:11px;font-weight:600;color:#A67F17;margin-bottom:2px;">${escapeHtml(
            loc.category
          )}</div>
          <div style="font-weight:700;font-size:13px;color:#0f2744;margin-bottom:4px;">${escapeHtml(
            loc.name
          )}</div>
          ${
            loc.description
              ? `<div style="font-size:12px;color:#334155;margin-bottom:4px;">${escapeHtml(
                  loc.description
                )}</div>`
              : ''
          }
          <div style="font-size:11px;color:#64748b;">${escapeHtml(loc.address)}</div>
          <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:#64748b;margin-top:4px;">
            ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}
          </div>
          ${leadersHtml}
          ${buildRouteButtonsHtml(loc.latitude, loc.longitude, userGpsCoords)}
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        if (onSelectLocation) onSelectLocation(loc);
      });
      marker.addTo(layer);
      markerMapRef.current.set(locKey, marker);

      if (isSelected) {
        map.flyTo([loc.latitude, loc.longitude], 16, { duration: 0.5 });
        marker.openPopup();
      }
    });
  }, [locations, selectedLocationId, onSelectLocation, userGpsCoords]);

  const localMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return locations
      .filter((loc) => {
        const hay = [
          loc.name,
          loc.category,
          loc.description,
          loc.address,
          loc.leaders?.kepala_dusun || '',
          loc.leaders?.ketua_rw || '',
          loc.leaders?.ketua_rt || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 5);
  }, [locations, searchQuery]);

  const handleSearchAddress = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError('Ketik minimal 2 huruf nama tempat atau alamat.');
      setDropdownOpen(true);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setDropdownOpen(true);
    try {
      const res = await fetch(`/api/public/map/geocode?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.error || 'Gagal mencari alamat di OpenStreetMap.');
        setOsmResults([]);
        return;
      }
      setOsmResults(Array.isArray(json.results) ? json.results : []);
    } catch {
      setSearchError('Tidak dapat menghubungi server pencarian alamat.');
      setOsmResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectLocalResult = (loc: MapMarkerItem) => {
    setDropdownOpen(false);
    setStatusNotice({ type: 'ok', text: `Menampilkan ${loc.name}` });
    const map = mapRef.current;
    if (map) {
      map.flyTo([loc.latitude, loc.longitude], 16, { duration: 0.5 });
      const marker = markerMapRef.current.get(String(loc.id));
      marker?.openPopup();
    }
    onSelectLocation?.(loc);
  };

  const handleSelectOsmResult = (item: GeocodeSearchResult) => {
    setDropdownOpen(false);
    const map = mapRef.current;
    const searchLayer = searchLayerRef.current;

    if (searchLayer) {
      searchLayer.clearLayers();
      const pin = L.circleMarker([item.lat, item.lng], {
        radius: 9,
        color: '#FFFFFF',
        weight: 2.5,
        fillColor: '#DC2626',
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="min-width:225px;max-width:280px;font-family:'Plus Jakarta Sans',sans-serif;">
            <div style="font-size:11px;font-weight:600;color:#DC2626;margin-bottom:2px;">Hasil Pencarian Alamat OSM</div>
            <div style="font-weight:700;font-size:13px;color:#0f2744;margin-bottom:4px;">${escapeHtml(
              item.short_name
            )}</div>
            <div style="font-size:11px;color:#475569;line-height:1.45;">${escapeHtml(
              item.display_name
            )}</div>
            <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:#64748b;margin-top:4px;">
              ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}
            </div>
            ${buildRouteButtonsHtml(item.lat, item.lng, userGpsCoords)}
          </div>`
        )
        .addTo(searchLayer);
      pin.openPopup();
    }

    if (map) {
      map.flyTo([item.lat, item.lng], 17, { duration: 0.55 });
    }

    if (pickerMode && onPickCoords) {
      onPickCoords({
        lat: Number(item.lat.toFixed(6)),
        lng: Number(item.lng.toFixed(6)),
      });
      setStatusNotice({
        type: 'ok',
        text: `Koordinat diarahkan ke "${item.short_name}".`,
      });
    } else {
      setStatusNotice({
        type: 'ok',
        text: `Menyorot hasil pencarian: ${item.short_name}`,
      });
    }
  };

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatusNotice({
        type: 'err',
        text: 'Peramban tidak mendukung layanan GPS lokasi.',
      });
      return;
    }

    setGpsLoading(true);
    setStatusNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = pos.coords.accuracy || 50;

        setUserGpsCoords({ lat, lng, accuracy });
        setGpsLoading(false);
        mapRef.current?.flyTo([lat, lng], 16, { duration: 0.55 });

        if (pickerMode && onPickCoords) {
          onPickCoords({ lat, lng });
          setStatusNotice({
            type: 'ok',
            text: `Titik koordinat diisi dari GPS Anda (akurasi ±${Math.round(accuracy)} m).`,
          });
        } else {
          setStatusNotice({
            type: 'ok',
            text: `Lokasi GPS aktif (akurasi ±${Math.round(accuracy)} m). Tombol rute kini memakai posisi Anda.`,
          });
        }
      },
      (err) => {
        setGpsLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi GPS ditolak oleh peramban. Aktifkan izin lokasi lalu coba lagi.'
            : 'Gagal membaca koordinat GPS saat ini. Pastikan sinyal lokasi perangkat aktif.';
        setStatusNotice({ type: 'err', text: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  const handleReset = () => {
    setDropdownOpen(false);
    setSearchQuery('');
    setOsmResults([]);
    setSearchError(null);
    setStatusNotice(null);
    searchLayerRef.current?.clearLayers();

    const targetLat = defaultCenterRef.current.lat || -6.8283;
    const targetLng = defaultCenterRef.current.lng || 107.9;
    mapRef.current?.closePopup();
    mapRef.current?.flyTo([targetLat, targetLng], 15, { duration: 0.5 });
    onResetView?.();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Toolbar Peta: Pencarian Lokasi + GPS Saya + Reset */}
      <div
        ref={toolbarRef}
        className="relative bg-slate-50 border-b border-slate-200 px-3 py-2.5 space-y-2 z-20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 flex items-center gap-1.5" role="search">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setDropdownOpen(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setSearchError(null);
                  if (val.trim().length >= 2) {
                    setDropdownOpen(true);
                  } else {
                    setDropdownOpen(false);
                    setOsmResults([]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearchAddress();
                  }
                }}
                placeholder="Cari lokasi desa, dusun, atau alamat jalan (OSM)..."
                aria-label="Cari lokasi atau alamat pada peta"
                className="w-full min-h-[38px] pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[var(--theme-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setOsmResults([]);
                    setSearchError(null);
                    setDropdownOpen(false);
                    searchLayerRef.current?.clearLayers();
                  }}
                  aria-label="Hapus pencarian peta"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleSearchAddress()}
              disabled={searchLoading}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {searchLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 text-[var(--theme-accent-light)] shrink-0" />
              )}
              <span>Cari</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={gpsLoading}
              title="Temukan posisi GPS saya saat ini"
              className="flex-1 sm:flex-none min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {gpsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 shrink-0" />
              ) : (
                <Crosshair className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              )}
              <span>{gpsLoading ? 'Mencari...' : 'GPS Saya'}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Kembalikan tampilan peta ke pusat Desa Margamukti"
              className="flex-1 sm:flex-none min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Dropdown Hasil Pencarian Terpadu (Desa + Nominatim OSM) */}
        {dropdownOpen && (localMatches.length > 0 || osmResults.length > 0 || searchLoading || searchError) && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 z-30">
            {localMatches.length > 0 && (
              <div className="py-1.5">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                  Lokasi &amp; Wilayah Terdaftar Desa ({localMatches.length})
                </p>
                {localMatches.map((loc) => (
                  <button
                    key={String(loc.id)}
                    type="button"
                    onClick={() => handleSelectLocalResult(loc)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{loc.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {loc.category} · {loc.address}
                      </p>
                    </div>
                    <MapPin className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="py-1.5">
              <div className="px-3 py-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Hasil Alamat OpenStreetMap
                </p>
                {!searchLoading && osmResults.length === 0 && !searchError && (
                  <button
                    type="button"
                    onClick={() => void handleSearchAddress()}
                    className="text-[11px] font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer"
                  >
                    Cari di OpenStreetMap
                  </button>
                )}
              </div>

              {searchLoading && (
                <div className="px-3 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mencari alamat di OpenStreetMap Nominatim...</span>
                </div>
              )}

              {searchError && (
                <p className="px-3 py-2 text-xs text-red-700 bg-red-50">{searchError}</p>
              )}

              {!searchLoading && !searchError && osmResults.length === 0 && searchQuery.trim().length >= 2 && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Tekan <strong>Cari</strong> atau Enter untuk menelusuri alamat umum di OpenStreetMap.
                </p>
              )}

              {osmResults.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onClick={() => handleSelectOsmResult(item)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{item.short_name}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{item.display_name}</p>
                  </div>
                  <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0 mt-0.5">
                    {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {statusNotice && (
          <div
            className={`text-[11px] px-2.5 py-1.5 rounded-md border flex items-center justify-between gap-2 ${
              statusNotice.type === 'err'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span className="leading-snug">{statusNotice.text}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Tutup pemberitahuan peta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Kanvas Peta Leaflet */}
      <div className="relative bg-slate-100">
        <div ref={containerRef} className={`w-full ${heightClass}`} />
      </div>

      {/* Mode Picker Footer */}
      {pickerMode && (
        <div className="bg-[var(--theme-primary)] text-white text-xs px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>Klik titik mana saja pada peta, gunakan GPS Saya, atau cari alamat untuk mengisi koordinat</span>
          {pickedCoords && Number.isFinite(pickedCoords.lat) && Number.isFinite(pickedCoords.lng) ? (
            <span className="font-mono-tabular text-[var(--theme-accent-light)] shrink-0">
              {pickedCoords.lat}, {pickedCoords.lng}
            </span>
          ) : (
            <span className="text-slate-300 shrink-0">Koordinat belum dipilih</span>
          )}
        </div>
      )}

      {/* Legenda Kategori & Pintasan Layer */}
      {showLegend && !pickerMode && (
        <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGEND_ITEMS.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white shadow-xs shrink-0"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Navigation className="w-3 h-3 text-[var(--theme-accent-dark)]" />
            <span>Gunakan ikon layer kanan atas untuk Satelit / Topografi</span>
          </span>
        </div>
      )}
    </div>
  );
}
