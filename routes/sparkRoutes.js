const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Function to extract YARN Application ID
const extractApplicationId = (line) => {
  const match = line.match(/application_\d+_\d+/);
  return match ? match[0] : null;
};

// Function to check Python syntax (returns null if Python isn’t available)
const checkSyntax = (code, tempFile) => {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(tempFile, code);
    exec(`python -m py_compile "${tempFile}"`, (error, stdout, stderr) => {
      if (error) {
        if (stderr && stderr.includes('Python was not found')) {
          console.warn('Python not found on system; skipping syntax check.');
          resolve(); // Skip syntax check if Python isn’t installed
        } else {
          reject(stderr || 'Syntax error in code');
        }
      } else {
        resolve();
      }
      fs.unlinkSync(tempFile); // Clean up temp file
    });
  });
};

router.get('/submit', async (req, res) => {
  const { code } = req.query;
  const userId = req.headers['user-id'] || 'unknown';
  const jobId = `${userId}-${Date.now()}`;

  if (!code) {
    res.status(400).json({ error: 'Spark code is required' });
    return;
  }

  console.log('Raw code received:', code);

  // Replace literal \n with actual newlines (just in case)
  const sanitizedCode = code.replace(/\\n/g, '\n').trim();
  console.log('Sanitized code:', sanitizedCode);

  // Syntax check (skipped if Python isn’t available)
  const tempSyntaxCheckFile = path.join(__dirname, `syntax-check-${jobId}.py`);
  try {
    await checkSyntax(sanitizedCode, tempSyntaxCheckFile);
  } catch (syntaxError) {
    console.error('Syntax Error:', syntaxError);
    res.status(400).json({ error: `Syntax Error: ${syntaxError}` });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ jobId, message: 'Spark job started' })}\n\n`);

  const plinkPath = path.normalize('C:\\Program Files\\PuTTY\\plink.exe');
  const pscpPath = path.normalize('C:\\Program Files\\PuTTY\\pscp.exe');
  const tempFileLocal = path.join(__dirname, `spark-job-${jobId}.py`);
  const tempFileRemote = `/tmp/spark-job-${jobId}.py`;

  fs.writeFileSync(tempFileLocal, sanitizedCode);

  const scpCommand = `"${pscpPath}" -P 2222 -pw cloudera "${tempFileLocal}" cloudera@127.0.0.1:${tempFileRemote}`;
  const submitCommand = `"${plinkPath}" -ssh -P 2222 cloudera@127.0.0.1 -pw cloudera -batch "spark-submit --master yarn --conf spark.python.use.daemon=false ${tempFileRemote}"`;

  console.log('SCP command:', scpCommand);
  console.log('Submit command:', submitCommand);

  let responseEnded = false;
  let appIdSent = false;

  exec(scpCommand, { windowsHide: true }, (scpError, scpStdout, scpStderr) => {
    if (scpError) {
      console.error('SCP Error:', scpError.message, scpStderr);
      res.write(`data: ${JSON.stringify({ error: scpStderr || scpError.message || 'SCP failed' })}\n\n`);
      res.end();
      responseEnded = true;
      fs.unlinkSync(tempFileLocal);
      return;
    }

    const proc = exec(submitCommand, { windowsHide: true }, (error, stdout, stderr) => {
      if (error && !responseEnded) {
        console.error('Submit Error:', error.message, stderr);
        res.write(`data: ${JSON.stringify({ error: stderr || error.message || 'Job failed' })}\n\n`);
        res.end();
        responseEnded = true;
      }
      fs.unlinkSync(tempFileLocal);
    });

    let accumulatedOutput = '';
    proc.stdout.on('data', (data) => {
      if (!responseEnded) {
        const output = data.toString();
        accumulatedOutput += output;
        console.log('STDOUT:', output);
        const appId = !appIdSent ? extractApplicationId(output) : null;
        if (appId) {
          res.write(`data: ${JSON.stringify({ jobId, applicationId: appId })}\n\n`);
          appIdSent = true;
        }
        res.write(`data: ${JSON.stringify({ jobId, log: output })}\n\n`);
      }
    });

    proc.stderr.on('data', (data) => {
      if (!responseEnded) {
        const errorOutput = data.toString();
        console.log('STDERR:', errorOutput);
        const appId = !appIdSent ? extractApplicationId(errorOutput) : null;
        if (appId) {
          res.write(`data: ${JSON.stringify({ jobId, applicationId: appId })}\n\n`);
          appIdSent = true;
        }
        res.write(`data: ${JSON.stringify({ jobId, log: `[ERROR] ${errorOutput}` })}\n\n`);
      }
    });

    proc.on('close', (code) => {
      if (!responseEnded) {
        console.log(`Job ${jobId} completed with exit code: ${code}`);
        console.log('Full accumulated output:', accumulatedOutput);
        res.write(`data: ${JSON.stringify({ 
          jobId, 
          state: code === 0 ? 'success' : 'dead',
          log: `Output: ${accumulatedOutput.trim()}`
        })}\n\n`);
        res.end();
        responseEnded = true;
      }
    });

    req.on('close', () => {
      if (!responseEnded) {
        proc.kill();
        res.end();
        responseEnded = true;
      }
    });
  });
});

module.exports = router;