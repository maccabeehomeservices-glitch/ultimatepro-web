import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, PhoneCall, Phone as PhoneIcon } from 'lucide-react';
import { useGet } from '../hooks/useApi';
import { Card, LoadingSpinner, EmptyState, Tabs } from '../components/ui';
import { format } from 'date-fns';

const tabList = [
  { id: 'messages', label: 'Messages' },
  { id: 'calls', label: 'Calls' },
];

export default function Phone() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('messages');

  const { data: convData, loading: convLoading, refetch: refetchConv } = useGet(
    activeTab === 'messages' ? '/sms/conversations' : null, [activeTab]
  );
  const { data: callsData, loading: callsLoading, refetch: refetchCalls } = useGet(
    activeTab === 'calls' ? '/phone/calls' : null, [activeTab]
  );

  const conversations = convData?.conversations || convData || [];
  const calls = callsData?.calls || callsData || [];

  // Auto-refresh conversations every 60 seconds
  useEffect(() => {
    if (activeTab !== 'messages') return;
    const interval = setInterval(() => refetchConv(), 60000);
    return () => clearInterval(interval);
  }, [activeTab]);

  function formatTime(ts) {
    if (!ts) return '';
    try { return format(new Date(ts), 'h:mm a'); } catch { return ''; }
  }

  const activeRefetch = activeTab === 'messages' ? refetchConv : refetchCalls;
  const activeLoading = activeTab === 'messages' ? convLoading : callsLoading;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Phone / SMS</h1>
        <button
          onClick={() => activeRefetch()}
          disabled={activeLoading}
          className="text-blue-600 text-sm font-medium flex items-center gap-1 min-h-[44px] px-2"
        >
          {activeLoading ? '⟳ Loading...' : '⟳ Refresh'}
        </button>
      </div>

      <Tabs tabs={tabList} active={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'messages' && (
          convLoading ? <LoadingSpinner /> :
          conversations.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations" description="SMS conversations will appear here." />
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const id = conv.id || conv._id || conv.conversation_id;
                return (
                  <Card key={id} onClick={() => navigate(`/phone/thread/${id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MessageSquare size={18} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 truncate">{conv.customer_name || conv.phone_number || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatTime(conv.last_message_at || conv.updated_at)}</p>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{conv.last_message || ''}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="bg-[#1A73E8] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'calls' && (
          callsLoading ? <LoadingSpinner /> :
          calls.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No call history" description="Call logs will appear here." />
          ) : (
            <div className="space-y-2">
              {calls.map((call, i) => (
                <Card key={call.id || call._id || i}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${call.direction === 'inbound' ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <PhoneIcon size={18} className={call.direction === 'inbound' ? 'text-green-500' : 'text-[#1A73E8]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{call.customer_name || call.from || call.to || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{call.direction || 'call'} · {formatTime(call.date || call.created_at)}{call.duration ? ` · ${call.duration}s` : ''}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
