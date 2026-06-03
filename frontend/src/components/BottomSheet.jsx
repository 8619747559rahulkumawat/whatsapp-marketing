import { motion, AnimatePresence } from 'framer-motion';

export default function BottomSheet({ isOpen, onClose, title, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a2e] border-t border-white/10 rounded-t-2xl max-h-[85vh] overflow-y-auto lg:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#1a1a2e] z-10">
              <h3 className="text-white font-semibold text-sm">{title}</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-lg p-1">&times;</button>
            </div>
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
