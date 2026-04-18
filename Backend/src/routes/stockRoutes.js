const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getStockEntries,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry
} = require('../controllers/stockController');

router.use(protect);   // all routes protected

router.route('/')
  .get(getStockEntries)
  .post(createStockEntry);

router.route('/:id')
  .put(updateStockEntry)
  .delete(deleteStockEntry);

module.exports = router;