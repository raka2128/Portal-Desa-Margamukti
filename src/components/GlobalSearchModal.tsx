import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  Newspaper,
  Search,
  SearchCheck,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { PublicRoute } from '../pages/public/HomePage';

export interface GlobalSearchResult {
  id: string;
  category: 'surat' | 'berita' | 'agenda' | 'umkm' | 'peta' | 'profil' | 'apbdes' | 'bansos';
  categoryLabel: string;
  title: string;
  subtitle: string;
  route: PublicRoute;
  subTab?: string;
  param?: string | number;
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectResult: (item: GlobalSearchResult) => void;
}

const SUGGESTED_KEYWORDS = [
  'Cek Bansos',
  'DTSEN',
  'Ahli Waris',
  'Domisili',
  'Tahu Sumedang',
  'APBDes',
  'Balai Desa',
];

const CATEGORY_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'semua', label: 'Semua' },
  { id: 'bansos', label: 'Cek Bansos' },
  { id: 'surat', label: 'Layanan Surat' },
  { id: 'berita', label: 'Berita' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'umkm', label: 'UMKM' },
  { id: 'profil', label: 'Profil & Wilayah' },
  { id: 'apbdes', label: 'APBDes' },
  { id: 'peta', label: 'Peta Lokasi' },
];

function getCategoryIcon(category: GlobalSearchResult['category']) {
  switch (category) {
    case 'bansos':
      return SearchCheck;
    case 'surat':
      return FileText;
    case 'berita':
      return Newspaper;
    case 'agenda':
      return CalendarDays;
    case 'umkm':
      return Store;
    case 'peta':
      return MapPin;
    case 'apbdes':
      return Wallet;
    case 'profil':
    default:
      return Users;
  }
}

export function GlobalSearchModal({ open, onClose, onSelectResult }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('semua');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setActiveFilter('semua');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/public/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((json) => {
          setResults(Array.isArray(json.results) ? json.results : []);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filteredResults =
    activeFilter === 'semua' ? results : results.filter((r) => r.category === activeFilter);

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[2px] flex items-start justify-center p-2 sm:p-4 pt-4 sm:pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Portal Desa Margamukti"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85dvh]">
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-2 sm:gap-3">
          <Search className="w-5 h-5 text-[#0F2744] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari layanan surat, berita, agenda, UMKM, atau APBDes..."
            className="flex-1 min-w-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Hapus kata kunci"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>

        {/* Filter Bar (only when results exist) */}
        {query.trim() && results.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {CATEGORY_FILTERS.map((cat) => {
              const count =
                cat.id === 'semua'
                  ? results.length
                  : results.filter((r) => r.category === cat.id).length;
              if (cat.id !== 'semua' && count === 0) return null;
              const active = activeFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveFilter(cat.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F2744] text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-[#0F2744]'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {!query.trim() ? (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#A67F17]">
                  Pencarian Cepat Portal Desa
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Ketik kata kunci untuk menelusuri seluruh layanan surat, berita, agenda kegiatan, UMKM, wilayah dusun/RW/RT, lokasi peta, dan data APBDes.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Topik Sering Dicari</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setQuery(kw)}
                      className="px-3 py-1.5 text-xs font-medium text-[#0F2744] bg-slate-50 hover:bg-[#0F2744] hover:text-white border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Menelusuri data portal Desa Margamukti...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[#0F2744]">
                Tidak ada hasil untuk &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-500">
                Coba gunakan kata kunci lain seperti Domisili, Ahli Waris, UMKM, Posyandu, atau Pawenang.
              </p>
            </div>
          ) : (
            filteredResults.map((item) => {
              const Icon = getCategoryIcon(item.category);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectResult(item);
                    onClose();
                  }}
                  className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#0F2744]/5 text-[#0F2744] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#A67F17]">
                        {item.categoryLabel}
                      </div>
                      <p className="text-sm font-semibold text-[#0F2744] truncate group-hover:underline">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F2744] shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tekan Ctrl + K kapan saja untuk membuka pencarian</span>
          <span className="font-mono-tabular">ESC untuk tutup</span>
        </div>
      </div>
    </div>
  );
}
