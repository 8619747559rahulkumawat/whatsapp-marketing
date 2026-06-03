import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#9ca3af', usePointStyle: true } }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
  }
};

export function StatCard({ label, value, icon: Icon, color, bg, subtitle }) {
  return (
    <div className={`glass-card p-5 glass-card-hover`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        {Icon && <div className={`w-10 h-10 rounded-xl ${bg || 'bg-purple-500/10'} flex items-center justify-center`}>
          <Icon className={`${color || 'text-purple-400'} text-lg`} />
        </div>}
      </div>
      <div className="text-2xl font-bold text-white">{value ?? 0}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

export function LineChart({ data, options, height = 300 }) {
  return (
    <div className="glass-card p-5">
      <Line data={data} options={{ ...defaultOptions, ...options }} height={height} />
    </div>
  );
}

export function BarChart({ data, options, height = 300 }) {
  return (
    <div className="glass-card p-5">
      <Bar data={data} options={{ ...defaultOptions, ...options }} height={height} />
    </div>
  );
}

export function DoughnutChart({ data, options, height = 300 }) {
  return (
    <div className="glass-card p-5 flex items-center justify-center">
      <div style={{ height }}>
        <Doughnut data={data} options={{ ...defaultOptions, cutout: '65%', ...options }} />
      </div>
    </div>
  );
}

export function PieChart({ data, options, height = 300 }) {
  return (
    <div className="glass-card p-5 flex items-center justify-center">
      <div style={{ height }}>
        <Pie data={data} options={{ ...defaultOptions, ...options }} />
      </div>
    </div>
  );
}

export function ChartCard({ title, subtitle, children }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
