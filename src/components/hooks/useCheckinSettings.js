import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook to fetch and manage check-in time settings
 * @returns {Object} - { settings, timeSlots, loading, error, refetch }
 */
export function useCheckinSettings() {
  const [settings, setSettings] = useState({
    checkinStartTime: '17:00',
    checkinEndTime: '22:00',
    checkinSlotInterval: 30,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/settings`);

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();

      if (data.settings) {
        setSettings({
          checkinStartTime: data.settings.checkinStartTime || '17:00',
          checkinEndTime: data.settings.checkinEndTime || '22:00',
          checkinSlotInterval: data.settings.checkinSlotInterval || 30,
        });
      }
    } catch (err) {
      console.error('Error fetching check-in settings:', err);
      setError(err.message);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /**
   * Generate time slots based on start time, end time, and interval
   * @returns {Array} - Array of { id, hour } objects
   */
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const { checkinStartTime, checkinEndTime, checkinSlotInterval } = settings;

    // Parse start and end times
    const [startHour, startMinute] = checkinStartTime.split(':').map(Number);
    const [endHour, endMinute] = checkinEndTime.split(':').map(Number);

    // Convert to minutes for easier calculation
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    let id = 1;
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += checkinSlotInterval) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      slots.push({
        id: id++,
        hour: timeString,
      });
    }

    return slots;
  }, [settings]);

  return {
    settings,
    timeSlots: generateTimeSlots(),
    loading,
    error,
    refetch: fetchSettings,
  };
}

export default useCheckinSettings;
