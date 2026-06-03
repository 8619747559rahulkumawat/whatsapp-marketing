import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import API from '../utils/api';
import { HiOutlineCheck, HiOutlineX, HiOutlineArrowRight } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

const plansData = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    description: 'Perfect for getting started with WhatsApp marketing.',
    popular: false,
    features: [
      { text: '100 Credits', included: true },
      { text: 'Basic Messaging', included: true },
      { text: '100 Contacts', included: true },
      { text: 'Basic Reports', included: true },
      { text: 'Bulk Messaging', included: false },
      { text: 'Campaign Analytics', included: false },
      { text: 'Automation Builder', included: false },
      { text: 'API Access', included: false },
      { text: 'Email Support', included: false },
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 499,
    interval: 'month',
    description: 'Best for growing businesses looking to scale.',
    popular: true,
    features: [
      { text: '5,000 Credits', included: true },
      { text: 'Basic Messaging', included: true },
      { text: 'Bulk Messaging', included: true },
      { text: 'Campaign Analytics', included: true },
      { text: '5,000 Contacts', included: true },
      { text: 'Basic Reports', included: true },
      { text: 'Email Support', included: true },
      { text: 'Automation Builder', included: false },
      { text: 'API Access', included: false },
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 1999,
    interval: 'month',
    description: 'For established businesses needing automation and API.',
    popular: false,
    features: [
      { text: '25,000 Credits', included: true },
      { text: 'Basic Messaging', included: true },
      { text: 'Bulk Messaging', included: true },
      { text: 'Campaign Analytics', included: true },
      { text: 'Unlimited Contacts', included: true },
      { text: 'Advanced Reports', included: true },
      { text: 'Priority Support', included: true },
      { text: 'Automation Builder', included: true },
      { text: 'API Access', included: true },
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    interval: 'month',
    description: 'Full platform access with AI, integrations and dedicated support.',
    popular: false,
    features: [
      { text: '100,000 Credits', included: true },
      { text: 'Basic Messaging', included: true },
      { text: 'Bulk Messaging', included: true },
      { text: 'Campaign Analytics', included: true },
      { text: 'Unlimited Contacts', included: true },
      { text: 'Advanced Reports', included: true },
      { text: 'AI Assistant', included: true },
      { text: 'Custom Integrations', included: true },
      { text: 'Dedicated Support', included: true },
      { text: 'Team Access', included: true },
    ]
  }
];

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(plansData);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await API.get('/billing/plans');
      if (data.success && data.plans.length > 0) {
        setPlans(data.plans.map(p => ({
          id: p._id,
          name: p.name,
          price: p.price,
          interval: p.interval,
          description: p.description || '',
          popular: p.name === 'Starter',
          features: (p.features || []).map(f => ({ text: f, included: true }))
        })));
      }
    } catch { console.error('Operation failed'); } finally { setLoading(false); }
  };

  const fetchCurrentPlan = async () => {
    try {
      const { data } = await API.get('/auth/me');
      if (data.success && data.user?.plan) {
        setCurrentPlan(data.user.plan);
      }
    } catch { console.error('Operation failed'); }
  };

  const handleSubscribe = async (plan) => {
    if (plan.id === currentPlan || plan.price === 0) return;
    setSubscribing(plan.id);
    setProcessing(true);
    try {
      const { data } = await API.post('/billing/subscribe', {
        planId: plan.id === 'free' ? 'free' : plan.id,
        paymentMethod: 'razorpay'
      });
      if (plan.price === 0) {
        alert('Free plan selected!');
        setCurrentPlan('free');
        return;
      }
      if (!data.success) throw new Error(data.message);
      const options = {
        key: data.order.key_id || '',
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'RSendix.pro',
        description: `${data.plan.name} Plan`,
        order_id: data.order.id,
        handler: async (response) => {
          const verify = await API.post('/billing/subscribe/confirm', {
            invoiceId: data.invoice._id,
            paymentId: response.razorpay_payment_id,
            paymentMethod: 'razorpay'
          });
          if (verify.data.success) {
            setCurrentPlan(data.plan.name.toLowerCase());
          }
        },
        modal: { ondismiss: () => { setProcessing(false); setSubscribing(null); } }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { setProcessing(false); setSubscribing(null); });
      rzp.open();
    } catch (err) {
      setProcessing(false);
      setSubscribing(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-900/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-6">
            <FaWhatsapp className="text-white text-3xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Choose the plan that fits your business needs. All plans include free credits to get you started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, idx) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative rounded-3xl p-6 flex flex-col ${
                  plan.popular
                    ? 'bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border-2 border-purple-500/50 shadow-xl shadow-purple-500/10'
                    : 'bg-[#1a1a2e]/80 border border-white/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white text-xs font-medium">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white capitalize">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mt-1 min-h-[40px]">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">₹{plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">/{plan.interval}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      {feat.included ? (
                        <HiOutlineCheck className="text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <HiOutlineX className="text-gray-600 mt-0.5 shrink-0" />
                      )}
                      <span className={feat.included ? 'text-gray-300' : 'text-gray-600'}>
                        {feat.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-center text-sm font-medium bg-green-600/20 text-green-400 border border-green-500/20">
                    Current Plan
                  </div>
                ) : plan.price === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-3">
                    Free - No payment needed
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={processing}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold hover:from-purple-500 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && subscribing === plan.id ? (
                      'Processing...'
                    ) : (
                      <>
                        Subscribe <HiOutlineArrowRight />
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {user && (
          <div className="text-center mt-12">
            <Link to="/billing" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium">
              Go to Billing Dashboard <HiOutlineArrowRight />
            </Link>
          </div>
        )}

        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-white mb-4">Need More Credits?</h2>
          <p className="text-gray-400 mb-6">1 Credit = ₹0.15. Purchase credits separately anytime.</p>
          <Link to={user ? "/wallet" : "/register"} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-medium">
            {user ? 'Buy Credits' : 'Get Started Free'} <HiOutlineArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
}
