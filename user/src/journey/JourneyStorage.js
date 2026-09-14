// Local Privacy-First Storage for Journey Sessions
// ZERO network requests, ZERO backend synchronization.
// Stored strictly on the user's device via AsyncStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  ACTIVE_JOURNEY: "@navx_active_journey",
  COMPLETED_JOURNEYS: "@navx_completed_journeys",
  RECENT_ROOMS: "navx_recent", // existing NavX recent key for backwards compatibility
};

export const MAX_RECENT_JOURNEYS = 10;

class JourneyStorage {
  /**
   * Save an active (in-progress) journey session.
   * @param {object} session
   */
  static async saveActiveSession(session) {
    if (!session) return;
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_JOURNEY,
        JSON.stringify(session)
      );
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to save active session:", e);
    }
  }

  /**
   * Get the active in-progress journey session.
   * @returns {Promise<object|null>}
   */
  static async getActiveSession() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_JOURNEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to get active session:", e);
      return null;
    }
  }

  /**
   * Clear the active in-progress journey session.
   */
  static async clearActiveSession() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_JOURNEY);
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to clear active session:", e);
    }
  }

  /**
   * Save a completed journey locally, maintaining MAX_RECENT_JOURNEYS limit.
   * @param {object} journey
   */
  static async saveCompletedJourney(journey) {
    if (!journey || !journey.journeyId) return;
    try {
      const journeys = await this.getCompletedJourneys();
      // Remove any duplicate with same ID
      const filtered = journeys.filter((j) => j.journeyId !== journey.journeyId);
      // Prepend newest journey
      filtered.unshift(journey);

      // Enforce local retention limit
      const trimmed = filtered.slice(0, MAX_RECENT_JOURNEYS);

      await AsyncStorage.setItem(
        STORAGE_KEYS.COMPLETED_JOURNEYS,
        JSON.stringify(trimmed)
      );

      // Synchronize with existing navx_recent rooms list for backwards-compatible UI
      await this._syncWithRecentRooms(journey);
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to save completed journey:", e);
    }
  }

  /**
   * Retrieve all completed journeys stored locally.
   * @returns {Promise<Array>}
   */
  static async getCompletedJourneys() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_JOURNEYS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to get completed journeys:", e);
      return [];
    }
  }

  /**
   * Get a single journey by journeyId.
   * @param {string} journeyId
   * @returns {Promise<object|null>}
   */
  static async getJourneyById(journeyId) {
    if (!journeyId) return null;
    try {
      const journeys = await this.getCompletedJourneys();
      return journeys.find((j) => j.journeyId === journeyId) || null;
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to get journey by ID:", e);
      return null;
    }
  }

  /**
   * Delete a specific journey by journeyId.
   * @param {string} journeyId
   */
  static async deleteJourney(journeyId) {
    if (!journeyId) return;
    try {
      const journeys = await this.getCompletedJourneys();
      const updated = journeys.filter((j) => j.journeyId !== journeyId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.COMPLETED_JOURNEYS,
        JSON.stringify(updated)
      );
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to delete journey:", e);
    }
  }

  /**
   * Idempotently delete ALL local journey data.
   * Clears active session, completed journeys, and cleans journey references.
   * Called during campus exit, data wipe, or manual purge.
   */
  static async clearAllJourneys() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACTIVE_JOURNEY,
        STORAGE_KEYS.COMPLETED_JOURNEYS,
      ]);
      if (__DEV__) console.log("[JourneyStorage] 🗑️ All local journey data permanently deleted.");
    } catch (e) {
      if (__DEV__) console.warn("[JourneyStorage] Failed to clear all journeys:", e);
    }
  }

  /**
   * Update existing navx_recent items to attach the latest journeyId
   * so legacy UI components can associate the room with its journey.
   * @private
   */
  static async _syncWithRecentRooms(journey) {
    try {
      const storedRecent = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_ROOMS);
      if (!storedRecent) return;
      const recentList = JSON.parse(storedRecent);
      if (!Array.isArray(recentList)) return;

      const roomId = journey.destination?.roomId || journey.destination?._id;
      const updated = recentList.map((item) => {
        const itemId = item._id || item.id;
        if (roomId && String(itemId) === String(roomId)) {
          return {
            ...item,
            lastJourneyId: journey.journeyId,
            startPointName: journey.startPoint?.name || "Starting Point",
            lastJourneyDistance: journey.distance,
            lastJourneyDuration: journey.duration,
            lastJourneyTime: journey.endTime,
          };
        }
        return item;
      });

      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_ROOMS,
        JSON.stringify(updated)
      );
    } catch (e) {
      // Non-critical, ignore
    }
  }
}

export default JourneyStorage;
