const mongoose = require('mongoose');

// Each item a supplier carries out or returns
const tripItemSchema = new mongoose.Schema({
  product_type: { type: String, required: true },
  packing_type: { type: String, required: true },
  weight_per_unit_grams: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 0 },
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
    quantity:              { type: Number, required: true, min: 0 },
    total_weight_kg:       { type: Number, default: 0 },
    reason: {
      type: String,
      enum: ['unsold', 'damaged', 'sample_return', 'other'],
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

// Auto-calc total_weight_kg for each item
supplierTripSchema.pre('save', function() {
  for (const item of this.carried_out) {
    item.total_weight_kg = (item.quantity * item.weight_per_unit_grams) / 1000;
  }
  for (const item of this.returned_items) {
    item.total_weight_kg = (item.quantity * item.weight_per_unit_grams) / 1000;
  }
});

module.exports = mongoose.model('SupplierTrip', supplierTripSchema);