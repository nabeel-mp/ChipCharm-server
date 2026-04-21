const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getTrips, getTrip, createTrip,
  recordReturn, updateTrip, deleteTrip, getTripSummary
} = require('../controllers/supplierTripController');

router.use(protect);

router.get('/summary', getTripSummary);
router.route('/').get(getTrips).post(createTrip);
router.route('/:id').get(getTrip).put(updateTrip).delete(deleteTrip);
router.put('/:id/return', recordReturn);

module.exports = router;