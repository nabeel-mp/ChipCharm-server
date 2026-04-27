const mongoose = require('mongoose');

const PACKING_TYPES = [
  'normal_500g', 
  'normal_1kg', 
  'jar_small', 
  'jar_medium', 
  'bottle'
];

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
    enum: PACKING_TYPES,
    required: true
  },
  weight_per_unit_grams: {
    type: Number,
    required: true // Customizable for Jars and Bottles as per Step 2
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
    // NEW: Added 'repacked' status for packets that are returned and opened for mixing
    enum: ['in_shop', 'with_supplier', 'delivered_to_counter', 'sold', 'sample', 'returned', 'damaged', 'repacked'],
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
module.exports.PACKING_TYPES = PACKING_TYPES;