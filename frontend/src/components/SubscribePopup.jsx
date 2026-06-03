import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiOutlineX, HiOutlineLightningBolt, HiOutlineCreditCard } from 'react-icons/hi';

export default function SubscribePopup({ isOpen, onClose, message }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border border-purple-500/20 rounded-3xl p-8 w-full max-w-md relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <HiOutlineX size={20} />
            </button>

            <div className="text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-orange-600/20 flex items-center justify-center mx-auto mb-6">
                <HiOutlineLightningBolt className="text-orange-400 text-3xl" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">Credits Exhausted</h2>
              <p className="text-gray-400 mb-6">
                {message || 'Your credits are finished. Please Subscribe to continue.'}
              </p>

              <div className="space-y-3">
                <Link
                  to="/billing"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold hover:from-purple-500 hover:to-purple-600 transition-all"
                >
                  <HiOutlineCreditCard size={20} />
                  Subscribe to a Plan
                </Link>
                <Link
                  to="/wallet"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-purple-500/20 text-purple-300 font-medium hover:bg-purple-500/10 transition-all"
                >
                  Buy Credits
                </Link>
              </div>

              <p className="text-gray-500 text-xs mt-4">
                Dashboard and billing features remain accessible.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
