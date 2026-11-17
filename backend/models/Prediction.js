import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true,
  },
  fruitType: {
    type: String,
    default: 'Banana',   // "Banana" | "Bittergourd" | "Tomato"
  },
  temperature: {
    type: Number,
    required: true,
    default: 25.0,
  },
  humidity: {
    type: Number,
    required: true,
    default: 60.0,
  },
  cnnClass: {
    type: String,
    required: true,
  },
  cnnConfidence: {
    type: Number,
    required: true,
  },
  cnnProbabilities: {
    type: Map,
    of: Number,
    default: {},
  },
  baseRemainingDays: {
    type: Number,
    required: true,
  },
  adjustedRemainingDays: {
    type: Number,
    required: true,
  },
  freshnessIndex: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  environmentalFactor: {
    type: Number,
    default: 1.0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema);
