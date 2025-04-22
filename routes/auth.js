// backend/auth.js
const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
router.use(bodyParser.json());

// Configuration for the OracleDB connection
const dbConfig = {
    user: 'SYSTEM',
    password: 'root',
    connectString: '0.0.0.0:1522/freepdb1'
};

const secretKey = 'your_secret_key'; // Use a strong secret key in production




// Middleware to check if the user is authenticated
const checkAuth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from the Authorization header

    if (!token) {
        return res.status(401).send('Unauthorized: No token provided');
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).send('Unauthorized: Invalid token');
        }
        req.userId = decoded.userId; // Store user ID in request object
        next(); // Proceed to the next middleware or route handler
    });
};







// Signup endpoint
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const connection = await oracledb.getConnection(dbConfig);
        await connection.execute(
            `INSERT INTO users (username, password) VALUES (:username, :password)`,
            [username, hashedPassword] // Store hashed password
        );
        await connection.commit();
        res.status(201).send('User created successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating user');
    }
});

// Login endpoint
// router.post('/login', async (req, res) => {
//     const { username, password } = req.body;
//     try {
//         const connection = await oracledb.getConnection(dbConfig);
//         const result = await connection.execute(
//             `SELECT * FROM users WHERE username = :username`,
//             [username]
//         );

//         if (result.rows.length === 0) {
//             return res.status(401).send('Invalid credentials');
//         }

//         const user = result.rows[0];
//         const isMatch = await bcrypt.compare(password, user[2]); // Assuming password is the third column

//         if (!isMatch) {
//             return res.status(401).send('Invalid credentials');
//         }

//         // Generate JWT token
//         const token = jwt.sign({ userId: user[0] }, secretKey, { expiresIn: '1h' }); // User ID as payload
//         res.json({ token }); // Return token to client
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Error during login');
//     }
// });


router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM users WHERE username = :username`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).send('Invalid credentials');
        }

        const user = result.rows[0];

        // Replace bcrypt with normal password matching
        if (password !== user[2]) { // Assuming password is the third column
            return res.status(401).send('Invalid credentials');
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user[0] }, secretKey, { expiresIn: '2h' }); // User ID as payload
        res.json({ token ,user}); // Return token to client
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during login');
    }
});






//get user details
router.get("/user/details", checkAuth, async (req, res) => {
    try {
        const userId = req.userId; // ✅ Get userId from authentication

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing userId" });
        }

        // ✅ Query user details from OracleDB
        const connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM users WHERE user_id = :userId`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT } // ✅ Returns key-value pairs
        );
        await connection.close(); // ✅ Ensure the connection is closed

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = result.rows[0];

        res.json({user})
    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ error: "Failed to retrieve user details" });
    }
});



module.exports = router;





