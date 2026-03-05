import { NanoRpcClient } from '@nanosession/rpc';
import { hasActiveSessions, getAmountToSessionMap, updateSessionStatus } from '../routes/status';

const POLL_INTERVAL_MS = 5_000; // Poll every 5 seconds
const HISTORY_COUNT = 10;       // Check last 10 blocks

let pollTimer: NodeJS.Timeout | null = null;
let lastSeenHash: string | null = null;

/**
 * Start the RPC polling fallback.
 * Periodically checks account_history for recent receive blocks
 * and matches them against active payment sessions.
 * Only hits the RPC when there are pending sessions.
 */
export function startRpcPoller(rpcClient: NanoRpcClient, account: string) {
    if (pollTimer) return; // Already running

    console.log(`[RPC-POLL] Starting fallback poller (every ${POLL_INTERVAL_MS / 1000}s when sessions active)`);

    pollTimer = setInterval(async () => {
        if (!hasActiveSessions()) return;

        try {
            const history = await rpcClient.getAccountHistory(account, HISTORY_COUNT);

            if (!history.length) return;

            const amountMap = getAmountToSessionMap();
            const activeAmounts = Object.keys(amountMap);
            let matchCount = 0;

            for (const entry of history) {
                // Stop at already-seen blocks to avoid reprocessing
                if (entry.hash === lastSeenHash) break;

                // In account_history for our account:
                //   type='receive' = funds arriving (someone sent to us) — this is what we want
                //   type='send' = funds leaving (we sent to someone) — ignore
                //   type='change' = representative change — ignore
                if (entry.type === 'receive' && entry.confirmed === 'true' && activeAmounts.includes(entry.amount)) {
                    console.log(`[RPC-POLL] Found matching payment! Hash: ${entry.hash}, Amount: ${entry.amount}`);
                    updateSessionStatus(entry.amount, entry.hash, 'confirmed');
                    matchCount++;
                }
            }

            // Update watermark to the latest block we've seen
            if (history[0]) {
                lastSeenHash = history[0].hash;
            }

            if (matchCount > 0 || activeAmounts.length > 0) {
                console.log(`[RPC-POLL] Checked ${history.length} recent blocks, ${activeAmounts.length} active sessions, ${matchCount} matches`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[RPC-POLL] Error polling account history: ${msg}`);
        }
    }, POLL_INTERVAL_MS);
}

/**
 * Stop the poller (for graceful shutdown)
 */
export function stopRpcPoller() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}
