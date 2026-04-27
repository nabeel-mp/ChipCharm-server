const SupplierTrip = require('../models/Suppliertrip');
const PackedItem   = require('../models/PackedItem');
const Box          = require('../models/Box'); // NEW: Box Model Required
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

    if (carried_out?.length) {
      for (const item of carried_out) {
        
        // --- 1. HANDLE LOOSE PACKETS ---
        let requiredQty = item.quantity || 0;
        if (requiredQty > 0) {
          const shopItems = await PackedItem.find({
            createdBy: req.user._id,
            product_type: item.product_type,
            packing_type: item.packing_type,
            weight_per_unit_grams: item.weight_per_unit_grams,
            status: 'in_shop',
            quantity: { $gt: 0 }
          }).sort({ date: 1 }); // FIFO

          let deductedAmount = 0;
          for (const shopItem of shopItems) {
            if (requiredQty <= 0) break;
            const take = Math.min(shopItem.quantity, requiredQty);
            shopItem.quantity -= take;
            shopItem.total_weight_kg = (shopItem.quantity * shopItem.weight_per_unit_grams) / 1000;
            await shopItem.save();

            requiredQty -= take;
            deductedAmount += take;
          }

          if (requiredQty > 0) {
            return res.status(400).json({ 
              message: `Not enough 'in_shop' packet stock for ${item.product_type} (${item.packing_type}). You are short by ${requiredQty} packets.` 
            });
          }

          // Create a PackedItem record marking these specific packets as 'with_supplier'
          const supplierBatch = await PackedItem.create({
            date: date || new Date(),
            product_type: item.product_type,
            packing_type: item.packing_type,
            weight_per_unit_grams: item.weight_per_unit_grams,
            quantity: deductedAmount,
            total_weight_kg: (deductedAmount * item.weight_per_unit_grams) / 1000,
            status: 'with_supplier',
            supplier_name: supplier_name,
            createdBy: req.user._id
          });
          item.packed_item_ref = supplierBatch._id;
        }

        // --- 2. HANDLE FULL BOXES ---
        let requiredBoxes = item.boxes || 0;
        if (requiredBoxes > 0) {
          if (item.packing_type !== 'normal_500g') {
             return res.status(400).json({ message: 'Boxes can only be assigned to normal_500g products.' });
          }

          // Find available boxes in the shop
          const shopBoxes = await Box.find({
            createdBy: req.user._id,
            product_type: item.product_type,
            boxes_packed: { $gt: 0 }
          }).sort({ date: 1 }); // FIFO

          let deductedBoxes = 0;
          for (const shopBox of shopBoxes) {
            if (requiredBoxes <= 0) break;
            const take = Math.min(shopBox.boxes_packed, requiredBoxes);
            
            shopBox.boxes_packed -= take;
            shopBox.total_units = shopBox.boxes_packed * shopBox.units_per_box;
            shopBox.total_weight_kg = (shopBox.total_units * shopBox.weight_per_unit_grams) / 1000;
            await shopBox.save();

            requiredBoxes -= take;
            deductedBoxes += take;
          }

          if (requiredBoxes > 0) {
            return res.status(400).json({ 
              message: `Not enough Box stock for ${item.product_type}. You are short by ${requiredBoxes} boxes in the shop.` 
            });
          }
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
exports.recordReturn = async (req, res) => {
  try {
    const { returned_items, cash_collected, notes } = req.body;

    const trip = await SupplierTrip.findOne({
      _id: req.params.id, createdBy: req.user._id
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    trip.returned_items  = returned_items || [];
    trip.cash_collected  = cash_collected || 0;
    trip.notes           = notes || trip.notes;
    trip.status          = 'completed';

    for (const ret of (returned_items || [])) {
      // Return logic for loose packets
      if (ret.packed_item_ref && ret.quantity > 0) {
        const status = ret.reason === 'damaged' ? 'damaged' : 'returned';
        await PackedItem.findByIdAndUpdate(ret.packed_item_ref, {
          status,
          return_reason: ret.reason === 'sample_return' ? 'other' : ret.reason,
          return_notes:  ret.notes || ''
        });
      }

      // NEW: Return logic for Boxes. If a supplier returns intact boxes, add them back to shop.
      if (ret.boxes > 0) {
         await Box.create({
            date: new Date(),
            product_type: ret.product_type,
            packing_type: 'normal_500g',
            boxes_packed: ret.boxes,
            units_per_box: 18,
            weight_per_unit_grams: 500,
            notes: `Returned from supplier ${trip.supplier_name}. Reason: ${ret.reason}. ${ret.notes || ''}`,
            createdBy: req.user._id
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