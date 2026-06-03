import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { HiOutlineCreditCard, HiOutlineCash, HiOutlineDocumentText, HiOutlineCheck, HiOutlineQrcode, HiOutlineDownload } from 'react-icons/hi';
import { FaPhone } from 'react-icons/fa';
import { jsPDF } from 'jspdf';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creditRate, setCreditRate] = useState(0.15);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchInvoices(), fetchCurrentPlan()]);
    API.get('/billing/rate').then(({ data }) => { if (data.success) setCreditRate(data.rate); }).catch(() => {});
  }, []);

  const defaultPlans = [
    { _id: 'free', name: 'Free', price: 0, interval: 'month', features: ['Basic messaging', '100 contacts', 'Basic reports'] },
    { _id: 'starter', name: 'Starter', price: 499, interval: 'month', features: ['Bulk messaging', '5000 contacts', 'Campaign analytics', 'Email support'] },
    { _id: 'professional', name: 'Professional', price: 1999, interval: 'month', features: ['All Starter features', '25000 contacts', 'Automation builder', 'Priority support', 'API access'] },
    { _id: 'enterprise', name: 'Enterprise', price: 9999, interval: 'month', features: ['All Professional features', '100k contacts', 'AI assistant', 'Dedicated support', 'Custom integrations'] }
  ];

  const fetchPlans = async () => {
    try {
      const { data } = await API.get('/billing/plans');
      if (data.success && data.plans.length > 0) {
        setPlans(data.plans);
      } else {
        setPlans(defaultPlans);
      }
    } catch { setPlans(defaultPlans); } finally { setLoading(false); }
  };

  const fetchInvoices = async () => {
    try {
      const { data } = await API.get('/billing/invoices');
      if (data.success) setInvoices(data.invoices);
    } catch { console.error('Operation failed'); }
  };

  const fetchCurrentPlan = async () => {
    try {
      const { data } = await API.get('/auth/me');
      if (data.success && data.user?.tenantId) {
        setCurrentPlan(data.user.tenantId.plan || 'free');
      }
    } catch { console.error('Operation failed'); }
  };

  const handleSubscribe = async (plan) => {
    if (plan.name.toLowerCase() === currentPlan) return;
    if (plan.price === 0) {
      try {
        await API.post('/billing/subscribe', { planId: plan._id });
        alert(`Subscribed to ${plan.name} plan!`);
        setCurrentPlan(plan.name.toLowerCase());
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
      return;
    }
    setActiveTab('qr');
    setUpiAmount(String(plan.price));
    setSubscribing(null);
  };

  const handleUpiVerify = async () => {
    if (!upiRef || !upiAmount) return alert('Enter UPI transaction ID and amount');
    setVerifying(true);
    try {
      const amount = parseFloat(upiAmount);
      const matchedPlan = defaultPlans.find(p => p.price === amount && amount > 0);
      const { data } = await API.post('/billing/upi/verify', {
        upiTransactionId: upiRef,
        amount,
        planId: matchedPlan?._id || null
      });
      if (data.success) {
        alert(`Payment verified! ${data.credits} credits added.${matchedPlan ? ` Upgraded to ${matchedPlan.name} plan!` : ''}`);
        if (matchedPlan) setCurrentPlan(matchedPlan.name.toLowerCase());
        setUpiRef('');
        setUpiAmount('');
        fetchInvoices();
        fetchCurrentPlan();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
    } finally { setVerifying(false); }
  };

  const handleRazorpayPurchase = async () => {
    if (!purchaseAmount || processing) return;
    setProcessing(true);
    try {
      const { data } = await API.post('/billing/razorpay/create-order', { amount: parseFloat(purchaseAmount) });
      if (!data.success) throw new Error(data.message);
      const options = {
        key: data.order.key_id || '',
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'RSendix.pro',
        description: `${data.credits} Credits`,
        order_id: data.order.id,
        handler: async (response) => {
          const verify = await API.post('/billing/razorpay/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            invoiceId: data.invoice._id
          });
          if (verify.data.success) {
            alert('Payment successful! Credits added to your account.');
            setPurchaseAmount('');
            fetchInvoices();
          }
        },
        modal: { ondismiss: () => setProcessing(false) }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { alert('Payment failed'); setProcessing(false); });
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
      setProcessing(false);
    }
  };

  const [upiRef, setUpiRef] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleDownloadPdf = (inv) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(24);
    doc.setTextColor(88, 28, 135);
    doc.text('RSendix.pro', pageWidth / 2, 30, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, pageWidth - 20, 35);

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);

    let y = 50;
    const leftX = 20;
    const valueX = 80;

    const fields = [
      { label: 'Invoice #', value: inv.invoiceNumber },
      { label: 'Date', value: new Date(inv.createdAt).toLocaleDateString() },
      { label: 'Amount', value: `${inv.currency} ${inv.amount}` },
      { label: 'Status', value: inv.status },
      { label: 'Payment', value: inv.paymentMethod || '-' },
      { label: 'Description', value: inv.description || 'Subscription Payment' },
    ];

    fields.forEach((field) => {
      doc.setFont('helvetica', 'bold');
      doc.text(field.label + ':', leftX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(field.value, valueX, y);
      y += 10;
    });

    y = 260;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by RSendix.pro', pageWidth / 2, y, { align: 'center' });
    doc.text('Thank you for your business!', pageWidth / 2, y + 5, { align: 'center' });

    doc.save(`invoice-${inv.invoiceNumber || inv._id}.pdf`);
  };

  const tabs = [
    { id: 'plans', label: 'Subscription Plans', icon: HiOutlineCreditCard },
    { id: 'purchase', label: 'Buy Credits', icon: HiOutlineCash },
    { id: 'qr', label: 'QR Payment', icon: HiOutlineQrcode },
    { id: 'invoices', label: 'Invoices', icon: HiOutlineDocumentText }
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Manage your subscription and purchase credits</p>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300">
          Current Plan: <span className="uppercase font-bold">{currentPlan}</span>
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

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.length > 0 ? plans.map((plan, idx) => {
            const isCurrent = plan.name.toLowerCase() === currentPlan;
            return (
              <motion.div key={plan._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                className={`glass-card p-4 sm:p-6 ${idx === 2 ? 'border-purple-500/50 ring-1 ring-purple-500/30' : ''}`}>
                {idx === 2 && <div className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full inline-block mb-3">Most Popular</div>}
                <h3 className="text-xl font-bold text-white capitalize">{plan.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-2xl sm:text-3xl font-bold text-white">₹{plan.price}</span>
                  <span className="text-gray-400">/{plan.interval}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features?.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm text-gray-300"><HiOutlineCheck className="text-green-400 shrink-0" /> {f}</li>)}
                </ul>
                <button onClick={() => handleSubscribe(plan)} disabled={isCurrent || processing}
                  className={`w-full py-2 rounded-xl text-sm font-medium ${isCurrent ? 'bg-green-600/20 text-green-400 cursor-default' : 'btn-primary text-white hover:opacity-90'}`}>
                  {processing && subscribing === plan._id ? 'Processing...' : isCurrent ? 'Current Plan' : 'Subscribe'}
                </button>
              </motion.div>
            );
          }) : (
            <div className="col-span-full text-center py-12 text-gray-500">No plans available</div>
          )}
        </div>
      )}

      {activeTab === 'purchase' && (
        <div className="max-w-lg">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4">Purchase Credits</h3>
            <div className="bg-purple-500/10 rounded-xl p-4 mb-6">
              <p className="text-purple-300 text-sm">Current Rate: <strong>1 Credit = ₹{creditRate}</strong></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount (₹)</label>
                <input type="number" className="input-field" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} placeholder="Enter amount..." min="1" />
              </div>
              {purchaseAmount && (
                <div className="bg-green-500/10 rounded-xl p-4">
                  <p className="text-green-400 text-sm">You will receive: <strong>{Math.floor(parseFloat(purchaseAmount) / creditRate).toLocaleString()} Credits</strong></p>
                </div>
              )}
              <div className="bg-purple-500/10 rounded-xl p-3 text-sm text-purple-300">
                <p>💡 Use the <strong>QR Payment</strong> tab instead to pay via UPI (GPay/PhonePe/Paytm).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="max-w-lg">
          <div className="glass-card p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FaPhone className="text-green-400" /> Pay via UPI QR
            </h3>
            <div className="flex flex-col items-center mb-6">
              <div className="w-48 h-48 bg-white rounded-2xl p-3 flex items-center justify-center mb-3">
                <picture><source srcSet="/upi-qr.webp" type="image/webp" /><img src="/upi-qr.jpeg" alt="UPI QR Code" className="w-full h-full object-contain" onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerHTML='<div class=text-gray-400 text-center><div class=text-6xl mb-2>📱</div><p class=text-sm>Scan with any UPI app</p><p class=text-xs mt-1>pay@rsendix</p></div>' }} /></picture>
              </div>
              <p className="text-gray-400 text-sm">Scan this QR with any UPI app (GPay, PhonePe, Paytm) and pay</p>
            </div>
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-white text-sm font-medium mb-3">After payment, verify here:</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Amount Paid (₹)</label>
                  <input type="number" className="input-field" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} placeholder="Enter amount..." min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">UPI Transaction ID</label>
                  <input className="input-field" value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="Enter UPI reference/transaction ID" />
                </div>
                {upiAmount && (
                  <div className="bg-green-500/10 rounded-xl p-3">
                    <p className="text-green-400 text-sm">You will receive: <strong>{Math.floor(parseFloat(upiAmount) / creditRate).toLocaleString()} Credits</strong></p>
                  </div>
                )}
                <button onClick={handleUpiVerify} disabled={!upiRef || !upiAmount || verifying}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-all disabled:opacity-50">
                  {verifying ? 'Verifying...' : 'Verify Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Invoice #</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Amount</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Status</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Payment</th>
                <th className="p-2 sm:p-4 text-left whitespace-nowrap">Date</th>
                <th className="p-2 sm:p-4 text-center whitespace-nowrap">PDF</th>
              </tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="table-row">
                    <td className="p-2 sm:p-4 text-white font-medium whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="p-2 sm:p-4 text-gray-300 whitespace-nowrap">{inv.currency} {inv.amount}</td>
                    <td className="p-2 sm:p-4 whitespace-nowrap"><span className={`badge text-xs ${inv.status === 'paid' ? 'badge-success' : inv.status === 'draft' ? 'badge-warning' : 'badge-danger'}`}>{inv.status}</span></td>
                    <td className="p-2 sm:p-4 text-gray-400 text-sm capitalize whitespace-nowrap">{inv.paymentMethod || '-'}</td>
                    <td className="p-2 sm:p-4 text-gray-400 text-sm whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="p-2 sm:p-4 text-center whitespace-nowrap">
                      <button onClick={() => handleDownloadPdf(inv)} className="text-purple-400 hover:text-purple-300 transition-colors" title="Download PDF">
                        <HiOutlineDownload className="w-5 h-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No invoices yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}