import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineChat, HiOutlineSparkles, HiOutlineEmojiHappy, HiOutlinePencil, HiOutlineLightBulb, HiOutlineChip } from 'react-icons/hi';
import { FaRobot, FaWhatsapp } from 'react-icons/fa';

export default function AIAssist() {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [smartReplyInput, setSmartReplyInput] = useState('');
  const [smartReplyResult, setSmartReplyResult] = useState('');
  const [sentimentInput, setSentimentInput] = useState('');
  const [sentimentResult, setSentimentResult] = useState('');
  const [optimizeInput, setOptimizeInput] = useState('');
  const [optimizeResult, setOptimizeResult] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    checkOllama();
    loadChatHistory();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const checkOllama = async () => {
    try {
      const { data } = await API.get('/ai/ollama-status');
      setOllamaStatus(data);
    } catch (err) { console.error(err); }
  };

  const loadChatHistory = async () => {
    try {
      const { data } = await API.get('/ai/chat');
      if (data.success) setMessages(data.messages);
    } catch (err) { console.error(err); }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const { data } = await API.post('/ai/chat', { message: userMsg, sessionId });
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        if (data.sessionId) setSessionId(data.sessionId);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.response?.data?.message || err.message}` }]);
    } finally { setLoading(false); }
  };

  const getSmartReply = async () => {
    if (!smartReplyInput) return;
    setSmartReplyResult('');
    try {
      const { data } = await API.post('/ai/smart-reply', { message: smartReplyInput });
      if (data.success) setSmartReplyResult(data.reply);
    } catch (err) {
      setSmartReplyResult(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const analyzeSentiment = async () => {
    if (!sentimentInput) return;
    setSentimentResult('');
    try {
      const { data } = await API.post('/ai/sentiment', { message: sentimentInput });
      if (data.success) setSentimentResult(data.sentiment);
    } catch (err) {
      setSentimentResult(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const optimizeMsg = async () => {
    if (!optimizeInput) return;
    setOptimizeResult('');
    try {
      const { data } = await API.post('/ai/optimize', { message: optimizeInput });
      if (data.success) setOptimizeResult(data.optimized);
    } catch (err) {
      setOptimizeResult(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const getSuggestion = async () => {
    try {
      const { data } = await API.post('/ai/suggestions', {});
      if (data.success) setSuggestion(data.suggestion);
    } catch (err) {
      setSuggestion(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const tabs = [
    { id: 'chat', label: 'AI Chat', icon: HiOutlineChat },
    { id: 'smart_reply', label: 'Smart Reply', icon: HiOutlineSparkles },
    { id: 'sentiment', label: 'Sentiment', icon: HiOutlineEmojiHappy },
    { id: 'optimize', label: 'Optimize', icon: HiOutlinePencil },
    { id: 'suggestions', label: 'Suggestions', icon: HiOutlineLightBulb }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">AI Assistant</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Powered by Ollama (Local AI - Free)</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${ollamaStatus?.available ? (ollamaStatus?.hasModel ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400') : 'bg-red-500/10 text-red-400'}`}>
          <HiOutlineChip />
          {!ollamaStatus?.available ? 'Ollama Offline' : ollamaStatus?.hasModel ? `Ollama Ready (${ollamaStatus.models?.join(', ')})` : 'Model not downloaded - AI will auto-download on first use'}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'chat' && (
        <div className="glass-card p-0 overflow-hidden">
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FaRobot className="text-5xl mb-4 text-purple-400" />
                <p>Ask me anything about WhatsApp marketing!</p>
                <p className="text-xs mt-2">I can help with campaigns, templates, best practices, and more.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/5 text-gray-200 rounded-bl-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'assistant' ? <FaRobot className="text-purple-400 text-xs" /> : <FaWhatsapp className="text-green-400 text-xs" />}
                    <span className="text-xs opacity-70">{msg.role === 'user' ? 'You' : 'AI'}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-2xl rounded-bl-sm p-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} className="p-4 border-t border-white/5">
            <div className="flex gap-3">
              <input className="input-field" value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..." disabled={loading} />
              <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-6 py-2 rounded-xl text-white disabled:opacity-50">Send</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'smart_reply' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineSparkles className="text-purple-400" /> Smart Reply Generator</h3>
            <p className="text-gray-400 text-sm mb-4">Generate professional replies to customer messages</p>
            <textarea className="input-field h-32 mb-4" value={smartReplyInput} onChange={e => setSmartReplyInput(e.target.value)} placeholder="Paste the customer message here..." />
            <button onClick={getSmartReply} className="btn-primary px-6 py-2 rounded-xl text-white">Generate Reply</button>
            {smartReplyResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-xs text-green-400 mb-2">Suggested Reply:</p>
                <p className="text-white">{smartReplyResult}</p>
                <button onClick={() => navigator.clipboard.writeText(smartReplyResult)} className="text-xs text-purple-400 mt-2 hover:text-purple-300">Copy to Clipboard</button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sentiment' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineEmojiHappy className="text-purple-400" /> Sentiment Analysis</h3>
            <p className="text-gray-400 text-sm mb-4">Analyze the sentiment of any message</p>
            <textarea className="input-field h-32 mb-4" value={sentimentInput} onChange={e => setSentimentInput(e.target.value)} placeholder="Enter a message to analyze..." />
            <button onClick={analyzeSentiment} className="btn-primary px-6 py-2 rounded-xl text-white">Analyze</button>
            {sentimentResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-4 rounded-xl ${sentimentResult === 'positive' ? 'bg-green-500/10 border-green-500/20' : sentimentResult === 'negative' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                <p className="text-sm">Sentiment: <strong className="capitalize">{sentimentResult}</strong></p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'optimize' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlinePencil className="text-purple-400" /> Message Optimizer</h3>
            <p className="text-gray-400 text-sm mb-4">Optimize your marketing messages for better engagement</p>
            <textarea className="input-field h-32 mb-4" value={optimizeInput} onChange={e => setOptimizeInput(e.target.value)} placeholder="Enter your message to optimize..." />
            <button onClick={optimizeMsg} className="btn-primary px-6 py-2 rounded-xl text-white">Optimize</button>
            {optimizeResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-xs text-green-400 mb-2">Optimized Version:</p>
                <p className="text-white">{optimizeResult}</p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><HiOutlineLightBulb className="text-purple-400" /> AI Suggestions</h3>
            <p className="text-gray-400 text-sm mb-4">Get actionable suggestions for your campaigns</p>
            <button onClick={getSuggestion} className="btn-primary px-6 py-2 rounded-xl text-white mb-4">Get Suggestion</button>
            {suggestion && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <p className="text-white">{suggestion}</p>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
