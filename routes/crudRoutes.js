// backend/auth.js
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(bodyParser.json());


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











router.get("/files", checkAuth, (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    const userFolder = path.join(__dirname, "../user_files", userId.toString());

    if (!fs.existsSync(userFolder)) {
        return res.status(404).json({ error: "User folder not found" });
    }

    const buildCustomStructure = (folderPath) => {
        const folderObject = {
            folder: path.basename(folderPath), // Folder name
            files: [],  // Holds files
            children: [] // Holds subfolders
        };

        try {
            const items = fs.readdirSync(folderPath, { withFileTypes: true });

            items.forEach((item) => {
                const fullPath = path.join(folderPath, item.name);

                if (item.isDirectory()) {
                    // Add subfolder to `children` instead of `files`
                    folderObject.children.push(buildCustomStructure(fullPath));
                } else {
                    try {
                        const stat = fs.statSync(fullPath);
                        const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "No content";

                        folderObject.files.push({
                            file: item.name,
                            content: content || "No content",
                            size: stat.size,
                            lastModified: stat.mtime
                        });
                    } catch (fileErr) {
                        console.error(`Error reading file: ${fullPath}`, fileErr);
                        folderObject.files.push({
                            file: item.name,
                            content: "Error reading file",
                            size: 0,
                            lastModified: null
                        });
                    }
                }
            });
        } catch (err) {
            console.error(`Error accessing folder: ${folderPath}`, err);
            return { error: `Failed to read folder: ${folderPath}` };
        }

        return folderObject;
    };

    try {
        const filesStructure = buildCustomStructure(userFolder);
        res.status(200).json(filesStructure);
    } catch (err) {
        console.error("Error building folder structure:", err);
        res.status(500).json({ error: "Unable to list files" });
    }
});







//Endpoint to save folder

router.post('/save', checkAuth, async (req, res) => {
    const { folderName} = req.body;

    try {
        const Folder =  path.join(__dirname,`../user_files/${req.userId.toString()}` , folderName);

        // Create user folder if it doesn't exist
        if (!fs.existsSync(Folder)) {
            fs.mkdirSync(Folder, { recursive: true });
            res.send('Folder saved successfully');
        } 

    } catch (error) {
        console.error(error);
        res.status(500).send('Error during file save operation');
    }
});





//endpoint to save nested folder


router.post("/foldersave/:folderName", checkAuth, (req, res) => {
    const { folderName } = req.params;
    const { folderpath } = req.body;

    if (!folderName) {
        return res.status(400).json({ error: "Missing required parameter: folderName" });
    }

    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized: Missing userId" });
    }

    // Construct the folder path
    const userFolder = path.join(__dirname, "../user_files", req.userId.toString(), folderpath);
    const folderPath = path.join(userFolder, folderName);

    try {
        // ✅ Ensure recursive directory creation
        fs.mkdirSync(folderPath, { recursive: true });

        res.status(201).json({ message: "Folder created successfully", folderPath });
    } catch (err) {
        console.error("Error creating folder:", err);
        res.status(500).json({ error: "Failed to create folder", details: err.message });
    }
});







//endpoint to save file

router.post("/filesave", checkAuth, (req, res) => {
    const { folderName, fileName, cardLanguage, content } = req.body;

    if (!fileName) {
        return res.status(400).json({ error: "Missing required parameter: fileName" });
    }

    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized: Missing userId" });
    }

    const filename = `${fileName}.${cardLanguage}`;
    const userFolder = path.join(__dirname, "../user_files", req.userId.toString(), folderName);
    const filePath = path.join(userFolder, filename);
    const fileContent = content || "";

    try {
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true }); // ✅ Create folder if it doesn't exist
        }

        if (fs.existsSync(filePath)) {
            return res.status(409).json({ error: "File already exists" }); // ✅ Return conflict status
        }

        fs.writeFileSync(filePath, fileContent); // ✅ Use writeFileSync for safer execution

        res.status(201).json({ message: "File created successfully", filePath });
    } catch (err) {
        console.error("Error saving file:", err);
        res.status(500).json({ error: "Failed to save file", details: err.message });
    }
});








//delete file


router.delete("/files/:folderName/:filename", checkAuth, (req, res) => {
    const { folderName, filename } = req.params;
    const userFolder = path.join(__dirname, "../user_files", req.userId.toString(), folderName);
    const filePath = path.join(userFolder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File or folder not found" });
    }

    try {
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            // ✅ If it's a folder, delete it and all contents
            fs.rmSync(filePath, { recursive: true, force: true });
            res.status(200).json({ message: "Folder and its contents deleted successfully" });
        } else {
            // ✅ If it's a file, delete only the file
            fs.unlinkSync(filePath);
            res.status(200).json({ message: "File deleted successfully" });
        }
    } catch (err) {
        console.error("Error deleting file or folder:", err);
        res.status(500).json({ error: "Failed to delete file or folder", details: err.message });
    }
});










//endpoint to delete folder

router.delete("/folder/:folderPath", checkAuth, (req, res) => {
    const { folderPath } = req.params; // Supports full nested folder path
    const userFolder = path.join(__dirname, "../user_files", req.userId.toString(), folderPath);

    if (!fs.existsSync(userFolder)) {
        return res.status(404).json({ error: "Folder not found" });
    }

    try {
        fs.rmdirSync(userFolder, { recursive: true }); // ✅ Deletes nested folders
        res.status(200).json({ message: "Folder deleted successfully", deletedPath: userFolder });
    } catch (err) {
        console.error("Error deleting folder:", err);
        res.status(500).json({ error: "Failed to delete folder" });
    }
});





//put update file content 
router.put('/fil/:folderName/:filename', checkAuth, (req, res) => {
    const { folderName, filename } = req.params;
    const { content} = req.body;

    // Extract the file extension from the old file name
    // const fileExtension = filexten; 

    if (!folderName || !filename || ! content) {
        return res.status(400).send('Missing required parameters: folderName, filename, or newFilename');
    }

    if (!req.userId) {
        return res.status(401).send('Unauthorized: Missing userId');
    }

    const userFolder = path.join(__dirname, '../user_files', req.userId.toString(), folderName);
    const oldFilePath = path.join(userFolder, filename);
    // const newFilePath = path.join(userFolder, `${content}.${fileExtension}`);
    const newFilePath = path.join(userFolder, filename);


    if (!fs.existsSync(oldFilePath)) {
        return res.status(404).send('File not found');
    }

    fs.rename(oldFilePath, newFilePath, (err) => {
        if (err) {
            console.error("Error renaming file:", err);
            return res.status(500).send("Failed to rename file");
        }
    
        // Overwrite file with new content
        fs.writeFile(newFilePath, content , (err) => {
            if (err) {
                console.error("Error writing content:", err);
                return res.status(500).send("Failed to write new content");
            }
            res.send("File renamed and new content added successfully");
        });
    });
});









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

router.put("/foledit/:folderName", checkAuth, (req, res) => {
    const { folderName } = req.params; // Example: "hive/new"
    const { newFolderName } = req.body; // Example: "old"

    if (!folderName || !newFolderName) {
        return res.status(400).json({ error: "Missing required parameters: folderName or newFolderName" });
    }

    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized: Missing userId" });
    }

    const userFolder = path.join(__dirname, "../user_files", req.userId.toString());
    const oldFolderPath = path.join(userFolder, folderName);
    const parentFolder = path.dirname(oldFolderPath); // ✅ Extract parent directory
    const newFolderPath = path.join(parentFolder, newFolderName); // ✅ New path within the same parent

    if (!fs.existsSync(oldFolderPath)) {
        return res.status(404).json({ error: "Folder not found" });
    }

    try {
        fs.renameSync(oldFolderPath, newFolderPath);
        res.status(200).json({ message: "Folder renamed successfully", oldPath: folderName, newPath: newFolderName });
    } catch (err) {
        console.error("Error renaming folder:", err);
        res.status(500).json({ error: "Failed to rename folder", details: err.message });
    }
});








module.exports = router;





