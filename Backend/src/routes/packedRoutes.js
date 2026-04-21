const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getPackedItems, createPackedItem,
  updatePackedItem, deletePackedItem,
  getPackedSummary, getAvailableStock
} = require('../controllers/packedController');

router.use(protect);

router.get('/summary',         getPackedSummary);
router.get('/available-stock', getAvailableStock);

router.route('/').get(getPackedItems).post(createPackedItem);
router.route('/:id').put(updatePackedItem).delete(deletePackedItem);

module.exports = router;