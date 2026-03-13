import 'dotenv/config';
import express from 'express';
import { createMiddleware } from '@faremeter/middleware/express';
import { SCHEME, NETWORK } from '@nanosession/core';

const PORT = process.env.SERVER_PORT || 3000;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:4000';
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '1000000000000000000000000'; // 1.0 XNO

async function main() {
  const app = express();

  console.log(`📡 Connecting to facilitator at ${FACILITATOR_URL}...`);

  // Configure Faremeter middleware
  const paymentMiddleware = await createMiddleware({
    facilitatorURL: FACILITATOR_URL,
    accepts: [{
      scheme: SCHEME,
      network: NETWORK,
      maxAmountRequired: PAYMENT_AMOUNT,
      maxTimeoutSeconds: 300,
    }],
  });

  // Protected endpoint
  app.get('/weather', paymentMiddleware, (req, res) => {
    console.log('✅ Access granted to /weather endpoint');
    res.json({
      location: 'NanoCity',
      temperature: 72,
      conditions: 'Sunny',
      forecast: 'Feeless transactions with high probability of efficiency',
      message: 'Thanks for your payment! Enjoy the weather report.',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', scheme: SCHEME, network: NETWORK });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'Try requesting GET /weather to see the x402 flow in action.',
    });
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║           NanoSession Resource Server (Faremeter)                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Using facilitator: ${FACILITATOR_URL}`);
    console.log(`💵 Cost per request: ${PAYMENT_AMOUNT} raw`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  GET http://localhost:${PORT}/weather (PROTECTED)`);
    console.log(`  GET http://localhost:${PORT}/health`);
    console.log('');
    console.log('Test with:');
    console.log(`  pnpm start:client`);
    console.log(`  OR`);
    console.log(`  curl -i http://localhost:${PORT}/weather`);
    console.log('');
  });
}

main().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
