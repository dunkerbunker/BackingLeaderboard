export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const runtime = globalThis as unknown as {
    backingMaintenance?: ReturnType<typeof setInterval>;
    backingMaintenanceBusy?: boolean;
  };
  if (runtime.backingMaintenance) return;
  const run = async () => {
    if (runtime.backingMaintenanceBusy) return;
    runtime.backingMaintenanceBusy = true;
    try {
      const { snapshot } = await import("./lib/leaderboard");
      const { db } = await import("./lib/db");
      await snapshot();
      await db().query("DELETE FROM rate_limits WHERE expires_at<now()");
    } catch (error) {
      console.error(
        "Backing maintenance:",
        error instanceof Error ? error.message : "failed",
      );
    } finally {
      runtime.backingMaintenanceBusy = false;
    }
  };
  runtime.backingMaintenance = setInterval(() => void run(), 60_000);
  runtime.backingMaintenance.unref();
}
