import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useGet, useMutation } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';
import { format } from 'date-fns';

export default function SmsThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [body, setBody] = useState('');
  const bottomRef = useRef(null);

  const { data, loading, refetch } = useGet(`/sms/conversations/${id}/messages`, [id]);
  const { mutate, loading: sending } = useMutation();

  const messages = data?.messages || data || [];
  const conversation = data?.conversation || {};

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await mutate('post', `/sms/conversations/${id}/send`, { body });
      setBody('');
      refetch();
    } catch {
      showSnack('Failed to send message', 'error');
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    try { return format(new Date(ts), 'h:mm a'); } catch { return ''; }
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="font-semibold text-gray-900">{conversation.customer_name || conversation.phone_number || 'Conversation'}</p>
          {conversation.phone_number && <p className="text-xs text-gray-400">{conversation.phone_number}</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {loading && <LoadingSpinner />}
        {messages.map((msg, i) => {
          const isOutbound = msg.direction === 'outbound' || msg.type === 'outbound';
          return (
            <div key={msg.id || i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isOutbound ? 'bg-[#1A73E8] text-white rounded-br-sm' : 'bg-white text-gray-900 shadow rounded-bl-sm'}`}>
                <p className="text-sm">{msg.body || msg.message}</p>
                <p className={`text-[10px] mt-1 ${isOutbound ? 'text-blue-200' : 'text-gray-400'}`}>{formatTime(msg.created_at || msg.date)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-200" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[44px]"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="w-11 h-11 bg-[#1A73E8] text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
