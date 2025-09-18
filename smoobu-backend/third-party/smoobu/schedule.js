import cron from "node-cron";

/**
 * Sets up cron jobs for regular Smoobu synchronization
 */
export function setupScheduledTasks() {
  // Schedule automatic sync every day at 1 AM
  cron.schedule("0 1 * * *", async () => {
    try {
      
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
          console.log("🟩 Scheduled sync completed:", data.stats);
          return data;
        }
      };
      
      // Call the reliable sync endpoint directly
      // Use environment variable for base URL to support both local and production deployments
      const baseUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
      const syncUrl = `${baseUrl}/api/fetch-and-sync`;

      console.log(`📡 Making scheduled sync request to: ${syncUrl}`);
      const axios = await import("axios");
      const response = await axios.default.get(syncUrl);
      console.log("🟩 Scheduled reliable sync completed:", response.data.stats);
    } catch (error) {
      console.error("🟥 Scheduled sync failed:", error);
    }
  });
  
  console.log("📅 Scheduled tasks have been set up - will run every day at 1 AM");
}