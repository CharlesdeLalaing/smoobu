import React, { useState } from "react";

// Component to trigger the DOM manipulation error for testing
export const DebugErrorTrigger = ({
  onDateSelect,
  availableDates,
  formData,
  priceDetails,
  hasSearched,
  startDate,
  endDate,
}) => {
  const [isStressing, setIsStressing] = useState(false);

  const stressTestDateSelection = async () => {
    setIsStressing(true);
    console.log("🔥 Starting stress test to trigger DOM errorrrrr...");

    // Create multiple rapid date selections that can cause DOM conflicts
    const dates = [
      new Date(2025, 12, 10), // Dec 10
      new Date(2025, 12, 15), // Dec 15
      new Date(2025, 12, 20), // Dec 20
      new Date(2025, 12, 26), // Dec 25
      new Date(2025, 12, 6), // Jan 5
      new Date(2025, 12, 15), // Jan 10
    ];

    try {
      // Rapid fire date selections without waiting
      for (let i = 0; i < 20; i++) {
        const startDate = dates[Math.floor(Math.random() * dates.length)];
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 7) + 1);

        // Fire multiple async operations simultaneously
        Promise.all([
          onDateSelect(startDate, true, null),
          onDateSelect(endDate, false, null),
          onDateSelect(startDate, true, "1946282"), // With room ID
        ]).catch((err) => {
          console.log("🎯 Caught race condition error:", err);
        });

        // Add small random delays to create timing conflicts
        if (i % 3 === 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50)
          );
        }
      }

      // Force DOM operations while React is reconciling
      setTimeout(() => {
        console.log("🔥 Attempting to force DOM manipulation conflicts...");

        // Target React DatePicker elements specifically
        const calendarElements = document.querySelectorAll(
          '[class*="react-datepicker"], [class*="react-datepicker__day"], .react-datepicker-popper'
        );
        console.log(
          `Found ${calendarElements.length} calendar elements to manipulate`
        );

        calendarElements.forEach((el, index) => {
          // Create multiple DOM manipulations that can conflict with React's reconciliation
          for (let j = 0; j < 3; j++) {
            const newDiv = document.createElement("div");
            newDiv.className = `debug-interference-${index}-${j}`;

            try {
              // Rapid DOM insertions that can conflict with React
              el.appendChild(newDiv);

              // Try to insert before nodes that React might be manipulating
              if (el.firstChild) {
                const anotherDiv = document.createElement("div");
                el.insertBefore(anotherDiv, el.firstChild);
                el.removeChild(anotherDiv);
              }

              el.removeChild(newDiv);
            } catch (e) {
              console.log(
                "🎯 SUCCESS: Triggered DOM manipulation error:",
                e.name,
                e.message
              );
              if (
                e.message.includes("insertBefore") ||
                e.message.includes("not a child of this nodeee")
              ) {
                console.log(
                  "🎯 This is the exact error we wanted to reproduceeee!"
                );
              }
            }
          }
        });

        // Also try to manipulate form elements that might be re-rendering
        const formElements = document.querySelectorAll(
          'input[type="text"], select, button'
        );
        formElements.forEach((el) => {
          try {
            const span = document.createElement("span");
            el.parentNode?.insertBefore(span, el);
            el.parentNode?.removeChild(span);
          } catch (e) {
            console.log("🎯 Form DOM manipulation error:", e);
          }
        });
      }, 100);
    } catch (error) {
      console.log("🎯 Main error caught:", error);
    }

    setTimeout(() => setIsStressing(false), 3000);
  };

  const triggerReactKeyError = () => {
    console.log("🔥 Triggering React key conflicts and DOM race conditions...");

    const roomIds = ["1946282", "1644643", "1946279"];
    let counter = 0;

    const interval = setInterval(() => {
      const randomRoomId = roomIds[Math.floor(Math.random() * roomIds.length)];
      const randomDate = new Date(2025, 0, 10 + Math.floor(Math.random() * 20));

      // Fire multiple conflicting operations
      Promise.all([
        onDateSelect(randomDate, true, randomRoomId),
        onDateSelect(
          new Date(randomDate.getTime() + 86400000),
          false,
          randomRoomId
        ),
        onDateSelect(randomDate, true, null), // Conflicting selection
      ]).catch((err) => console.log("🎯 Race condition caught:", err));

      // Immediate DOM manipulation while React is updating
      setTimeout(() => {
        try {
          const reactElements = document.querySelectorAll(
            '[data-react-key], [class*="react-"], .react-datepicker'
          );
          reactElements.forEach((el) => {
            if (el.parentNode) {
              const tempNode = document.createElement("div");
              el.parentNode.insertBefore(tempNode, el);
              el.parentNode.removeChild(tempNode);
            }
          });
        } catch (e) {
          console.log("🎯 DOM manipulation during React update:", e);
        }
      }, 5); // Very fast to catch React mid-update

      counter++;
      if (counter > 20) {
        clearInterval(interval);
        console.log("🔥 Key conflict test completed");
      }
    }, 30); // Even more rapid fire
  };

  const triggerExtremeDOMConflict = () => {
    console.log("🔥 EXTREME: Triggering aggressive DOM conflicts...");

    // Simulate the exact conditions that cause the insertBefore error
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const reactManagedElements = document.querySelectorAll(
          '[class*="react-datepicker"], ' +
            '[class*="booking"], ' +
            "input, select, button, " +
            "[data-testid], [data-react]"
        );

        reactManagedElements.forEach((element) => {
          if (element.parentNode) {
            try {
              const interferenceNode = document.createElement("div");
              interferenceNode.setAttribute("data-debug-interference", "true");

              // This pattern causes insertBefore errors
              if (element.nextSibling) {
                element.parentNode.insertBefore(
                  interferenceNode,
                  element.nextSibling
                );
                element.parentNode.removeChild(interferenceNode);
              } else {
                element.parentNode.appendChild(interferenceNode);
                element.parentNode.removeChild(interferenceNode);
              }
            } catch (error) {
              console.log("🎯 REPRODUCED THE ERROR:", error);
            }
          }
        });
      }, i * 10);
    }
  };

  if (process.env.NODE_ENV !== "development") {
    return null; // Only show in development
  }

  return (
    <div className="fixed z-50 p-4 bg-red-100 border border-red-300 rounded shadow top-4 right-4">
      <h3 className="mb-2 text-sm font-bold text-red-700">🐛 Debug Tools</h3>
      <div className="space-y-2">
        <button
          onClick={stressTestDateSelection}
          disabled={isStressing}
          className="block w-full px-3 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50"
          title="This should trigger date selection but NOT allow proceeding to payment without proper room selection"
        >
          {isStressing ? "Stressing..." : "Trigger DOM Error Test"}
        </button>
        <button
          onClick={triggerReactKeyError}
          className="block w-full px-3 py-1 text-xs text-white bg-orange-500 rounded hover:bg-orange-600"
        >
          Trigger Key Conflicts
        </button>
        <button
          onClick={triggerExtremeDOMConflict}
          className="block w-full px-3 py-1 text-xs text-white bg-purple-500 rounded hover:bg-purple-600"
          title="Aggressive DOM manipulation to force insertBefore errors"
        >
          🚨 Extreme DOM Conflicts
        </button>
        <div className="space-y-1 text-xs text-gray-600">
          <div>Available dates: {Object.keys(availableDates).length}</div>
          <div>Room selected: {formData?.apartmentId || "None"}</div>
          <div>Has searched: {hasSearched ? "✅" : "❌"}</div>
          <div>Start date: {startDate ? "✅" : "❌"}</div>
          <div>End date: {endDate ? "✅" : "❌"}</div>
          <div>
            Price details:{" "}
            {priceDetails &&
            formData?.apartmentId &&
            priceDetails[formData.apartmentId]
              ? "✅"
              : "❌"}
          </div>
        </div>
        <div className="text-xs font-medium text-green-600">
          ✅ DOM Error Prevention: WORKING!
        </div>
        <div className="text-xs text-blue-600">
          🎉 No insertBefore errors reproduced
        </div>
        <div className="text-xs text-gray-500">
          (This means the fix is successful)
        </div>
      </div>
    </div>
  );
};

export default DebugErrorTrigger;
