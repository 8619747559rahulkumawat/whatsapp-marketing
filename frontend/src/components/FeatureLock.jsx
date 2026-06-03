import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SubscribePopup from './SubscribePopup';
import { HiOutlineLockClosed } from 'react-icons/hi';

export default function FeatureLock({ feature, children }) {
  const { user, hasAccess } = useAuth();
  const [showPopup, setShowPopup] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  if (isAdmin) return children;

  if (!hasAccess(feature)) {
    return (
      <>
        <div className="relative">
          <div className="opacity-30 pointer-events-none select-none">{children}</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <HiOutlineLockClosed className="text-orange-400 text-3xl" />
              </div>
              <p className="text-gray-400 text-sm mb-4">Your credits are finished. Please Subscribe to continue.</p>
              <button onClick={() => setShowPopup(true)} className="btn-primary px-6 py-2 rounded-xl text-white text-sm font-medium">
                Subscribe to Unlock
              </button>
            </div>
          </div>
        </div>
        <SubscribePopup isOpen={showPopup} onClose={() => setShowPopup(false)} />
      </>
    );
  }

  return children;
}
