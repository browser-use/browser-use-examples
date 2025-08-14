import { NextRequest } from "next/server";

// Allow streaming responses up to 10 minutes
export const maxDuration = 10 * 60;

export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log(body);

  return new Response("OK");
}
