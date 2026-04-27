const SupplierTrip = require('../models/Suppliertrip');
const PackedItem   = require('../models/PackedItem');
const mongoose     = require('mongoose');

// GET /api/supplier-trips
exports.getTrips = async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.supplier_name)
      filter.supplier_name = new RegExp(req.query.supplier_name, 'i');
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const d = new Date(req.query.date);
      const n = new Date(d); n.setDate(d.getDate() + 1);
      filter.date = { $gte: d, $lt: n };
    }
    const trips = await SupplierTrip.find(filter).sort({ date: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/supplier-trips/:id
exports.getTrip = async (req, res) => {
  try {
    const trip = await SupplierTrip.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/supplier-trips  — Create a new trip (carry-out)
exports.createTrip = async (req, res) => {
  try {
    const { date, supplier_name, carried_out, notes } = req.body;
    if (!supplier_name) return res.status(400).json({ message: 'supplier_name is required' });

    // Mark carried_out items as with_supplier
    if (carried_out?.length) {
      for (const item of carried_out) {
        if (item.packed_item_ref) {
          await PackedItem.findByIdAndUpdate(item.packed_item_ref, {
            status: 'with_supplier',
            supplier_name
          });
        }
      }
    }

    const trip = await SupplierTrip.create({
      date: date || new Date(),
      supplier_name,
      carried_out:    carried_out || [],
      returned_items: [],
      notes:          notes || '',
      status:         'pending',
      createdBy:      req.user._id
    });
    res.status(201).json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/supplier-trips/:id/return  — Record supplier returning items
// NOTE: No MongoDB transactions used here - works on standalone MongoDB
exports.recordReturn = async (req, res) => {
  try {
    const { returned_items, cash_collected, notes } = req.body;

    const trip = await SupplierTrip.findOne({
      _id: req.params.id, createdBy: req.user._id
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Update returned items on trip
    trip.returned_items  = returned_items || [];
    trip.cash_collected  = cash_collected || 0;
    trip.notes           = notes || trip.notes;
    trip.status          = 'completed';

    // Mark returned packed items back appropriately
    for (const ret of (returned_items || [])) {
      if (ret.packed_item_ref) {
        const status = ret.reason === 'damaged' ? 'damaged' : 'returned';
        await PackedItem.findByIdAndUpdate(ret.packed_item_ref, {
          status,
          return_reason: ret.reason === 'sample_return' ? 'other' : ret.reason,
          return_notes:  ret.notes || ''
        });
      }
    }

    await trip.save();
    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/supplier-trips/:id  — General update
exports.updateTrip = async (req, res) => {
  try {
    const trip = await SupplierTrip.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/supplier-trips/:id
exports.deleteTrip = async (req, res) => {
  try {
    const trip = await SupplierTrip.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/supplier-trips/summary
exports.getTripSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const summary = await SupplierTrip.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$supplier_name',
          total_trips:          { $sum: 1 },
          total_cash_collected: { $sum: '$cash_collected' },
          pending_trips:        { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      },
      { $sort: { total_cash_collected: -1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};