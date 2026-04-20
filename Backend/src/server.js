const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth',      require('./routes/authRoutes'));
app.use('/api/stock',     require('./routes/stockRoutes'));
app.use('/api/packed',    require('./routes/packedRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/counters',  require('./routes/counterRoutes'));

app.get('/', (req, res) => res.send('ChipCharm API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));