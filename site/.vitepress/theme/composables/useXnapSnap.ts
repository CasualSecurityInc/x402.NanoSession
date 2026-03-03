import { ref, onMounted } from 'vue';

const XNAP_SNAP_ID = 'npm:@obsidia/xnap';
const XNAP_LEGACY_SNAP_ID = 'npm:@xnap/snap'; // Old ID for backwards compatibility

export function useXnapSnap() {
    const isMetaMaskInstalled = ref(false);
    const isXnapInstalled = ref(false);
    const isPending = ref(false);
    const error = ref<string | null>(null);

    onMounted(async () => {
        checkMetaMask();
        if (isMetaMaskInstalled.value) {
            await checkXnapInstalled();
        }
    });

    function checkMetaMask() {
        isMetaMaskInstalled.value = typeof window !== 'undefined' && Boolean((window as any).ethereum);
    }

    async function checkXnapInstalled() {
        if (!isMetaMaskInstalled.value) return false;

        try {
            const provider = (window as any).ethereum;
            const snaps = await provider.request({ method: 'wallet_getSnaps' });
            const snapIds = Object.keys(snaps);
            // Check for either the new or legacy snap ID
            isXnapInstalled.value = snapIds.includes(XNAP_SNAP_ID) || snapIds.includes(XNAP_LEGACY_SNAP_ID);
            return isXnapInstalled.value;
        } catch (e: any) {
            // wallet_getSnaps may not be available if:
            // 1. MetaMask doesn't support Snaps (older version)
            // 2. Another wallet is overriding window.ethereum
            // 3. User hasn't connected any wallet yet
            console.warn('Could not check installed snaps:', e?.message || e);
            return false;
        }
    }

    /**
     * Get the detected snap ID (new or legacy) or default to new
     */
    async function getDetectedSnapId(): Promise<string> {
        if (!isMetaMaskInstalled.value) return XNAP_SNAP_ID;
        
        try {
            const provider = (window as any).ethereum;
            const snaps = await provider.request({ method: 'wallet_getSnaps' });
            const snapIds = Object.keys(snaps);
            if (snapIds.includes(XNAP_SNAP_ID)) return XNAP_SNAP_ID;
            if (snapIds.includes(XNAP_LEGACY_SNAP_ID)) return XNAP_LEGACY_SNAP_ID;
        } catch (e: any) {
            console.warn('Could not detect snap ID:', e?.message || e);
        }
        return XNAP_SNAP_ID;
    }

    async function installXnap() {
        if (!isMetaMaskInstalled.value) return;

        isPending.value = true;
        error.value = null;

        try {
            const provider = (window as any).ethereum;
            await provider.request({
                method: 'wallet_requestSnaps',
                params: {
                    [XNAP_SNAP_ID]: {}
                }
            });
            isXnapInstalled.value = true;
        } catch (e: any) {
            console.error('User rejected snap install or error:', e);
            error.value = e.message || 'Failed to install Xnap';
        } finally {
            isPending.value = false;
        }
    }

    async function payWithXnap(toAddress: string, amountRaw: string) {
        if (!isMetaMaskInstalled.value || !isXnapInstalled.value) return;

        isPending.value = true;
        error.value = null;

        try {
            const provider = (window as any).ethereum;
            
            // Get the actual detected snap ID (handles legacy installs)
            const snapId = await getDetectedSnapId();
            // Convert raw to XNO decimal format (Nano uses 30 decimal places)
            const rawBigInt = BigInt(amountRaw);
            const divisor = 10n ** 30n; // 10^30
            const wholePart = rawBigInt / divisor;
            const fractionPart = rawBigInt % divisor;
            const amountDecimal = `${wholePart}.${fractionPart.toString().padStart(30, '0').replace(/0+$/, '')}`;

            const requestPayload = {
                method: 'wallet_invokeSnap',
                params: {
                    snapId: snapId,
                    request: {
                        method: 'xno_makeTransaction',
                        params: {
                            to: toAddress,
                            value: amountDecimal
                        }
                    }
                }
            };
            console.log('[Xnap] Sending request:', JSON.stringify(requestPayload, null, 2));

            const response = await provider.request(requestPayload);
            console.log('[Xnap] Raw response:', response);
            console.log('[Xnap] Response type:', typeof response);
            console.log('[Xnap] Response keys:', response ? Object.keys(response) : 'null');

            isPending.value = false;
            return response; // Contains { hash: string | undefined }
        } catch (e: any) {
            console.error('[Xnap] Payment failed:', e);
            console.error('[Xnap] Error type:', typeof e);
            console.error('[Xnap] Error code:', e?.code);
            console.error('[Xnap] Error message:', e?.message);
            console.error('[Xnap] Error data:', e?.data);
            console.error('[Xnap] Error stack:', e?.stack);
            
            // Handle specific error cases
            const errorCode = e?.code || e?.data?.code;
            const errorMsg = e?.message || '';
            
            if (errorCode === -32603 || errorMsg.includes('non-JSON-serializable')) {
                // Xnap snap bug: returns non-serializable response even on success
                // Transaction likely succeeded - let SSE detect it
                console.log('[Xnap] Non-serializable error detected. Transaction may have succeeded. Waiting for SSE...');
                // Don't set error or throw - keep isPending true so UI shows "in progress"
                // SSE will update the UI when payment is detected
                return { hash: undefined, pending: true };
            } else if (errorCode === 4001) {
                error.value = 'Transaction rejected by user.';
                isPending.value = false;
                throw e;
            } else {
                error.value = errorMsg || 'Payment was rejected or failed';
                isPending.value = false;
                throw e;
            }
        }
    }

    function reset() {
        isPending.value = false;
        error.value = null;
    }

    return {
        isMetaMaskInstalled,
        isXnapInstalled,
        isPending,
        error,
        installXnap,
        payWithXnap,
        reset
    };
}
