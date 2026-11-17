import Prediction from '../models/Prediction.js';
import { callMlServiceForFiles } from '../services/mlService.js';
import mongoose from 'mongoose';

// In-memory fallback cache in case MongoDB is temporarily not reachable
const inMemoryPredictions = [];

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const averageMlResults = (results) => {
  const validResults = results.filter((result) => result.isValidFruit !== false);
  const baseResults = validResults.length > 0 ? validResults : results;
  const rottenResult = baseResults.find((result) =>
    String(result.cnn?.class || result.cnn?.predicted_class || '').toLowerCase().includes('rotten')
  );
  if (rottenResult) {
    return {
      ...rottenResult,
      viewCount: results.length,
      aggregationMode: 'rottenViewOverride',
      selectedViewIndex: results.indexOf(rottenResult),
    };
  }
  const first = baseResults[0];
  const probabilityKeys = [...new Set(baseResults.flatMap((result) =>
    Object.keys(result.cnn?.probabilities || {})
  ))];
  const probabilities = Object.fromEntries(probabilityKeys.map((key) => [
    key,
    Number(average(baseResults.map((result) => Number(result.cnn?.probabilities?.[key] || 0))).toFixed(4)),
  ]));
  const fruitTypes = baseResults.map((result) => result.cnn?.fruit_type).filter(Boolean);
  const classes = baseResults.map((result) => result.cnn?.class).filter(Boolean);
  const statuses = baseResults.map((result) => result.finalPrediction?.status).filter(Boolean);
  const mostCommon = (values) => values.sort((a, b) =>
    values.filter((value) => value === b).length - values.filter((value) => value === a).length
  )[0];

  return {
    ...first,
    isValidFruit: validResults.length === results.length,
    viewCount: results.length,
    cnn: {
      ...first.cnn,
      class: mostCommon(classes) || first.cnn?.class,
      confidence: Number(average(baseResults.map((result) => Number(result.cnn?.confidence || 0))).toFixed(4)),
      probabilities,
      fruit_type: mostCommon(fruitTypes) || first.cnn?.fruit_type,
      cnn_confidence: Number(average(baseResults.map((result) => Number(result.cnn?.cnn_confidence || result.cnn?.confidence || 0))).toFixed(4)),
    },
    lstm: {
      ...first.lstm,
      baseRemainingDays: Number(average(baseResults.map((result) => Number(result.lstm?.baseRemainingDays || 0))).toFixed(2)),
    },
    environment: {
      ...first.environment,
      environmentalFactor: Number(average(baseResults.map((result) => Number(result.environment?.environmentalFactor || 1))).toFixed(4)),
    },
    finalPrediction: {
      ...first.finalPrediction,
      remainingDays: Number(average(baseResults.map((result) => Number(result.finalPrediction?.remainingDays || 0))).toFixed(2)),
      freshnessIndex: Number(average(baseResults.map((result) => Number(result.finalPrediction?.freshnessIndex || 0))).toFixed(2)),
      status: mostCommon(statuses) || first.finalPrediction?.status,
    },
  };
};

export const createPrediction = async (req, res) => {
  try {
    const uploadedFiles = [
      ...(req.files?.images || []),
      ...(req.files?.image || []),
    ];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload 1, 2, or 4 fruit images' });
    }
    if (![1, 2, 4].includes(uploadedFiles.length)) {
      return res.status(400).json({ success: false, message: `Please select exactly ${uploadedFiles.length === 3 ? '1, 2, or 4' : uploadedFiles.length} fruit images` });
    }

    const temperature = parseFloat(req.body.temperature || 25.0);
    const humidity = parseFloat(req.body.humidity || 60.0);

    // Call ML Service
    const mlResults = await callMlServiceForFiles(uploadedFiles.map((file) => file.path), temperature, humidity);
    const mlResult = averageMlResults(mlResults, uploadedFiles.length);

    const imageUrl = `/uploads/${uploadedFiles[0].filename}`;
    const predictionData = {
      imageUrl,
      fruitType: mlResult.cnn?.fruit_type || 'Banana',
      temperature,
      humidity,
      isBanana: mlResult.isValidFruit !== false && mlResult.isBanana !== false,
      validation: mlResult.validation || null,
      message: mlResult.message || null,
      cnnClass: mlResult.cnn.class,
      cnnConfidence: mlResult.cnn.confidence,
      cnnProbabilities: mlResult.cnn.probabilities,
      baseRemainingDays: mlResult.lstm.baseRemainingDays,
      adjustedRemainingDays: mlResult.finalPrediction.remainingDays,
      freshnessIndex: mlResult.finalPrediction.freshnessIndex,
      status: mlResult.finalPrediction.status,
      environmentalFactor: mlResult.environment.environmentalFactor,
      createdAt: new Date(),
    };

    let savedRecord = null;
    if (mongoose.connection.readyState === 1) {
      try {
        savedRecord = await Prediction.create(predictionData);
      } catch (dbErr) {
        console.warn('Could not save to MongoDB, saving in memory:', dbErr.message);
      }
    }

    if (!savedRecord) {
      savedRecord = {
        _id: `mem-${Date.now()}`,
        ...predictionData,
      };
      inMemoryPredictions.unshift(savedRecord);
    }

    res.status(200).json({
      success: true,
      prediction: savedRecord,
      mlRaw: mlResult,
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing prediction',
    });
  }
};

export const getLatestWebcamCapture = async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const capturedDir = path.resolve(process.cwd(), '..', 'ml-service', 'cnn', 'captured_images');

    if (!fs.existsSync(capturedDir)) {
      return res.status(404).json({ success: false, message: 'No captured images directory found' });
    }

    const files = fs.readdirSync(capturedDir)
      .filter((f) => f.startsWith('banana_') && (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(capturedDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      return res.status(404).json({ success: false, message: 'No webcam images captured yet' });
    }

    const latestFile = files[0].name;
    const filePath = path.join(capturedDir, latestFile);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('X-Filename', latestFile);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getLatestWebcamCaptureInfo = async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const capturedDir = path.resolve(process.cwd(), '..', 'ml-service', 'cnn', 'captured_images');

    if (!fs.existsSync(capturedDir)) {
      return res.status(200).json({ exists: false });
    }

    const files = fs.readdirSync(capturedDir)
      .filter((f) => f.startsWith('banana_') && (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')))
      .map((f) => ({
        filename: f,
        time: fs.statSync(path.join(capturedDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      return res.status(200).json({ exists: false });
    }

    res.status(200).json({
      exists: true,
      filename: files[0].filename,
      time: files[0].time,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getInMemoryPredictions = () => inMemoryPredictions;
