// extract-emails.js
// Script to extract all emails from Firebase bookings
import { db } from './firebase-config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractAllEmails() {
  try {
    console.log('🔍 Fetching all bookings from Firebase...');

    // Fetch all bookings from Firebase
    const snapshot = await db.collection('bookings').get();

    console.log(`📊 Found ${snapshot.size} bookings in total`);

    // Extract email data from each booking
    const emailData = [];
    const uniqueEmails = new Set();

    snapshot.forEach(doc => {
      const booking = doc.data();

      // Extract all possible email fields
      const email = booking.email || null;

      // Only add if email exists
      if (email) {
        uniqueEmails.add(email);

        emailData.push({
          bookingId: booking.smoobuId || booking.smoobuReservationId || doc.id,
          firebaseDocId: doc.id,
          email: email,
          firstName: booking.firstName || '',
          lastName: booking.lastName || '',
          guestName: booking.guestName || '',
          phone: booking.phone || '',
          arrivalDate: booking.arrivalDate || '',
          departureDate: booking.departureDate || '',
          property: booking.property || '',
          channelName: booking.channelName || '',
          createdAt: booking.createdAt && booking.createdAt.toDate ? booking.createdAt.toDate().toISOString() : (booking.createdAt || ''),
        });
      }
    });

    // Sort by arrival date (most recent first)
    emailData.sort((a, b) => {
      if (!a.arrivalDate) return 1;
      if (!b.arrivalDate) return -1;
      return b.arrivalDate.localeCompare(a.arrivalDate);
    });

    // Prepare summary
    const summary = {
      totalBookings: snapshot.size,
      bookingsWithEmail: emailData.length,
      uniqueEmails: uniqueEmails.size,
      extractedAt: new Date().toISOString(),
    };

    // Prepare final output
    const output = {
      summary,
      bookings: emailData,
      uniqueEmailsList: Array.from(uniqueEmails).sort(),
    };

    // Save to JSON file
    const outputPath = path.join(__dirname, 'extracted-emails.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('\n✅ Email extraction completed!');
    console.log(`📧 Total bookings: ${summary.totalBookings}`);
    console.log(`📧 Bookings with email: ${summary.bookingsWithEmail}`);
    console.log(`📧 Unique emails: ${summary.uniqueEmails}`);
    console.log(`📁 Output saved to: ${outputPath}`);

    // Also create a simple CSV file for easy import
    const csvPath = path.join(__dirname, 'extracted-emails.csv');
    const csvHeader = 'Booking ID,Email,First Name,Last Name,Guest Name,Phone,Arrival Date,Property,Channel\n';
    const csvRows = emailData.map(row =>
      `"${row.bookingId}","${row.email}","${row.firstName}","${row.lastName}","${row.guestName}","${row.phone}","${row.arrivalDate}","${row.property}","${row.channelName}"`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`📁 CSV saved to: ${csvPath}`);

    // Create a simple emails-only CSV
    const emailsOnlyPath = path.join(__dirname, 'emails-only.csv');
    const emailsOnlyContent = 'Email\n' + Array.from(uniqueEmails).sort().join('\n');
    fs.writeFileSync(emailsOnlyPath, emailsOnlyContent);
    console.log(`📁 Emails-only CSV saved to: ${emailsOnlyPath}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error extracting emails:', error);
    process.exit(1);
  }
}

// Run the extraction
extractAllEmails();
