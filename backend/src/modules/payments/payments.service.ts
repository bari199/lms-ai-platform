import Stripe from "stripe";
import { pool } from "../../config/db.js";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey || !secretKey.startsWith("sk_test_")) {
  throw new Error("A valid Stripe test secret key is required");
}

const stripe = new Stripe(secretKey);

interface CreateCheckoutInput {
  userId: string;
  courseId: string;
}

export async function createCheckoutSession({
  userId,
  courseId,
}: CreateCheckoutInput) {
  // Always retrieve the course price from PostgreSQL.
  const courseResult = await pool.query(
    `SELECT id, title, price
     FROM courses
     WHERE id = $1 AND status = 'approved'`,
    [courseId],
  );

  if (courseResult.rows.length === 0) {
    throw new Error("APPROVED_COURSE_NOT_FOUND");
  }

  const course = courseResult.rows[0];
  const amountInPaise = Math.round(Number(course.price) * 100);

  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
    throw new Error("INVALID_COURSE_PRICE");
  }

  // Avoid creating a second payment for an existing enrollment.
  const enrollmentResult = await pool.query(
    `SELECT id
     FROM enrollments
     WHERE student_id = $1 AND course_id = $2`,
    [userId, courseId],
  );

  if (enrollmentResult.rows.length > 0) {
    throw new Error("ALREADY_ENROLLED");
  }

  const paymentResult = await pool.query(
    `INSERT INTO payments
       (user_id, course_id, amount, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [userId, courseId, course.price],
  );

  const paymentId = paymentResult.rows[0].id;

  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: course.title,
            },
            unit_amount: amountInPaise,
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment/cancel`,
      client_reference_id: userId,
      metadata: {
        paymentId,
        userId,
        courseId,
      },
    });

    await pool.query(
      `UPDATE payments
       SET stripe_checkout_session_id = $1
       WHERE id = $2`,
      [session.id, paymentId],
    );

    return {
      paymentId,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    };
  } catch (error) {
    await pool.query(
      `UPDATE payments
       SET status = 'failed'
       WHERE id = $1 AND status = 'pending'`,
      [paymentId],
    );

    throw error;
  }
}
