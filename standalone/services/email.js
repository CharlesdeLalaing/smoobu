const nodemailer = require('nodemailer');

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter verification failed:', error.message);
  } else {
    console.log('Email transporter is ready to send messages');
  }
});

/**
 * Send booking confirmation email to admin
 * @param {Object} booking - The booking data
 * @param {Object} paymentIntent - Stripe payment intent data
 */
async function sendAdminNotification(booking, paymentIntent) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    console.warn('ADMIN_EMAIL not configured, skipping admin notification');
    return;
  }

  const extrasHtml = booking.extras && booking.extras.length > 0
    ? `<h3>Extras:</h3><ul>${booking.extras.map(e =>
        `<li>${e.name}: ${e.amount}€${e.extraPersonQuantity > 0 ? ` + ${e.extraPersonQuantity} x ${e.extraPersonPrice}€` : ''}</li>`
      ).join('')}</ul>`
    : '';

  const couponHtml = booking.couponApplied
    ? `<p><strong>Code promo:</strong> ${booking.couponApplied.code} (-${booking.couponApplied.discount}€)</p>`
    : '';

  const spaHtml = booking.spaDateTime
    ? `<p><strong>SPA:</strong> ${booking.spaDateTime}</p>`
    : booking.spaBookingPreference === 'later'
    ? `<p><strong>SPA:</strong> À réserver ultérieurement</p>`
    : '';

  const mailOptions = {
    from: `"Ferme de Basseilles - Réservations" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Nouvelle réservation - ${booking.firstName} ${booking.lastName} - ${booking.arrivalDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #668E73; border-bottom: 2px solid #668E73; padding-bottom: 10px;">
          Nouvelle Réservation Confirmée
        </h1>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Détails du Client</h2>
          <p><strong>Nom:</strong> ${booking.firstName} ${booking.lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
          <p><strong>Téléphone:</strong> ${booking.phone || 'Non renseigné'}</p>
          <p><strong>Adresse:</strong> ${booking.street || 'Non renseignée'}</p>
          <p><strong>Code postal / Ville:</strong> ${booking.postalCode || ''} ${booking.location || booking.city || ''}</p>
          <p><strong>Pays:</strong> ${booking.country || 'Non renseigné'}</p>
        </div>

        <div style="background-color: #e8f4ea; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Détails de la Réservation</h2>
          <p><strong>Chambre:</strong> ${booking.roomName || booking.apartmentName || 'Room ' + booking.apartmentId}</p>
          <p><strong>Arrivée:</strong> ${booking.arrivalDate}</p>
          <p><strong>Heure d'arrivée:</strong> ${booking.arrivalTime || 'Non spécifiée'}</p>
          <p><strong>Départ:</strong> ${booking.departureDate}</p>
          <p><strong>Adultes:</strong> ${booking.adults || 2}</p>
          <p><strong>Enfants:</strong> ${booking.children || 0}</p>
          ${spaHtml}
        </div>

        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Détails du Paiement</h2>
          <p><strong>Prix de base:</strong> ${booking.basePrice || booking.priceDetailsSnapshot?.originalPrice || 0}€</p>
          ${(() => {
            const breakdown = booking.priceBreakdown?.guestFeesBreakdown || booking.priceDetailsSnapshot?.guestFeesBreakdown;
            if (breakdown) {
              let html = '';
              if (breakdown.extraAdults > 0) {
                const adultFees = breakdown.extraAdults * breakdown.extraGuestFeePerNight * breakdown.nights;
                html += `<p><strong>Frais adultes suppl.:</strong> ${breakdown.extraAdults} × ${breakdown.extraGuestFeePerNight}€ × ${breakdown.nights} nuit(s) = ${adultFees}€</p>`;
              }
              if (breakdown.extraChildren > 0) {
                const childFees = breakdown.extraChildren * breakdown.extraChildFeePerNight * breakdown.nights;
                html += `<p><strong>Frais enfants suppl.:</strong> ${breakdown.extraChildren} × ${breakdown.extraChildFeePerNight}€ × ${breakdown.nights} nuit(s) = ${childFees}€</p>`;
              }
              return html || `<p><strong>Frais invités:</strong> 0€</p>`;
            }
            return `<p><strong>Frais invités:</strong> ${booking.guestFees || 0}€</p>`;
          })()}
          ${extrasHtml}
          ${couponHtml}
          <hr style="border: 1px solid #ddd;">
          <p style="font-size: 18px;"><strong>TOTAL PAYÉ:</strong> ${booking.totalPriceWithExtras || paymentIntent.amount / 100}€</p>
          <p><strong>ID Paiement Stripe:</strong> ${paymentIntent.id}</p>
          <p><strong>Statut:</strong> <span style="color: green; font-weight: bold;">CONFIRMÉ</span></p>
        </div>

        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement par le système de réservation.</p>
          <p>Date de réception: ${new Date().toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' })}</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin notification sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
}

/**
 * Send booking confirmation email to guest
 * @param {Object} booking - The booking data
 */
async function sendGuestConfirmation(booking) {
  const extrasHtml = booking.extras && booking.extras.length > 0
    ? `<h3>Extras réservés:</h3><ul>${booking.extras.map(e =>
        `<li>${e.name}: ${e.amount}€</li>`
      ).join('')}</ul>`
    : '';

  const spaHtml = booking.spaDateTime
    ? `<p><strong>Rendez-vous SPA:</strong> ${booking.spaDateTime}</p>`
    : booking.spaBookingPreference === 'later'
    ? `<p><strong>SPA:</strong> Vous avez choisi de réserver votre créneau SPA ultérieurement. Nous vous contacterons.</p>`
    : '';

  const mailOptions = {
    from: `"Ferme de Basseilles" <${process.env.EMAIL_USER}>`,
    to: booking.email,
    subject: `Confirmation de réservation - Ferme de Basseilles - ${booking.arrivalDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px; background-color: #668E73;">
          <h1 style="color: white; margin: 0;">Ferme de Basseilles</h1>
        </div>

        <div style="padding: 30px;">
          <h2 style="color: #668E73;">Merci pour votre réservation, ${booking.firstName}!</h2>

          <p>Nous avons le plaisir de confirmer votre réservation. Voici les détails:</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Votre séjour</h3>
            <p><strong>Chambre:</strong> ${booking.roomName || booking.apartmentName}</p>
            <p><strong>Date d'arrivée:</strong> ${booking.arrivalDate}</p>
            <p><strong>Heure d'arrivée prévue:</strong> ${booking.arrivalTime || 'à partir de 16h00'}</p>
            <p><strong>Date de départ:</strong> ${booking.departureDate} (avant 11h00)</p>
            <p><strong>Nombre de personnes:</strong> ${(booking.adults || 2) + (booking.children || 0)} (${booking.adults || 2} adultes${booking.children > 0 ? `, ${booking.children} enfants` : ''})</p>
            ${spaHtml}
          </div>

          ${extrasHtml}

          <div style="background-color: #e8f4ea; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Montant payé</h3>
            <p style="font-size: 24px; color: #668E73; margin: 0;"><strong>${booking.totalPriceWithExtras}€</strong></p>
          </div>

          <div style="margin-top: 30px;">
            <h3 style="color: #333;">Informations pratiques</h3>
            <ul>
              <li>Check-in: à partir de 16h00</li>
              <li>Check-out: avant 11h00</li>
              <li>Adresse: Ferme de Basseilles, Belgique</li>
            </ul>
          </div>

          <div style="margin-top: 30px; padding: 20px; background-color: #f0f0f0; border-radius: 8px;">
            <p style="margin: 0;">Des questions? Contactez-nous:</p>
            <p style="margin: 5px 0;"><a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a></p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background-color: #333; color: white;">
          <p style="margin: 0;">À bientôt à la Ferme de Basseilles!</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Guest confirmation sent to', booking.email, ':', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending guest confirmation:', error);
    throw error;
  }
}

module.exports = {
  sendAdminNotification,
  sendGuestConfirmation,
  transporter
};
