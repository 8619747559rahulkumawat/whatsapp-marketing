import { useState, useRef, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { HiOutlineBell, HiOutlineMenuAlt2, HiOutlineUser, HiOutlineLogout, HiOutlineCash, HiOutlineLockClosed } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

const Header = memo(function Header({ setSidebarOpen, collapsed }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const planColors = {
    free: 'bg-gray-500/20 text-gray-400',
    starter: 'bg-blue-500/20 text-blue-400',
    professional: 'bg-purple-500/20 text-purple-400',
    enterprise: 'bg-amber-500/20 text-amber-400'
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const credits = user?.credits || 0;
  const showLockWarning = credits <= 0 && !isAdmin;

  return (
    <header className={`fixed top-0 right-0 left-0 z-20 bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-white/5 ${collapsed ? 'lg:left-20' : 'lg:left-64'} transition-all duration-300`}>
      <div className="flex items-center justify-between px-4 md:px-8 h-16">
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <HiOutlineMenuAlt2 size={24} />
          </button>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
            <span className="text-white font-bold text-sm">RSendix.pro</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400 text-xs">SMART BULK MESSAGING</span>
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

          <button className="relative p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            <HiOutlineBell size={18} className="sm:size-[22px]" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
            >
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
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                >
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
                    {(isAdmin) && (
                      <Link to="/settings" onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm">
                        <HiOutlineUser size={18} />
                        Settings
                      </Link>
                    )}
                    <button onClick={() => { setShowDropdown(false); logout(); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm w-full">
                      <HiOutlineLogout size={18} />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
});
export default Header;
