const StockEntry = require('../models/StockEntry');
const PackedItem = require('../models/PackedItem');

// GET /api/stock
exports.getStockEntries = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.product_type) filter.product_type = req.query.product_type;

    const entries = await StockEntry.find(filter).sort({ date: -1 });
    res.json(entries);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/stock
exports.createStockEntry = async (req, res) => {
  const { date, product_type, produced_kg, notes } = req.body;
  try {
    // Opening stock = last closing stock FOR THE SAME PRODUCT TYPE
    const lastEntry = await StockEntry.findOne({
      createdBy: req.user._id,
      product_type
    }).sort({ date: -1 });

    const opening_stock_kg = lastEntry ? lastEntry.closing_stock_kg : 0;

    const entryDate = new Date(date);
    const nextDay = new Date(entryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Packed weight for this product type on this date
    const packedToday = await PackedItem.aggregate([
      {
        $match: {
          createdBy: req.user._id,
          product_type,
          date: { $gte: entryDate, $lt: nextDay }
        }
      },
      { $group: { _id: null, total: { $sum: '$total_weight_kg' } } }
    ]);

    const packed_kg = packedToday[0]?.total || 0;
    const closing_stock_kg = opening_stock_kg + Number(produced_kg) - packed_kg;

    const entry = await StockEntry.create({
      date,
      product_type,
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

// PUT /api/stock/:id
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