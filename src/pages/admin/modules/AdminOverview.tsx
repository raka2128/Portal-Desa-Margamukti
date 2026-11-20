import { useEffect, useState } from 'react';
import { ArrowRight, FileCheck, FileClock, MessageSquare, Store, Users } from 'lucide-react';
import { adminFetch } from '../../../utils/adminApi';
import type { Complaint, LetterRequest, PopulationStats } from '../../../types';

interface AdminOverviewProps {
  onSelectMenu: (menu: string) => void;
}

export function AdminOverview({ onSelectMenu }: AdminOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    population: PopulationStats;
    counts: {
      pendingLetters: number;
      approvedLetters: number;
      totalUmkm: number;
      totalArticles: number;
      unreadComplaints: number;
    };
    recentRequests: LetterRequest[];
    recentComplaints: Complaint[];
  } | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError('');
    adminFetch('/api/admin/dashboard')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.population) {
          throw new Error(json.error || 'Gagal memuat data ringkasan admin.');
        }
        setData(json);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadDashboard, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 border border-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !data.population) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-red-700">{error || 'Data ringkasan tidak tersedia.'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
        >
          Muat Ulang Data
        </button>
      </div>
    );
  }

  const { population, counts, recentRequests, recentComplaints } = data;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Penduduk</p>
            <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
              {population.totalResidents.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {population.maleCount} L · {population.femaleCount} P
            </p>
          </div>
          <Users className="w-5 h-5 text-[#C59B27]" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Permohonan Surat Baru</p>
            <p className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1">
              {counts.pendingLetters}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {counts.approvedLetters} surat disetujui
            </p>
          </div>
          <FileClock className="w-5 h-5 text-amber-600" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Produk UMKM Terdaftar</p>
            <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
              {counts.totalUmkm}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {counts.totalArticles} artikel dipublikasikan
            </p>
          </div>
          <Store className="w-5 h-5 text-[#C59B27]" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pesan Warga Baru</p>
            <p className="text-2xl font-bold text-[#0F2744] font-mono-tabular mt-1">
              {counts.unreadComplaints}
            </p>
            <p className="text-xs text-slate-500 mt-1">Perlu tindak lanjut</p>
          </div>
          <MessageSquare className="w-5 h-5 text-[#0F2744]" />
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-[#0F2744]">Statistik Penduduk per Dusun</h3>
            <button
              type="button"
              onClick={() => onSelectMenu('penduduk')}
              className="text-xs font-semibold text-[#A67F17] hover:underline cursor-pointer"
            >
              Kelola Penduduk
            </button>
          </div>
          <div className="space-y-4">
            {population.dusunBreakdown.map((d) => {
              const pct =
                population.totalResidents > 0
                  ? Math.round((d.residentCount / population.totalResidents) * 100)
                  : 0;
              return (
                <div key={d.dusun} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{d.dusun}</span>
                    <span className="font-mono-tabular text-slate-600">
                      {d.residentCount} jiwa ({d.maleCount} L / {d.femaleCount} P)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0F2744] rounded-full"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#0F2744] border-b border-slate-100 pb-3">
            Komposisi Pekerjaan Warga
          </h3>
          <div className="space-y-3">
            {population.occupationBreakdown.map((occ) => {
              const pct =
                population.totalResidents > 0
                  ? Math.round((occ.count / population.totalResidents) * 100)
                  : 0;
              return (
                <div key={occ.occupation} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{occ.occupation}</span>
                    <span className="font-mono-tabular text-slate-500">
                      {occ.count} org ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C59B27] rounded-full"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Letter Requests & Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F2744] inline-flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#C59B27]" />
              Antrean Permohonan Surat Terbaru
            </h3>
            <button
              type="button"
              onClick={() => onSelectMenu('surat')}
              className="text-xs font-semibold text-[#0F2744] hover:text-[#A67F17] inline-flex items-center gap-1 cursor-pointer"
            >
              Verifikasi & Cetak <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentRequests.map((req) => (
              <div key={req.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-[#0F2744]">
                      {req.tracking_code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{req.template_name}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                    {req.applicant_name}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    req.status === 'approved'
                      ? 'text-emerald-700'
                      : req.status === 'rejected'
                      ? 'text-red-700'
                      : 'text-amber-700'
                  }`}
                >
                  {req.status === 'approved'
                    ? 'Disetujui'
                    : req.status === 'rejected'
                    ? 'Ditolak'
                    : 'Menunggu'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F2744]">Kotak Masuk Warga</h3>
            <button
              type="button"
              onClick={() => onSelectMenu('pengaduan')}
              className="text-xs font-semibold text-[#0F2744] hover:text-[#A67F17] inline-flex items-center gap-1 cursor-pointer"
            >
              Semua Pesan <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentComplaints.map((c) => (
              <div key={c.id} className="px-6 py-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#A67F17]">{c.category}</span>
                  <span className="text-slate-500 capitalize">{c.status}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 line-clamp-1">{c.subject}</p>
                <p className="text-xs text-slate-500">Dari: {c.sender_name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
