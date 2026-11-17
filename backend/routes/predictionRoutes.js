import express from 'express';
import { createPrediction, getLatestWebcamCapture, getLatestWebcamCaptureInfo } from '../controllers/predictionController.js';
import { getPredictionHistory, getPredictionById, deletePrediction } from '../controllers/historyController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/latest-capture-info', getLatestWebcamCaptureInfo);
router.get('/latest-capture', getLatestWebcamCapture);
router.get('/sensor/latest', async (req, res) => {
  // 1. Try querying FastAPI ML service (port 8000) if active
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get('http://127.0.0.1:8000/sensor/latest', { timeout: 1200 });
    if (response.data && response.data.is_live) {
      return res.json(response.data);
    }
  } catch (err) {
    // ML service (port 8000) is offline or busy
  }

  // 2. Try reading from latest_sensor.json cache file (written by cnn_inference / read_sensor)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const cachePath = path.resolve(process.cwd(), '..', 'ml-service', 'latest_sensor.json');
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;
      if (ageSeconds < 45) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        return res.json({ ...cached, is_live: true, is_stale: false });
      }
    }
  } catch (e) {
    // Ignore cache read failure
  }

  // 3. Fallback: run read_sensor.py --json directly on-demand via Python on COM3
  try {
    const { exec } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.resolve(process.cwd(), '..', 'ml-service', 'environmental', 'read_sensor.py');
    const command = `python "${scriptPath}" --json`;

    exec(command, { timeout: 4500 }, (err, stdout) => {
      if (!err && stdout) {
        try {
          const match = stdout.match(/\{[\s\S]*"temperature"[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            return res.json(parsed);
          }
        } catch (pe) {
          // JSON parse failure
        }
      }
      return res.json({
        temperature: 25.0,
        humidity: 60.0,
        is_live: false,
        source: 'Baseline Fallback (25.0°C, 60.0% RH)',
      });
    });
  } catch (err) {
    res.json({
      temperature: 25.0,
      humidity: 60.0,
      is_live: false,
      error: err.message,
      source: 'Baseline Fallback (25.0°C, 60.0% RH)',
    });
  }
});

router.post('/', upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'image', maxCount: 1 },
]), createPrediction);
router.get('/history', getPredictionHistory);
router.get('/:id', getPredictionById);
router.delete('/:id', deletePrediction);

export default router;
