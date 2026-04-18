const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getPackedItems,
  createPackedItem,
  updatePackedItem,
  deletePackedItem
} = require('../controllers/packedController');

router.use(protect);

router.route('/')
  .get(getPackedItems)
  .post(createPackedItem);

router.route('/:id')
  .put(updatePackedItem)
  .delete(deletePackedItem);

module.exports = router;