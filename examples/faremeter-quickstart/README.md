# NanoSession + Faremeter Quickstart

This example demonstrates how to use NanoSession with [Faremeter](https://faremeter.xyz) for frictionless, agentic payments on the Nano network.

## Overview

In this demo, we'll set up:
1.  **A Facilitator:** Handles Nano payment requirements, verification, and settlement.
2.  **A Resource Server:** An Express server with Faremeter middleware that protects a `/weather` endpoint.
3.  **A Client:** A script using a wrapped `fetch` that automatically handles payments when it encounters an HTTP 402.

All transactions occur on the **Nano Mainnet**, which is feeless and fast.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- A small amount of Nano (XNO) for testing (0.01 XNO is plenty).

## 1. Setup Your Environment

Clone the repository and install dependencies:

```bash
pnpm install
cd examples/faremeter-quickstart
```

## 2. Generate Wallets

We'll use `nanocurrency-cli` to generate seeds for our Payer and Facilitator.

```bash
# Create a directory for wallets
mkdir -p demo-wallets

# Generate Payer seed
npx nanocurrency-cli generate-seed > demo-wallets/payer.seed

# Generate Facilitator seed
npx nanocurrency-cli generate-seed > demo-wallets/facilitator.seed
```

## 3. Fund Your Payer Wallet

Find your Payer's address:

```bash
# Get the address for the payer seed (index 0)
npx nanocurrency-cli derive-address --seed $(cat demo-wallets/payer.seed) --index 0
```

Copy the address and fund it with some Nano (e.g., from [Nano.to](https://nano.to) or a faucet).

## 4. Configure the Environment

Create a `.env` file in `examples/faremeter-quickstart`:

```bash
# Facilitator configuration
NANO_FACILITATOR_ADDRESS=<YOUR_FACILITATOR_ADDRESS>
# NANO_FACILITATOR_SEED=$(cat demo-wallets/facilitator.seed) # Optional: if you want to pocket funds

# Payer configuration
NANO_PAYER_SEED=$(cat demo-wallets/payer.seed)
```

To get your Facilitator address:
```bash
npx nanocurrency-cli derive-address --seed $(cat demo-wallets/facilitator.seed) --index 0
```

## 5. Start the Demo

You'll need three terminal windows:

### Terminal 1: Start the Facilitator
```bash
pnpm start:facilitator
```

### Terminal 2: Start the Resource Server
```bash
pnpm start:server
```

### Terminal 3: Run the Client
```bash
pnpm start:client
```

## How It Works

1.  **Initial Request:** The Client requests `http://localhost:3000/weather`.
2.  **402 Payment Required:** The Resource Server (via Faremeter middleware) responds with an HTTP 402 and payment requirements obtained from the Facilitator.
3.  **Payment Execution:** The wrapped `fetch` catches the 402, uses the Nano payment handler to create and broadcast a Nano transaction, and obtains a block hash.
4.  **Verification:** The wrapped `fetch` retries the request with the payment proof.
5.  **Access Granted:** The Resource Server verifies the proof with the Facilitator. If valid, it returns the weather data.

## Result

The client output should look like this:

```json
{
  "location": "NanoCity",
  "temperature": 72,
  "conditions": "Sunny",
  "forecast": "Feeless transactions with high probability of efficiency",
  "message": "Thanks for your payment! Enjoy the weather report.",
  "timestamp": "2026-03-13T05:00:00.000Z"
}
```

At the same time, you'll see the Facilitator and Server logging the transaction details.
