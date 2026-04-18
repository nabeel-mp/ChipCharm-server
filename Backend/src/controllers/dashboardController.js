const StockEntry = require('../models/StockEntry');
const PackedItem = require('../models/PackedItem');

// GET /api/dashboard/summary
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Latest stock entry (today's closing stock)
    const latestEntry = await StockEntry.findOne({ createdBy: userId })
      .sort({ date: -1 });

    // Packed item totals by status
    const packedSummary = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$status',
          total_units: { $sum: '$quantity' },
          total_kg:    { $sum: '$total_weight_kg' }
        }
      }
    ]);

    // Packed by type
    const byType = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$packing_type',
          total_units: { $sum: '$quantity' },
          total_kg:    { $sum: '$total_weight_kg' }
        }
      }
    ]);

    // Last 7 days production
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyProduction = await StockEntry.find({
      createdBy: userId,
      date: { $gte: sevenDaysAgo }
    }).sort({ date: 1 }).select('date produced_kg closing_stock_kg');

    res.json({
      current_stock_kg:   latestEntry?.closing_stock_kg ?? 0,
      opening_stock_kg:   latestEntry?.opening_stock_kg ?? 0,
      todays_produced_kg: latestEntry?.produced_kg ?? 0,
      packed_summary:     packedSummary,
      by_type:            byType,
      weekly_production:  weeklyProduction
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};