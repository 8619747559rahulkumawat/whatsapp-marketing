import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineArrowLeft } from 'react-icons/hi';

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const [campRes, msgRes] = await Promise.all([
        API.get(`/campaigns/${id}`),
        API.get(`/campaigns/${id}/messages`)
      ]);
      if (campRes.data.success) setCampaign(campRes.data.campaign);
      if (msgRes.data.success) setMessages(msgRes.data.messages);
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;
  if (!campaign) return <div className="text-center text-gray-400 py-20">Campaign not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
        <HiOutlineArrowLeft /> Back to Campaigns
      </Link>

      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{campaign.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className={`badge ${campaign.status === 'completed' ? 'badge-success' : campaign.status === 'running' ? 'badge-info' : campaign.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                {campaign.status}
              </span>
              <span className="text-gray-400 text-sm capitalize">{campaign.type} Campaign</span>
              <span className="text-gray-400 text-sm">{new Date(campaign.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Total', value: campaign.totalContacts, color: 'text-white' },
            { label: 'Sent', value: campaign.sentCount, color: 'text-blue-400' },
            { label: 'Delivered', value: campaign.deliveredCount, color: 'text-green-400' },
            { label: 'Failed', value: campaign.failedCount, color: 'text-red-400' },
          ].map((s, idx) => (
            <div key={idx} className="text-center p-4 rounded-xl bg-white/5">
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-4">Message Content</h3>
        <div className="p-4 rounded-xl bg-white/5 text-gray-300 whitespace-pre-wrap">{campaign.message || 'No message content'}</div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-2 sm:p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Message Log ({messages.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="p-2 sm:p-3 text-left whitespace-nowrap">To</th>
                <th className="p-2 sm:p-3 text-left whitespace-nowrap">Content</th>
                <th className="p-2 sm:p-3 text-left whitespace-nowrap">Status</th>
                <th className="p-2 sm:p-3 text-left whitespace-nowrap">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, idx) => (
                <tr key={msg._id} className="table-row">
                  <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">{msg.to}</td>
                  <td className="p-2 sm:p-3 text-gray-400 text-sm max-w-md truncate">{msg.content}</td>
                  <td className="p-2 sm:p-3 whitespace-nowrap">
                    <span className={`badge ${msg.status === 'sent' ? 'badge-info' : msg.status === 'delivered' ? 'badge-success' : msg.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="p-2 sm:p-3 text-gray-400 text-sm whitespace-nowrap">{msg.sentAt ? new Date(msg.sentAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No messages sent yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
