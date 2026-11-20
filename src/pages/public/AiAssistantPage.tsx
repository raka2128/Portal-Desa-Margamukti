import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useAiChatSession } from '../../utils/aiChatSession';
import { AiMarkdownText } from '../../components/AiMarkdownText';
import type { PublicRoute } from './HomePage';

interface AiAssistantPageProps {
  onNavigate: (route: PublicRoute, subTab?: string, param?: string | number) => void;
}

export function AiAssistantPage({ onNavigate }: AiAssistantPageProps) {
  const [draft, setDraft] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    quickTopics,
    guides,
    topicsLoading,
    sending,
    sendMessage,
    clearMessages,
  } = useAiChatSession();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    await sendMessage(text);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (sending) return;
    await sendMessage(prompt);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Institutional Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
            Pusat Informasi Terpadu · Layanan Warga Digital
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--theme-primary)] [text-wrap:balance]">
            Asisten AI Layanan Desa &amp; Daerah
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Konsultasi interaktif seputar juknis kepesertaan <strong>DTSEN</strong>, syarat penerima bantuan sosial (<strong>PKH, BPNT, PBI-JK, KIP Sekolah, KIP Kuliah, BLT Desa</strong>), syarat penerbitan adminduk (<strong>KTP-el, KK, Surat Nikah NA, KIA</strong>), serta tata kelola pemerintahan Desa Margamukti dan Kabupaten Sumedang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              disabled={sending}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mulai Percakapan Baru</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('surat', 'form')}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md transition-colors cursor-pointer"
          >
            <span>Ajukan Surat Mandiri</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--theme-accent-light)]" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Rail: Quick Topics & Curated Guide Index */}
        <aside className="lg:col-span-4 space-y-6 order-2 lg:order-1">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-[var(--theme-primary)]">
                Topik Bantuan Cepat
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik salah satu pertanyaan di bawah untuk langsung memulai konsultasi.
              </p>
            </div>

            {topicsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {quickTopics.map((topic) => (
                  <div key={topic.id} className="border border-slate-200 rounded-lg p-3.5 space-y-2.5 bg-slate-50/60">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[var(--theme-primary)]">{topic.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{topic.description}</p>
                      </div>
                      {topic.action && (
                        <button
                          type="button"
                          onClick={() => onNavigate(topic.action!.route as PublicRoute, topic.action!.subTab)}
                          className="text-[11px] font-semibold text-[var(--theme-accent-dark)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {topic.action.label}
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {topic.prompts.map((prompt, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          disabled={sending}
                          onClick={() => handleQuickPrompt(prompt)}
                          className="w-full text-left px-2.5 py-2 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <span className="leading-snug">{prompt}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Curated Knowledge Summary List */}
          {guides.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BookOpen className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-[var(--theme-primary)]">
                    Direktori Juknis Terkurasi
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {guides.length} panduan aktif yang dibaca oleh Asisten AI
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {guides.map((guide) => {
                  const expanded = selectedGuideId === guide.id;
                  return (
                    <div key={guide.id} className="py-2.5 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedGuideId(expanded ? null : guide.id)}
                        className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[var(--theme-accent-dark)]">
                            {guide.category}
                          </p>
                          <p className="text-xs font-semibold text-slate-800 leading-snug">
                            {guide.title}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {expanded && (
                        <div className="pt-1 space-y-2 text-xs text-slate-600">
                          <p className="leading-relaxed">{guide.summary}</p>
                          {guide.official_source && (
                            <p className="text-[11px] text-slate-500">
                              Rujukan: {guide.official_source}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() => handleQuickPrompt(`Jelaskan secara lengkap tentang ${guide.title}`)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] rounded-md cursor-pointer"
                            >
                              Tanyakan Rincian ke AI
                            </button>
                            {guide.related_route && guide.related_label && (
                              <button
                                type="button"
                                onClick={() => onNavigate(guide.related_route as PublicRoute, guide.related_subtab || undefined)}
                                className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--theme-primary)] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                {guide.related_label}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Right Column: Main AI Conversation Panel */}
        <section
          aria-label="Ruang Percakapan Asisten AI"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[540px] lg:h-[700px] order-1 lg:order-2"
        >
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[var(--theme-primary)] text-white flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-[var(--theme-accent-light)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--theme-primary)] truncate">
                  Konsultasi Layanan Warga Desa Margamukti
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Terhubung ke data portal desa · juknis terkurasi · penelusuran web resmi
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center max-w-xl mx-auto py-6 space-y-5">
                <div className="space-y-2 text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent-dark)]">
                    Siap Membantu Warga 24 Jam
                  </p>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)]">
                    Apa yang ingin Anda ketahui hari ini?
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ajukan pertanyaan dengan bahasa sehari-hari. Asisten AI akan merangkumkan persyaratan dokumen, alur pengurusan di tingkat RT/RW, Kantor Desa, Kecamatan Sumedang Utara, maupun instansi Kabupaten Sumedang.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    'Apa syarat masuk DTSEN dan arti Desil 1 sampai 4?',
                    'Apa saja syarat penerima PKH, BPNT, dan KIP Kuliah?',
                    'Apa berkas syarat membuat Surat Pengantar Nikah (NA)?',
                    'Bagaimana cara membuat KTP baru, KK pecah, dan KIA anak?',
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={sending}
                      onClick={() => handleQuickPrompt(sample)}
                      className="text-left p-3.5 border border-slate-200 hover:border-[var(--theme-primary)] bg-slate-50/70 hover:bg-slate-50 rounded-lg text-xs sm:text-sm text-slate-700 leading-snug transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <span>{sample}</span>
                      <ArrowRight className="w-4 h-4 text-[var(--theme-primary)] shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[78%] bg-[var(--theme-primary)] text-white rounded-xl rounded-br-sm px-4 py-3 text-sm leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex justify-start">
                    <div
                      className={`max-w-[95%] sm:max-w-[88%] rounded-xl rounded-bl-sm px-4 sm:px-5 py-4 border space-y-3 ${
                        msg.error
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-slate-50/60 border-slate-200 text-slate-800'
                      }`}
                    >
                      {msg.error ? (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm leading-relaxed">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>{msg.text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('peta-kontak')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 underline cursor-pointer"
                          >
                            <span>Hubungi Kontak Resmi / WhatsApp Center Desa</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <AiMarkdownText text={msg.text} />
                      )}

                      {msg.suggestedLinks && msg.suggestedLinks.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            Layanan Terkait:
                          </span>
                          {msg.suggestedLinks.map((link, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onNavigate(link.route as PublicRoute, link.subTab)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--theme-primary)] bg-white border border-slate-200 hover:border-[var(--theme-primary)] rounded-md transition-colors cursor-pointer"
                            >
                              <span>{link.label}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[var(--theme-accent-dark)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Rujukan Penelusuran Web Resmi
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-[var(--theme-primary)] hover:border-[var(--theme-primary)] truncate"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-bl-sm px-4 py-3 text-xs sm:text-sm text-slate-500">
                  Menyusun jawaban dari basis data desa dan juknis resmi...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-white border-t border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1500}
                placeholder="Ketik pertanyaan seputar DTSEN, Bansos, KTP, KK, NA, KIA, atau Pemda Sumedang..."
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[var(--theme-primary)]"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-45 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Pastikan informasi pribadi sensitif (seperti PIN IKD/password) tidak dibagikan di obrolan.</span>
              <span className="font-mono-tabular shrink-0 ml-2">{draft.length}/1500</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
