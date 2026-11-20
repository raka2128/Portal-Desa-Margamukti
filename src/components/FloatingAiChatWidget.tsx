import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  ExternalLink,
  Maximize2,
  MessageSquareText,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { useAiChatSession } from '../utils/aiChatSession';
import { AiMarkdownText } from './AiMarkdownText';
import type { PublicRoute } from '../pages/public/HomePage';

interface FloatingAiChatWidgetProps {
  currentRoute: PublicRoute;
  onNavigate: (route: PublicRoute, subTab?: string, param?: string | number) => void;
}

export function FloatingAiChatWidget({ currentRoute, onNavigate }: FloatingAiChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, quickTopics, sending, sendMessage, clearMessages } = useAiChatSession();

  useEffect(() => {
    if (open) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages.length, sending]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (currentRoute === 'asisten-ai') {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    await sendMessage(text);
  };

  return (
    <div className="no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end">
      {open && (
        <section
          aria-label="Asisten AI Layanan Warga Desa Margamukti"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[410px] h-[min(74dvh,560px)] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Drawer Header */}
          <div className="px-4 py-3 bg-[var(--theme-primary)] text-white border-b-2 border-[var(--theme-accent)] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[var(--theme-accent-light)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                  Asisten AI Layanan Warga
                </p>
                <p className="text-[11px] text-slate-200 truncate">
                  DTSEN · Bansos · Adminduk · Pemda &amp; Desa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate('asisten-ai');
                }}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Buka tampilan penuh"
                aria-label="Buka tampilan penuh halaman Asisten AI"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  disabled={sending}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-slate-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Percakapan baru"
                  aria-label="Mulai percakapan baru"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Tutup jendela Asisten AI"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/70">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--theme-primary)]">
                    Selamat datang di Layanan Tanya AI Desa Margamukti
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tanyakan juknis kepesertaan <strong>DTSEN</strong>, syarat penerima <strong>PKH / BPNT / PBI / KIP Sekolah &amp; Kuliah</strong>, syarat <strong>KTP, KK, Surat Nikah (NA), KIA</strong>, atau info pemerintahan daerah Kabupaten Sumedang.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Pilih Topik Cepat
                  </p>
                  <div className="space-y-2">
                    {quickTopics.map((topic) => (
                      <div key={topic.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[var(--theme-primary)]">{topic.title}</p>
                          {topic.action && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onNavigate(topic.action!.route as PublicRoute, topic.action!.subTab);
                              }}
                              className="text-[11px] font-medium text-[var(--theme-accent-dark)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {topic.action.label}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => sendMessage(topic.prompts[0])}
                          className="w-full text-left text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2.5 py-2 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="line-clamp-2">{topic.prompts[0]}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] bg-[var(--theme-primary)] text-white rounded-xl rounded-br-sm px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex justify-start">
                    <div
                      className={`max-w-[94%] rounded-xl rounded-bl-sm px-3.5 py-3 border space-y-2.5 ${
                        msg.error
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      {msg.error ? (
                        <div className="flex items-start gap-2 text-xs leading-relaxed">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>{msg.text}</span>
                        </div>
                      ) : (
                        <AiMarkdownText text={msg.text} />
                      )}

                      {msg.suggestedLinks && msg.suggestedLinks.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {msg.suggestedLinks.map((link, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onNavigate(link.route as PublicRoute, link.subTab);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--theme-primary)] bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            >
                              <span>{link.label}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-100 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Sumber Referensi Resmi
                          </p>
                          <div className="flex flex-col gap-1">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--theme-primary)] hover:underline truncate"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
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
                <div className="bg-white border border-slate-200 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-xs text-slate-500">
                  Menyiapkan jawaban dari data desa &amp; juknis resmi...
                </div>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Input Composer */}
          <form onSubmit={handleSubmit} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1500}
              placeholder="Tulis pertanyaan DTSEN, Bansos, KTP, KK, NA..."
              className="flex-1 min-w-0 min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[var(--theme-primary)]"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="min-w-[44px] min-h-[42px] inline-flex items-center justify-center px-3 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white rounded-lg transition-colors disabled:opacity-45 cursor-pointer shrink-0"
              aria-label="Kirim pertanyaan"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-[46px] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white shadow-lg border border-[var(--theme-accent)]/60 transition-transform active:scale-95 cursor-pointer"
        aria-label={open ? 'Tutup Asisten AI Desa' : 'Buka Tanya AI Desa'}
      >
        {open ? (
          <X className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
        ) : (
          <MessageSquareText className="w-4 h-4 text-[var(--theme-accent-light)] shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
          {open ? 'Tutup AI' : 'Tanya AI Desa'}
        </span>
      </button>
    </div>
  );
}
