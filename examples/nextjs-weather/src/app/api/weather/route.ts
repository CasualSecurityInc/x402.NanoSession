import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { server, facilitatorAddress } from "../../../x402";
// Note: We aren't doing the @x402/extensions/bazaar extension because
// it is out of scope for a bare-minimum Next.js API example.

// Derive payTo from seed if configured, otherwise use fallback address
const NANO_FALLBACK_PAY_TO = "nano_3x402nanosessionexampleaddressweusesodontsendmoneytothisaddr";
const NANO_TEST_PAY_TO = facilitatorAddress || NANO_FALLBACK_PAY_TO;

import { decodePaymentSignature } from "@nanosession/core";
import { withX402Context } from "@nanosession/x402";

/**
 * Weather API endpoint handler
 * This handler returns weather data after payment verification.
 */
const handler = async (_: NextRequest) => {
  return NextResponse.json(
    {
      report: {
        weather: "sunny",
        temperature: 72,
      },
    },
    { status: 200 },
  );
};

/**
 * Protected weather API endpoint using withX402 wrapper
 *
 * This demonstrates the x402 wrapper which returns HTTP 402 with
 * Payment-Required headers when first accessed, and executes the
 * handler only when a valid Payment-Signature is received.
 */
const wrappedGET = withX402(
  handler,
  {
    accepts: [
      {
        scheme: "exact",
        price: "0.01", // x402-adapter parses this into 10^28 raw (0.01 XNO)
        network: "nano:mainnet",
        payTo: NANO_TEST_PAY_TO,
        extra: {
          nanoSession: {} // This triggers Track 1 (stateful tagged proof)
        }
      },
      {
        scheme: "exact",
        price: "0.01",
        network: "nano:mainnet",
        payTo: NANO_TEST_PAY_TO,
        extra: {
          nanoSignature: {} // This triggers Track 2 (stateless signature proof)
        }
      },
    ],
    description: "Access to weather API",
    mimeType: "application/json",
  },
  server
);

export const GET = (req: NextRequest) => {
  const signature = req.headers.get('PAYMENT-SIGNATURE');
  let sessionId: string | undefined;

  if (signature) {
    try {
      const payload = decodePaymentSignature(signature);
      sessionId = payload.accepted?.extra?.nanoSession?.id;
    } catch (e) {
      // Ignore invalid signatures, server will return 400/402
    }
  }

  return withX402Context({ sessionId }, () => wrappedGET(req));
};
