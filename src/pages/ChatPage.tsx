import { useEffect, useRef, useState } from 'react';
import { api, API_URL } from '../api/client';
import { ChatMessage, Conversation } from '../api/types';

// Real-time-ish delivery via short polling instead of Socket.io/WebSocket — the backend runs
// as Vercel serverless functions in production, which don't hold persistent WS connections.
const POLL_MS = 3000;

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeGuestIdRef = useRef<string | null>(null);

  const loadConversations = () => api.get<Conversation[]>('/admin/chat/conversations').then(setConversations);
  const loadMessages = (guestId: string) => api.get<ChatMessage[]>(`/admin/chat/${guestId}/messages`).then(setMessages);

  useEffect(() => {
    activeGuestIdRef.current = activeGuestId;
  }, [activeGuestId]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(() => {
      loadConversations();
      if (activeGuestIdRef.current) loadMessages(activeGuestIdRef.current);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const openConversation = (guestId: string) => {
    setActiveGuestId(guestId);
    loadMessages(guestId);
    api.patch(`/admin/chat/${guestId}/read`).then(loadConversations);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const value = text.trim();
    if (!value || !activeGuestId) return;
    setText('');
    const message = await api.post<ChatMessage>(`/admin/chat/${activeGuestId}/messages`, { text: value });
    setMessages((prev) => [...prev, message]);
    loadConversations();
  };

  const sendPhoto = async (file: File) => {
    if (!activeGuestId) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await api.post<{ url: string }>('/upload/admin', form);
    const message = await api.post<ChatMessage>(`/admin/chat/${activeGuestId}/messages`, { photo: url });
    setMessages((prev) => [...prev, message]);
    loadConversations();
  };

  const active = conversations.find((c) => c.guestId === activeGuestId);

  return (
    <div>
      <h1>Чат</h1>
      <div className="chat-layout">
        <div className="chat-list">
          {conversations.length === 0 && <p className="muted" style={{ padding: 14 }}>Пока нет диалогов</p>}
          {conversations.map((c) => (
            <div key={c.guestId} className={`chat-list-item ${activeGuestId === c.guestId ? 'active' : ''}`} onClick={() => openConversation(c.guestId)}>
              <div className="chat-list-item__name">
                {c.guestName} · №{c.guestRoom} {c.unreadFromGuest > 0 && <span className="badge orange">{c.unreadFromGuest}</span>}
              </div>
              <div className="chat-list-item__preview">{c.lastMessage || '📷 фото'}</div>
            </div>
          ))}
        </div>
        <div className="chat-main">
          {!active ? (
            <div className="muted" style={{ padding: 20 }}>
              Выберите диалог слева
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                {active.guestName} · №{active.guestRoom}
              </div>
              <div className="chat-messages">
                {messages.map((m) => (
                  <div key={m._id} className={`chat-bubble ${m.sender}`}>
                    {m.text && <div>{m.text}</div>}
                    {m.photo && <img src={m.photo.startsWith('http') ? m.photo : `${API_URL}${m.photo}`} alt="" />}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input-row">
                <button className="btn secondary" onClick={() => fileRef.current?.click()}>
                  📷
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
                <input type="text" className="input" placeholder="Сообщение…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                <button className="btn" onClick={send}>
                  Отправить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
