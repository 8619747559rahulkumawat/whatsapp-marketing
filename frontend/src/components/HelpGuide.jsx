import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineX, HiOutlineBookOpen, HiOutlineSearch, HiOutlineLightBulb, HiOutlineChevronDown } from 'react-icons/hi';
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation, featureKeys, icons } from '../translations';

export default function HelpGuide({ onClose }) {
  const { lang, toggleLang } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeFeature, setActiveFeature] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const t = (key) => getTranslation(key, lang);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const filtered = featureKeys.filter(k => {
    const name = t(k).toLowerCase();
    const desc = t(k + 'Desc').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientY);
  const handleTouchEnd = (e) => {
    if (touchStart && (touchStart - e.changedTouches[0].clientY) < -80) onClose();
    setTouchStart(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1a1a2e] w-full sm:max-w-xl sm:rounded-2xl sm:mx-4 h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col border border-white/10 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="relative flex items-center justify-between px-3 sm:px-5 pt-2 pb-2 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <HiOutlineBookOpen className="text-purple-400 flex-shrink-0" size={18} />
            <h2 className="text-base sm:text-lg font-bold text-white truncate">{t('helpGuide')}</h2>
            <span className="hidden sm:inline text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{filtered.length} {t('features')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => lang !== 'hi' && toggleLang()}
                className={`px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all ${lang === 'hi' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                🇮🇳 हिंदी
              </button>
              <button onClick={() => lang !== 'en' && toggleLang()}
                className={`px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all ${lang === 'en' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                🇬🇧 English
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10">
              <HiOutlineX size={20} />
            </button>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-1 sm:hidden w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="px-3 sm:px-5 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
          <div className="flex gap-2 items-center bg-white/5 rounded-xl px-3 py-2 sm:py-2.5">
            <HiOutlineSearch className="text-gray-400 flex-shrink-0" size={16} />
            <input className="bg-transparent text-white text-sm flex-1 outline-none border-none placeholder:text-gray-500"
              placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white text-xs p-1">✕</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-1.5 overscroll-contain">
          <AnimatePresence>
            {filtered.map((k, i) => (
              <motion.div key={k} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <div onClick={() => setActiveFeature(activeFeature === k ? null : k)}
                  className="p-3 sm:p-3.5 rounded-xl bg-white/5 active:bg-white/10 hover:bg-white/[0.07] cursor-pointer transition-all select-none">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="text-lg sm:text-xl flex-shrink-0">{icons[k]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t(k)}</p>
                      <p className="text-gray-400 text-xs mt-px leading-relaxed line-clamp-2">{t(k + 'Desc')}</p>
                    </div>
                    <motion.div animate={{ rotate: activeFeature === k ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <HiOutlineChevronDown className="text-gray-500 flex-shrink-0" size={16} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {activeFeature === k && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="mt-2.5 pt-2.5 border-t border-white/5">
                          <div className="flex items-start gap-2 bg-purple-500/10 p-2.5 sm:p-3 rounded-lg">
                            <HiOutlineLightBulb className="text-purple-400 mt-0.5 flex-shrink-0" size={15} />
                            <p className="text-purple-200 text-xs sm:text-sm leading-relaxed">{t(k + 'How')}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">{t('noFeatureFound')} "<span className="text-purple-400">{search}</span>"</p>
            </div>
          )}
        </div>
        <div className="px-3 sm:px-5 py-2.5 border-t border-white/5 flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-gray-600">{t('adminCall')} <a href="tel:+918617559759" className="text-purple-400 font-medium">+91 8619747559</a></p>
          <p className="text-[10px] text-gray-600">{filtered.length} / {featureKeys.length}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}