const mongoose = require('mongoose');

// Each item a supplier carries out or returns
const tripItemSchema = new mongoose.Schema({
  product_type: { type: String, required: true },
  packing_type: { type: String, required: true },
  weight_per_unit_grams: { type: Number, required: true },
  // Tracks loose packets
  quantity: { type: Number, default: 0 }, 
  // Tracks full boxes (only applies to normal_500g)
  boxes: { type: Number, default: 0 },    
  total_weight_kg: { type: Number, default: 0 },
  // Reference to original packed item if applicable
  packed_item_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PackedItem'
  }
}, { _id: false });

const supplierTripSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  supplier_name: {
    type: String,
    required: true,
    trim: true
  },
  // Items carried out today (given to supplier)
  carried_out: [tripItemSchema],
  
  // Items returned by supplier today
  returned_items: [{
    product_type:          { type: String, required: true },
    packing_type:          { type: String, required: true },
    weight_per_unit_grams: { type: Number, required: true },
    quantity:              { type: Number, default: 0 },
    boxes:                 { type: Number, default: 0 }, // Tracking returned boxes
    total_weight_kg:       { type: Number, default: 0 },
    reason: {
      type: String,
      // Ensures repacking flow from Step 8 is preserved
      enum: ['unsold', 'damaged', 'sample_return', 'repack_needed', 'other'],
      default: 'unsold'
    },
    notes: { type: String, default: '' }
  }],
  // Cash collected from supplier for items sold
  cash_collected: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Auto-calc total_weight_kg combining both loose packets and boxes
supplierTripSchema.pre('save', function() {
  for (const item of this.carried_out) {
    const totalUnits = (item.quantity || 0) + ((item.boxes || 0) * 18);
    item.total_weight_kg = (totalUnits * item.weight_per_unit_grams) / 1000;
  }
  for (const item of this.returned_items) {
    const totalUnits = (item.quantity || 0) + ((item.boxes || 0) * 18);
    item.total_weight_kg = (totalUnits * item.weight_per_unit_grams) / 1000;
  }
});

module.exports = mongoose.model('SupplierTrip', supplierTripSchema);