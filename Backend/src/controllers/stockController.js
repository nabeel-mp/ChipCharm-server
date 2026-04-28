const StockEntry = require('../models/StockEntry');
const PackedItem = require('../models/PackedItem');
const mongoose   = require('mongoose');

// GET /api/stock
exports.getStockEntries = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.product_type) filter.product_type = req.query.product_type;

    // FIX: Added createdAt: -1 to ensure the absolute latest entry of the day is always first
    const entries = await StockEntry.find(filter).sort({ date: -1, createdAt: -1 });
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
    const userObjId = new mongoose.Types.ObjectId(userId);

    const entryDate = new Date(date);
    
    // Create day boundaries for querying
    const startOfDay = new Date(entryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(startOfDay);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Check if an entry already exists for this date and product
    const existingEntry = await StockEntry.findOne({
      createdBy: userId,
      product_type,
      date: { $gte: startOfDay, $lt: nextDay }
    });

    if (existingEntry) {
      existingEntry.produced_kg += Number(produced_kg);
      existingEntry.closing_stock_kg += Number(produced_kg);
      if (notes) {
        existingEntry.notes = existingEntry.notes ? existingEntry.notes + ' | ' + notes : notes;
      }
      existingEntry.updatedAt = new Date();
      await existingEntry.save();

      // Update all future entries
      await StockEntry.updateMany(
        { createdBy: userId, product_type, date: { $gte: nextDay } },
        { $inc: { opening_stock_kg: Number(produced_kg), closing_stock_kg: Number(produced_kg) } }
      );

      return res.status(200).json(existingEntry);
    }

    // 2. If no entry exists for this date, find the latest entry BEFORE this date
    const lastEntryBefore = await StockEntry.findOne({
      createdBy: userId,
      product_type,
      date: { $lt: startOfDay }
    }).sort({ date: -1, createdAt: -1 });

    const opening_stock_kg = lastEntryBefore ? lastEntryBefore.closing_stock_kg : 0;
    const closing_stock_kg = opening_stock_kg + Number(produced_kg); 
    // removed double-deduction of packedToday as packed items adjust closing_stock_kg dynamically via packedController

    const doc = {
      date:              entryDate,
      product_type,
      produced_kg:       Number(produced_kg),
      opening_stock_kg,
      closing_stock_kg,
      packed_kg:         0,
      notes:             notes || '',
      createdBy:         userObjId,
      createdAt:         new Date(),
      updatedAt:         new Date()
    };

    const result = await StockEntry.collection.insertOne(doc);
    const entry  = await StockEntry.findById(result.insertedId);

    // 3. Update any future entries since we inserted stock in the timeline
    await StockEntry.updateMany(
      { createdBy: userId, product_type, date: { $gte: nextDay } },
      { $inc: { opening_stock_kg: Number(produced_kg), closing_stock_kg: Number(produced_kg) } }
    );

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
    const entry = await StockEntry.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });
    
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const produced_kg = entry.produced_kg || 0;
    const product_type = entry.product_type;
    
    const entryDate = entry.date;
    const startOfNextDay = new Date(entryDate);
    startOfNextDay.setHours(0, 0, 0, 0);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    await StockEntry.collection.deleteOne({ _id: entry._id });

    // Decrease the stock from all future entries
    if (produced_kg > 0) {
      await StockEntry.updateMany(
        { createdBy: req.user._id, product_type, date: { $gte: startOfNextDay } },
        { $inc: { opening_stock_kg: -produced_kg, closing_stock_kg: -produced_kg } }
      );
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteStockEntry error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};