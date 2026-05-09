import { Request, Response, Router } from 'express';
import { NanoRpcClient } from '@nanosession/rpc';

let rpcClient: NanoRpcClient | null = null;

export function __setPollRpcClientForTests(client: NanoRpcClient | null) {
  rpcClient = client;
}

function getRpcClient(): NanoRpcClient {
  if (!rpcClient) {
    if (!process.env.NANO_RPC_URL) {
      throw new Error('NANO_RPC_URL environment variable is not set');
    }

    rpcClient = new NanoRpcClient({
      endpoints: [process.env.NANO_RPC_URL],
      timeoutMs: 15000,
    });
  }

  return rpcClient;
}

export const pollRoute = Router();

pollRoute.get('/', async (req: Request, res: Response) => {
  const payerAccount = req.query.payerAccount;
  const payTo = req.query.payTo;
  const amount = req.query.amount;

  if (typeof payerAccount !== 'string' || typeof payTo !== 'string' || typeof amount !== 'string') {
    res.status(400).json({ error: 'payerAccount, payTo, and amount are required' });
    return;
  }

  try {
    const rpc = getRpcClient();
    const history = await rpc.getAccountHistory(payerAccount, 20);

    for (const entry of history) {
      if (entry.type !== 'send' || entry.confirmed !== 'true' || entry.amount !== amount) {
        continue;
      }

      const blockInfo = await rpc.getBlockInfo(entry.hash);
      if (!blockInfo.confirmed || blockInfo.link_as_account !== payTo) {
        continue;
      }

      res.json({
        found: true,
        sendHash: entry.hash,
        payerAccount,
        payTo,
        amount,
      });
      return;
    }

    res.json({ found: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Polling failed';
    res.status(502).json({ error: message });
  }
});

pollRoute.post('/mock-match', (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'test') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { sendHash, payerAccount, payTo, amount } = req.body ?? {};
  res.json({
    found: true,
    sendHash,
    payerAccount,
    payTo,
    amount,
  });
});
