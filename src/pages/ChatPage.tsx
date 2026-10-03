import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Send } from 'lucide-react';
import { api, API_URL, sameJson } from '../api/client';
import { ChatMessage, Conversation } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { compressImage } from '../utils/image';

// Real-time-ish delivery via short polling (the production API keeps no WebSocket
// connections). The open conversation only asks for messages newer than the last one it
// has, so each poll is tiny no matter how long the history is.
const MESSAGES_POLL_MS = 3000;
const CONVERSATIONS_POLL_MS = 5000;

const mergeMessages = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  if (!incoming.length) return prev;
  const known = new Set(prev.map((m) => m._id));
  const fresh = incoming.filter((m) => !known.has(m._id));
  return fresh.length ? [...prev, ...fresh] : prev;
};

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const jumpRef = useRef(false);
  activeRef.current = activeGuestId;
  messagesRef.current = messages;

  const loadConversations = () =>
    api.get<Conversation[]>('/admin/chat/conversations').then((list) => setConversations((prev) => (sameJson(prev, list) ? prev : list)));

  usePolling(loadConversations, CONVERSATIONS_POLL_MS);

  const markRead = (guestId: string) => api.patch(`/admin/chat/${guestId}/read`).then(loadConversations).catch(() => {});

  // Only messages after the newest one we hold; ignores responses for a conversation the
  // admin has already switched away from.
  const pollMessages = async () => {
    const guestId = activeRef.current;
    if (!guestId) return;
    const last = messagesRef.current[messagesRef.current.length - 1];
    const query = last ? `?after=${encodeURIComponent(last.timestamp)}` : '';
    const incoming = await api.get<ChatMessage[]>(`/admin/chat/${guestId}/messages${query}`);
    if (activeRef.current !== guestId) return;
    setMessages((prev) => (last ? mergeMessages(prev, incoming) : incoming));
    if (incoming.some((m) => m.sender === 'guest' && !m.readStatus)) markRead(guestId);
  };

  usePolling(pollMessages, MESSAGES_POLL_MS, [activeGuestId]);

  const openConversation = (guestId: string) => {
    if (guestId === activeGuestId) return;
    messagesRef.current = [];
    setMessages([]);
    setError('');
    jumpRef.current = true;
    setActiveGuestId(guestId);
    markRead(guestId);
  };

  // Jump to the bottom when a conversation opens; follow new messages only if the admin
  // is already near the bottom (reading older history isn't interrupted).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (jumpRef.current && messages.length) {
      jumpRef.current = false;
      el.scrollTop = el.scrollHeight;
    } else if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length]);

  const deliver = async (body: { text?: string; photo?: string }) => {
    const guestId = activeGuestId;
    if (!guestId) return;
    const message = await api.post<ChatMessage>(`/admin/chat/${guestId}/messages`, body);
    if (activeRef.current === guestId) setMessages((prev) => mergeMessages(prev, [message]));
    loadConversations().catch(() => {});
  };

  const send = async () => {
    const value = text.trim();
    if (!value || !activeGuestId || sending) return;
    setText('');
    setSending(true);
    setError('');
    try {
      await deliver({ text: value });
    } catch (e: any) {
      setText(value);
      setError(e.message || 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async (file: File) => {
    if (!activeGuestId) return;
    setSending(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', await compressImage(file));
      const { url } = await api.post<{ url: string }>('/upload/admin', form);
      await deliver({ photo: url });
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить фото');
    } finally {
      setSending(false);
    }
  };

  const active = conversations.find((c) => c.guestId === activeGuestId);

  return (
    <div>
      <div className="page-head">
        <h1>Чат</h1>
      </div>
      <div className={`chat-layout ${active ? 'has-active' : ''}`}>
        <div className="chat-list">
          {conversations.length === 0 && <p className="muted" style={{ padding: 14 }}>Пока нет диалогов</p>}
          {conversations.map((c) => (
            <div key={c.guestId} className={`chat-list-item ${activeGuestId === c.guestId ? 'active' : ''}`} onClick={() => openConversation(c.guestId)}>
              <div className="chat-list-item__name">
                <span>
                  {c.guestName} · №{c.guestRoom}
                </span>
                {c.unreadFromGuest > 0 && <span className="badge orange">{c.unreadFromGuest}</span>}
              </div>
              <div className="chat-list-item__preview">{c.lastMessage || '📷 фото'}</div>
            </div>
          ))}
        </div>
        <div className="chat-main">
          {!active ? (
            <div className="chat-main__empty">Выберите диалог слева</div>
          ) : (
            <>
              <div className="chat-main__header">
                <button className="btn icon small secondary" onClick={() => setActiveGuestId(null)} aria-label="К списку диалогов">
                  <ArrowLeft />
                </button>
                <span className="wrap-anywhere">
                  {active.guestName} · №{active.guestRoom}
                </span>
              </div>
              <div className="chat-messages" ref={listRef}>
                {messages.map((m) => (
                  <div key={m._id} className={`chat-bubble ${m.sender}`}>
                    {m.photo && (
                      <a href={m.photo.startsWith('http') ? m.photo : `${API_URL}${m.photo}`} target="_blank" rel="noreferrer">
                        <img src={m.photo.startsWith('http') ? m.photo : `${API_URL}${m.photo}`} alt="" />
                      </a>
                    )}
                    {m.text && <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>}
                    <div className="chat-bubble__time">{new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
              {error && <div className="error-text" style={{ padding: '6px 14px 0' }}>{error}</div>}
              <div className="chat-input-row">
                <button className="btn icon secondary" onClick={() => fileRef.current?.click()} aria-label="Отправить фото">
                  <Camera />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) sendPhoto(file);
                  }}
                />
                <input type="text" className="input" placeholder="Сообщение…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                <button className="btn icon" onClick={send} disabled={sending || !text.trim()} aria-label="Отправить">
                  <Send />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
