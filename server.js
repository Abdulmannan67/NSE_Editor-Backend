const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRouter = require('./routes/auth');
const sparkRoutes=require('./routes/sparkRoutes')


const app = express();
const PORT = 5000;

// CORS setup
app.use(cors());

// app.use(cors())

app.use(bodyParser.json());
app.use('/auth', authRouter);
app.use('/spark',sparkRoutes)




app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});