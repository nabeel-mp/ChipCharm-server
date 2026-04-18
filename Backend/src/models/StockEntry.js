const mongoose = require('mongoose');

const stockEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  produced_kg: {        // How many KG of chips made today
    type: Number,
    required: true,
    min: 0
  },
  opening_stock_kg: {   // Stock at start of day (auto-calculated)
    type: Number,
    default: 0
  },
  closing_stock_kg: {   // Stock at end of day (auto-calculated)
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