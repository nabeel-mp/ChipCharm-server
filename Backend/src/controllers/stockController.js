const StockEntry  = require('../models/StockEntry');
const PackedItem  = require('../models/PackedItem');

// GET /api/stock  — list all entries (newest first)
exports.getStockEntries = async (req, res) => {
  try {
    const entries = await StockEntry.find({ createdBy: req.user._id })
      .sort({ date: -1 });
    res.json(entries);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/stock  — create daily production entry
exports.createStockEntry = async (req, res) => {
  const { date, produced_kg, notes } = req.body;
  try {
    // Find previous entry to set opening stock
    const lastEntry = await StockEntry.findOne({ createdBy: req.user._id })
      .sort({ date: -1 });

    const opening_stock_kg = lastEntry ? lastEntry.closing_stock_kg : 0;

    // Total packed KG for that day (from PackedItems)
    const entryDate = new Date(date);
    const nextDay   = new Date(entryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const packedToday = await PackedItem.aggregate([
      {
        $match: {
          createdBy: req.user._id,
          date: { $gte: entryDate, $lt: nextDay }
        }
      },
      { $group: { _id: null, total: { $sum: '$total_weight_kg' } } }
    ]);

    const packed_kg = packedToday[0]?.total || 0;
    const closing_stock_kg = opening_stock_kg + produced_kg - packed_kg;

    const entry = await StockEntry.create({
      date,
      produced_kg,
      opening_stock_kg,
      closing_stock_kg,
      notes,
      createdBy: req.user._id
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/stock/:id  — update an entry
exports.updateStockEntry = async (req, res) => {
  try {
    const entry = await StockEntry.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/stock/:id
exports.deleteStockEntry = async (req, res) => {
  try {
    const entry = await StockEntry.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};