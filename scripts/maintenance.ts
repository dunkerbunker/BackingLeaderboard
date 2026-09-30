import { db } from "../src/lib/db";
import { currentSeason, snapshot } from "../src/lib/leaderboard";
async function main() {
  try {
    const season = await currentSeason();
    await snapshot();
    await db().query("DELETE FROM rate_limits WHERE expires_at<now()");
    await db().query(
      "DELETE FROM claims WHERE status='pending' AND expires_at<now()-interval '30 days'",
    );
    console.log(
      `Maintenance complete: active season ${season.starts_at}; rankings captured; expired counters removed.`,
    );
  } finally {
    await db().end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
