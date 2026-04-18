const DailyStock = require('../models/Dailystock');
const PackedInventory = require('../models/PackedInventory');

// @desc    Record new bulk chips produced today
// @route   POST /api/inventory/produce
exports.addDailyProduction = async (req, res) => {
  const { flavor, producedTodayKg } = req.body;

  try {
    // Find if we already started a record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of the day

    let stock = await DailyStock.findOne({ 
      flavor, 
      date: { $gte: today } 
    });

    if (stock) {
      // Update existing record for today
      stock.producedTodayKg += producedTodayKg;
      stock.totalAvailableKg += producedTodayKg;
      stock.closingStockKg = stock.totalAvailableKg;
    } else {
      // Create a new record for today
      stock = new DailyStock({
        flavor,
        openingStockKg: 0, // In a real scenario, fetch yesterday's closing stock
        producedTodayKg,
        totalAvailableKg: producedTodayKg,
        closingStockKg: producedTodayKg
      });
    }

    await stock.save();
    res.status(201).json(stock);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Package bulk chips into jars/normal packs
// @route   POST /api/inventory/package
exports.packageItems = async (req, res) => {
  const { flavor, packagingType, quantity, weightPerItemKg } = req.body;

  try {
    // 1. Calculate total kg needed for this packaging run
    const totalWeightNeeded = quantity * weightPerItemKg;

    // 2. Find today's bulk stock
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stock = await DailyStock.findOne({ flavor, date: { $gte: today } });

    // Check if we have enough chips!
    if (!stock || stock.totalAvailableKg < totalWeightNeeded) {
      return res.status(400).json({ 
        message: `Not enough bulk ${flavor} chips! You need ${totalWeightNeeded}kg but only have ${stock ? stock.totalAvailableKg : 0}kg.` 
      });
    }

    // 3. Deduct from Daily Bulk Stock
    stock.totalAvailableKg -= totalWeightNeeded;
    stock.closingStockKg = stock.totalAvailableKg;
    await stock.save();

    // 4. Add to Packed Inventory
    let packedItem = await PackedInventory.findOne({ flavor, packagingType, weightPerItemKg });
    
    if (packedItem) {
      packedItem.quantityPacked += quantity;
      packedItem.quantityInShop += quantity;
    } else {
      packedItem = new PackedInventory({
        flavor,
        packagingType,
        weightPerItemKg,
        quantityPacked: quantity,
        quantityInShop: quantity
      });
    }

    await packedItem.save();

    res.status(200).json({ 
      message: 'Packaging successful!', 
      remainingBulkStock: stock.totalAvailableKg,
      updatedPackedInventory: packedItem
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};