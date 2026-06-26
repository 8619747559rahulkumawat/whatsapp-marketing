exports.previewMessage = async (req, res) => {
  try {
    const { template, variables = {} } = req.body;
    if (!template) return res.status(400).json({ success: false, message: 'Template text required' });

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let rendered = template;
    for (const [key, val] of Object.entries(variables)) {
      const safeKey = escapeRegex(key);
      rendered = rendered.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, 'gi'), val || '');
      rendered = rendered.replace(new RegExp(`{${safeKey}}`, 'gi'), val || '');
    }

    res.json({ success: true, preview: rendered, characterCount: rendered.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
