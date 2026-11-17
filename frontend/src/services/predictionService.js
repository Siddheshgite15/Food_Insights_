import api from './api';

export const predictionService = {
  async predict(formData) {
    const res = await api.post('/api/prediction', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getHistory() {
    const res = await api.get('/api/prediction/history');
    return res.data;
  },

  async getPredictionById(id) {
    const res = await api.get(`/api/prediction/${id}`);
    return res.data;
  },

  async deletePrediction(id) {
    const res = await api.delete(`/api/prediction/${id}`);
    return res.data;
  },
};
