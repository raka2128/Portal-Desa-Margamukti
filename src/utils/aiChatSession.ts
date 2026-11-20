import { useCallback, useEffect, useState } from 'react';
import type { AiChatMessage, AiChatQuickTopic } from '../types';

export interface PublicAiGuideSummary {
  id: number;
  category: string;
  title: string;
  summary: string;
  official_source: string;
  related_route: string;
  related_subtab: string;
  related_label: string;
}

const STORAGE_KEY = 'margamukti_ai_chat_messages_v1';
const SYNC_EVENT = 'margamukti:ai-chat-updated';

function readStoredMessages(): AiChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeStoredMessages(messages: AiChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    // Abaikan jika penyimpanan sesi penuh
  }
}

export function useAiChatSession() {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => readStoredMessages());
  const [quickTopics, setQuickTopics] = useState<AiChatQuickTopic[]>([]);
  const [guides, setGuides] = useState<PublicAiGuideSummary[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onSync = () => {
      setMessages(readStoredMessages());
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/ai-chat/topics')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setQuickTopics(Array.isArray(json.quickTopics) ? json.quickTopics : []);
        setGuides(Array.isArray(json.guides) ? json.guides : []);
      })
      .catch(() => {
        // Biarkan daftar topik kosong jika offline
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = useCallback(async (rawText: string): Promise<boolean> => {
    const text = rawText.trim();
    if (!text || sending) return false;

    const current = readStoredMessages();
    const userMsg: AiChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };
    const nextWithUser = [...current, userMsg];
    setMessages(nextWithUser);
    writeStoredMessages(nextWithUser);
    setSending(true);

    try {
      const historyPayload = current
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/public/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          typeof json?.error === 'string' && json.error.trim()
            ? json.error.trim()
            : 'Maaf, Asisten AI belum dapat memproses pertanyaan saat ini. Silakan coba kembali.';
        const errorBubble: AiChatMessage = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'model',
          text: errMsg,
          createdAt: new Date().toISOString(),
          error: true,
        };
        const afterErr = [...nextWithUser, errorBubble];
        setMessages(afterErr);
        writeStoredMessages(afterErr);
        return false;
      }

      const aiMsg: AiChatMessage = {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'model',
        text: String(json.reply || ''),
        createdAt: new Date().toISOString(),
        sources: Array.isArray(json.sources) ? json.sources : [],
        suggestedLinks: Array.isArray(json.suggestedLinks) ? json.suggestedLinks : [],
      };
      const afterReply = [...nextWithUser, aiMsg];
      setMessages(afterReply);
      writeStoredMessages(afterReply);
      return true;
    } catch {
      const offlineBubble: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: 'Koneksi ke server portal terputus. Periksa jaringan internet Anda lalu coba kirim ulang.',
        createdAt: new Date().toISOString(),
        error: true,
      };
      const afterOffline = [...nextWithUser, offlineBubble];
      setMessages(afterOffline);
      writeStoredMessages(afterOffline);
      return false;
    } finally {
      setSending(false);
    }
  }, [sending]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    writeStoredMessages([]);
  }, []);

  return {
    messages,
    quickTopics,
    guides,
    topicsLoading,
    sending,
    sendMessage,
    clearMessages,
  };
}
