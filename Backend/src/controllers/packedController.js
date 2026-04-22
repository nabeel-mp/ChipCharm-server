const PackedItem = require('../models/PackedItem');
const StockEntry = require('../models/StockEntry');
const mongoose   = require('mongoose');

// GET /api/packed
exports.getPackedItems = async (req, res) => {
  try {
    if (!req.user || !req.user._id)
      return res.status(401).json({ message: 'Not authenticated' });

    const { status, type, date, product_type, supplier_name, destination } = req.query;
    const filter = { createdBy: req.user._id };
    if (status)        filter.status       = status;
    if (type)          filter.packing_type = type;
    if (product_type)  filter.product_type = product_type;
    if (supplier_name) filter.supplier_name = new RegExp(supplier_name, 'i');
    if (destination)   filter.destination   = new RegExp(destination, 'i');
    if (date) {
      const d    = new Date(date);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      if (!isNaN(d)) filter.date = { $gte: d, $lt: next };
    }

    const items = await PackedItem.find(filter).sort({ date: -1 });
    res.json(items);
  } catch (err) {
    console.error('getPackedItems error:', err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/packed  — deducts bulk stock from StockEntry
exports.createPackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id)
      throw new Error('Not authenticated');

    const {
      date, product_type, packing_type,
      weight_per_unit_grams, quantity,
      status, label, stockEntry,
      destination, supplier_name
    } = req.body;

    if (!product_type)   throw new Error('product_type is required');
    if (!packing_type)   throw new Error('packing_type is required');
    if (weight_per_unit_grams == null || isNaN(weight_per_unit_grams))
      throw new Error('weight_per_unit_grams must be a valid number');
    if (quantity == null || isNaN(quantity))
      throw new Error('quantity must be a valid number');

    const weightNum   = Number(weight_per_unit_grams);
    const quantityNum = Number(quantity);
    const total_weight_kg = (weightNum * quantityNum) / 1000;

    // ── Find the latest StockEntry for this product that has available stock ──
    const latestEntry = await StockEntry
      .findOne({
        createdBy:    req.user._id,
        product_type,
        closing_stock_kg: { $gte: total_weight_kg }
      })
      .sort({ date: -1 });

    if (!latestEntry) {
      const anyEntry = await StockEntry
        .findOne({ createdBy: req.user._id, product_type })
        .sort({ date: -1 });

      const available = anyEntry ? anyEntry.closing_stock_kg : 0;
      throw new Error(
        `Insufficient stock for ${product_type}. ` +
        `Required: ${total_weight_kg.toFixed(3)} kg, Available: ${available.toFixed(3)} kg`
      );
    }

    // Deduct from closing_stock_kg
    latestEntry.closing_stock_kg -= total_weight_kg;
    latestEntry.packed_kg         = (latestEntry.packed_kg || 0) + total_weight_kg;
    await latestEntry.save();

    // Create packed item
    const itemData = {
      date:                  date || new Date(),
      product_type,
      packing_type,
      weight_per_unit_grams: weightNum,
      quantity:              quantityNum,
      total_weight_kg,
      status:                status || 'in_shop',
      label:                 label || '',
      destination:           destination || '',
      supplier_name:         supplier_name || '',
      createdBy:             req.user._id
    };
    if (stockEntry) itemData.stockEntry = stockEntry;

    const item = new PackedItem(itemData);
    await item.save();

    res.status(201).json({
      ...item.toObject(),
      stock_deducted_kg:      total_weight_kg,
      remaining_stock_kg:     latestEntry.closing_stock_kg
    });
  } catch (err) {
    console.error('createPackedItem error:', err);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    const isBusinessErr = err.message.includes('stock') ||
                          err.message.includes('required') ||
                          err.message.includes('authenticated');
    res.status(isBusinessErr ? 400 : 500).json({ message: err.message });
  }
};

// PUT /api/packed/:id
exports.updatePackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id)
      return res.status(401).json({ message: 'Not authenticated' });

    const updateData = { ...req.body };

    if (updateData.status === 'returned' && !updateData.return_reason)
      updateData.return_reason = 'other';

    if (updateData.weight_per_unit_grams != null || updateData.quantity != null) {
      const existing = await PackedItem.findById(req.params.id);
      if (existing) {
        const w = Number(updateData.weight_per_unit_grams ?? existing.weight_per_unit_grams);
        const q = Number(updateData.quantity              ?? existing.quantity);
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
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/packed/:id  — restores stock on delete
exports.deletePackedItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id)
      return res.status(401).json({ message: 'Not authenticated' });

    const item = await PackedItem.findOne({
      _id: req.params.id, createdBy: req.user._id
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Restore stock
    const latestEntry = await StockEntry
      .findOne({ createdBy: req.user._id, product_type: item.product_type })
      .sort({ date: -1 });

    if (latestEntry) {
      latestEntry.closing_stock_kg += item.total_weight_kg;
      latestEntry.packed_kg         = Math.max(0, (latestEntry.packed_kg || 0) - item.total_weight_kg);
      await latestEntry.save();
    }

    await item.deleteOne();
    res.json({ message: 'Deleted', stock_restored_kg: item.total_weight_kg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/packed/summary
exports.getPackedSummary = async (req, res) => {
  try {
    if (!req.user || !req.user._id)
      return res.status(401).json({ message: 'Not authenticated' });

    const userId = new mongoose.Types.ObjectId(req.user._id);
    const summary = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: { product_type: '$product_type', status: '$status' },
          total_units: { $sum: '$quantity' },
          total_kg:    { $sum: '$total_weight_kg' }
        }
      },
      { $sort: { '_id.product_type': 1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/packed/available-stock  — current available bulk stock per product
exports.getAvailableStock = async (req, res) => {
  try {
    const PRODUCT_TYPES = [
      'Salted Banana Chips','Spicy Banana Chips','Sweet Banana Chips','Banana 4 Cut','Jaggery'
    ];
    const userId = req.user._id;
    const stocks = await Promise.all(
      PRODUCT_TYPES.map(async pt => {
        const entry = await StockEntry
          .findOne({ createdBy: userId, product_type: pt })
          .sort({ date: -1 });
        return {
          product_type:      pt,
          available_kg:      entry ? entry.closing_stock_kg : 0,
          last_produced_kg:  entry ? entry.produced_kg      : 0,
          last_entry_date:   entry ? entry.date             : null
        };
      })
    );
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};