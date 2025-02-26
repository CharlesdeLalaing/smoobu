// Save this as test-firebase.js
import { db } from "./firebase-config.js";

async function testFirebase() {
  console.log("Starting Firebase connection test...");
  console.log("db object type:", typeof db);
  console.log("db object exists:", !!db);

  try {
    // Try to get a document from the bookings collection
    console.log("Attempting to query Firestore...");
    const snapshot = await db.collection("bookings").limit(1).get();

    console.log("Query successful!");
    console.log(`Found ${snapshot.size} booking(s) in the bookings collection`);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      console.log("Sample booking ID:", doc.id);
      console.log("Sample booking data:", Object.keys(doc.data()));
    }

    // Try to access the collection methods
    console.log("\nChecking Firestore methods:");
    console.log("db.collection exists:", typeof db.collection === "function");
    console.log("db.doc exists:", typeof db.doc === "function");

    return "Firebase connection test completed successfully";
  } catch (error) {
    console.error("Error testing Firebase connection:", error);
    return `Firebase connection test failed: ${error.message}`;
  }
}

// Run the test
testFirebase()
  .then((result) => {
    console.log("\nResult:", result);
  })
  .catch((error) => {
    console.error("\nFatal error:", error);
  });
