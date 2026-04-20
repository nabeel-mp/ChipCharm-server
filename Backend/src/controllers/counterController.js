const Counter = require('../models/Counter');

// GET /api/counters
exports.getCounters = async (req, res) => {
  try {
    const counters = await Counter.find({ createdBy: req.user._id, is_active: true })
      .sort({ name: 1 });
    res.json(counters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/counters
exports.createCounter = async (req, res) => {
  const { name, type, location, contact } = req.body;
  try {
    const counter = await Counter.create({
      name, type, location, contact,
      createdBy: req.user._id
    });
    res.status(201).json(counter);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/counters/:id
exports.updateCounter = async (req, res) => {
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    res.json(counter);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/counters/:id (soft delete)
exports.deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { is_active: false },
      { new: true }
    );
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    res.json({ message: 'Counter removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};