const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product_type:          { type: String, required: true },
  packing_type:          { type: String, required: true },
  weight_per_unit_grams: { type: Number, required: true },
  quantity:              { type: Number, required: true, min: 1 },
  unit_price:            { type: Number, required: true, min: 0 },
  total_price:           { type: Number, default: 0 },
  // Optional reference to a packed item
  packed_item_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PackedItem'
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  // shop = in-shop sale
  // factory = direct walk-in sale at factory
  // counter = sale recorded by/for a roadside counter or shop
  // supplier_settlement = supplier cash settlement
  sale_type: {
    type: String,
    enum: ['shop', 'factory', 'counter', 'supplier_settlement'],
    default: 'shop'
  },
  items: [saleItemSchema],
  subtotal:     { type: Number, default: 0 },
  discount:     { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  payment_mode: {
    type: String,
    enum: ['cash', 'upi', 'card', 'credit'],
    default: 'cash'
  },
  // For factory sale: customer name / walk-in
  // For counter sale: counter/shop name
  customer_name: { type: String, default: '' },
  // If linked to a supplier trip
  supplier_trip_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierTrip'
  },
  notes:    { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

saleSchema.pre('save', function() {
  // Calc item totals
  for (const item of this.items) {
    item.total_price = item.quantity * item.unit_price;
  }
  this.subtotal = this.items.reduce((s, i) => s + i.total_price, 0);
  this.total_amount = Math.max(0, this.subtotal - (this.discount || 0));
});

module.exports = mongoose.model('Sale', saleSchema);