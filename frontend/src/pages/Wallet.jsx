import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { HiOutlineCash, HiOutlineArrowUp, HiOutlineArrowDown } from 'react-icons/hi';
import { FaWallet } from 'react-icons/fa';

export default function Wallet() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchTransactions(); }, [page]);

  const fetchTransactions = async () => {
    try {
      const { data } = await API.get(`/wallet/transactions?page=${page}&limit=20`);
      if (data.success) { setTransactions(data.transactions); setTotalPages(data.pagination.pages); }
    } catch { console.error("API Error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your credits and transactions</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-600/20 to-green-600/20 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center">
              <FaWallet className="text-white text-2xl" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Available Credits</p>
              <p className="text-4xl font-bold text-white">{user?.credits?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>Total Used: {(user?.totalCreditsUsed || 0).toLocaleString()}</span>
          </div>
        </div>
      </motion.div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="p-4 text-left">Type</th>
              <th className="p-4 text-left">Amount</th>
              <th className="p-4 text-left">Balance</th>
              <th className="p-4 text-left">Description</th>
              <th className="p-4 text-left">Date</th>
            </tr></thead>
            <tbody>
              {transactions.map((txn, idx) => (
                <motion.tr key={txn._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="table-row">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${txn.type === 'credit' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {txn.type === 'credit' ? <HiOutlineArrowUp className="text-green-400" /> : <HiOutlineArrowDown className="text-red-400" />}
                      </div>
                      <span className={`capitalize font-medium ${txn.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>{txn.type}</span>
                    </div>
                  </td>
                  <td className="p-4 text-white font-medium">{txn.type === 'credit' ? '+' : '-'}{txn.amount}</td>
                  <td className="p-4 text-gray-300">{txn.balanceAfter}</td>
                  <td className="p-4 text-gray-400 text-sm">{txn.description || '-'}</td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(txn.createdAt).toLocaleString()}</td>
                </motion.tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No transactions yet</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg text-sm text-gray-400 hover:bg-white/5 disabled:opacity-30">&lt;</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-sm ${page === pageNum ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{pageNum}</button>
              );
            })}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg text-sm text-gray-400 hover:bg-white/5 disabled:opacity-30">&gt;</button>
          </div>
        )}
      </div>
    </div>
  );
}
