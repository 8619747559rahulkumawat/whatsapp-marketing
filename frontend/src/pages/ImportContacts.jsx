import { useState, useRef, useEffect } from 'react';
import API from '../utils/api';
import { HiOutlineUpload, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineDownload } from 'react-icons/hi';

export default function ImportContacts() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    API.get('/contacts/groups').then(({ data }) => {
      if (data.success) setGroups(data.groups || []);
    }).catch(() => {});
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (groupId) fd.append('groupId', groupId);
      const { data } = await API.post('/import-contacts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Import failed');
    } finally { setUploading(false); }
  };

  const downloadSample = () => {
    const csv = 'phone,name,email\n919876543210,Test User,test@email.com\n919876543211,Another User,another@email.com';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_import.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Import Contacts</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Upload CSV or Excel file to bulk add contacts</p>
        </div>
        <button onClick={downloadSample} className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <HiOutlineDownload /> Sample CSV
        </button>
      </div>

      <div className="glass-card p-4 sm:p-6 max-w-xl">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Contact Group (optional)</label>
          <select className="input-field" value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">No group</option>
            {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${dragging ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-purple-500/50'}`}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <div>
              <HiOutlineCheckCircle className="mx-auto text-3xl text-green-400 mb-2" />
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <HiOutlineUpload className="mx-auto text-3xl text-gray-500 mb-2" />
              <p className="text-gray-400">Drop file here or click to browse</p>
              <p className="text-gray-500 text-sm mt-1">Supports CSV, XLSX, XLS</p>
            </div>
          )}
        </div>

        <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary w-full mt-4 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm">
          {uploading ? <span className="animate-spin">⟳</span> : <HiOutlineUpload />}
          {uploading ? 'Importing...' : 'Import Contacts'}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-white/5 rounded-xl space-y-2">
            <h3 className="text-white font-semibold mb-3">Import Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-xl sm:text-2xl font-bold text-white">{result.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-xl sm:text-2xl font-bold text-green-400">{result.imported}</p>
                <p className="text-xs text-gray-400">Imported</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-xl sm:text-2xl font-bold text-yellow-400">{result.skipped}</p>
                <p className="text-xs text-gray-400">Skipped (duplicates)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
