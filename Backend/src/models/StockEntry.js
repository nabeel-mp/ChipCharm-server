const mongoose = require('mongoose');

const PRODUCT_TYPES = [
  'Salted Banana Chips',
  'Spicy Banana Chips',
  'Sweet Banana Chips',
  'Banana 4 Cut',
  'Jaggery'
];

const stockEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  product_type: {
    type: String,
    required: true,
    enum: PRODUCT_TYPES
  },
  produced_kg: {
    type: Number,
    required: true,
    min: 0
  },
  opening_stock_kg: {
    type: Number,
    default: 0
  },
  closing_stock_kg: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('StockEntry', stockEntrySchema);