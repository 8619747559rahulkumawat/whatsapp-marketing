import { useState } from 'react';
import API from '../utils/api';
import { HiOutlineEye } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

export default function MessagePreview() {
  const [template, setTemplate] = useState('');
  const [variables, setVariables] = useState([{ key: 'name', value: '' }, { key: 'phone', value: '' }]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const addVariable = () => setVariables([...variables, { key: '', value: '' }]);

  const removeVariable = (idx) => {
    if (variables.length <= 2) return;
    setVariables(variables.filter((_, i) => i !== idx));
  };

  const updateVariable = (idx, field, val) => {
    const updated = [...variables];
    updated[idx][field] = val;
    setVariables(updated);
  };

  const extractVars = () => {
    const matches = template.match(/{(\w+)}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const varsObj = {};
      variables.forEach(v => { if (v.key) varsObj[v.key] = v.value; });
      const { data } = await API.post('/preview/message', { template, variables: varsObj });
      setPreview(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Preview failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Message Preview</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Preview how your message will look before sending</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-4">Template</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Message Template</label>
              <textarea className="input-field h-32 resize-none font-mono text-sm"
                value={template}
                onChange={e => setTemplate(e.target.value)}
                placeholder="Namaste {name}! Aapka {phone} receive ho gaya."
              />
              <p className="text-xs text-gray-500 mt-1">Use {'{variable}'} for dynamic values</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Variables</label>
                <button onClick={addVariable} className="text-xs text-purple-400 hover:text-purple-300">+ Add</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {variables.map((v, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="input-field w-2/5 text-sm" placeholder="key" value={v.key}
                      onChange={e => updateVariable(idx, 'key', e.target.value)} />
                    <input className="input-field flex-1 text-sm" placeholder="value" value={v.value}
                      onChange={e => updateVariable(idx, 'value', e.target.value)} />
                    {variables.length > 2 && (
                      <button onClick={() => removeVariable(idx)} className="text-red-400 text-sm px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handlePreview} disabled={loading || !template} className="btn-primary w-full flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm">
              {loading ? <span className="animate-spin">⟳</span> : <HiOutlineEye />}
              {loading ? 'Rendering...' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-white font-semibold mb-4">Preview</h2>
          {preview ? (
            <div className="space-y-4">
              <div className="bg-[#0a0a1a] rounded-xl p-4 border border-white/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <FaWhatsapp className="text-white text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/10 rounded-2xl rounded-tl-none p-4">
                      <p className="text-white whitespace-pre-wrap break-words">{preview.preview}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">via WhatsApp</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400">Characters</p>
                  <p className="text-white font-bold">{preview.characterCount}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400">Segments</p>
                  <p className="text-white font-bold">{Math.ceil(preview.characterCount / 160) || 1}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Enter a template and click Preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
