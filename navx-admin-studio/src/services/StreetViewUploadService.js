import { uploadStreetViewSession } from './adminApi';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

class StreetViewUploadService {
  static async uploadSession(frames, config, onProgress) {
    const formData = new FormData();

    frames.forEach((frame, index) => {
      formData.append('images', {
        uri: frame.uri,
        type: 'image/jpeg',
        name: `frame_${index}.jpg`,
      });
    });

    const telemetry = frames.map(f => f.telemetry);
    formData.append('telemetry', JSON.stringify(telemetry));

    formData.append('campusId', config.campusId);
    formData.append('blockId', config.blockId);
    formData.append('floorId', config.floorId);
    formData.append('adminId', config.adminId);

    // Retry logic for network failures
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await uploadStreetViewSession(formData, (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progressEvent);
          }
        });
        return response.data;
      } catch (err) {
        lastError = err;
        console.warn(`Upload attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
        
        // Don't retry on 4xx client errors (bad request, auth, etc.)
        if (err.response && err.response.status >= 400 && err.response.status < 500) {
          throw err;
        }
        
        // Wait before retrying (with exponential backoff)
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
      }
    }
    
    throw lastError;
  }
}

export default StreetViewUploadService;
