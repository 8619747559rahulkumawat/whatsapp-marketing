export default function FormField({ label, name, type = 'text', value, onChange, onBlur, error, placeholder, required, className = '', children }) {
  const inputId = `field-${name}`;
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      {children ? children : (
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2.5 rounded-xl bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors text-sm`}
        />
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
