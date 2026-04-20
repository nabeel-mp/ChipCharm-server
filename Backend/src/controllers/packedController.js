const PackedItem = require('../models/PackedItem');
const mongoose = require('mongoose');

// GET /api/packed
exports.getPackedItems = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found. Please log in again.' });
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
      if (!isNaN(d.valueOf())) {
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        filter.date = { $gte: d, $lt: next };
      }
    }

    const items = await PackedItem.find(filter).sort({ date: -1 });
    res.json(items);
  } catch (err) {
    console.error('🔥 CRASH in getPackedItems:', err);
    res.status(500).json({ message: err.message || 'Server error fetching packed items' });
  }
};

// POST /api/packed
exports.createPackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found. Please log in again.' });
    }

    const {
      date, product_type, packing_type, weight_per_unit_grams,
      quantity, status, label, stockEntry,
      destination, supplier_name
    } = req.body;

    if (!product_type) return res.status(400).json({ message: 'product_type is required' });
    if (!packing_type) return res.status(400).json({ message: 'packing_type is required' });
    if (weight_per_unit_grams == null || isNaN(weight_per_unit_grams)) {
      return res.status(400).json({ message: 'weight_per_unit_grams must be a valid number' });
    }
    if (quantity == null || isNaN(quantity)) {
      return res.status(400).json({ message: 'quantity must be a valid number' });
    }

    const weightNum   = Number(weight_per_unit_grams);
    const quantityNum = Number(quantity);
    const total_weight_kg = (weightNum * quantityNum) / 1000;

    const itemData = {
      date: date || new Date(),
      product_type,
      packing_type,
      weight_per_unit_grams: weightNum,
      quantity: quantityNum,
      total_weight_kg,
      status: status || 'in_shop',
      label: label || '',
      destination: destination || '',
      supplier_name: supplier_name || '',
      createdBy: req.user._id
    };
    if (stockEntry) itemData.stockEntry = stockEntry;

    const item = new PackedItem(itemData);
    await item.save();

    res.status(201).json(item);
  } catch (err) {
    console.error('🔥 CRASH in createPackedItem:', err);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message || 'Server error creating packed item' });
  }
};

// PUT /api/packed/:id
exports.updatePackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found. Please log in again.' });
    }

    const updateData = { ...req.body };

    if (updateData.status === 'returned' && !updateData.return_reason) {
      updateData.return_reason = 'other';
    }

    if (updateData.weight_per_unit_grams != null || updateData.quantity != null) {
      const existing = await PackedItem.findById(req.params.id);
      if (existing) {
        const w = Number(updateData.weight_per_unit_grams || existing.weight_per_unit_grams);
        const q = Number(updateData.quantity || existing.quantity);
        updateData.total_weight_kg = (w * q) / 1000;
      }
    }

    const item = await PackedItem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      updateData,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('🔥 CRASH in updatePackedItem:', err);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message || 'Server error updating packed item' });
  }
};

// DELETE /api/packed/:id
exports.deletePackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found. Please log in again.' });
    }

    const item = await PackedItem.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('🔥 CRASH in deletePackedItem:', err);
    res.status(500).json({ message: err.message || 'Server error deleting packed item' });
  }
};

// GET /api/packed/summary
exports.getPackedSummary = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication error: User not found. Please log in again.' });
    }

    const userId = new mongoose.Types.ObjectId(req.user._id);
    const summary = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
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
    console.error('🔥 CRASH in getPackedSummary:', err);
    res.status(500).json({ message: err.message || 'Server error fetching packed summary' });
  }
};