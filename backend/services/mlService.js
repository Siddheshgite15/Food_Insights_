import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

export const callMlService = async (filePath, temperature = 25.0, humidity = 60.0) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('temperature', temperature.toString());
  form.append('humidity', humidity.toString());

  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 45000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`ML Service responded with ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`ML Service at ${ML_SERVICE_URL} is unreachable. Please ensure the Python FastAPI service is running.`);
    } else {
      throw new Error(`ML Service request error: ${error.message}`);
    }
  }
};

export const callMlServiceForFiles = async (filePaths, temperature = 25.0, humidity = 60.0) => {
  return Promise.all(filePaths.map((filePath) => callMlService(filePath, temperature, humidity)));
};
