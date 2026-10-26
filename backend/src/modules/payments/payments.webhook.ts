import type { Request, Response } from "express";
import Stripe from "stripe";
import { pool } from "../../config/db.js";

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = secretKey ? new Stripe(secretKey) : null;

export async function handleStripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  // Temporary debugging: verify webhook request reaches this handler.
  console.log("WEBHOOK HIT", {
    signaturePresent: typeof req.headers["stripe-signature"] === "string",
    bodyIsBuffer: Buffer.isBuffer(req.body),
  });

  if (!stripe || !webhookSecret) {
    console.error("Stripe webhook configuration is missing");

    res.status(500).json({
      success: false,
      message: "Stripe webhook configuration is missing",
    });
    return;
  }

  const signature = req.headers["stripe-signature"];

  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    console.error("Webhook request validation failed:", {
      signaturePresent: typeof signature === "string",
      bodyIsBuffer: Buffer.isBuffer(req.body),
    });

    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook request",
    });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error(
      "Stripe signature verification failed:",
      error instanceof Error ? error.message : String(error),
    );

    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature",
    });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Ignore completed sessions that have not been paid.
      if (session.payment_status !== "paid") {
        res.status(200).json({ received: true });
        return;
      }

      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;
      const courseId = session.metadata?.courseId;

      if (
        !paymentId ||
        !userId ||
        !courseId ||
        typeof session.id !== "string"
      ) {
        console.error("Checkout metadata is incomplete", {
          sessionIdPresent: typeof session.id === "string",
          paymentIdPresent: Boolean(paymentId),
          userIdPresent: Boolean(userId),
          courseIdPresent: Boolean(courseId),
        });

        res.status(400).json({
          success: false,
          message: "Checkout metadata is incomplete",
        });
        return;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const paymentResult = await client.query(
          `SELECT id, user_id, course_id, amount, status
           FROM payments
           WHERE id = $1
             AND user_id = $2
             AND course_id = $3
             AND stripe_checkout_session_id = $4
           FOR UPDATE`,
          [paymentId, userId, courseId, session.id],
        );

        if (paymentResult.rows.length !== 1) {
          throw new Error("PAYMENT_RECORD_NOT_FOUND");
        }

        const payment = paymentResult.rows[0];

        if (payment.status !== "success") {
          const amountInPaise = Math.round(Number(payment.amount) * 100);

          if (
            session.currency !== "inr" ||
            session.amount_total !== amountInPaise
          ) {
            throw new Error("PAYMENT_AMOUNT_MISMATCH");
          }

          await client.query(
            `UPDATE payments
             SET status = 'success',
                 stripe_payment_intent_id = $1
             WHERE id = $2`,
            [
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
              paymentId,
            ],
          );
        }

        const courseResult = await client.query(
          `SELECT id
           FROM courses
           WHERE id = $1 AND status = 'approved'`,
          [courseId],
        );

        if (courseResult.rows.length !== 1) {
          throw new Error("COURSE_NOT_AVAILABLE");
        }

        await client.query(
          `INSERT INTO enrollments (student_id, course_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, course_id) DO NOTHING`,
          [userId, courseId],
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error instanceof Error ? error.message : String(error),
    );

    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
}
