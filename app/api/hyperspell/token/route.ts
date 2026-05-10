import { NextRequest, NextResponse } from "next/server";
import Hyperspell from "@hyperspell/hyperspell";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.HYPERSPELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HYPERSPELL_API_KEY is required" },
      { status: 500 }
    );
  }

  const userId =
    req.headers.get("x-triage-user-id")?.trim() ||
    process.env.HYPERSPELL_CONNECT_USER_ID?.trim();
  if (!userId) {
    return NextResponse.json(
      {
        error:
          "HYPERSPELL_CONNECT_USER_ID is required until authenticated user mapping is wired.",
      },
      { status: 400 }
    );
  }

  const hyperspell = new Hyperspell({
    apiKey,
  });

  try {
    const response = await hyperspell.auth.userToken({
      user_id: userId,
    });

    return NextResponse.json({ token: response.token });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create Hyperspell user token",
      },
      { status: 502 }
    );
  }
}
