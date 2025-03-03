import cron from "node-cron";
import { syncReservations } from "../smoobu/syncReservationsNodeCron.js";

/**
 * Sets up cron jobs for regular Smoobu synchronization
 */
export function setupScheduledTasks() {
  // Schedule automatic sync every 12 hours
  cron.schedule("0 */12 * * *", async () => {
    try {
      console.log("🟦 Starting scheduled sync...");
      await syncReservations();
      console.log("🟩 Scheduled sync completed");
    } catch (error) {
      console.error("🟥 Scheduled sync failed:", error);
    }
  });

  console.log("📅 Scheduled tasks have been set up");
}
