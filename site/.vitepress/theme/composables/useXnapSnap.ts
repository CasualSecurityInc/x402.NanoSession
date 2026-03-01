import { ref, onMounted } from 'vue';

const XNAP_SNAP_ID = 'npm:@xnap/snap';

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
            isXnapInstalled.value = Object.keys(snaps).includes(XNAP_SNAP_ID);
            return isXnapInstalled.value;
        } catch (e) {
            console.error('Failed to check snaps:', e);
            return false;
        }
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

            const response = await provider.request({
                method: 'wallet_invokeSnap',
                params: {
                    snapId: XNAP_SNAP_ID,
                    request: {
                        method: 'nano_send',
                        params: {
                            to: toAddress,
                            amount: amountRaw,
                            network: 'mainnet'
                        }
                    }
                }
            });

            return response; // Usually contains the block hash or success boolean depending on xnap version
        } catch (e: any) {
            console.error('Payment failed via Xnap:', e);
            error.value = e.message || 'Payment was rejected or failed';
            throw e;
        } finally {
            isPending.value = false;
        }
    }

    return {
        isMetaMaskInstalled,
        isXnapInstalled,
        isPending,
        error,
        installXnap,
        payWithXnap
    };
}
