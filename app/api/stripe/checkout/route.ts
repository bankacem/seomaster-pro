import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const schema = z.object({ priceId: z.string().min(1) });
export async function POST(request: Request) { try { if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 }); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid price ID" }, { status: 400 }); const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"; const session = await stripe.checkout.sessions.create({ mode: "subscription", line_items: [{ price: parsed.data.priceId, quantity: 1 }], success_url: `${origin}/dashboard?checkout=success`, cancel_url: `${origin}/pricing?checkout=cancelled` }); return NextResponse.json({ url: session.url }); } catch (error) { console.error("Checkout error", error); return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 }); } }
