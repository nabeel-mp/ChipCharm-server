const mongoose = require('mongoose');

const packedInventorySchema = new mongoose.Schema({
  flavor: { 
    type: String, 
    enum: ['spicy', 'masala', 'regular'], 
    required: true 
  },
  packagingType: { 
    type: String, 
    enum: ['jar', 'normal'], 
    required: true 
  },
  weightPerItemKg: { 
    type: Number, 
    required: true 
  }, // e.g., 0.5 for 500g, 1 for 1kg
  quantityPacked: { 
    type: Number, 
    default: 0 
  }, // Total items packed today
  quantityInShop: { 
    type: Number, 
    default: 0 
  }, // Current stock sitting on the shelf
  quantitySold: { 
    type: Number, 
    default: 0 
  }, // Items sold
  samplesGiven: { 
    type: Number, 
    default: 0 
  } // Promotional samples handed out
}, { timestamps: true });

module.exports = mongoose.model('PackedInventory', packedInventorySchema);