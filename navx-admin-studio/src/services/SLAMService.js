import api, { startScanSession, updateTrajectory, finalizeSession } from './adminApi';

class SLAMService {
  constructor() {
    this.sessionId = null;
    this.currentPose = { x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0 };
    this.updateInterval = null;
  }

  async startSession(buildingId, floorId, adminId) {
    try {
      const response = await startScanSession({
        buildingId,
        floorId,
        adminId
      });
      this.sessionId = response?.session?._id || 'demo-session';
      this.startStreaming();
      return this.sessionId;
    } catch (error) {
      console.error('Failed to start scan session:', error.message || error);
      // Fallback for demo / offline
      this.sessionId = 'demo-session';
      this.startStreaming();
      return this.sessionId;
    }
  }

  startStreaming() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => {
      this.sendTrajectoryUpdate();
    }, 500);
  }

  updateSensor(type, data) {
    if (!data) return;
    if (type === 'accelerometer') {
      this.currentPose.x += (data.x || 0) * 0.01;
      this.currentPose.y += (data.y || 0) * 0.01;
      this.currentPose.z += (data.z || 0) * 0.01;
    }
  }

  async sendTrajectoryUpdate() {
    if (!this.sessionId || this.sessionId === 'demo-session') return;
    try {
      await updateTrajectory(this.sessionId, {
        pose: this.currentPose
      });
    } catch (error) {
      // Non-blocking telemetry error
      console.log('Telemetry stream notice:', error.message);
    }
  }

  async stopSession(payload = {}) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (!this.sessionId || this.sessionId === 'demo-session') {
      this.sessionId = null;
      return { success: true, mode: 'demo' };
    }

    try {
      const response = await finalizeSession(this.sessionId, payload);
      this.sessionId = null;
      return response;
    } catch (error) {
      console.error('Failed to finalize scan session:', error.message || error);
      this.sessionId = null;
      return { success: false, error: error.message };
    }
  }
}

export default new SLAMService();
