import { NextResponse } from "next/server";

/**
 * AI chat endpoint.
 * Will stream Claude responses for app generation. Not implemented yet.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 }
  );
}
