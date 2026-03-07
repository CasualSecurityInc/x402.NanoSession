import { ref, onMounted, onUnmounted } from 'vue';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired';

export function usePaymentStatus(sessionId: string, demoServerUrl: string) {
    const status = ref<PaymentStatus>('pending');
    const error = ref<string | null>(null);
    const blockHash = ref<string | null>(null);

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let isManuallyClosed = false;
    const MAX_RECONNECT_DELAY = 30000; // Cap at 30 seconds

    const connect = () => {
        if (!sessionId || isManuallyClosed) return;

        // Clear any pending reconnect
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        try {
            eventSource = new EventSource(`${demoServerUrl}/api/status/${sessionId}`);

            eventSource.onopen = () => {
                console.log('[SSE] Connected');
                reconnectAttempts = 0; // Reset on successful connection
                error.value = null;
            };

            eventSource.onmessage = (event) => {
                try {
                    // filter out heartbeat
                    if (event.data === 'heartbeat') return;

                    const data = JSON.parse(event.data);
                    if (data.status) {
                        status.value = data.status;
                        if (data.blockHash) {
                            blockHash.value = data.blockHash;
                        }

                        // If confirmed or failed, we can close the connection
                        if (data.status === 'confirmed' || data.status === 'failed') {
                            isManuallyClosed = true;
                            eventSource?.close();
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse SSE message', e);
                }
            };

            eventSource.onerror = (err) => {
                console.warn('[SSE] Connection error, will reconnect...', err);
                eventSource?.close();
                eventSource = null;

                // Don't set error immediately - try to reconnect first
                // Only set error after multiple failed attempts
                if (status.value === 'pending') {
                    scheduleReconnect();
                }
            };
        } catch (e: any) {
            error.value = e.message || 'Failed to connect to payment server';
        }
    };

    const scheduleReconnect = () => {
        if (isManuallyClosed || status.value !== 'pending') return;

        reconnectAttempts++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);

        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

        reconnectTimeout = setTimeout(() => {
            connect();
        }, delay);
    };

    // Handle visibility change for mobile backgrounding
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log('[SSE] Page visible, checking connection...');
            // If we think we're still pending but connection might be dead, reconnect
            if (status.value === 'pending' && (!eventSource || eventSource.readyState === EventSource.CLOSED)) {
                console.log('[SSE] Connection dead on visibility change, reconnecting');
                connect();
            }
        }
    };

    onMounted(() => {
        connect();
        document.addEventListener('visibilitychange', handleVisibilityChange);
    });

    onUnmounted(() => {
        isManuallyClosed = true;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
        if (eventSource) {
            eventSource.close();
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    return {
        status,
        error,
        blockHash
    };
}
