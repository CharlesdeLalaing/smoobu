import { useState, useEffect, useCallback } from "react";
import { api } from "../components/utils/api";

/**
 * Hook to fetch rooms dynamically from Smoobu via backend API
 * This replaces the hardcoded roomsData.js approach
 */
export function useDynamicRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/dynamic-rooms");

      if (response.data.success) {
        setRooms(response.data.rooms);
      } else {
        setError(response.data.error || "Failed to fetch rooms");
      }
    } catch (err) {
      console.error("Error fetching dynamic rooms:", err);
      setError(err.response?.data?.message || err.message || "Failed to fetch rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    error,
    refetch: fetchRooms,
  };
}

/**
 * Hook to fetch availability/rates for dynamic rooms
 */
export function useDynamicRates(startDate, endDate, adults = 1, children = 0) {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasAvailability, setHasAvailability] = useState(false);

  const fetchRates = useCallback(async () => {
    if (!startDate || !endDate) {
      setRates({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/dynamic-rates", {
        params: {
          start_date: startDate,
          end_date: endDate,
          adults,
          children,
        },
      });

      if (response.data.success) {
        setRates(response.data.rates);
        setHasAvailability(response.data.hasAvailability);
      } else {
        setError(response.data.error || "Failed to fetch rates");
      }
    } catch (err) {
      console.error("Error fetching dynamic rates:", err);
      setError(err.response?.data?.message || err.message || "Failed to fetch rates");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, adults, children]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return {
    rates,
    loading,
    error,
    hasAvailability,
    refetch: fetchRates,
  };
}

/**
 * Hook to test Smoobu API connection
 */
export function useSmoobuConnection() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testConnection = useCallback(async (apiKey = null) => {
    setLoading(true);
    setError(null);

    try {
      const params = apiKey ? { apiKey } : {};
      const response = await api.get("/test-smoobu-connection", { params });

      setConnectionStatus({
        success: response.data.success,
        apartmentCount: response.data.apartmentCount,
        apartments: response.data.apartments,
      });
    } catch (err) {
      console.error("Error testing Smoobu connection:", err);
      setError(err.response?.data?.message || err.message || "Connection test failed");
      setConnectionStatus({ success: false });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    connectionStatus,
    loading,
    error,
    testConnection,
  };
}

/**
 * Hook to save room configuration
 */
export function useRoomConfig() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveConfig = useCallback(async (roomId, config) => {
    setSaving(true);
    setError(null);

    try {
      const response = await api.post(`/room-config/${roomId}`, config);

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to save config");
      }

      return response.data.config;
    } catch (err) {
      console.error("Error saving room config:", err);
      setError(err.response?.data?.message || err.message || "Failed to save config");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    saveConfig,
    saving,
    error,
  };
}
