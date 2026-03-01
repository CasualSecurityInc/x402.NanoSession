import { ref, onMounted, onUnmounted } from 'vue';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired';

export function usePaymentStatus(sessionId: string, demoServerUrl: string) {
    const status = ref<PaymentStatus>('pending');
    const error = ref<string | null>(null);
    const blockHash = ref<string | null>(null);

    let eventSource: EventSource | null = null;

    onMounted(() => {
        if (!sessionId) return;

        try {
            eventSource = new EventSource(`${demoServerUrl}/api/status/${sessionId}`);

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
                            eventSource?.close();
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse SSE message', e);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE Error:', err);
                error.value = 'Connection lost. Please refresh to try again.';
                eventSource?.close();
            };
        } catch (e: any) {
            error.value = e.message || 'Failed to connect to payment server';
        }
    });

    onUnmounted(() => {
        if (eventSource) {
            eventSource.close();
        }
    });

    return {
        status,
        error,
        blockHash
    };
}
