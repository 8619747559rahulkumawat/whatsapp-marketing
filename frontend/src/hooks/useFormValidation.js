import { useState } from 'react';

const validators = {
  required: (v) => (v && v.trim ? v.trim() : v) ? null : 'This field is required',
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email',
  phone: (v) => /^[\d\+\-\(\)\s]{10,15}$/.test(v) ? null : 'Invalid phone number',
  minLength: (min) => (v) => (v && v.length >= min) ? null : `Minimum ${min} characters`,
  maxLength: (max) => (v) => (v && v.length <= max) ? null : `Maximum ${max} characters`,
  number: (v) => v && isNaN(Number(v)) ? 'Must be a number' : null,
  url: (v) => !v || /^https?:\/\/.+/.test(v) ? null : 'Invalid URL',
  match: (other, label) => (v, form) => v === form[other] ? null : `Must match ${label || other}`,
};

export function useFormValidation(fields, config = {}) {
  const [form, setForm] = useState(() => {
    const obj = {};
    fields.forEach(f => { obj[f.name] = f.default || ''; });
    return obj;
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    const field = fields.find(f => f.name === name);
    if (!field) return null;
    const rules = field.rules || [];
    for (const rule of rules) {
      const validatorFn = typeof rule === 'function' ? rule : validators[rule];
      if (!validatorFn) continue;
      const err = validatorFn(value, form);
      if (err) return err;
    }
    return null;
  };

  const validateAll = () => {
    const newErrors = {};
    let valid = true;
    fields.forEach(f => {
      const err = validateField(f.name, form[f.name]);
      if (err) { newErrors[f.name] = err; valid = false; }
    });
    setErrors(newErrors);
    setTouched(Object.fromEntries(fields.map(f => [f.name, true])));
    return valid;
  };

  const handleChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const err = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const err = validateField(name, form[name]);
    setErrors(prev => ({ ...prev, [name]: err }));
  };

  const reset = () => {
    const obj = {};
    fields.forEach(f => { obj[f.name] = f.default || ''; });
    setForm(obj);
    setErrors({});
    setTouched({});
  };

  const setFieldValue = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return { form, errors, touched, handleChange, handleBlur, validateAll, reset, setFieldValue, setForm };
}
