import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineSearch, HiOutlineChartBar, HiOutlineUserGroup, HiOutlineDatabase, HiOutlineEye } from 'react-icons/hi';
import { FaBrain, FaRobot } from 'react-icons/fa';

export default function DataCapture() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [contactResult, setContactResult] = useState(null);
  const [extractMessage, setExtractMessage] = useState('');
  const [extractPhone, setExtractPhone] = useState('');
  const [extractResult, setExtractResult] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/data-capture/stats');
      if (data.success) setStats(data.stats);
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const searchContact = async () => {
    if (!searchPhone) return;
    try {
      const { data } = await API.get(`/contacts?phone=${searchPhone}`);
      if (data.success && data.contacts?.length > 0) {
        const contact = data.contacts[0];
        const { data: history } = await API.get(`/data-capture/history/${contact._id}`);
        if (history.success) setContactResult(history);
      } else {
        setContactResult(null);
        alert('Contact not found');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Search failed');
    }
  };

  const extractData = async () => {
    if (!extractMessage || !extractPhone) return;
    setExtractResult(null);
    try {
      const { data: contactSearch } = await API.get(`/contacts?phone=${extractPhone}`);
      if (!contactSearch.success || !contactSearch.contacts?.length) {
        alert('Contact not found. Save the contact first.');
        return;
      }
      const contact = contactSearch.contacts[0];
      const { data } = await API.post('/data-capture/extract', { message: extractMessage, contactId: contact._id });
      setExtractResult(data);
    } catch (err) {
      setExtractResult({ error: err.response?.data?.message || err.message });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Capture & Auto CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Automatically extract and update contact data from messages</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center">
            <HiOutlineUserGroup className="text-3xl text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalContacts}</p>
            <p className="text-gray-400 text-sm">Total Contacts</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineDatabase className="text-3xl text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalWithData}</p>
            <p className="text-gray-400 text-sm">With Captured Data</p>
          </div>
          <div className="glass-card p-5 text-center">
            <HiOutlineChartBar className="text-3xl text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.captureRate}%</p>
            <p className="text-gray-400 text-sm">Data Capture Rate</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><FaBrain className="text-purple-400" /> Extract Data from Message</h2>
          <p className="text-gray-400 text-sm mb-4">Paste a customer message to automatically extract fields like email, phone, address, name, and order info.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Contact Phone</label>
              <input className="input-field" value={extractPhone} onChange={e => setExtractPhone(e.target.value)} placeholder="+1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
              <textarea className="input-field h-28" value={extractMessage} onChange={e => setExtractMessage(e.target.value)} placeholder="Paste the customer message here..." />
            </div>
            <button onClick={extractData} className="btn-primary px-4 py-2 rounded-xl text-white flex items-center gap-2">
              <FaRobot /> Extract Data
            </button>
            {extractResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                {extractResult.error ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{extractResult.error}</div>
                ) : (
                  <>
                    {extractResult.updated && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">Contact updated successfully!</div>
                    )}
                    {extractResult.extracted && Object.keys(extractResult.extracted).length > 0 && (
                      <div className="p-4 bg-white/5 rounded-xl">
                        <p className="text-xs text-gray-400 mb-2">Extracted Data:</p>
                        <div className="space-y-1">
                          {Object.entries(extractResult.extracted).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="text-white font-medium">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineSearch className="text-purple-400" /> Search Contact Data</h2>
            <div className="flex gap-3">
              <input className="input-field flex-1" value={searchPhone} onChange={e => setSearchPhone(e.target.value)} placeholder="Search by phone..." />
              <button onClick={searchContact} className="btn-primary px-4 py-2 rounded-xl text-white">Search</button>
            </div>
            {contactResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                    {(contactResult.contact?.name || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{contactResult.contact?.name}</p>
                    <p className="text-gray-500 text-xs">{contactResult.contact?.phone}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {contactResult.contact?.email && <p className="text-gray-400">Email: <span className="text-white">{contactResult.contact.email}</span></p>}
                  {contactResult.contact?.address && <p className="text-gray-400">Address: <span className="text-white">{contactResult.contact.address}</span></p>}
                  {Object.entries(contactResult.capturedData || {}).map(([key, val]) => (
                    <p key={key} className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}: <span className="text-white">{String(val)}</span></p>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-2">How it works</h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">1.</span> AI analyzes incoming messages for entity data</li>
              <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">2.</span> Extracts name, email, phone, address, order details</li>
              <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">3.</span> Automatically updates contact record</li>
              <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">4.</span> Enables personalized follow-up campaigns</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
