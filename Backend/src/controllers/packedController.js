const PackedItem = require('../models/PackedItem');

// GET /api/packed
exports.getPackedItems = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found.' });
    }
    const { status, type, date, product_type, supplier_name, destination } = req.query;
    const filter = { createdBy: req.user._id };

    if (status) filter.status = status;
    if (type) filter.packing_type = type;
    if (product_type) filter.product_type = product_type;
    if (supplier_name) filter.supplier_name = new RegExp(supplier_name, 'i');
    if (destination) filter.destination = new RegExp(destination, 'i');
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }

    const items = await PackedItem.find(filter).sort({ date: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/packed
exports.createPackedItem = async (req, res) => {
  const {
    date, product_type, packing_type, weight_per_unit_grams,
    quantity, status, label, stockEntry,
    destination, supplier_name
  } = req.body;
  try {
    const item = await PackedItem.create({
      date, product_type, packing_type, weight_per_unit_grams,
      quantity, status, label, stockEntry,
      destination: destination || '',
      supplier_name: supplier_name || '',
      createdBy: req.user._id
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/packed/:id — update status, mark return, etc.
exports.updatePackedItem = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // If marking as returned, record reason
    if (updateData.status === 'returned' && !updateData.return_reason) {
      updateData.return_reason = 'other';
    }

    const item = await PackedItem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      updateData,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/packed/:id
exports.deletePackedItem = async (req, res) => {
  try {
    const item = await PackedItem.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/packed/summary — totals grouped by product+status
exports.getPackedSummary = async (req, res) => {
  try {
    const summary = await PackedItem.aggregate([
      { $match: { createdBy: req.user._id } },
      {
        $group: {
          _id: { product_type: '$product_type', status: '$status' },
          total_units: { $sum: '$quantity' },
          total_kg: { $sum: '$total_weight_kg' }
        }
      },
      { $sort: { '_id.product_type': 1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};