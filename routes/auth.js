// backend/auth.js
const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const router = express.Router();
router.use(bodyParser.json());

// Configuration for the OracleDB connection
const dbConfig = {
    user: 'SYSTEM',
    password: 'root',
    connectString: '0.0.0.0:1522/freepdb1'
};

const secretKey = 'your_secret_key'; // Use a strong secret key in production

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
    console.log(username,password)
    try {
        const connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM users WHERE username = :username`,
            [username]
        );

        if (result.rows.length === 0) {
            console.log(result.rows)
            return res.status(401).send('Invalid credentials');
        }

        const user = result.rows[0];

        // Replace bcrypt with normal password matching
        if (password !== user[2]) { // Assuming password is the third column
            return res.status(401).send('Invalid credentials');
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user[0] }, secretKey, { expiresIn: '2h' }); // User ID as payload
        res.json({ token }); // Return token to client
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during login');
    }
});

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






// Example of listing user files

// router.get('/files', checkAuth, (req, res) => {
//     const userFolder = path.join(__dirname, '../user_files', req.userId.toString());
//     fs.readdir(userFolder, (err, files) => {
//         if (err) {
//             console.error(err);
//             return res.status(500).send('Unable to list files');
//         }
//         res.json(files);
//     });
// });



router.get('/files', checkAuth, (req, res) => {
    // Ensure userId exists
    const userId = req.userId;
    if (!userId) {
        return res.status(400).send('User ID is required'); // Bad request if userId is missing
    }

    const userFolder = path.join(__dirname, '../user_files', userId.toString());

    // Check if the folder for the user exists
    if (!fs.existsSync(userFolder)) {
        return res.status(404).send('User folder not found'); // Respond if the folder doesn't exist
    }

    const buildCustomStructure = (folderPath) => {
        const folderObject = {
            folder: path.basename(folderPath), // Current folder's name
            files: [] // Array to hold nested files and folders
        };

        // Read all items in the given folder
        const items = fs.readdirSync(folderPath, { withFileTypes: true });

        items.forEach(item => {
            const fullPath = path.join(folderPath, item.name);
            if (item.isDirectory()) {
                // If it's a directory, recurse into it
                folderObject.files.push(buildCustomStructure(fullPath)); // Recursively handle subfolders
            } else {
                try {
                    const stat = fs.statSync(fullPath);
                    const content = fs.readFileSync(fullPath, 'utf8'); // Read file content
                    // console.log(folderObject.files);
                    folderObject.files.push({
                        file: item.name, // File name
                        content: content || "No content", // Add file content or default text
                        size: stat.size, // Optional: Include file size
                        lastModified: stat.mtime // Optional: Include last modified date
                    });
                } catch (err) {
                    console.error(`Unable to read file: ${fullPath}`, err);
                    folderObject.files.push({
                        file: item.name,
                        content: "Error reading file",
                        size: 0, // Size as zero if there's an error
                        lastModified: null // No last modified date
                    });
                }
            }
        });

        return folderObject; // Return the populated folder structure
    };

    try {
        // Build the full structure starting from the user's folder
        const filesStructure = buildCustomStructure(userFolder);
        res.json(filesStructure); // Send the object in the desired structure
    } catch (err) {
        console.error(err);
        res.status(500).send('Unable to list files');
    }
});








//Endpoint to save folder

router.post('/save', checkAuth, async (req, res) => {
    const { folderName, playgroundName, cardLanguage } = req.body;

    try {
        const Folder =  path.join(__dirname,`../user_files/${req.userId.toString()}` , folderName);

        // Create user folder if it doesn't exist
        if (!fs.existsSync(Folder)) {
            fs.mkdirSync(Folder, { recursive: true });
        }

        const filePath = path.join(Folder, `${playgroundName}.${cardLanguage}`);
        let content=" No content";
        fs.writeFile(filePath, content, (err) => {
            if (err) {
                return res.status(500).send('Failed to save file');
            }
            res.send('File saved successfully');
            
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during file save operation');
    }
});







//endpoint to save file
router.post('/filesave/:folderName', checkAuth, (req, res) => {
    const { folderName } = req.params; // Folder to save the file
    const { fileName,cardLanguage,content } = req.body; // File name from request body, content may be undefined

    if (!fileName) {
        return res.status(400).send('Missing required parameter: fileName');
    }

    if (!req.userId) {
        return res.status(401).send('Unauthorized: Missing userId');
    }

    const filename= fileName+cardLanguage;

    // Construct the folder and file paths
    const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName);
    const filePath = path.join(userFolder, filename);


    // Use an empty string as default content if none is provided
    const fileContent = content || "";

    // Save the file with the provided or default content
    fs.writeFile(filePath, fileContent, (err) => {
        if (err) {
            console.error('Error saving file:', err);
            return res.status(500).send('Failed to save file');
        }
        res.status(201).send('File created successfully');
    });
});








// Endpoint to delete files
// router.delete('/files/:filename', checkAuth, (req, res) => {
//     const { filename } = req.params;
//     const userFolder = path.join(__dirname, 'user_files', req.userId.toString());
//     const filePath = path.join(userFolder, filename);

//     fs.unlink(filePath, (err) => {
//         if (err) {
//             return res.status(500).send('Failed to delete file');
//         }
//         res.send('File deleted successfully');
//     });
// });

router.delete('/files/:folderName/:filename', checkAuth, (req, res) => {
    const { folderName, filename } = req.params;
    const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName);
    const filePath = path.join(userFolder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('File deletion error:', err);
            return res.status(500).send('Failed to delete file');
        }
        res.send('File deleted successfully');
    });
});










//endpoint to delete folder

router.delete('/folder/:folderName', checkAuth, (req, res) => {
    const { folderName } = req.params;
    const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName);

    // Check if the folder exists
    if (!fs.existsSync(userFolder)) {
        return res.status(404).send('Folder not found');
    }

    // Delete the folder and all its contents
    fs.rm(userFolder, { recursive: true, force: true }, (err) => {
        if (err) {
            console.error('Folder deletion error:', err);
            return res.status(500).send('Failed to delete folder');
        }
        res.send('Folder deleted successfully');
    });
});





//put update file content 
// router.put('/files/:folderName/:filename', checkAuth, (req, res) => {
//     const { folderName, filename } = req.params; // Get folder and file names from request params
//     const { content } = req.body; // Get the new content from request body
//     console.log(content)
//     const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName); // Construct the user's folder path
//     const filePath = path.join(userFolder, filename); // Construct the full file path

//     // Check if the file exists
//     if (!fs.existsSync(filePath)) {
//         return res.status(404).send('File not found'); // Respond with 404 if file doesn't exist
//     }

//     // Write new content to the file
//     fs.rename(filePath,content, (err) => {
//         if (err) {
//             console.error('Error updating file:', err);
//             return res.status(500).send('Failed to update file'); // Respond with 500 in case of an error
//         }
//         res.send('File updated successfully'); // Respond with success
//     });
// });






//update file name 

router.put('/files/:folderName/:filename', checkAuth, (req, res) => {
    const { folderName, filename } = req.params;
    const { content,filexten } = req.body;

    // Extract the file extension from the old file name
    const fileExtension = filexten; 

    if (!folderName || !filename || ! content) {
        return res.status(400).send('Missing required parameters: folderName, filename, or newFilename');
    }

    if (!req.userId) {
        return res.status(401).send('Unauthorized: Missing userId');
    }

    const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName);
    const oldFilePath = path.join(userFolder, filename);
    const newFilePath = path.join(userFolder, `${content}.${fileExtension}`);

    if (!fs.existsSync(oldFilePath)) {
        return res.status(404).send('File not found');
    }

    fs.rename(oldFilePath, newFilePath, (err) => {
        if (err) {
            console.error('Error renaming file:', err);
            return res.status(500).send('Failed to rename file');
        }
        res.send('File renamed successfully');
    });
});







//update folder name 

router.put('/foledit/:folderName', checkAuth, (req, res) => {
    const { folderName } = req.params; // The current folder name
    const { newFolderName } = req.body; // The new folder name

    if (!folderName || !newFolderName) {
        return res.status(400).send('Missing required parameters: folderName or newFolderName');
    }

    if (!req.userId) {
        return res.status(401).send('Unauthorized: Missing userId');
    }

    // Construct paths
    const userFolder = path.join(__dirname, '../user_files', req.userId.toString());
    const oldFolderPath = path.join(userFolder, folderName); // Current folder path
    const newFolderPath = path.join(userFolder, newFolderName); // New folder path

    // Check if the current folder exists
    if (!fs.existsSync(oldFolderPath)) {
        return res.status(404).send('Folder not found');
    }

    // Rename the folder
    fs.rename(oldFolderPath, newFolderPath, (err) => {
        if (err) {
            console.error('Error renaming folder:', err);
            return res.status(500).send('Failed to rename folder');
        }
        res.send('Folder renamed successfully');
    });
});





// Route to run Hive queries via Beeline
// router.post('/run-hive-query', (req, res) => {
//     const { query } = req.body;

//     // Validate the query
//     if (!query) {
//         return res.status(400).json({ error: "No query provided" });
//     }

//     // Use the full path to Beeline
//     const command = `/usr/bin/beeline -u "jdbc:hive2://127.0.0.1:10000/default" -e "${query}"`;
//     console.log('Executing command:', command);

//     // Execute the Beeline command
//     exec(command, (error, stdout, stderr) => {
//         if (error) {
//             console.error('Error executing Hive query:', stderr);
//             return res.status(500).json({ error: stderr });
//         }
//         res.json({ result: stdout });
//     });
// });




router.post('/run-hive-query', (req, res) => {
    const { query } = req.body;
  
    if (!query) {
      return res.status(400).json({ error: 'No query provided' });
    }
  
    const vmHost = '127.0.0.1';
    const vmPort = 2222;
    const vmUser = 'cloudera';
    const vmPassword = 'cloudera';
  
    const command = `"C:\\Program Files\\PuTTY\\plink.exe" -ssh -P ${vmPort} ${vmUser}@${vmHost} -pw ${vmPassword} -batch "beeline -u 'jdbc:hive2://127.0.0.1:10000/default' -e \\"${query}\\""`;
  
  
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing Hive query:', stderr || error.message);
        return res.status(500).json({ error: stderr || 'Failed to execute query' });
      }
      res.json({ result: stdout });
    });
  });







router.post("/run-impala-query", (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: "No query provided" });
    }

    // Define your VM details
    const vmHost = '127.0.0.1';
    const vmPort = 2222;
    const vmUser = 'cloudera';
    const vmPassword = 'cloudera';

    // Use PuTTY's plink to SSH into the VM and run the Impala query
    const command = `"C:\\Program Files\\PuTTY\\plink.exe" -ssh  -P ${vmPort} ${vmUser}@${vmHost} -pw ${vmPassword} "impala-shell -q '${query}'"`;

    // console.log("Executing command:", command);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("Error executing Impala query:", stderr);
            return res.status(500).json({ error: stderr });
        }
        res.json({ result: stdout });
    });
});


module.exports = router;





module.exports = router;