import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
})

/* export const sendPaymentSuccessEmail = async (order) => {
  return sendEmail({
    to: order.email,
    subject: `Payment Successful - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Payment Successful 🎉</h2>

        <p>Hello ${order.recipientName},</p>

        <p>
          We have successfully received the payment for order
          <strong>${order.orderNumber}</strong>
        </p>

        <table>
          <tr>
            <td><strong>Order Number</strong></td>
            <td>${order.orderNumber}</td>
          </tr>
          <tr>
            <td><strong>Total</strong></td>
            <td>Rp ${Number(order.grandTotal).toLocaleString('id-ID')}</td>
          </tr>
        </table>

        <p>
          Your order is currently being processed.
        </p>

        <p>
          Thank you for shopping at DIVRSITY.
        </p>
      </div>
    `
  })
} */

export const sendPaymentSuccessEmail = async (order) => {
  const productsHtml = (order.products || []).map((product) => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #eee;">
        <strong>${product.product_name}</strong>
        <br>
        <span style="color: #666; font-size: 12px;">
          ${product.product_variant_name}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #eee;">
        ${product.qty}
      </td>
      <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #eee; white-space: nowrap;">
        Rp ${Number(product.product_price).toLocaleString('id-ID')}
      </td>
      <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #eee; white-space: nowrap;">
        Rp ${Number(product.subtotal).toLocaleString('id-ID')}
      </td>
    </tr>
  `).join('')

  return sendEmail({
    to: order.email,
    subject: `Payment Successful - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333; line-height: 1.5;">
        <h2 style="color: #16a34a;">Payment Successful 🎉</h2>

        <p>Hello ${order.recipientName},</p>

        <p>
          We have successfully received the payment for order
          <strong>${order.orderNumber}</strong>.
        </p>

        <h3>Order Details</h3>

        <p>
          <strong>Order Number:</strong> ${order.orderNumber}
        </p>

        <h3>Products</h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px 8px; text-align: left;">Product</th>
              <th style="padding: 10px 8px; text-align: center;">Qty</th>
              <th style="padding: 10px 8px; text-align: right;">Price</th>
              <th style="padding: 10px 8px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">Shipping Cost</td>
            <td style="padding: 8px 0; text-align: right; white-space: nowrap;">
              Rp ${Number(order.shippingCost || 0).toLocaleString('id-ID')}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong>Grand Total</strong>
            </td>
            <td style="padding: 8px 0; text-align: right; white-space: nowrap;">
              <strong style="font-size: 18px; color: #16a34a;">
                Rp ${Number(order.grandTotal).toLocaleString('id-ID')}
              </strong>
            </td>
          </tr>
        </table>

        <p>
          Your order is currently being processed. We will notify you
          when your order has been shipped.
        </p>

        <p>Thank you for shopping at <strong>DIVRSITY</strong>.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin-top: 24px;">

        <p style="font-size: 12px; color: #888;">
          This is an automated email. Please do not reply directly to this message.
        </p>
      </div>
    `
  })
}

export const sendShippingEmail = async (order) => {
  console.log('KIRIM EMAIL SHIPPING SENT')
  return sendEmail({
    to: order.email,
    subject: `Order Shipped - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Your Order Has Been Shipped 📦</h2>

        <p>Hello ${order.recipientName},</p>

        <p>
          Order <strong>${order.orderNumber}</strong>
          has been handed over to the courier service.
        </p>

        <table>
          <tr>
            <td><strong>Order Number</strong></td>
            <td>${order.orderNumber}</td>
          </tr>

          <tr>
            <td><strong>Tracking Number</strong></td>
            <td>${order.awb}</td>
          </tr>
          
          <tr>
            <td><strong>Courier</strong></td>
            <td>${order.shipping}</td>
          </tr>
        </table>

        <p>
          You can use the tracking number above to track the status of your shipment.
        </p>

        <p>
          Thank you for shopping at DIVRSITY.
        </p>
      </div>
    `
  })
}

export const deliveredShippingEmail = async (order) => {
  console.log('KIRIM EMAIL SHIPPING SENT')
  return sendEmail({
    to: order.email,
    subject: `Order Has Arrived - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Your Order Has Arrived 🎉</h2>

        <p>Hello ${order.recipientName},</p>

        <p>
          Order <strong>${order.orderNumber}</strong>
          has been recorded as delivered.
        </p>

        <p>
          We hope the product meets your expectations.
        </p>

        <p>
          Thank you for shopping at DIVRSITY.
        </p>
      </div>
    `
  })
}

export const sendEmail = async ({
  to,
  subject,
  html
}) => {
  return transporter.sendMail({
    from: `"DIVRSITY" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  })
}