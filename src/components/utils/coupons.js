import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';


export const VALID_COUPONS = {
    "DOME.390": {
      discount: 390,
      type: "fixed",
      currency: "EUR"
    },
    "BULLE.215": {
      discount: 215,
      type: "fixed",
      currency: "EUR"
    },
    "DOME.305": {
      discount: 305,
      type: "fixed",
      currency: "EUR"
    },
    "DOME.235.1": {
      discount: 235,
      type: "fixed",
      currency: "EUR"
    },
    "DOME.235.2": {
      discount: 235,
      type: "fixed",
      currency: "EUR"
    },
    "BULLE.295": {
      discount: 295,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6104": {
      discount: 400,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6096": {
      discount: 150,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6105": {
      discount: 300,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6111": {
      discount: 200,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6112": {
      discount: 180,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6496": {
      discount: 360,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6714": {
      discount: 190,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6898": {
      discount: 275,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6899": {
      discount: 265,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6901": {
      discount: 315,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6968": {
      discount: 200,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6969": {
      discount: 400,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6970": {
      discount: 315,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.6973": {
      discount: 235,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.7082": {
      discount: 210,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.7095": {
      discount: 360,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.7105": {
      discount: 270,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.7157": {
      discount: 215,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10476": {
      discount: 240,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10492": {
      discount: 315,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10495": {
      discount: 245,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10551": {
      discount: 210,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10577": {
      discount: 275,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10575": {
      discount: 230,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10591": {
      discount: 180,
      type: "fixed",
      currency: "EUR"
    },
    "GIFT.10593": {
      discount: 315,
      type: "fixed",
      currency: "EUR"
    },
    "8QYXC4S98J": {
      discount: 180,
      type: "fixed",
      currency: "EUR",
    },
    "CWZUULAHOX": {
      discount: 210,
      type: "fixed",
      currency: "EUR",
    }
};


export const initializeCoupons = async () => {
  try {
    const batch = [];
    for (const [code, details] of Object.entries(VALID_COUPONS)) {
      batch.push(addDoc(collection(db, 'coupons'), {
        code,
        ...details,
        status: 'active',
        expiryDate: Timestamp.fromDate(new Date('2025-12-31')),
        usedCount: 0,
        lastUsedDate: null,
        usedBy: [],
        dateCreated: Timestamp.now()
      }));
    }
    await Promise.all(batch);

  } catch (error) {
    console.error('Error:', error);
  }
};

// initializeCoupons();