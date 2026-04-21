const StockEntry = require('../models/StockEntry');
const PackedItem = require('../models/PackedItem');
const mongoose   = require('mongoose');

// GET /api/stock
exports.getStockEntries = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.product_type) filter.product_type = req.query.product_type;

    const entries = await StockEntry.find(filter).sort({ date: -1 });
    res.json(entries);
  } catch (err) {
    console.error('getStockEntries error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/stock
exports.createStockEntry = async (req, res) => {
  const { date, product_type, produced_kg, notes } = req.body;
  try {
    const userId = req.user._id;

    // Opening stock = last closing stock for this product type
    const lastEntry = await StockEntry.findOne({
      createdBy: userId,
      product_type
    }).sort({ date: -1 });

    const opening_stock_kg = lastEntry ? lastEntry.closing_stock_kg : 0;

    const entryDate = new Date(date);
    const nextDay   = new Date(entryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Packed weight for this product type on this date
    const userObjId = new mongoose.Types.ObjectId(userId);
    const packedToday = await PackedItem.aggregate([
      {
        $match: {
          createdBy:    userObjId,
          product_type,
          date: { $gte: entryDate, $lt: nextDay }
        }
      },
      { $group: { _id: null, total: { $sum: '$total_weight_kg' } } }
    ]);

    const packed_kg        = packedToday[0]?.total || 0;
    const closing_stock_kg = opening_stock_kg + Number(produced_kg) - packed_kg;

    // Insert directly via collection to avoid session issues on standalone MongoDB
    const doc = {
      date:              entryDate,
      product_type,
      produced_kg:       Number(produced_kg),
      opening_stock_kg,
      closing_stock_kg,
      notes:             notes || '',
      createdBy:         userObjId,
      createdAt:         new Date(),
      updatedAt:         new Date()
    };

    const result = await StockEntry.collection.insertOne(doc);
    const entry  = await StockEntry.findById(result.insertedId);

    res.status(201).json(entry);
  } catch (err) {
    console.error('createStockEntry error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/stock/:id
exports.updateStockEntry = async (req, res) => {
  try {
    const entry = await StockEntry.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('updateStockEntry error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/stock/:id
exports.deleteStockEntry = async (req, res) => {
  try {
    const result = await StockEntry.collection.deleteOne({
      _id:       new mongoose.Types.ObjectId(req.params.id),
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteStockEntry error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};