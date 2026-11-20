import { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Siren,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ArticleMediaUploadForm } from '../../../components/ArticleMediaUploadForm';
import { ImageWithFallback } from '../../../components/ImageWithFallback';
import { LeafletMap } from '../../../components/LeafletMap';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { uploadImageFile } from '../../../utils/uploadImage';
import { parseArticleMediaItems } from '../../../utils/videoEmbed';
import { adminFetch } from '../../../utils/adminApi';
import type {
  Article,
  ArticleComment,
  ArticleMediaItem,
  Complaint,
  GalleryItem,
  MapLocation,
  UmkmProduct,
  VillageSettings,
} from '../../../types';

interface NotifyProps {
  onNotify: (msg: string, type?: 'ok' | 'err') => void;
}

// ============================================================================
// 1. MANAJEMEN BERITA & ARTIKEL DESA
// ============================================================================

export function AdminArticlesModule({ onNotify }: NotifyProps) {
  const [subTab, setSubTab] = useState<'articles' | 'comments'>('articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentFilter, setCommentFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Pemerintahan',
    excerpt: '',
    content: '<p></p>',
    image_url: '',
    media_items: [] as ArticleMediaItem[],
    author_name: 'Admin Desa Margamukti',
    published_at: new Date().toISOString().slice(0, 10),
    is_published: true,
  });

  const load = () => {
    adminFetch('/api/admin/articles')
      .then((r) => r.json())
      .then((j) => setArticles(j.articles || []));
    adminFetch('/api/admin/comments')
      .then((r) => r.json())
      .then((j) => setComments(j.comments || []))
      .catch(() => setComments([]));
  };
  useEffect(load, []);

  const openNew = () => {
    setEditingId(null);
    setForm({
      title: '',
      category: 'Pemerintahan',
      excerpt: '',
      content: '<p>Tulis isi berita desa di sini...</p>',
      image_url: '',
      media_items: [],
      author_name: 'Admin Desa Margamukti',
      published_at: new Date().toISOString().slice(0, 10),
      is_published: true,
    });
    setModalOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      category: a.category,
      excerpt: a.excerpt,
      content: a.content,
      image_url: a.image_url,
      media_items: parseArticleMediaItems(a.media_items),
      author_name: a.author_name,
      published_at: a.published_at,
      is_published: a.is_published === 1,
    });
    setModalOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      onNotify('Thumbnail berita berhasil diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal unggah.', 'err');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/articles/${editingId}` : '/api/admin/articles';
    const method = editingId ? 'PUT' : 'POST';
    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      onNotify(j.error || 'Gagal menyimpan artikel.', 'err');
      return;
    }
    setModalOpen(false);
    load();
    onNotify('Artikel berita disimpan.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
    load();
    onNotify('Artikel dihapus.');
  };

  const handleToggleCommentStatus = async (c: ArticleComment) => {
    const nextStatus = c.status === 'published' ? 'hidden' : 'published';
    const res = await adminFetch(`/api/admin/comments/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      load();
      onNotify(nextStatus === 'published' ? 'Komentar ditampilkan ke publik.' : 'Komentar disembunyikan dari publik.');
    }
  };

  const handleSaveCommentReply = async (c: ArticleComment, admin_reply: string) => {
    const res = await adminFetch(`/api/admin/comments/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_reply }),
    });
    if (res.ok) {
      load();
      onNotify('Tanggapan Pemerintah Desa tersimpan.');
    }
  };

  const handleDeleteComment = async (id: number) => {
    await adminFetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
    load();
    onNotify('Komentar dihapus.');
  };

  const filteredComments = comments.filter((c) =>
    commentFilter === 'all' ? true : c.status === commentFilter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen Berita &amp; Moderasi Komentar</h2>
          <p className="text-xs text-slate-500">
            Publikasikan kabar kegiatan resmi dan moderasi atau balas komentar warga pada berita.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('articles')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'articles' ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600'
              }`}
            >
              Kelola Berita ({articles.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('comments')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'comments' ? 'bg-white text-[#0F2744] shadow-sm' : 'text-slate-600'
              }`}
            >
              Moderasi Komentar ({comments.length})
            </button>
          </div>

          {subTab === 'articles' && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Tulis Berita Baru
            </button>
          )}
        </div>
      </div>

      {subTab === 'articles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((art) => (
            <div key={art.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
              <div className="w-28 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <ImageWithFallback src={art.image_url} alt={art.title} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#A67F17]">{art.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{art.published_at}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 mt-0.5">{art.title}</h3>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`font-semibold ${art.is_published ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {art.is_published ? 'Tayang' : 'Draft'}
                    </span>
                    {parseArticleMediaItems(art.media_items).length > 0 && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-slate-500 font-mono-tabular">
                          {parseArticleMediaItems(art.media_items).length} Media
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openEdit(art)} className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(art.id)} className="p-1.5 text-slate-600 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'comments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `Semua (${comments.length})` },
                { id: 'published', label: `Tampil (${comments.filter((c) => c.status === 'published').length})` },
                { id: 'hidden', label: `Disembunyikan (${comments.filter((c) => c.status === 'hidden').length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCommentFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  commentFilter === f.id
                    ? 'bg-[#0F2744] text-white border-[#0F2744]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredComments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Tidak ada komentar pada filter ini.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComments.map((c) => (
                <div
                  key={c.id}
                  className={`bg-white border rounded-xl p-5 space-y-3 ${
                    c.status === 'hidden' ? 'border-slate-200 opacity-75' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#0F2744] inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-[#A67F17]" />
                          {c.author_name}
                        </span>
                        {c.author_region && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="text-slate-600">{c.author_region}</span>
                          </>
                        )}
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-slate-500">{c.created_at}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className={c.status === 'published' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {c.status === 'published' ? 'Tampil Publik' : 'Disembunyikan'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        Pada artikel: <span className="text-[#0F2744] font-semibold">{c.article_title}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleCommentStatus(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        {c.status === 'published' ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                            Sembunyikan
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                            Tampilkan
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                        title="Hapus komentar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-800 leading-relaxed">{c.comment_text}</p>

                  <div>
                    <input
                      defaultValue={c.admin_reply}
                      onBlur={(e) => {
                        if (e.target.value !== c.admin_reply) {
                          handleSaveCommentReply(c, e.target.value);
                        }
                      }}
                      placeholder="Tulis tanggapan resmi Pemerintah Desa atas komentar ini lalu klik di luar kotak..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">
                {editingId ? 'Edit Berita' : 'Tulis Berita Baru'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Berita *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Pemerintahan">Pemerintahan</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Kemasyarakatan">Kemasyarakatan</option>
                    <option value="Layanan Publik">Layanan Publik</option>
                    <option value="Ekonomi & UMKM">Ekonomi & UMKM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Publikasi</label>
                  <input
                    type="date"
                    value={form.published_at}
                    onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Penulis</label>
                  <input
                    value={form.author_name}
                    onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ringkasan Singkat</label>
                <textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gambar Thumbnail Utama</label>
                <div className="flex gap-2">
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="/uploads/... atau URL gambar"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" /> Unggah
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <ArticleMediaUploadForm
                coverImage={form.image_url}
                onChangeCoverImage={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
                mediaItems={form.media_items}
                onChangeMediaItems={(items) => setForm((prev) => ({ ...prev, media_items: items }))}
                onNotify={onNotify}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Konten Berita (Rich Text)</label>
                <RichTextEditor value={form.content} onChange={(html) => setForm({ ...form, content: html })} />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                />
                Publikasikan ke halaman warga
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer">
                  Simpan Berita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. MANAJEMEN UMKM WARGA
// ============================================================================

export function AdminUmkmModule({ onNotify }: NotifyProps) {
  const [items, setItems] = useState<UmkmProduct[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    business_name: '',
    product_name: '',
    category: 'Kuliner',
    owner_name: '',
    description: '',
    price: 0,
    whatsapp: '628',
    image_url: '',
    is_verified: true,
  });

  const load = () => {
    adminFetch('/api/admin/umkm')
      .then((r) => r.json())
      .then((j) => setItems(j.products || []));
  };
  useEffect(load, []);

  const openNew = () => {
    setEditingId(null);
    setForm({
      business_name: '',
      product_name: '',
      category: 'Kuliner',
      owner_name: '',
      description: '',
      price: 25000,
      whatsapp: '62812',
      image_url: '',
      is_verified: true,
    });
    setModalOpen(true);
  };

  const openEdit = (p: UmkmProduct) => {
    setEditingId(p.id);
    setForm({
      business_name: p.business_name,
      product_name: p.product_name,
      category: p.category,
      owner_name: p.owner_name,
      description: p.description,
      price: p.price,
      whatsapp: p.whatsapp,
      image_url: p.image_url,
      is_verified: p.is_verified === 1,
    });
    setModalOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      onNotify('Foto produk diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal unggah.', 'err');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/umkm/${editingId}` : '/api/admin/umkm';
    const method = editingId ? 'PUT' : 'POST';
    await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setModalOpen(false);
    load();
    onNotify('Data UMKM disimpan.');
  };

  const toggleVerify = async (p: UmkmProduct) => {
    await adminFetch(`/api/admin/umkm/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, is_verified: p.is_verified ? 0 : 1 }),
    });
    load();
    onNotify('Status verifikasi UMKM diperbarui.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/umkm/${id}`, { method: 'DELETE' });
    load();
    onNotify('Produk UMKM dihapus.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen Katalog UMKM Warga</h2>
          <p className="text-xs text-slate-500">Tambah, edit, dan verifikasi produk usaha warga Desa Margamukti.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Tambah UMKM
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <ImageWithFallback src={item.image_url} alt={item.product_name} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#A67F17]">{item.category} · {item.business_name}</span>
                <span className="font-mono-tabular font-bold text-[#0F2744]">
                  Rp {item.price.toLocaleString('id-ID')}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 truncate">{item.product_name}</h3>
              <p className="text-xs text-slate-500">Pemilik: {item.owner_name} · WA: {item.whatsapp}</p>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => toggleVerify(item)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                    item.is_verified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {item.is_verified ? 'Terverifikasi' : 'Belum Verifikasi'}
                </button>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openEdit(item)} className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-600 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">{editingId ? 'Edit UMKM' : 'Tambah Produk UMKM'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Usaha *</label>
                  <input required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white">
                    <option value="Kuliner">Kuliner</option>
                    <option value="Kerajinan">Kerajinan</option>
                    <option value="Pertanian">Pertanian</option>
                    <option value="Jasa">Jasa</option>
                    <option value="Fashion">Fashion</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Produk *</label>
                <input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemilik</label>
                  <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga (Rp)</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp (628...) *</label>
                  <input required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Foto Produk</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md" />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Unggah
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Produk</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer">Simpan UMKM</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. MANAJEMEN GALERI KEGIATAN
// ============================================================================

export function AdminGalleryModule({ onNotify }: NotifyProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().slice(0, 10),
    category: 'Pemerintahan',
    image_url: '',
  });

  const load = () => {
    adminFetch('/api/admin/gallery')
      .then((r) => r.json())
      .then((j) => setItems(j.items || []));
  };
  useEffect(load, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      onNotify('Foto galeri diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal unggah.', 'err');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setModalOpen(false);
    setForm({ title: '', description: '', event_date: new Date().toISOString().slice(0, 10), category: 'Pemerintahan', image_url: '' });
    load();
    onNotify('Foto kegiatan ditambahkan ke galeri.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    load();
    onNotify('Foto galeri dihapus.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen Galeri Kegiatan Desa</h2>
          <p className="text-xs text-slate-500">Unggah dan kelola dokumentasi kegiatan pemerintahan dan masyarakat.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Tambah Foto Galeri
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((g) => (
          <div key={g.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="aspect-[4/3] bg-slate-100">
                <ImageWithFallback src={g.image_url} alt={g.title} />
              </div>
              <div className="p-4 space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="font-semibold text-[#A67F17]">{g.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{g.event_date}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{g.description}</p>
              </div>
            </div>
            <div className="px-4 pb-3 flex justify-end">
              <button type="button" onClick={() => handleDelete(g.id)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-[#0F2744]">Tambah Dokumentasi Galeri</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Kegiatan *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">File Foto</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="URL atau unggah file..." className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md" />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Unggah
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer">Simpan Foto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. MANAJEMEN PETA & LOKASI PENTING (DENGAN PICKER KLIK PETA)
// ============================================================================

export function AdminMapModule({ onNotify }: NotifyProps) {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Fasilitas Umum',
    description: '',
    address: '',
    latitude: -6.8283,
    longitude: 107.9,
  });

  const load = () => {
    adminFetch('/api/admin/map')
      .then((r) => r.json())
      .then((j) => setLocations(j.locations || []));
  };
  useEffect(load, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/map/${editingId}` : '/api/admin/map';
    const method = editingId ? 'PUT' : 'POST';
    await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setEditingId(null);
    setForm({ name: '', category: 'Fasilitas Umum', description: '', address: '', latitude: -6.8283, longitude: 107.9 });
    load();
    onNotify('Titik lokasi peta berhasil disimpan.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/map/${id}`, { method: 'DELETE' });
    load();
    onNotify('Titik lokasi dihapus.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0F2744]">Manajemen Peta & Lokasi Penting</h2>
        <p className="text-xs text-slate-500">
          Klik langsung pada peta untuk menentukan koordinat latitude/longitude fasilitas umum di Desa Margamukti.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <LeafletMap
            centerLat={-6.8283}
            centerLng={107.9}
            locations={locations}
            selectedLocationId={editingId}
            pickerMode={true}
            pickedCoords={{ lat: form.latitude, lng: form.longitude }}
            onPickCoords={(c) => setForm((prev) => ({ ...prev, latitude: c.lat, longitude: c.lng }))}
            heightClass="h-[380px]"
          />
        </div>

        <form onSubmit={handleSave} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#0F2744]">
            {editingId ? 'Edit Lokasi Terpilih' : 'Tambah Lokasi Baru'}
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lokasi *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Posyandu Melati / Balai Dusun" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white">
              <option value="Pemerintahan">Pemerintahan</option>
              <option value="Pendidikan">Pendidikan</option>
              <option value="Kesehatan">Kesehatan</option>
              <option value="Ibadah">Ibadah</option>
              <option value="Fasilitas Umum">Fasilitas Umum</option>
              <option value="Wilayah Dusun">Wilayah Dusun</option>
              <option value="Wilayah RW">Wilayah RW</option>
              <option value="Wilayah RT">Wilayah RT</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
              <input type="number" step="any" required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
              <input type="number" step="any" required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-md" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat / Dusun</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi / Keterangan Pengurus</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
          </div>
          <div className="flex gap-2">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', category: 'Fasilitas Umum', description: '', address: '', latitude: -6.8283, longitude: 107.9 });
                }}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md cursor-pointer"
              >
                Batal
              </button>
            )}
            <button type="submit" className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-[#0F2744] rounded-md cursor-pointer">
              {editingId ? 'Simpan Perubahan' : 'Simpan Titik Lokasi'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {locations.map((loc) => (
          <div key={loc.id} className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[#A67F17]">{loc.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{loc.latitude}, {loc.longitude}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
              <p className="text-xs text-slate-600">{loc.address}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditingId(loc.id);
                  setForm({
                    name: loc.name,
                    category: loc.category,
                    description: loc.description,
                    address: loc.address,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  });
                }}
                className="p-1.5 text-slate-600 hover:text-[#0F2744] cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => handleDelete(loc.id)} className="p-1.5 text-slate-600 hover:text-red-600 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 5. KOTAK MASUK PENGADUAN WARGA
// ============================================================================

export function AdminComplaintsModule({ onNotify }: NotifyProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  const load = () => {
    adminFetch('/api/admin/complaints')
      .then((r) => r.json())
      .then((j) => setComplaints(j.complaints || []));
  };
  useEffect(load, []);

  const updateStatus = async (c: Complaint, status: Complaint['status'], admin_reply: string) => {
    await adminFetch(`/api/admin/complaints/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_reply }),
    });
    load();
    onNotify('Status pesan warga diperbarui.');
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/complaints/${id}`, { method: 'DELETE' });
    load();
    onNotify('Pesan dihapus.');
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#0F2744]">Kotak Masuk Layanan Kontak & Pengaduan</h2>
        <p className="text-xs text-slate-500">Tinjau dan tindak lanjuti aspirasi atau laporan dari warga.</p>
      </div>

      <div className="space-y-4">
        {complaints.map((c) => {
          const isEmergency = c.is_emergency === 1;
          const hasCoords =
            c.latitude !== null &&
            c.latitude !== undefined &&
            c.longitude !== null &&
            c.longitude !== undefined;
          return (
            <div
              key={c.id}
              className={`bg-white border rounded-xl p-5 space-y-3 ${
                isEmergency ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {isEmergency && (
                      <>
                        <span className="inline-flex items-center gap-1 font-bold text-red-700">
                          <Siren className="w-3.5 h-3.5" />
                          LAPORAN DARURAT · DRT-{String(c.id).padStart(4, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="font-semibold text-[#A67F17]">{c.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{c.sender_name} ({c.sender_contact})</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{c.created_at}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#0F2744] mt-1">{c.subject}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={c.status}
                    onChange={(e) => updateStatus(c, e.target.value as Complaint['status'], c.admin_reply)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white"
                  >
                    <option value="baru">Baru</option>
                    <option value="diproses">Diproses</option>
                    <option value="selesai">Selesai</option>
                  </select>
                  <button type="button" onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{c.message}</p>

              {hasCoords && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs">
                  <span className="font-mono-tabular text-slate-700 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-700 shrink-0" />
                    Titik GPS Pelapor: {c.latitude}, {c.longitude}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#0F2744] hover:underline"
                  >
                    Lihat di Peta
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-1">
                <input
                  defaultValue={c.admin_reply}
                  onBlur={(e) => {
                    if (e.target.value !== c.admin_reply) {
                      updateStatus(c, c.status, e.target.value);
                    }
                  }}
                  placeholder="Tulis catatan tindak lanjut admin lalu klik di luar kotak..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 6. PENGATURAN PROFIL & BERANDA DESA DINAMIS
// ============================================================================

export function AdminSettingsModule({ onNotify }: NotifyProps) {
  const [form, setForm] = useState<VillageSettings | null>(null);

  useEffect(() => {
    adminFetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => setForm(j.settings));
  }, []);

  if (!form) return null;

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      setForm({ ...form, hero_image: url });
      onNotify('Gambar hero berhasil diunggah.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Gagal unggah.', 'err');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      onNotify('Gagal menyimpan profil desa.', 'err');
      return;
    }
    onNotify('Profil desa & tampilan Beranda publik berhasil diperbarui.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-[#0F2744]">Pengaturan Profil, Beranda & Kontak Desa</h2>
        <p className="text-xs text-slate-500">Seluruh perubahan di sini langsung tampil secara dinamis di Portal Publik warga.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#0F2744] border-b border-slate-100 pb-2">Tampilan Hero Beranda</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Utama Hero</label>
          <input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Subjudul / Deskripsi Hero</label>
          <textarea rows={2} value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Gambar Hero</label>
          <div className="flex gap-2">
            <input value={form.hero_image} onChange={(e) => setForm({ ...form, hero_image: e.target.value })} className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md" />
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Unggah
              <input type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#0F2744] border-b border-slate-100 pb-2">Visi, Misi & Sejarah</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Visi Desa</label>
          <textarea rows={2} value={form.vision} onChange={(e) => setForm({ ...form, vision: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Misi Desa (pisahkan baris baru)</label>
          <textarea rows={4} value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Sejarah / Gambaran Umum</label>
          <textarea rows={3} value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#0F2744] border-b border-slate-100 pb-2">Kontak, Media Sosial Resmi & Jam Layanan Kantor Desa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telepon Kantor</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Center Desa (628...)</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan Facebook Desa (URL)</label>
            <input
              type="url"
              value={form.facebook_url || ''}
              onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
              placeholder="https://www.facebook.com/pemdesmargamukti"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan Instagram Desa (URL)</label>
            <input
              type="url"
              value={form.instagram_url || ''}
              onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
              placeholder="https://www.instagram.com/pemdes_margamukti"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Desa</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Operasional</label>
            <input value={form.service_hours} onChange={(e) => setForm({ ...form, service_hours: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap Kantor Desa</label>
          <input value={form.office_address} onChange={(e) => setForm({ ...form, office_address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0F2744] hover:bg-[#16355C] rounded-md cursor-pointer">
          Simpan Semua Pengaturan Desa
        </button>
      </div>
    </form>
  );
}
