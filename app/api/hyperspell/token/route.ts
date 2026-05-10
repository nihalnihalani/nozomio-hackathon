import { NextResponse } from 'next/server';
import Hyperspell from '@hyperspell/hyperspell';

export async function POST() {
  // In a real app we'd get the authenticated userId here.
  // For the hackathon, we hardcode the specific sandbox userId.
  const userId = 'sandbox:yahya.s.alhinai@gmail.com';

  const hyperspell = new Hyperspell({
    apiKey: process.env.HYPERSPELL_API_KEY!,
  });

  const response = await hyperspell.auth.userToken({
    user_id: userId,
  });

  return NextResponse.json({ token: response.token });
}