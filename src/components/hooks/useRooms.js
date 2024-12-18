import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';

export const useRooms = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const response = await api.get('/apartments');
        setRooms(response.data.apartments);
      } catch (err) {
        setError(t('rooms.errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [t]); // Add t to dependencies array

  return { rooms, loading, error };
};