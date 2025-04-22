const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRouter = require('./routes/auth');
const sparkRoutes=require('./routes/sparkRoutes')
const crudRoutes=require('./routes/crudRoutes')
const hiveimpalaRoutes=require('./routes/hive&impala')


const app = express();
const PORT = 5000;

// CORS setup
app.use(cors());

// app.use(cors())

app.use(bodyParser.json());
app.use('/auth', authRouter);
app.use('/crud', crudRoutes);
app.use('/spark',sparkRoutes)
app.use('/query',hiveimpalaRoutes)





app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});