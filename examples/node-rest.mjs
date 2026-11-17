// node examples/node-rest.mjs   (PIXCHARP_API_KEY=pxa_live_... in the environment)
import { createClient, HaremApiError } from "harem-altin-api";

const client = createClient({ apiKey: process.env.PIXCHARP_API_KEY });

try {
  const has = await client.getPrice("HAS");
  console.log(`Has altın: alış ${has.alis} / satış ${has.satis} (${has.asOfUtc})`);

  const { data, stale } = await client.getPrices(["GRAM_ALTIN", "CEYREK_YENI", "USDTRY"]);
  for (const price of data) console.log(price.symbol, price.alis, price.satis);
  if (stale) console.warn("The feed has not updated for a while.");

  console.log("Remaining this month:", client.rateLimit?.quotaRemaining);
} catch (error) {
  if (error instanceof HaremApiError) {
    console.error(`${error.status} ${error.code}: ${error.message}`);
  } else {
    throw error;
  }
}
