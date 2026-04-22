const mongoose = require('mongoose');

// Packing types expanded to match factory reality
const packedItemSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  product_type: {
    type: String,
    required: true
  },
  packing_type: {
    type: String,
    enum: ['normal_half_kg', 'normal_1kg', 'jar_small', 'jar_medium', 'jar_large', 'big_bottle'],
    required: true
  },
  weight_per_unit_grams: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  total_weight_kg: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_shop', 'with_supplier', 'delivered_to_counter', 'sold', 'sample', 'returned', 'damaged'],
    default: 'in_shop'
  },
  label: {
    type: String,
    default: ''
  },
  // Counter/Shop destination
  destination: {
    type: String,
    default: ''
  },
  // Supplier who took the items
  supplier_name: {
    type: String,
    default: ''
  },
  // Return tracking
  return_reason: {
    type: String,
    enum: ['', 'damaged', 'old_stock', 'not_selling', 'other'],
    default: ''
  },
  return_notes: {
    type: String,
    default: ''
  },
  stockEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockEntry'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Auto-calculate total weight before saving
packedItemSchema.pre('save', function () {
  this.total_weight_kg = (this.weight_per_unit_grams * this.quantity) / 1000;
});

module.exports = mongoose.model('PackedItem', packedItemSchema);