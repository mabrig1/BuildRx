import { NextResponse } from "next/server";

/**
 * Stripe webhook handler for subscription lifecycle events.
 * Not implemented yet.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 }
  );
}
