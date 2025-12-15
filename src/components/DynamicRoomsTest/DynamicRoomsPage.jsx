import { useState } from "react";
import { useDynamicRooms, useDynamicRates, useSmoobuConnection } from "../../hooks/useDynamicRooms";
import "./DynamicRoomsPage.css";

/**
 * Test page for dynamic Smoobu room integration
 * This demonstrates fetching rooms directly from Smoobu API
 */
export default function DynamicRoomsPage() {
  const { rooms, loading: roomsLoading, error: roomsError, refetch } = useDynamicRooms();
  const { connectionStatus, loading: connectionLoading, testConnection } = useSmoobuConnection();

  // Date selection for availability check
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const { rates, loading: ratesLoading, hasAvailability } = useDynamicRates(
    startDate,
    endDate,
    adults,
    children
  );

  // For testing with custom API key
  const [customApiKey, setCustomApiKey] = useState("");

  const handleTestConnection = () => {
    testConnection(customApiKey || null);
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
          <button
            onClick={handleTestConnection}
            disabled={connectionLoading}
            className="drp-button"
          >
            {connectionLoading ? "Testing..." : "Test Connection"}
          </button>

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
        </div>
      </section>

      {/* Rooms List Section */}
      <section className="drp-section">
        <h2>2. Rooms from Smoobu</h2>
        <button onClick={refetch} disabled={roomsLoading} className="drp-button">
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
                  <span className={`drp-badge ${room.isConfigured ? "configured" : "default"}`}>
                    {room.isConfigured ? "Configured" : "Using Defaults"}
                  </span>
                </div>
                <div className="drp-room-details">
                  <p><strong>Smoobu ID:</strong> {room.smoobuId}</p>
                  <p><strong>Max Occupancy:</strong> {room.maxOccupancy} guests</p>
                  <p><strong>Max Guests (config):</strong> {room.maxGuests}</p>
                  <p><strong>Type:</strong> {room.type}</p>
                  <p><strong>Currency:</strong> {room.currency}</p>
                  {room.location?.city && (
                    <p><strong>Location:</strong> {room.location.city}</p>
                  )}
                </div>
                <div className="drp-room-pricing">
                  <h4>Pricing Config:</h4>
                  <ul>
                    <li>Extra Guest/Night: {room.extraGuestsPerNight}EUR (after {room.startingAtGuest} guests)</li>
                    <li>Extra Child/Night: {room.extraChildPerNight}EUR</li>
                    <li>Cleaning Fee: {room.cleaningFee}EUR</li>
                    {room.lengthOfStayDiscount?.discountPercentage > 0 && (
                      <li>
                        Long Stay: {room.lengthOfStayDiscount.discountPercentage}% off after{" "}
                        {room.lengthOfStayDiscount.minNights} nights
                      </li>
                    )}
                  </ul>
                </div>

                {/* Show rates if available */}
                {rates[room.id] && (
                  <div className={`drp-room-availability ${rates[room.id].isAvailable ? "available" : "unavailable"}`}>
                    <h4>
                      {rates[room.id].isAvailable ? "Available" : "Not Available"}
                    </h4>
                    {rates[room.id].isAvailable && (
                      <div className="drp-pricing-details">
                        <p>Base: {rates[room.id].pricing.basePrice.toFixed(2)}EUR</p>
                        {rates[room.id].pricing.guestFees > 0 && (
                          <p>Guest Fees: +{rates[room.id].pricing.guestFees.toFixed(2)}EUR</p>
                        )}
                        {rates[room.id].pricing.discount > 0 && (
                          <p>Discount: -{rates[room.id].pricing.discount.toFixed(2)}EUR</p>
                        )}
                        <p className="drp-final-price">
                          <strong>Total: {rates[room.id].pricing.finalPrice.toFixed(2)}EUR</strong>
                        </p>
                        <p className="drp-nights">for {rates[room.id].nights} night(s)</p>
                      </div>
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
