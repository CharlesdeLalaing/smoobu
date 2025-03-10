import cron from "node-cron";
import { fetchAndSync } from "./actions/api/fetch-and-sync.js";

/**
 * Sets up cron jobs for regular Smoobu synchronization
 */
export function setupScheduledTasks() {
  // Schedule automatic sync every 12 hours
  cron.schedule("0 */12 * * *", async () => {
    try {
      console.log("🟦 Starting scheduled sync...", new Date().toISOString());
      
      // Calculate date range for the past 1 year (365 days)
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      
      const req = { 
        query: { 
          startDate: startDate, 
          endDate: endDate 
        } 
      };
      
      const res = {
        status: (code) => ({
          json: (data) => {
            if (code >= 400) {
              console.error(`🟥 Sync failed with status ${code}:`, data);
              throw new Error(data.error || "Sync failed");
            }
            return data;
          }
        }),
        json: (data) => {

          return data;
        }
      };
      
      await fetchAndSync(req, res);
    } catch (error) {
      console.error("🟥 Scheduled sync failed:", error);
    }
  });
  
  console.log("📅 Scheduled tasks have been set up - will run every 12 hours");
}