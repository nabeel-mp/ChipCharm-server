const StockEntry = require('../models/StockEntry');
const PackedItem = require('../models/PackedItem');

const PRODUCT_TYPES = [
  'Salted Banana Chips',
  'Spicy Banana Chips',
  'Sweet Banana Chips',
  'Banana 4 Cut',
  'Jaggery'
];

// GET /api/dashboard/summary
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Latest stock entry per product
    const latestEntries = await Promise.all(
      PRODUCT_TYPES.map(pt =>
        StockEntry.findOne({ createdBy: userId, product_type: pt })
          .sort({ date: -1 })
      )
    );

    // Total current stock across all products
    const current_stock_kg = latestEntries.reduce(
      (sum, e) => sum + (e?.closing_stock_kg || 0), 0
    );

    // Today's production
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    const todayProduced = await StockEntry.aggregate([
      {
        $match: {
          createdBy: userId,
          date: { $gte: todayStart, $lt: todayEnd }
        }
      },
      { $group: { _id: null, total: { $sum: '$produced_kg' } } }
    ]);

    // Packed summary by status
    const packedSummary = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$status',
          total_units: { $sum: '$quantity' },
          total_kg: { $sum: '$total_weight_kg' }
        }
      }
    ]);

    // Packed summary by product type
    const packedByProduct = await PackedItem.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$product_type',
          in_shop: {
            $sum: { $cond: [{ $eq: ['$status', 'in_shop'] }, '$quantity', 0] }
          },
          with_supplier: {
            $sum: { $cond: [{ $eq: ['$status', 'with_supplier'] }, '$quantity', 0] }
          },
          sold: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$quantity', 0] }
          },
          sample: {
            $sum: { $cond: [{ $eq: ['$status', 'sample'] }, '$quantity', 0] }
          },
          returned: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, '$quantity', 0] }
          },
          damaged: {
            $sum: { $cond: [{ $eq: ['$status', 'damaged'] }, '$quantity', 0] }
          }
        }
      }
    ]);

    // Returns this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentReturns = await PackedItem.find({
      createdBy: userId,
      status: { $in: ['returned', 'damaged'] },
      updatedAt: { $gte: weekAgo }
    }).sort({ updatedAt: -1 }).limit(10);

    // 7-day production chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyProduction = await StockEntry.aggregate([
      {
        $match: {
          createdBy: userId,
          date: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
          },
          produced_kg: { $sum: '$produced_kg' }
        }
      },
      { $sort: { '_id.date': 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          produced_kg: 1
        }
      }
    ]);

    // Per product current stock
    const stockByProduct = latestEntries.map((e, i) => ({
      product_type: PRODUCT_TYPES[i],
      closing_stock_kg: e?.closing_stock_kg || 0,
      produced_kg: e?.produced_kg || 0
    }));

    res.json({
      current_stock_kg,
      todays_produced_kg: todayProduced[0]?.total || 0,
      packed_summary: packedSummary,
      packed_by_product: packedByProduct,
      stock_by_product: stockByProduct,
      recent_returns: recentReturns,
      weekly_production: weeklyProduction
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};