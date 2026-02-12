import express from 'express';
import { createMiddleware } from '@faremeter/middleware/express';
import { SCHEME, NETWORK } from '@nanosession/core';

const APP_PORT = process.env.PORT || 3000;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:4000';
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '1000000000000000000000000';

async function main() {
  const app = express();

  const paymentMiddleware = await createMiddleware({
    facilitatorURL: FACILITATOR_URL,
    accepts: [{
      scheme: SCHEME,
      network: NETWORK,
      maxAmountRequired: PAYMENT_AMOUNT,
      maxTimeoutSeconds: 300,
    }],
  });

  app.get('/api/resource', paymentMiddleware, (_req, res) => {
    res.json({
      message: 'Access granted!',
      resource: {
        id: 'example-resource-1',
        name: 'Premium Content',
        data: 'This is protected content that required a NanoSession payment.',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', scheme: SCHEME, network: NETWORK });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not found',
      endpoints: [
        'GET /api/resource - Protected resource (requires payment)',
        'GET /health - Health check',
      ],
    });
  });

  const server = app.listen(APP_PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║      NanoSession + Faremeter Example Server                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running on http://localhost:${APP_PORT}`);
    console.log(`📡 Using facilitator at ${FACILITATOR_URL}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  GET http://localhost:${APP_PORT}/api/resource (protected)`);
    console.log(`  GET http://localhost:${APP_PORT}/health`);
    console.log('');
    console.log('Test with:');
    console.log(`  curl -i http://localhost:${APP_PORT}/api/resource`);
    console.log('');
  });

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    server.close(() => process.exit(0));
  });
}

main().catch(console.error);
