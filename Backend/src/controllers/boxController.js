const Box        = require('../models/Box');
const StockEntry = require('../models/StockEntry');
const mongoose   = require('mongoose');

// GET /api/boxes
exports.getBoxes = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.product_type) filter.product_type = req.query.product_type;
    if (req.query.date) {
      const d = new Date(req.query.date);
      const n = new Date(d); n.setDate(d.getDate() + 1);
      filter.date = { $gte: d, $lt: n };
    }
    const boxes = await Box.find(filter).sort({ date: -1 });
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/boxes
exports.createBox = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      date, product_type, boxes_packed,
      units_per_box = 18,
      weight_per_unit_grams = 500,
      notes
    } = req.body;

    if (!product_type)  throw new Error('product_type is required');
    if (!boxes_packed || boxes_packed < 1) throw new Error('boxes_packed must be >= 1');

    const totalUnits    = boxes_packed * units_per_box;
    const totalWeightKg = (totalUnits * weight_per_unit_grams) / 1000;

    // Check + deduct stock
    const latestEntry = await StockEntry
      .findOne({
        createdBy: req.user._id,
        product_type,
        closing_stock_kg: { $gte: totalWeightKg }
      })
      .sort({ date: -1 })
      .session(session);

    if (!latestEntry) {
      const anyEntry = await StockEntry
        .findOne({ createdBy: req.user._id, product_type })
        .sort({ date: -1 })
        .session(session);
      const available = anyEntry ? anyEntry.closing_stock_kg : 0;
      throw new Error(
        `Insufficient stock for ${product_type}. ` +
        `Need ${totalWeightKg.toFixed(2)} kg, have ${available.toFixed(2)} kg`
      );
    }

    latestEntry.closing_stock_kg -= totalWeightKg;
    latestEntry.packed_kg         = (latestEntry.packed_kg || 0) + totalWeightKg;
    await latestEntry.save({ session });

    const box = new Box({
      date:                  date || new Date(),
      product_type,
      boxes_packed:          Number(boxes_packed),
      units_per_box:         Number(units_per_box),
      weight_per_unit_grams: Number(weight_per_unit_grams),
      notes:                 notes || '',
      createdBy:             req.user._id
    });
    await box.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      ...box.toObject(),
      stock_deducted_kg:  totalWeightKg,
      remaining_stock_kg: latestEntry.closing_stock_kg
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('createBox error:', err);
    res.status(err.message.includes('stock') || err.message.includes('required') ? 400 : 500)
      .json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// DELETE /api/boxes/:id  — restores stock
exports.deleteBox = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const box = await Box.findOne({ _id: req.params.id, createdBy: req.user._id }).session(session);
    if (!box) { await session.abortTransaction(); return res.status(404).json({ message: 'Box not found' }); }

    const latestEntry = await StockEntry
      .findOne({ createdBy: req.user._id, product_type: box.product_type })
      .sort({ date: -1 })
      .session(session);

    if (latestEntry) {
      latestEntry.closing_stock_kg += box.total_weight_kg;
      latestEntry.packed_kg         = Math.max(0, (latestEntry.packed_kg || 0) - box.total_weight_kg);
      await latestEntry.save({ session });
    }

    await box.deleteOne({ session });
    await session.commitTransaction();
    res.json({ message: 'Deleted', stock_restored_kg: box.total_weight_kg });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/boxes/summary
exports.getBoxSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const summary = await Box.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$product_type',
          total_boxes:      { $sum: '$boxes_packed' },
          total_units:      { $sum: '$total_units' },
          total_weight_kg:  { $sum: '$total_weight_kg' }
        }
      }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};