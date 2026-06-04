import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import API from '../utils/api';
import { connectSocket } from '../utils/socket';
import HelpGuide from '../components/HelpGuide';
import { HiOutlineBell, HiOutlineMenuAlt2, HiOutlineUser, HiOutlineLogout, HiOutlineCash, HiOutlineLockClosed, HiOutlineSun, HiOutlineMoon, HiOutlineCheckCircle, HiOutlineX, HiOutlinePhone, HiOutlineQuestionMarkCircle } from 'react-icons/hi';

const Header = memo(function Header({ setSidebarOpen, collapsed }) {
  const { user, logout, token } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifs = useCallback(async () => {
    try {
      const r = await API.get('/notifications?limit=10');
      if (r.data.success) {
        setNotifications(r.data.notifications);
        setUnreadCount(r.data.unreadCount);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (token) {
      fetchNotifs();
      const interval = setInterval(fetchNotifs, 30000);
      try {
        const socket = connectSocket();
        if (socket) {
          socket.on('notification:new', (notif) => {
            setNotifications(prev => [notif, ...prev].slice(0, 10));
            setUnreadCount(c => c + 1);
          });
        }
      } catch {}
      return () => clearInterval(interval);
    }
  }, [token, fetchNotifs]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await API.put('/notifications/all/read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const planColors = {
    free: 'bg-gray-500/20 text-gray-400',
    starter: 'bg-blue-500/20 text-blue-400',
    professional: 'bg-purple-500/20 text-purple-400',
    enterprise: 'bg-amber-500/20 text-amber-400'
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const credits = user?.credits || 0;
  const showLockWarning = credits <= 0 && !isAdmin;

  const notifIcon = (type) => {
    switch(type) {
      case 'lead': return '🔵'; case 'deal': return '💎'; case 'task': return '📋';
      case 'meeting': return '📅'; case 'email': return '📧'; case 'goal': return '🎯';
      case 'contract': return '📄'; case 'survey': return '📊'; default: return '🔔';
    }
  };

  return (
    <header className={`fixed top-0 right-0 left-0 z-20 bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-white/5 ${collapsed ? 'lg:left-20' : 'lg:left-64'} transition-all duration-300`}>
      <div className="flex items-center justify-between px-4 md:px-8 h-16">
        <div className="flex items-center gap-4">
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <HiOutlineMenuAlt2 size={24} />
          </button>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
            <span className="text-white font-bold text-sm">RSendix.pro</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400 text-xs">SMART CRM</span>
            <span className="text-gray-600">|</span>
            <a href="tel:+918617559759" className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium">
              <HiOutlinePhone size={14} /> +91 8619747559
            </a>
          </div>
          {user?.plan && (
            <span className={`hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase ${planColors[user.plan] || 'bg-gray-500/20 text-gray-400'}`}>
              {user.plan}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          {showLockWarning ? (
            <Link to="/billing" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-orange-500/10 text-orange-300 border border-orange-500/20 text-xs sm:text-sm font-medium hover:bg-orange-500/20 transition-all">
              <HiOutlineLockClosed size={16} className="hidden sm:block" />
              <span className="hidden sm:inline">0 Credits -</span>
              <span>Subscribe</span>
            </Link>
          ) : (
            <Link to="/wallet" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-purple-600/10 text-purple-300 border border-purple-500/20 text-xs sm:text-sm font-medium hover:bg-purple-600/20 transition-all">
              <HiOutlineCash size={16} />
              <span className="hidden sm:inline">{credits?.toLocaleString() || 0}</span>
              <span className="sm:hidden">{(credits/1000).toFixed(1)}k</span>
            </Link>
          )}

          <button onClick={() => setShowHelp(true)} className="px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm text-gray-400 hover:text-purple-400 hover:bg-white/5 transition-all font-medium border border-white/5 hover:border-purple-500/30">
            Help Guide
          </button>
          <button onClick={toggleTheme} className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all" title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <HiOutlineSun size={18} className="sm:size-[22px]" /> : <HiOutlineMoon size={18} className="sm:size-[22px]" />}
          </button>

          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotif(!showNotif)} className="relative p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <HiOutlineBell size={18} className="sm:size-[22px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotif && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-white font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <HiOutlineCheckCircle size={14} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <p className="text-gray-500 text-xs text-center py-8">No notifications yet</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} onClick={() => { markRead(n._id); if (n.link) navigate(n.link); }}
                          className={`flex items-start gap-3 p-4 border-b border-white/5 cursor-pointer transition-all ${n.read ? 'opacity-60' : 'bg-white/5 hover:bg-white/10'}`}>
                          <span className="text-base flex-shrink-0">{notifIcon(n.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${n.read ? 'text-gray-400' : 'text-white font-medium'}`}>{n.title}</p>
                            {n.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>}
                            <p className="text-[10px] text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1" />}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all">
              <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10">
                    <p className="text-white font-medium">{user?.name}</p>
                    <p className="text-gray-400 text-sm">{user?.email}</p>
                    {user?.plan && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${planColors[user.plan] || 'bg-gray-500/20 text-gray-400'}`}>
                        {user.plan} Plan
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <Link to="/settings" onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm">
                      <HiOutlineUser size={18} /> Settings
                    </Link>
                    <button onClick={() => { setShowDropdown(false); logout(); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm w-full">
                      <HiOutlineLogout size={18} /> Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}
    </header>
  );
});
export default Header;
