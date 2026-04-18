const mongoose = require('mongoose');

const dailyStockSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    default: Date.now 
  },
  flavor: { 
    type: String, 
    enum: ['spicy', 'masala', 'regular'], 
    required: true 
  },
  openingStockKg: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  producedTodayKg: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  totalAvailableKg: { 
    type: Number, 
    default: 0 
  }, // This will be: openingStock + producedToday
  closingStockKg: { 
    type: Number, 
    default: 0 
  } // This will be calculated at the end of the day
}, { timestamps: true });

module.exports = mongoose.model('DailyStock', dailyStockSchema);