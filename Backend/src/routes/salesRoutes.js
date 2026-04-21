const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getSales, createSale, updateSale, deleteSale, getSalesSummary
} = require('../controllers/salesController');

router.use(protect);

router.get('/summary', getSalesSummary);
router.route('/').get(getSales).post(createSale);
router.route('/:id').put(updateSale).delete(deleteSale);

module.exports = router;