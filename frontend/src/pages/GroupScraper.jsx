import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineUsers, HiOutlineDownload, HiOutlineSearch, HiOutlineTag, HiOutlineRefresh, HiOutlineTrash, HiOutlineEye, HiOutlineFilter, HiOutlineUserAdd, HiOutlineChat, HiOutlineChatAlt2 } from 'react-icons/hi';
import { FaWhatsapp, FaUserPlus, FaCommentDots } from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';

export default function GroupScraper() {
  const { addToast } = useToast();
  const [scrapes, setScrapes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScrape, setSelectedScrape] = useState(null);
  const [members, setMembers] = useState([]);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [form, setForm] = useState({ groupJid: '', groupName: '', sessionId: '' });
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableGroups, setAvailableGroups] = useState([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [exportingContacts, setExportingContacts] = useState(false);
  const [exportSessionId, setExportSessionId] = useState('');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ groupJid: '', groupName: '', sessionId: '', limit: 50 });
  const [scrapingMessages, setScrapingMessages] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgSearch, setMsgSearch] = useState('');
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => { fetchScrapes(); fetchSessions(); const si = setInterval(fetchSessions, 5000); return () => clearInterval(si); }, []);

  const fetchScrapes = async () => {
    try {
      const { data } = await API.get('/contacts/groups/scrapes');
      if (data.success) setScrapes(data.scrapes || []);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await API.get('/sessions');
      if (data.success) setSessions(data.sessions || []);
    } catch { console.error('Operation failed'); }
  };

  const startScrape = async (e) => {
    e.preventDefault();
    try {
      await API.post('/contacts/groups/scrape', form);
      addToast('Group scraped successfully', 'success');
      setShowScrapeModal(false);
      setForm({ groupJid: '', groupName: '', sessionId: '' });
      setAvailableGroups([]);
      fetchScrapes();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to start scrape', 'error');
    }
  };

  const viewMembers = async (scrape) => {
    setSelectedScrape(scrape);
    try {
      const { data } = await API.get(`/contacts/groups/scrape/${scrape._id}/members`);
      if (data.success) setMembers(data.members || []);
    } catch { console.error('Operation failed'); }
  };

  const getBlobErrorMessage = async (err, fallback = 'Export failed') => {
    let msg = err.response?.data?.message || err.message || fallback;
    try {
      const d = err.response?.data;
      if (d instanceof Blob) {
        const text = await d.text();
        try { msg = JSON.parse(text).message || text || msg; } catch { msg = text || msg; }
      } else if (typeof d === 'string') {
        try { msg = JSON.parse(d).message || d || msg; } catch { msg = d || msg; }
      } else if (d && typeof d === 'object') {
        msg = d.message || JSON.stringify(d) || msg;
      }
    } catch { console.error('Operation failed'); }
    return msg;
  };

  const downloadBlob = (data, filename) => {
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      addToast('Failed to download file. Please try again.', 'error');
    }
  };

  const exportExcel = async (id) => {
    const scrape = scrapes.find(s => s._id === id);
    if (!scrape) return addToast('Scrape not found', 'error');
    
    const contactCount = scrape.participants?.length || scrape.totalMembers || 0;
    if (!contactCount) return addToast('No contacts found to export for this scrape', 'warning');
    
    try {
      const { data } = await API.get(`/contacts/groups/scrape/${id}/export`, { responseType: 'blob' });
      downloadBlob(data, `group-members-${scrape.groupName || id}.xlsx`);
      addToast('Export downloaded successfully', 'success');
    } catch (err) {
      addToast(await getBlobErrorMessage(err, 'Failed to export scrape contacts'), 'error');
    }
  };

  const deleteScrape = async (id) => {
    if (!confirm('Delete this scrape record?')) return;
    try { 
      await API.delete(`/contacts/groups/scrape/${id}`); 
      fetchScrapes(); 
      if (selectedScrape?._id === id) { setSelectedScrape(null); setMembers([]); }
      addToast('Scrape deleted', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete scrape', 'error');
    }
  };

  const fetchGroups = async (sessionId) => {
    if (!sessionId) return;
    setFetchingGroups(true);
    try {
      const { data } = await API.get(`/sessions/${sessionId}/groups`);
      if (data.success) {
        setAvailableGroups(data.groups || []);
        if (!data.groups?.length) addToast('No WhatsApp groups found on this account', 'warning');
      } else {
        addToast(data.message || 'Failed to fetch groups', 'error');
      }
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to fetch groups. Ensure session is connected (✅).', 'error');
    } finally { setFetchingGroups(false); }
  };

  const selectGroup = (group) => {
    setForm({ ...form, groupJid: group.id, groupName: group.name });
  };

  const importToContacts = async (id) => {
    try {
      await API.post(`/contacts/groups/scrape/${id}/import`);
      addToast('Members imported to contacts', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Import failed', 'error');
    }
  };

  const exportPhoneContacts = async () => {
    const sessionId = exportSessionId;
    if (!sessionId) return addToast('Select a connected session from the dropdown first', 'warning');
    
    const selectedSession = sessions.find(s => s.sessionId === sessionId);
    if (!selectedSession) return addToast('Invalid session selected', 'error');
    if (selectedSession.status !== 'connected') {
      return addToast('WhatsApp session not connected. Please connect the session first.', 'warning');
    }

    setExportingContacts(true);
    const format = exportFormat || 'xlsx';
    try {
      console.log('[ExportContacts] Starting export', { sessionId, format });
      
      const { data } = await API.get(`/sessions/${sessionId}/export`, {
        params: { format },
        responseType: 'blob'
      });
      
      const filename = `contacts-${selectedSession.name || sessionId}.${format}`;
      downloadBlob(data, filename);
      addToast('Contacts exported successfully', 'success');
      console.log('[ExportContacts] Export completed', { sessionId, format, filename });
    } catch (err) {
      let errorMsg = await getBlobErrorMessage(err, 'No contacts found to export for this session');
      if (err.response?.status === 404) {
        try {
          const diag = await API.get(`/debug/session/${sessionId}`);
          if (diag.data?.success) {
            const d = diag.data;
            errorMsg = `❌ No contacts. Session=${d.sessionExists}, Connected=${d.connected}, DB Contacts=${d.contactsCount}, Scraped=${d.scrapedContactsCount}, Group Members=${d.groupMembersCount}, Store Contacts=${d.storeContactsCount}, Socket Contacts=${d.socketContactsCount}`;
          }
        } catch (diagErr) {
          console.error('[ExportContacts] Diagnostics fetch error:', diagErr);
        }
      }
      console.error('[ExportContacts] Export error', { sessionId, format, error: errorMsg });
      addToast(errorMsg, 'error');
    } finally { 
      setExportingContacts(false); 
    }
  };

  const scrapeAllGroups = async () => {
    if (!form.sessionId) return;
    setScrapingAll(true);
    try {
      const { data } = await API.post('/contacts/groups/scrape-all', { sessionId: form.sessionId });
      if (data.success) {
        addToast(data.message, 'success');
        setShowScrapeModal(false);
        setForm({ groupJid: '', groupName: '', sessionId: '' });
        setAvailableGroups([]);
        fetchScrapes();
      } else {
        addToast(data.message || 'Failed to scrape all groups', 'error');
      }
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to scrape all groups', 'error');
    } finally { setScrapingAll(false); }
  };

  const exportMessagesExcel = async (id) => {
    try {
      const { data } = await API.get(`/contacts/groups/scrape/${id}/export-messages`, { responseType: 'blob' });
      downloadBlob(data, `group-messages-${id}.xlsx`);
      addToast('Messages exported successfully', 'success');
    } catch (err) {
      addToast(await getBlobErrorMessage(err, 'Failed to export messages'), 'error');
    }
  };

  const scrapeMessages = async () => {
    if (!msgForm.groupJid || !msgForm.sessionId) return addToast('Select a group and session first', 'warning');
    setScrapingMessages(true);
    setMessages([]);
    try {
      const { data } = await API.post('/contacts/groups/scrape-messages', {
        groupJid: msgForm.groupJid,
        sessionId: msgForm.sessionId,
        limit: msgForm.limit
      });
      if (data.success) {
        setMessages(data.messages || []);
        if (!data.messages?.length) addToast('No messages found in this group', 'warning');
        else addToast(`Scraped ${data.messages.length} messages`, 'success');
      }
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to scrape messages', 'error');
    } finally {
      setScrapingMessages(false);
    }
  };

  const viewMessages = async (scrape) => {
    try {
      const { data } = await API.get(`/contacts/groups/scrape/${scrape._id}/messages`);
      if (data.success) {
        setMessages(data.messages || []);
        setShowMessages(true);
        setMsgForm({ ...msgForm, groupJid: scrape.groupJid, groupName: scrape.groupName });
      }
    } catch { console.error('Operation failed'); }
  };

  const filteredMembers = members.filter(m =>
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(m.phone || m.number || '').includes(searchTerm)
  );

  const filteredMessages = messages.filter(m =>
    (m.content || '').toLowerCase().includes(msgSearch.toLowerCase()) ||
    (m.senderPhone || '').includes(msgSearch)
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Group Contact Scraper</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Extract members from WhatsApp groups</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <select className="input-field text-sm py-1.5" value={exportSessionId} onChange={e => setExportSessionId(e.target.value)}>
              <option value="">Select session</option>
              {sessions.map(s => (
                <option key={s._id} value={s.sessionId}>{s.name || s.sessionId} {s.status === 'connected' ? '✅' : '❌'}</option>
              ))}
            </select>
            <select className="input-field text-sm py-1.5" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
              <option value="xlsx">XLSX</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button onClick={exportPhoneContacts} disabled={exportingContacts || !exportSessionId}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
              <HiOutlineDownload size={14} className={`${exportingContacts ? 'animate-spin' : ''}`} />
              {exportingContacts ? 'Exporting...' : 'Export Contacts'}
            </button>
          </div>
          <button onClick={() => setShowScrapeModal(true)} className="btn-primary px-3 sm:px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
            <FaUserPlus /> Scrape Group
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlineUsers className="text-2xl sm:text-3xl text-purple-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scrapes.length}</p>
          <p className="text-gray-400 text-sm">Groups Scraped</p>
        </div>
        <div className="glass-card p-4 sm:p-5 text-center">
          <FaWhatsapp className="text-2xl sm:text-3xl text-green-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scrapes.reduce((s, g) => s + (g.totalMembers || g.participants?.length || 0), 0)}</p>
          <p className="text-gray-400 text-sm">Total Members</p>
        </div>
        <div className="glass-card p-4 sm:p-5 text-center">
          <HiOutlineDownload className="text-2xl sm:text-3xl text-blue-400 mx-auto mb-2" />
          <p className="text-xl sm:text-2xl font-bold text-white">{scrapes.filter(s => s.imported).length}</p>
          <p className="text-gray-400 text-sm">Imported to Contacts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-white font-semibold">Scrape History</h2>
          {scrapes.map((scrape, idx) => (
            <motion.div key={scrape._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
              className={`glass-card p-4 cursor-pointer glass-card-hover ${selectedScrape?._id === scrape._id ? 'border-purple-500/50' : ''}`}
              onClick={() => viewMembers(scrape)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <FaWhatsapp className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{scrape.groupName || scrape.groupJid}</h3>
                    <p className="text-gray-400 text-xs">{scrape.totalMembers || scrape.participants?.length || 0} members</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${scrape.status === 'completed' ? 'badge-success' : scrape.status === 'scraping' ? 'badge-warning' : 'badge-info'}`}>
                    {scrape.status || 'completed'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setMsgForm({ groupJid: scrape.groupJid, groupName: scrape.groupName || scrape.groupJid, sessionId: scrape.sessionId || '', limit: 50 }); setShowMsgModal(true); }}
                    className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" title="Scrape Messages">
                    <HiOutlineChatAlt2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{new Date(scrape.createdAt).toLocaleDateString()}</span>
                {scrape.imported && <span className="badge badge-success text-[10px]">Imported</span>}
                {scrape.totalMessages > 0 && <span className="badge badge-info text-[10px]">{scrape.totalMessages} msgs</span>}
              </div>
            </motion.div>
          ))}
          {scrapes.length === 0 && <div className="text-center py-8 text-gray-500">No groups scraped yet</div>}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">
              {showMessages ? `Messages from ${msgForm.groupName}` : selectedScrape ? `Members of ${selectedScrape.groupName || selectedScrape.groupJid}` : 'Select a scrape to view'}
            </h2>
            {selectedScrape && !showMessages && (
              <div className="flex gap-2">
                <button onClick={() => viewMessages(selectedScrape)} className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" title="View Messages">
                  <HiOutlineChatAlt2 size={14} />
                </button>
                <button onClick={() => exportExcel(selectedScrape._id)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Export Excel">
                  <HiOutlineDownload size={14} />
                </button>
                <button onClick={() => importToContacts(selectedScrape._id)} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Import to Contacts">
                  <HiOutlineUserAdd size={14} />
                </button>
                <button onClick={() => deleteScrape(selectedScrape._id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                  <HiOutlineTrash size={14} />
                </button>
              </div>
            )}
            {showMessages && (
              <div className="flex gap-2">
                <button onClick={() => exportMessagesExcel(selectedScrape?._id)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Export Messages to Excel">
                  <HiOutlineDownload size={14} />
                </button>
                <button onClick={() => { setShowMessages(false); setMessages([]); }} className="text-xs text-purple-400 hover:text-purple-300">
                  Back to Members
                </button>
              </div>
            )}
          </div>

          {!showMessages && selectedScrape && (
            <>
              <div className="glass-card p-3">
                <div className="flex gap-3">
                  <HiOutlineSearch className="text-gray-400 mt-2.5" />
                  <input className="input-field flex-1" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search members..." />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMembers.map((member, idx) => (
                  <motion.div key={member._id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 font-bold">
                        {(member.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{member.name || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{member.phone || member.number || member.jid}</p>
                      </div>
                    </div>
                    {member.isAdmin && <span className="badge badge-warning text-[10px]">Admin</span>}
                  </motion.div>
                ))}
                {filteredMembers.length === 0 && <div className="text-center py-8 text-gray-500">No members found</div>}
              </div>
            </>
          )}

          {showMessages && (
            <>
              <div className="glass-card p-3">
                <div className="flex gap-3">
                  <HiOutlineSearch className="text-gray-400 mt-2.5" />
                  <input className="input-field flex-1" value={msgSearch} onChange={e => setMsgSearch(e.target.value)} placeholder="Search messages..." />
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMessages.length === 0 && <div className="text-center py-8 text-gray-500">No messages found</div>}
                {filteredMessages.map((msg, idx) => (
                  <motion.div key={msg.msgId || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.01 }}
                    className="glass-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold flex-shrink-0">
                          {msg.senderPhone?.slice(-2) || '??'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-xs font-medium">{msg.senderName || msg.senderPhone || 'Unknown'}</span>
                            <span className="text-gray-500 text-[10px]">{msg.senderPhone}</span>
                            <span className="text-gray-600 text-[10px]">{new Date(msg.timestamp).toLocaleString()}</span>
                            {msg.type !== 'text' && <span className="badge text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{msg.type}</span>}
                          </div>
                          <p className="text-gray-300 text-sm mt-1 break-words">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Message Scrape Modal */}
      {showMsgModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowMsgModal(false); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Scrape Group Messages</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Session</label>
                <select className="input-field" value={msgForm.sessionId} onChange={e => setMsgForm({ ...msgForm, sessionId: e.target.value })} required>
                  <option value="">Select session</option>
                  {sessions.map(s => <option key={s._id} value={s.sessionId}>{s.name || s.sessionId} {s.status === 'connected' ? '✅' : '❌'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Group JID</label>
                <input className="input-field" value={msgForm.groupJid} onChange={e => setMsgForm({ ...msgForm, groupJid: e.target.value })} required placeholder="123456789-123456@g.us" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Group Name</label>
                <input className="input-field" value={msgForm.groupName} onChange={e => setMsgForm({ ...msgForm, groupName: e.target.value })} placeholder="My Group" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Messages Limit (max 200)</label>
                <input className="input-field" type="number" min="1" max="200" value={msgForm.limit} onChange={e => setMsgForm({ ...msgForm, limit: parseInt(e.target.value) || 50 })} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setShowMsgModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button onClick={scrapeMessages} disabled={scrapingMessages}
                  className="btn-primary px-6 py-2 rounded-xl text-white flex items-center gap-2">
                  {scrapingMessages ? <span className="animate-spin">⏳</span> : <FaCommentDots />}
                  {scrapingMessages ? 'Scraping...' : 'Scrape Messages'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showScrapeModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowScrapeModal(false); setAvailableGroups([]); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Scrape WhatsApp Group</h2>
            <form onSubmit={startScrape} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Session</label>
                  <select className="input-field" value={form.sessionId} onChange={e => { setForm({ ...form, sessionId: e.target.value, groupJid: '', groupName: '' }); setAvailableGroups([]); }} required>
                    <option value="">Select session</option>
                    {sessions.map(s => <option key={s._id} value={s.sessionId}>{s.name || s.sessionId} {s.status === 'connected' ? '✅' : s.status === 'connecting' ? '⏳' : '❌'}</option>)}
                  </select>
                  {form.sessionId && (
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => fetchGroups(form.sessionId)} disabled={fetchingGroups}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <HiOutlineRefresh className={`${fetchingGroups ? 'animate-spin' : ''}`} size={14} />
                        {fetchingGroups ? 'Loading...' : 'Fetch My Groups'}
                      </button>
                      <button type="button" onClick={scrapeAllGroups} disabled={scrapingAll}
                        className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                        <HiOutlineRefresh className={`${scrapingAll ? 'animate-spin' : ''}`} size={14} />
                        {scrapingAll ? 'Scraping...' : 'Scrape All Groups'}
                      </button>
                    </div>
                  )}
                </div>
                {availableGroups.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Group</label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {availableGroups.map(g => (
                        <div key={g.id} onClick={() => selectGroup(g)}
                          className={`p-2 rounded-lg cursor-pointer text-sm flex items-center justify-between ${form.groupJid === g.id ? 'bg-purple-600/30 border border-purple-500/50' : 'bg-white/5 hover:bg-white/10'}`}>
                          <span className="text-white">{g.name}</span>
                          <span className="text-gray-500 text-xs">{g.memberCount} members</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Group JID</label>
                <input className="input-field" value={form.groupJid} onChange={e => setForm({ ...form, groupJid: e.target.value })} required placeholder="123456789-123456@g.us" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Group Name (optional)</label>
                <input className="input-field" value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} placeholder="My Group" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowScrapeModal(false)} className="px-6 py-2 rounded-xl border border-white/10 text-gray-300">Cancel</button>
                <button type="submit" className="btn-primary px-6 py-2 rounded-xl text-white">Start Scraping</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
