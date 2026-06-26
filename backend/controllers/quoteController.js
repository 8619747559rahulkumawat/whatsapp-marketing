const Quote = require('../models/Quote');
const Activity = require('../models/Activity');

function generateQuoteNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `Q-${ts}-${rand}`;
}

exports.getQuotes = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { quoteNumber: { $regex: req.query.search, $options: 'i' } },
        { contactName: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    const quotes = await Quote.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, quotes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuote = async (req, res) => {
  try {
    const quote = await Quote.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createQuote = async (req, res) => {
  try {
    const items = req.body.items || [];
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    const processedItems = items.map(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTax = itemSubtotal * (item.taxRate / 100);
      subtotal += itemSubtotal;
      taxTotal += itemTax;
      discountTotal += item.discount || 0;
      return {
        productId: item.productId,
        productName: item.productName,
        description: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0
      };
    });
    const grandTotal = subtotal + taxTotal - discountTotal;
    const quote = await Quote.create({
      ...req.body,
      items: processedItems,
      subtotal, taxTotal, discountTotal, grandTotal,
      quoteNumber: generateQuoteNumber(),
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    await Activity.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: req.body.contactId,
      dealId: req.body.dealId,
      type: 'quote',
      title: `Quote created: ${quote.quoteNumber}`,
      description: `Amount: ₹${grandTotal}`,
      metadata: { quoteId: quote._id, quoteNumber: quote.quoteNumber, amount: grandTotal }
    });
    res.status(201).json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateQuote = async (req, res) => {
  try {
    const items = req.body.items;
    if (items) {
      let subtotal = 0, taxTotal = 0, discountTotal = 0;
      items.forEach(item => {
        const itemSubtotal = item.quantity * item.unitPrice;
        subtotal += itemSubtotal;
        taxTotal += itemSubtotal * (item.taxRate / 100);
        discountTotal += item.discount || 0;
      });
      req.body.subtotal = subtotal;
      req.body.taxTotal = taxTotal;
      req.body.discountTotal = discountTotal;
      req.body.grandTotal = subtotal + taxTotal - discountTotal;
    }
    const quote = await Quote.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const quote = await Quote.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, message: 'Quote deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const data = { status, updatedAt: new Date() };
    if (status === 'sent') data.sentAt = new Date();
    if (status === 'accepted') data.acceptedAt = new Date();
    const quote = await Quote.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenant._id }, data, { new: true });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
