const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getBoxes, createBox, deleteBox, getBoxSummary
} = require('../controllers/boxController');

router.use(protect);

router.get('/summary', getBoxSummary);
router.route('/').get(getBoxes).post(createBox);
router.route('/:id').delete(deleteBox);

module.exports = router;