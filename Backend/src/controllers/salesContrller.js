const Sale     = require('../models/Sale');
const mongoose = require('mongoose');

// GET /api/sales
exports.getSales = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.sale_type)    filter.sale_type    = req.query.sale_type;
    if (req.query.payment_mode) filter.payment_mode = req.query.payment_mode;
    if (req.query.date) {
      const d = new Date(req.query.date);
      const n = new Date(d); n.setDate(d.getDate() + 1);
      if (!isNaN(d)) filter.date = { $gte: d, $lt: n };
    }
    if (req.query.from && req.query.to) {
      filter.date = { $gte: new Date(req.query.from), $lte: new Date(req.query.to) };
    }
    const sales = await Sale.find(filter).sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/sales
exports.createSale = async (req, res) => {
  try {
    const { date, sale_type, items, discount, payment_mode, customer_name, supplier_trip_ref, notes } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ message: 'At least one sale item is required' });

    for (const item of items) {
      if (!item.product_type)  return res.status(400).json({ message: 'product_type is required per item' });
      if (!item.packing_type)  return res.status(400).json({ message: 'packing_type is required per item' });
      if (item.unit_price == null) return res.status(400).json({ message: 'unit_price is required per item' });
      if (!item.quantity)      return res.status(400).json({ message: 'quantity is required per item' });
    }

    const sale = new Sale({
      date:              date || new Date(),
      sale_type:         sale_type || 'shop',
      items,
      discount:          discount || 0,
      payment_mode:      payment_mode || 'cash',
      customer_name:     customer_name || '',
      supplier_trip_ref: supplier_trip_ref || undefined,
      notes:             notes || '',
      createdBy:         req.user._id
    });
    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/sales/:id
exports.updateSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/sales/:id
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/summary  — financial dashboard data
exports.getSalesSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // Date range (default: current month)
    const now       = new Date();
    const fromParam = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toParam   = req.query.to   ? new Date(req.query.to)   : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const matchRange = { createdBy: userId, date: { $gte: fromParam, $lte: toParam } };

    // Total revenue in range
    const [revenue] = await Sale.aggregate([
      { $match: matchRange },
      { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ]);

    // Today's revenue
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
    const [todayRev] = await Sale.aggregate([
      { $match: { createdBy: userId, date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ]);

    // Daily revenue trend (last 30 days)
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const dailyTrend = await Sale.aggregate([
      { $match: { createdBy: userId, date: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue:     { $sum: '$total_amount' },
          sale_count:  { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', revenue: 1, sale_count: 1 } }
    ]);

    // Revenue by product type
    const byProduct = await Sale.aggregate([
      { $match: matchRange },
      { $unwind: '$items' },
      {
        $group: {
          _id:          '$items.product_type',
          total_revenue: { $sum: '$items.total_price' },
          total_units:   { $sum: '$items.quantity' }
        }
      },
      { $sort: { total_revenue: -1 } }
    ]);

    // Revenue by payment mode
    const byPayment = await Sale.aggregate([
      { $match: matchRange },
      { $group: { _id: '$payment_mode', total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ]);

    // Best-selling packing types
    const byPackingType = await Sale.aggregate([
      { $match: matchRange },
      { $unwind: '$items' },
      {
        $group: {
          _id:          '$items.packing_type',
          total_units:  { $sum: '$items.quantity' },
          total_revenue: { $sum: '$items.total_price' }
        }
      },
      { $sort: { total_units: -1 } }
    ]);

    // Recent sales
    const recentSales = await Sale.find({ createdBy: userId })
      .sort({ date: -1 })
      .limit(10);

    res.json({
      period:         { from: fromParam, to: toParam },
      total_revenue:  revenue?.total   || 0,
      total_sales:    revenue?.count   || 0,
      today_revenue:  todayRev?.total  || 0,
      today_sales:    todayRev?.count  || 0,
      daily_trend:    dailyTrend,
      by_product:     byProduct,
      by_payment:     byPayment,
      by_packing_type: byPackingType,
      recent_sales:   recentSales
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};