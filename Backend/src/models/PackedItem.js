const mongoose = require('mongoose');

// Packing types: 'kg_pack' | 'jar' | 'normal'
const packedItemSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  packing_type: {
    type: String,
    enum: ['kg_pack', 'jar', 'normal'],
    required: true
  },
  weight_per_unit_grams: {  // e.g. 500g pack, 250g jar
    type: Number,
    required: true
  },
  quantity: {               // Number of units packed
    type: Number,
    required: true,
    min: 0
  },
  total_weight_kg: {        // auto = (weight_per_unit_grams * quantity) / 1000
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_shop', 'sold', 'sample'],
    default: 'in_shop'
  },
  label: {                  // e.g. "500g Masala Jar"
    type: String,
    default: ''
  },
  stockEntry: {             // linked to which day's stock
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
packedItemSchema.pre('save', function (next) {
  this.total_weight_kg = (this.weight_per_unit_grams * this.quantity) / 1000;
  next();
});

module.exports = mongoose.model('PackedItem', packedItemSchema);