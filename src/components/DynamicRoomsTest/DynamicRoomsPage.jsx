import { useState, useEffect, useCallback } from "react";
import { useSmoobuConnection } from "../../hooks/useDynamicRooms";
import { api } from "../utils/api";
import "./DynamicRoomsPage.css";

/**
 * Test page for dynamic Smoobu room integration
 * This demonstrates fetching rooms directly from Smoobu API
 */
export default function DynamicRoomsPage() {
  const { connectionStatus, loading: connectionLoading, testConnection } = useSmoobuConnection();

  // API Key state - used for all fetches
  const [customApiKey, setCustomApiKey] = useState("");
  const [activeApiKey, setActiveApiKey] = useState(""); // The key being used for fetches

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState(null);

  // Date selection for availability check
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Rates state
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [hasAvailability, setHasAvailability] = useState(false);

  // Pricing config state
  const [pricingConfigs, setPricingConfigs] = useState({});
  const [editingRoom, setEditingRoom] = useState(null);
  const [editForm, setEditForm] = useState({
    extraGuestFeePerNight: 0,
    extraChildFeePerNight: 0,
    startingAtGuest: 1,
    cleaningFeeOverride: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState(null);

  // Fetch rooms with optional API key
  const fetchRooms = useCallback(async (apiKey = null) => {
    setRoomsLoading(true);
    setRoomsError(null);

    try {
      const params = apiKey ? { apiKey } : {};
      const response = await api.get("/dynamic-rooms", { params });

      if (response.data.success) {
        setRooms(response.data.rooms);
      } else {
        setRoomsError(response.data.error || "Failed to fetch rooms");
      }
    } catch (err) {
      console.error("Error fetching dynamic rooms:", err);
      setRoomsError(err.response?.data?.message || err.message || "Failed to fetch rooms");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  // Fetch rates with optional API key
  const fetchRates = useCallback(async (apiKey = null) => {
    if (!startDate || !endDate) {
      setRates({});
      return;
    }

    setRatesLoading(true);

    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
        adults,
        children,
      };
      if (apiKey) {
        params.apiKey = apiKey;
      }

      const response = await api.get("/dynamic-rates", { params });

      if (response.data.success) {
        setRates(response.data.rates);
        setHasAvailability(response.data.hasAvailability);
      } else {
        setRates({});
      }
    } catch (err) {
      console.error("Error fetching dynamic rates:", err);
      setRates({});
    } finally {
      setRatesLoading(false);
    }
  }, [startDate, endDate, adults, children]);

  // Fetch pricing configs from Firebase
  const fetchPricingConfigs = useCallback(async () => {
    try {
      const response = await api.get("/pricing-configs");

      if (response.data.success) {
        setPricingConfigs(response.data.configs);
      }
    } catch (err) {
      console.error("Error fetching pricing configs:", err);
    }
  }, []);

  // Save pricing config for a room
  const savePricingConfig = async (roomId, config) => {
    setSavingConfig(true);
    setConfigMessage(null);

    try {
      const room = rooms.find((r) => r.id === roomId);

      const response = await api.post(`/pricing-config/${roomId}`, {
        ...config,
        name: room?.name || "",
      });

      if (response.data.success) {
        setConfigMessage({ type: "success", text: "Configuration saved successfully!" });
        // Update local state
        setPricingConfigs((prev) => ({
          ...prev,
          [roomId]: response.data.config,
        }));
        // Refresh rooms and pricing configs to get updated data
        fetchRooms(activeApiKey || null);
        fetchPricingConfigs();
        // Also refetch rates if dates are selected
        if (startDate && endDate) {
          fetchRates(activeApiKey || null);
        }
        // Close edit form after short delay
        setTimeout(() => {
          setEditingRoom(null);
          setConfigMessage(null);
        }, 1500);
      } else {
        setConfigMessage({ type: "error", text: response.data.error || "Failed to save" });
      }
    } catch (err) {
      console.error("Error saving pricing config:", err);
      setConfigMessage({ type: "error", text: err.message || "Failed to save configuration" });
    } finally {
      setSavingConfig(false);
    }
  };

  // Start editing a room's pricing config
  const startEditingRoom = (room) => {
    const existingConfig = room.pricingConfig || pricingConfigs[room.id];
    setEditForm({
      extraGuestFeePerNight: existingConfig?.extraGuestFeePerNight || 0,
      extraChildFeePerNight: existingConfig?.extraChildFeePerNight || 0,
      startingAtGuest: existingConfig?.startingAtGuest || 1,
      cleaningFeeOverride: existingConfig?.cleaningFeeOverride ?? "",
    });
    setEditingRoom(room.id);
    setConfigMessage(null);
  };

  // Load rooms on mount (with env API key)
  useEffect(() => {
    fetchRooms();
    fetchPricingConfigs();
  }, [fetchRooms, fetchPricingConfigs]);

  // Fetch rates when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchRates(activeApiKey || null);
    }
  }, [startDate, endDate, adults, children, activeApiKey, fetchRates]);

  const handleTestConnection = () => {
    testConnection(customApiKey || null);
  };

  const handleLoadRoomsWithKey = () => {
    setActiveApiKey(customApiKey);
    fetchRooms(customApiKey || null);
    fetchPricingConfigs();
  };

  return (
    <div className="dynamic-rooms-page">
      <header className="drp-header">
        <h1>Dynamic Smoobu Integration Test</h1>
        <p>This page fetches rooms directly from Smoobu API without hardcoded data</p>
      </header>

      {/* Connection Test Section */}
      <section className="drp-section">
        <h2>1. Test Smoobu Connection</h2>
        <div className="drp-connection-test">
          <div className="drp-input-group">
            <label>Custom API Key (optional - uses env if empty):</label>
            <input
              type="text"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="Enter Smoobu API key to test..."
            />
          </div>
          <div className="drp-button-group">
            <button
              onClick={handleTestConnection}
              disabled={connectionLoading}
              className="drp-button"
            >
              {connectionLoading ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={handleLoadRoomsWithKey}
              disabled={roomsLoading}
              className="drp-button drp-button-primary"
            >
              {roomsLoading ? "Loading..." : "Load Rooms with This Key"}
            </button>
          </div>

          {connectionStatus && (
            <div className={`drp-status ${connectionStatus.success ? "success" : "error"}`}>
              {connectionStatus.success ? (
                <>
                  <span className="drp-status-icon">&#10003;</span>
                  <span>Connected! Found {connectionStatus.apartmentCount} apartments</span>
                </>
              ) : (
                <>
                  <span className="drp-status-icon">&#10007;</span>
                  <span>Connection failed</span>
                </>
              )}
            </div>
          )}

          {activeApiKey && (
            <div className="drp-status success">
              <span className="drp-status-icon">&#128273;</span>
              <span>Using custom API key for all requests</span>
            </div>
          )}
        </div>
      </section>

      {/* Rooms List Section */}
      <section className="drp-section">
        <h2>2. Rooms from Smoobu</h2>
        <button onClick={() => fetchRooms(activeApiKey || null)} disabled={roomsLoading} className="drp-button">
          {roomsLoading ? "Loading..." : "Refresh Rooms"}
        </button>

        {roomsError && <div className="drp-error">{roomsError}</div>}

        {roomsLoading ? (
          <div className="drp-loading">Loading rooms from Smoobu...</div>
        ) : (
          <div className="drp-rooms-grid">
            {rooms.map((room) => (
              <div key={room.id} className="drp-room-card">
                <div className="drp-room-header">
                  <h3>{room.name}</h3>
                  <div className="drp-badges">
                    {room.hasPricingConfig && (
                      <span className="drp-badge configured">Firebase Config</span>
                    )}
                    {room.hasSmoobuAddons && (
                      <span className="drp-badge default">Smoobu Addons</span>
                    )}
                    {!room.hasPricingConfig && !room.hasSmoobuAddons && (
                      <span className="drp-badge warning">No Config</span>
                    )}
                  </div>
                </div>
                <div className="drp-room-details">
                  <p><strong>Smoobu ID:</strong> {room.smoobuId}</p>
                  <p><strong>Max Occupancy:</strong> {room.maxOccupancy ? `${room.maxOccupancy} guests` : "Not set in Smoobu"}</p>
                  <p><strong>Type:</strong> {room.type}</p>
                  <p><strong>Currency:</strong> {room.currency || "EUR"}</p>
                  {room.location?.city && (
                    <p><strong>Location:</strong> {room.location.city}</p>
                  )}
                </div>
                <div className="drp-room-pricing">
                  <h4>Fee Configuration:</h4>
                  {room.hasPricingConfig ? (
                    <ul className="drp-config-list">
                      <li>Extra Guest Fee: <strong>{room.extraGuestsPerNight} EUR</strong>/night</li>
                      <li>Extra Child Fee: <strong>{room.extraChildPerNight} EUR</strong>/night</li>
                      <li>Starting at Guest: <strong>{room.startingAtGuest}</strong></li>
                      {room.cleaningFee > 0 && (
                        <li>Cleaning Fee: <strong>{room.cleaningFee} EUR</strong></li>
                      )}
                    </ul>
                  ) : room.hasSmoobuAddons ? (
                    <ul>
                      {room.cleaningFee > 0 && (
                        <li>Cleaning Fee: {room.cleaningFee} EUR (per booking)</li>
                      )}
                      {room.extraGuestsPerNight > 0 && (
                        <li>Extra Guest: {room.extraGuestsPerNight} EUR/person/night</li>
                      )}
                      {room.allFees && room.allFees.map((fee, idx) => (
                        <li key={idx}>{fee.name}: {fee.amount} EUR ({fee.description})</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="drp-no-addons">
                      No fee configuration set. Click "Configure Fees" below.
                    </p>
                  )}
                  <button
                    className="drp-button drp-button-small"
                    onClick={() => startEditingRoom(room)}
                  >
                    Configure Fees
                  </button>
                </div>

                {/* Show rates if available */}
                {rates[room.id] && (
                  <div className={`drp-room-availability ${rates[room.id].isAvailable ? "available" : "unavailable"}`}>
                    <h4>
                      {rates[room.id].isAvailable ? "Available" : "Not Available"}
                    </h4>
                    {rates[room.id].isAvailable && (
                      <div className="drp-pricing-details">
                        {/* Show price breakdown from Smoobu priceElements */}
                        {rates[room.id].priceElements && rates[room.id].priceElements.length > 0 ? (
                          <>
                            {rates[room.id].priceElements.map((el, idx) => (
                              <p key={idx} className={el.amount < 0 ? "drp-discount" : ""}>
                                {el.name}: {el.amount >= 0 ? "" : ""}{el.amount.toFixed(2)} {rates[room.id].currency || "EUR"}
                              </p>
                            ))}
                          </>
                        ) : (
                          <p>Base Price: {rates[room.id].pricing.finalPrice.toFixed(2)} {rates[room.id].currency || "EUR"}</p>
                        )}
                        <p className="drp-final-price">
                          <strong>Total: {rates[room.id].pricing.finalPrice.toFixed(2)} {rates[room.id].currency || "EUR"}</strong>
                        </p>
                        <p className="drp-nights">for {rates[room.id].nights} night(s), {rates[room.id].guestInfo?.total || 2} guest(s)</p>
                        {/* Warning if discount seems too high */}
                        {rates[room.id].pricing.discount < -rates[room.id].pricing.basePrice * 0.5 && (
                          <p className="drp-warning">Note: Large discount applied ({Math.abs(rates[room.id].pricing.discount).toFixed(0)}€)</p>
                        )}
                      </div>
                    )}
                    {/* Show unavailability reason if present */}
                    {!rates[room.id].isAvailable && rates[room.id].unavailableReason && (
                      <p className="drp-unavailable-reason">{rates[room.id].unavailableReason}</p>
                    )}
                    {/* Show message if no price configured */}
                    {rates[room.id].message && (
                      <p className="drp-message">{rates[room.id].message}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!roomsLoading && rooms.length === 0 && !roomsError && (
          <div className="drp-empty">No rooms found. Make sure Smoobu API key is configured.</div>
        )}
      </section>

      {/* Availability Check Section */}
      <section className="drp-section">
        <h2>3. Check Availability & Pricing</h2>
        <div className="drp-availability-form">
          <div className="drp-form-row">
            <div className="drp-input-group">
              <label>Check-in:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="drp-input-group">
              <label>Check-out:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <div className="drp-form-row">
            <div className="drp-input-group">
              <label>Adults:</label>
              <select value={adults} onChange={(e) => setAdults(parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="drp-input-group">
              <label>Children:</label>
              <select value={children} onChange={(e) => setChildren(parseInt(e.target.value))}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {ratesLoading && <div className="drp-loading">Checking availability...</div>}

        {startDate && endDate && !ratesLoading && (
          <div className={`drp-availability-result ${hasAvailability ? "has-availability" : "no-availability"}`}>
            {hasAvailability ? (
              <p>&#10003; Rooms available for your dates! See pricing above.</p>
            ) : (
              <p>&#10007; No rooms available for selected dates.</p>
            )}
          </div>
        )}
      </section>

      {/* Pricing Configuration Modal */}
      {editingRoom && (
        <div className="drp-modal-overlay" onClick={() => setEditingRoom(null)}>
          <div className="drp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drp-modal-header">
              <h3>Configure Pricing - {rooms.find((r) => r.id === editingRoom)?.name}</h3>
              <button className="drp-modal-close" onClick={() => setEditingRoom(null)}>
                &times;
              </button>
            </div>
            <div className="drp-modal-body">
              <p className="drp-modal-info">
                Configure guest fees for this property. These values will be stored in Firebase
                and used to calculate accurate pricing breakdowns.
              </p>

              <div className="drp-config-form">
                <div className="drp-form-group">
                  <label>Extra Guest Fee (per night)</label>
                  <div className="drp-input-with-unit">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.extraGuestFeePerNight}
                      onChange={(e) =>
                        setEditForm({ ...editForm, extraGuestFeePerNight: parseFloat(e.target.value) || 0 })
                      }
                    />
                    <span className="drp-unit">EUR/night</span>
                  </div>
                  <small>Fee charged per extra adult guest per night</small>
                </div>

                <div className="drp-form-group">
                  <label>Extra Child Fee (per night)</label>
                  <div className="drp-input-with-unit">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.extraChildFeePerNight}
                      onChange={(e) =>
                        setEditForm({ ...editForm, extraChildFeePerNight: parseFloat(e.target.value) || 0 })
                      }
                    />
                    <span className="drp-unit">EUR/night</span>
                  </div>
                  <small>Fee charged per child per night</small>
                </div>

                <div className="drp-form-group">
                  <label>Guest Fees Start After</label>
                  <div className="drp-input-with-unit">
                    <select
                      value={editForm.startingAtGuest}
                      onChange={(e) =>
                        setEditForm({ ...editForm, startingAtGuest: parseInt(e.target.value) })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} guest{n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="drp-unit">included</span>
                  </div>
                  <small>Extra guest fees apply after this many guests</small>
                </div>

                <div className="drp-form-group">
                  <label>Cleaning Fee Override (optional)</label>
                  <div className="drp-input-with-unit">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.cleaningFeeOverride}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          cleaningFeeOverride: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Leave empty to use Smoobu value"
                    />
                    <span className="drp-unit">EUR</span>
                  </div>
                  <small>Leave empty to use cleaning fee from Smoobu</small>
                </div>
              </div>

              {configMessage && (
                <div className={`drp-config-message ${configMessage.type}`}>
                  {configMessage.text}
                </div>
              )}
            </div>
            <div className="drp-modal-footer">
              <button
                className="drp-button"
                onClick={() => setEditingRoom(null)}
                disabled={savingConfig}
              >
                Cancel
              </button>
              <button
                className="drp-button drp-button-primary"
                onClick={() => savePricingConfig(editingRoom, editForm)}
                disabled={savingConfig}
              >
                {savingConfig ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <section className="drp-section drp-debug">
        <h2>Debug Info</h2>
        <details>
          <summary>Raw Room Data ({rooms.length} rooms)</summary>
          <pre>{JSON.stringify(rooms, null, 2)}</pre>
        </details>
        {Object.keys(rates).length > 0 && (
          <details>
            <summary>Raw Rates Data</summary>
            <pre>{JSON.stringify(rates, null, 2)}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
