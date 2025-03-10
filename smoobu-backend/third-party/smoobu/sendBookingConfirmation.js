import { transporter } from "../../config/nodemailer.js"
import { formatDate } from "../../helpers/date.js";

export const sendBookingConfirmation = async (bookingData) => {
  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Confirmation de réservation - Ferme de Basseilles</h1>
        
        <div style="margin: 20px 0;">
          <h2>Détails du séjour</h2>
          <p>Arrivée: ${formatDate(bookingData.arrivalDate)} à ${
      bookingData.arrivalTime
    }</p>
          <p>Départ: ${formatDate(bookingData.departureDate)}</p>
          <p>Voyageurs: ${bookingData.adults} adultes${
      bookingData.children ? `, ${bookingData.children} enfants` : ""
    }</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Détails des prix</h2>
          <p>Prix de base: ${bookingData.basePrice.toFixed(2)} EUR</p>
          ${
            bookingData.guestFees > 0
              ? `<p>Frais supplémentaires (${Math.max(
                  0,
                  parseInt(bookingData.adults) +
                    parseInt(bookingData.children) -
                    bookingData.priceDetails?.settings?.startingAtGuest || 2
                )} personne(s)): 
              ${bookingData.guestFees.toFixed(2)} EUR</p>`
              : ""
          }
          ${bookingData.extras
            ?.map(
              (extra) => `
            <p>${extra.name} (x${extra.quantity}): ${extra.amount.toFixed(
                2
              )} EUR</p>
            ${
              extra.extraPersonQuantity > 0
                ? `<p>Personne supplémentaire (x${
                    extra.extraPersonQuantity
                  }): ${(
                    extra.extraPersonPrice * extra.extraPersonQuantity
                  ).toFixed(2)} EUR</p>`
                : ""
            }
          `
            )
            .join("")}
          ${
            bookingData.priceDetails?.discount
              ? `<p style="color: #22c55e;">Réduction long séjour (${
                  bookingData.priceDetails.settings.lengthOfStayDiscount
                    .discountPercentage
                }%): -${bookingData.priceDetails.discount.toFixed(2)} EUR</p>`
              : ""
          }
          ${
            bookingData.couponApplied
              ? `<p style="color: #22c55e;">
                ${
                  bookingData.couponApplied.type === "percentage"
                    ? `Code promo (${bookingData.couponApplied.code} - ${
                        bookingData.couponApplied.percentageValue
                      }%): -${(bookingData.couponApplied.discount || 0).toFixed(
                        2
                      )} EUR`
                    : `Code promo (${bookingData.couponApplied.code}): -${(
                        bookingData.couponApplied.discount || 0
                      ).toFixed(2)} EUR`
                }
              </p>`
              : ""
          }
          <p style="font-weight: bold; margin-top: 10px;">Total: ${bookingData.price.toFixed(
            2
          )} EUR</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Coordonnées</h2>
          <p>${bookingData.firstName} ${bookingData.lastName}</p>
          <p>Email: ${bookingData.email}</p>
          ${bookingData.phone ? `<p>Téléphone: ${bookingData.phone}</p>` : ""}
        </div>

        <div style="margin-top: 30px;">
          <p>À bientôt!</p>
          <p>L'équipe de la Ferme de Basseilles</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: bookingData.email,
      subject: "Confirmation de réservation - Ferme de Basseilles",
      html: emailContent,
    });

  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
};