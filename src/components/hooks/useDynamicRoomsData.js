import { useState, useEffect } from "react";
import { api } from "../utils/api";

// Default placeholder image for rooms without images
const PLACEHOLDER_IMAGE = "https://placehold.co/600x400?text=Room+Image";

// Default feature icons (you can replace these with actual icons later)
import people from "../../assets/Chambres/icons8-people-52.png";

/**
 * Hook to fetch rooms dynamically from Smoobu and transform them
 * to a format compatible with the booking form
 */
export function useDynamicRoomsData() {
  const [roomsData, setRoomsData] = useState({});
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // Prevent duplicate fetches
    if (hasFetched) return;

    async function fetchRooms() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get("/dynamic-rooms");

        if (response.data.success && response.data.rooms) {
          const rooms = response.data.rooms;

          // Transform to roomsData format (keyed by ID)
          const roomsMap = {};
          rooms.forEach((room) => {
            const roomId = String(room.id || room.smoobuId);

            roomsMap[roomId] = {
              id: roomId,
              smoobuId: roomId,
              type: room.type || "rooms.types.standard",
              nameKey: room.name, // Use actual name, not translation key
              name: room.name, // Direct name for display
              description: room.description || "",
              images: {
                main: room.images?.[0] || PLACEHOLDER_IMAGE,
                secondary: room.images?.[1] || PLACEHOLDER_IMAGE,
                tertiary: room.images?.[2] || PLACEHOLDER_IMAGE,
                quaternary: room.images?.[3] || PLACEHOLDER_IMAGE,
                quinary: room.images?.[4] || PLACEHOLDER_IMAGE,
                senary: room.images?.[5] || PLACEHOLDER_IMAGE,
              },
              maxGuests: room.maxOccupancy || 4,
              features: [
                {
                  icon: people,
                  title: "rooms.features.maxGuests",
                  value: room.maxOccupancy || 4,
                },
              ],
              size: room.size || "",
              calendarData: {
                id: roomId,
                verification: "",
                urls: {
                  en: `https://login.smoobu.com/en/cockpit/widget/single-calendar/${roomId}`,
                  fr: `https://login.smoobu.com/fr/cockpit/widget/single-calendar/${roomId}`,
                  nl: `https://login.smoobu.com/nl/cockpit/widget/single-calendar/${roomId}`,
                },
              },
              // Pricing config from SQLite
              pricingConfig: room.pricingConfig || null,
              hasPricingConfig: room.hasPricingConfig || false,
              extraGuestsPerNight: room.extraGuestsPerNight || 0,
              extraChildPerNight: room.extraChildPerNight || 0,
              startingAtGuest: room.startingAtGuest || 2,
              cleaningFee: room.cleaningFee || 0,
            };
          });

          setRoomsData(roomsMap);
          setRoomsList(Object.values(roomsMap));
          setHasFetched(true);
        } else {
          setError("Failed to fetch rooms");
        }
      } catch (err) {
        console.error("Error fetching dynamic rooms:", err);
        // Only set error if we haven't successfully fetched before
        setRoomsData((prevData) => {
          if (Object.keys(prevData).length === 0) {
            setError(err.message || "Failed to fetch rooms");
          } else {
            console.warn("Using cached rooms data due to fetch error");
          }
          return prevData; // Keep existing data
        });
      } finally {
        setLoading(false);
      }
    }

    fetchRooms();
  }, [hasFetched]);

  return {
    roomsData,      // Object keyed by room ID (same format as static roomsData)
    roomsList,      // Array of rooms
    loading,
    error,
    refetch: () => {
      setLoading(true);
      // Trigger re-fetch by updating state
    }
  };
}

/**
 * Get room name - handles both translation keys and direct names
 */
export function getRoomName(room, t) {
  // If it's a translation key, translate it
  if (room.nameKey && room.nameKey.startsWith("rooms.")) {
    return t(room.nameKey);
  }
  // Otherwise return the direct name
  return room.name || room.nameKey || `Room ${room.id}`;
}

export default useDynamicRoomsData;
