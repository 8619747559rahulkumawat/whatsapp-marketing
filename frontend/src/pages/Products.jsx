import { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineX, HiOutlineCurrencyRupee, HiOutlineTag } from 'react-icons/hi';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', sku: '', taxRate: 0 });

  const fetch = useCallback(async () => {
    const [p, c] = await Promise.all([
      API.get(`/products${filterCat ? `?category=${filterCat}` : ''}`),
      API.get('/products/categories')
    ]);
    if (p.data.success) setProducts(p.data.products);
    if (c.data.success) setCategories(c.data.categories);
  }, [filterCat]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await API.put(`/products/${editing._id}`, { ...form, price: parseFloat(form.price) });
      else await API.post('/products', { ...form, price: parseFloat(form.price) });
      setShowForm(false); setEditing(null);
      setForm({ name: '', description: '', price: '', category: '', sku: '', taxRate: 0 });
      fetch();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    await API.delete(`/products/${id}`);
    fetch();
  };

  const editProduct = (p) => {
    setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category || '', sku: p.sku || '', taxRate: p.taxRate || 0 });
    setEditing(p); setShowForm(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Products Catalog</h1>
        <div className="flex gap-3">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field text-sm">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', category: '', sku: '', taxRate: 0 }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap">
            <HiOutlinePlus /> Add Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p._id} className="glass-card rounded-xl p-5 hover:border-purple-500/30 transition-all border border-white/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{p.name}</h3>
                {p.sku && <p className="text-gray-500 text-xs">SKU: {p.sku}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => editProduct(p)} className="text-gray-500 hover:text-purple-400 p-1"><HiOutlinePencil size={15} /></button>
                <button onClick={() => handleDelete(p._id)} className="text-gray-500 hover:text-red-400 p-1"><HiOutlineTrash size={15} /></button>
              </div>
            </div>
            {p.description && <p className="text-gray-400 text-sm mb-3 line-clamp-2">{p.description}</p>}
            <div className="flex items-center justify-between">
              <span className="text-green-400 text-lg font-bold">₹{p.price?.toLocaleString()}</span>
              {p.category && <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full"><HiOutlineTag />{p.category}</span>}
            </div>
            {p.taxRate > 0 && <p className="text-xs text-gray-600 mt-1">Tax: {p.taxRate}%</p>}
          </div>
        ))}
        {products.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">No products yet</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-1"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Product Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input-field w-full" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="input-field w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Price *" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required className="input-field" />
                <input type="number" placeholder="Tax Rate %" value={form.taxRate} onChange={e => setForm({...form, taxRate: e.target.value})} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field" />
                <input type="text" placeholder="SKU" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-semibold">{editing ? 'Update' : 'Add'} Product</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
