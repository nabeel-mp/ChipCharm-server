const PackedItem = require('../models/PackedItem');

// GET /api/packed
exports.getPackedItems = async (req, res) => {
  try {
    const { status, type, date } = req.query;
    const filter = { createdBy: req.user._id };
    if (status) filter.status = status;
    if (type)   filter.packing_type = type;
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }
    const items = await PackedItem.find(filter).sort({ date: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/packed
exports.createPackedItem = async (req, res) => {
  const { date, packing_type, weight_per_unit_grams,
          quantity, status, label, stockEntry } = req.body;
  try {
    const item = await PackedItem.create({
      date, packing_type, weight_per_unit_grams,
      quantity, status, label, stockEntry,
      createdBy: req.user._id
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/packed/:id  — e.g. mark as sold/sample
exports.updatePackedItem = async (req, res) => {
  try {
    const item = await PackedItem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch {
    res.status(500).json({ message: 'Server error' });
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