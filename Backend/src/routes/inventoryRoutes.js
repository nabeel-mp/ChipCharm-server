const express = require('express');
const router = express.Router();
const { addDailyProduction, packageItems } = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');

// The 'protect' middleware ensures a valid JWT token is sent with the request
router.post('/produce', protect, addDailyProduction);
router.post('/package', protect, packageItems);

module.exports = router;