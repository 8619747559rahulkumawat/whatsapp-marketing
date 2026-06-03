exports.previewMessage = async (req, res) => {
  try {
    const { template, variables = {} } = req.body;
    if (!template) return res.status(400).json({ success: false, message: 'Template text required' });

    let rendered = template;
    for (const [key, val] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val || '');
      rendered = rendered.replace(new RegExp(`{${key}}`, 'gi'), val || '');
    }

    res.json({ success: true, preview: rendered, characterCount: rendered.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
