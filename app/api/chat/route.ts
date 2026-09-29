import { env } from "cloudflare:workers";
import { onRequestPost } from "../../../../functions/api/chat.js";

export async function POST(request: Request) {
  return onRequestPost({
    request,
    env: {
      OLLAMA_API_KEY: env.OLLAMA_API_KEY,
      OLLAMA_URL: env.OLLAMA_URL || "https://ollama.com/api/chat"
    }
  });
}
