import Prediction from '../models/Prediction.js';
import { getInMemoryPredictions } from './predictionController.js';
import mongoose from 'mongoose';

export const getPredictionHistory = async (req, res) => {
  try {
    let predictions = [];

    if (mongoose.connection.readyState === 1) {
      predictions = await Prediction.find({}).sort({ createdAt: -1 }).limit(50);
    }

    if (!predictions || predictions.length === 0) {
      predictions = getInMemoryPredictions();
    }

    res.json({
      success: true,
      count: predictions.length,
      predictions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPredictionById = async (req, res) => {
  try {
    const { id } = req.params;
    let record = null;

    if (mongoose.connection.readyState === 1 && !id.startsWith('mem-')) {
      record = await Prediction.findById(id);
    }

    if (!record) {
      record = getInMemoryPredictions().find((p) => p._id.toString() === id);
    }

    if (!record) {
      return res.status(404).json({ success: false, message: 'Prediction not found' });
    }

    res.json({ success: true, prediction: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePrediction = async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1 && !id.startsWith('mem-')) {
      await Prediction.findByIdAndDelete(id);
    }
    res.json({ success: true, message: 'Prediction deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
