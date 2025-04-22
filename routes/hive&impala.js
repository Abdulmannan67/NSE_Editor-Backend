
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const router = express.Router();
router.use(bodyParser.json());







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