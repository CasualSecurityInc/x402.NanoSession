#!/bin/sh
if [ "$VITE_ENABLE_TESTNET_TAB" = "true" ]; then
  concurrently --kill-others -n site,mainnet,testnet \
    "pnpm site:dev" \
    "pnpm demo:mainnet" \
    "pnpm demo:testnet"
else
  concurrently --kill-others -n site,mainnet \
    "pnpm site:dev" \
    "pnpm demo:mainnet"
fi
