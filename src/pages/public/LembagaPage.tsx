import { useEffect, useState } from 'react';
import { BookOpen, Building2, MapPin, Phone, ShieldCheck, Users } from 'lucide-react';
import type { InstitutionSlug, VillageInstitution } from '../../types';

interface LembagaPageProps {
  initialSlug?: InstitutionSlug;
  onSelectSlug?: (slug: InstitutionSlug) => void;
}

const SLUG_ORDER: InstitutionSlug[] = ['bpd', 'bumdesa', 'lpm', 'pkk'];

export function LembagaPage({ initialSlug = 'bpd', onSelectSlug }: LembagaPageProps) {
  const [institutions, setInstitutions] = useState<VillageInstitution[]>([]);
  const [activeSlug, setActiveSlug] = useState<InstitutionSlug>(initialSlug);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveSlug(initialSlug);
  }, [initialSlug]);

  useEffect(() => {
    fetch('/api/public/institutions')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.institutions)) {
          setInstitutions(json.institutions);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTab = (slug: InstitutionSlug) => {
    setActiveSlug(slug);
    onSelectSlug?.(slug);
  };

  const orderedInstitutions = [...institutions].sort(
    (a, b) => SLUG_ORDER.indexOf(a.slug) - SLUG_ORDER.indexOf(b.slug)
  );
  const activeInst =
    orderedInstitutions.find((i) => i.slug === activeSlug) || orderedInstitutions[0];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-10 w-72 bg-slate-200 rounded" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Sub-Menu Lembaga Desa */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Mitra Strategis Pemerintahan &amp; Pemberdayaan Warga
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] mt-1">
            Lembaga Desa Margamukti
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-full w-full md:w-auto self-start">
          {SLUG_ORDER.map((slug) => {
            const inst = orderedInstitutions.find((i) => i.slug === slug);
            const label = inst?.short_name || slug.toUpperCase();
            const isActive = activeSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => handleSelectTab(slug)}
                className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--theme-primary)] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[var(--theme-primary)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!activeInst ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Data Lembaga Desa belum tersedia.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Hero Lembaga Card */}
          <div className="bg-[var(--theme-primary)] text-white rounded-2xl p-6 sm:p-8 border-b-4 border-[var(--theme-accent)] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-accent-light)]">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>{activeInst.short_name} Desa Margamukti</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white">
                  {activeInst.name}
                </h2>
                {activeInst.tagline && (
                  <p className="text-sm text-slate-200 leading-relaxed">{activeInst.tagline}</p>
                )}
              </div>

              <div className="bg-white/10 border border-white/15 rounded-xl p-4 text-xs space-y-2 lg:w-80 shrink-0">
                {activeInst.office_location && (
                  <div className="flex items-start gap-2 text-slate-100">
                    <MapPin className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0 mt-0.5" />
                    <span>{activeInst.office_location}</span>
                  </div>
                )}
                {activeInst.contact_phone && (
                  <div className="flex items-center gap-2 text-slate-100 font-mono-tabular">
                    <Phone className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
                    <span>{activeInst.contact_phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[var(--theme-accent-light)] font-semibold pt-1 border-t border-white/10">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{activeInst.members?.length || 0} Pengurus &amp; Anggota Aktif</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Profil & Tupoksi */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Profil &amp; Dasar Hukum
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{activeInst.description}</p>
                {activeInst.legal_basis && (
                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Dasar Hukum: </span>
                    {activeInst.legal_basis}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Tugas Pokok &amp; Fungsi (Tupoksi)
                </p>
                {activeInst.tupoksi.length === 0 ? (
                  <p className="text-xs text-slate-500">Daftar tupoksi belum ditambahkan.</p>
                ) : (
                  <ol className="space-y-3">
                    {activeInst.tupoksi.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed pb-3 border-b border-slate-100 last:border-0 last:pb-0"
                      >
                        <span className="w-6 h-6 rounded-full bg-[var(--theme-primary)] text-white font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Daftar Pengurus & Anggota */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-[var(--theme-primary)]">
                    Susunan Pengurus &amp; Anggota {activeInst.short_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Data resmi kepengurusan periode berjalan Desa Margamukti.
                  </p>
                </div>
                <span className="text-xs font-mono-tabular font-semibold text-[var(--theme-primary)]">
                  {activeInst.members?.length || 0} Orang
                </span>
              </div>

              {!activeInst.members || activeInst.members.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Belum ada data anggota terdaftar pada lembaga ini.
                </div>
              ) : (
                <>
                  {/* Mobile Compact Cards */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {activeInst.members.map((m, idx) => (
                      <div key={m.id} className="p-4 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--theme-accent-dark)]">
                              {m.position}
                            </p>
                            <h4 className="text-sm font-bold text-[var(--theme-primary)]">
                              {m.name}
                            </h4>
                          </div>
                          <span className="text-xs font-mono-tabular text-slate-400 shrink-0">
                            #{idx + 1}
                          </span>
                        </div>
                        {m.notes && <p className="text-xs text-slate-600">{m.notes}</p>}
                        {m.phone && (
                          <p className="text-xs font-mono-tabular text-slate-500 flex items-center gap-1 pt-0.5">
                            <Phone className="w-3 h-3 text-[var(--theme-accent-dark)]" />
                            {m.phone}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4 w-12">No</th>
                          <th className="py-3 px-4">Nama Lengkap</th>
                          <th className="py-3 px-4">Jabatan</th>
                          <th className="py-3 px-4">Keterangan / Bidang</th>
                          <th className="py-3 px-4 text-right">Kontak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {activeInst.members.map((m, idx) => (
                          <tr key={m.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[var(--theme-primary)]">
                              {m.name}
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-[var(--theme-accent-dark)]">
                              {m.position}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600">
                              {m.notes || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                              {m.phone || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
