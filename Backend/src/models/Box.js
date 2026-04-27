const mongoose = require('mongoose');

// A box = 18 normal_500g packed items (9kg per box)
const BOX_UNITS = 18;
const BOX_WEIGHT_KG = 9; // 18 * 500g

const boxSchema = new mongoose.Schema({
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
    default: 'normal_500g',
    enum: ['normal_500g'],
    required: true
  },
  // Number of complete boxes packed today
  boxes_packed: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // units_per_box is configurable (default 18)
  units_per_box: {
    type: Number,
    default: BOX_UNITS
  },
  // weight per unit in grams (default 500)
  weight_per_unit_grams: {
    type: Number,
    default: 500
  },
  // Total units in all boxes
  total_units: {
    type: Number,
    default: 0
  },
  // Total kg
  total_weight_kg: {
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

boxSchema.pre('save', function() {
  this.total_units = this.boxes_packed * this.units_per_box;
  this.total_weight_kg = (this.total_units * this.weight_per_unit_grams) / 1000;
});

module.exports = mongoose.model('Box', boxSchema);
module.exports.BOX_UNITS = BOX_UNITS;
module.exports.BOX_WEIGHT_KG = BOX_WEIGHT_KG;