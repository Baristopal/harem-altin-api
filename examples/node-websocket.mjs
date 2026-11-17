// npm install harem-altin-api ws
// node examples/node-websocket.mjs   (Pro or Business plan key in PIXCHARP_API_KEY)
import WebSocket from "ws";
import { stream } from "harem-altin-api";

const prices = stream({
  apiKey: process.env.PIXCHARP_API_KEY,
  WebSocket, // sends the key in the X-API-Key header
  symbols: ["HAS", "GRAM_ALTIN", "USDTRY"],
  onSnapshot: (snapshot) => console.log("snapshot:", snapshot.data.length, "symbols"),
  onPrice: (price) => console.log(price.symbol, price.alis, price.satis),
  onError: (error) => console.error(error.code, error.message),
});

process.on("SIGINT", () => {
  prices.close();
  process.exit(0);
});
