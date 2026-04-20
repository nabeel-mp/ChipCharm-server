const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCounters,
  createCounter,
  updateCounter,
  deleteCounter
} = require('../controllers/counterController');

router.use(protect);

router.route('/')
  .get(getCounters)
  .post(createCounter);

router.route('/:id')
  .put(updateCounter)
  .delete(deleteCounter);

module.exports = router;