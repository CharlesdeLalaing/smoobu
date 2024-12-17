import Bulle_img_1 from "../../assets/Chambres/La Bulle/Bulle_1.webp";
import Bulle_img_2 from "../../assets/Chambres/La Bulle/Bulle_2.webp";
import Bulle_img_3 from "../../assets/Chambres/La Bulle/Bulle_3.webp";
import Bulle_img_4 from "../../assets/Chambres/La Bulle/Bulle_4.webp";
import Bulle_img_5 from "../../assets/Chambres/La Bulle/Bulle_5.webp";
import Bulle_img_6 from "../../assets/Chambres/La Bulle/Bulle_6.webp";

import dome_img_1 from "../../assets/Chambres/Le Dôme/dome_1.webp";
import dome_img_2 from "../../assets/Chambres/Le Dôme/dome_2.webp";
import dome_img_3 from "../../assets/Chambres/Le Dôme/dome_3.webp";
import dome_img_4 from "../../assets/Chambres/Le Dôme/dome_4.webp";
import dome_img_5 from "../../assets/Chambres/Le Dôme/dome_5.webp";

import Moulin_img_1 from "../../assets/Chambres/Le Moulin/Moulin_1.webp";
import Moulin_img_2 from "../../assets/Chambres/Le Moulin/Moulin_2.webp";
import Moulin_img_3 from "../../assets/Chambres/Le Moulin/Moulin_3.webp";
import Moulin_img_4 from "../../assets/Chambres/Le Moulin/Moulin_4.webp";
import Moulin_img_5 from "../../assets/Chambres/Le Moulin/Moulin_5.webp";

import Ble_img_1 from "../../assets/Chambres/De Blé/blé_1.webp";
import Ble_img_2 from "../../assets/Chambres/De Blé/blé_2.webp";
import Ble_img_3 from "../../assets/Chambres/De Blé/blé_3.webp";
import Ble_img_4 from "../../assets/Chambres/De Blé/blé_4.webp";
import Ble_img_5 from "../../assets/Chambres/De Blé/blé_5.webp";

import Logis_img_1 from "../../assets/Chambres/Le Logis/logis_1.webp";
import Logis_img_2 from "../../assets/Chambres/Le Logis/logis_2.webp";
import Logis_img_3 from "../../assets/Chambres/Le Logis/logis_3.webp";
import Logis_img_4 from "../../assets/Chambres/Le Logis/logis_4.webp";
import Logis_img_5 from "../../assets/Chambres/Le Logis/logis_5.webp";
import Logis_img_6 from "../../assets/Chambres/Le Logis/logis_6.webp";
import Logis_img_7 from "../../assets/Chambres/Le Logis/logis_7.webp";

// Feature Icons
import bed from "../../assets/Chambres/icons8-bed-50.png";
import dog from "../../assets/Chambres/icons8-dog-50.png";
import fire from "../../assets/Chambres/icons8-fire-64.png";
import heater from "../../assets/Chambres/icons8-heater-50.png";
import people from "../../assets/Chambres/icons8-people-52.png";
import shower from "../../assets/Chambres/icons8-shower-50.png";
import spoon from "../../assets/Chambres/icons8-spoon-50.png";
import toilet from "../../assets/Chambres/icons8-toilet-50.png";
import wifi from "../../assets/Chambres/icons8-wifi-50.png";

export const roomsData = {
  1644643: {
    id: 1644643,
    type: "rooms.types.unusual",
    nameKey: "rooms.names.bulle",
    description: "rooms.descriptions.bulle",
    images: {
      main: Bulle_img_1,
      secondary: Bulle_img_2,
      tertiary: Bulle_img_3,
      quaternary: Bulle_img_4,
      quinary: Bulle_img_5,
      senary: Bulle_img_6
    },
    maxGuests: 2,
    features: [
      { icon: people, title: "rooms.features.maxGuests", value: 2 },
      { icon: bed, title: "rooms.features.bedKing" },
      { icon: dog, title: "rooms.features.pets" },
      { icon: toilet, title: "rooms.features.dryToilet" },
      { icon: fire, title: "rooms.features.brazier" },
    ],
    size: "30m²",
    calendarData: {
      id: "1644643",
      verification: "d70371945b04df2e536bb400d92cacf6d8570999a385af194dd64661801f9b46",
      urls: {
        en: "https://login.smoobu.com/en/cockpit/widget/single-calendar/1644643",
        fr: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1644643",
        nl: "https://login.smoobu.com/nl/cockpit/widget/single-calendar/1644643"
      }
    }
  },

  1946282: {
    id: 1946282,
    type: "rooms.types.unusual",
    nameKey: "rooms.names.dome",
    description: "rooms.descriptions.dome",
    images: {
      main: dome_img_1,
      secondary: dome_img_2,
      tertiary: dome_img_3,
      quaternary: dome_img_4,
      quinary: dome_img_5
    },
    maxGuests: 4,
    features: [
      { icon: people, title: "rooms.features.maxGuestsWithChildren", value: [2, 2] },
      { icon: bed, title: "rooms.features.bedKing" },
      { icon: dog, title: "rooms.features.pets" },
      { icon: toilet, title: "rooms.features.dryToilet" },
      { icon: heater, title: "rooms.features.heater" },
      { icon: fire, title: "rooms.features.brazier" },
    ],
    size: "40m²",
    calendarData: {
      id: "1946282",
      verification: "8dedff27d1d2b0d2872fb29c6ba8c480a5a23b80a7a712c846f6198df9fc9efb",
      urls: {
        en: "https://login.smoobu.com/en/cockpit/widget/single-calendar/1946282",
        fr: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946282",
        nl: "https://login.smoobu.com/nl/cockpit/widget/single-calendar/1946282"
      }
    }
  },

  1946279: {
    id: 1946279,
    type: "rooms.types.guesthouse",
    nameKey: "rooms.names.moulin",
    description: "rooms.descriptions.moulin",
    images: {
      main: Moulin_img_1,
      secondary: Moulin_img_2,
      tertiary: Moulin_img_3,
      quaternary: Moulin_img_4,
      quinary: Moulin_img_5,
    },
    maxGuests: 2,
    features: [
      { icon: people, title: "rooms.features.maxGuestsWithChildren", value: [2, 2] },
      { icon: bed, title: "rooms.features.bedQueen" },
      { icon: dog, title: "rooms.features.pets" },
      { icon: shower, title: "rooms.features.bathroom" },
      { icon: spoon, title: "rooms.features.kitchen" },
      { icon: wifi, title: "rooms.features.wifi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946279",
      verification: "5ef22b823e6c18979c1585d55bf5061d6ea312e1f2a2979fba3ae2657fde3d92",
      urls: {
        en: "https://login.smoobu.com/en/cockpit/widget/single-calendar/1946279",
        fr: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946279",
        nl: "https://login.smoobu.com/nl/cockpit/widget/single-calendar/1946279"
      }
    }
  },

  1946276: {
    id: 1946276,
    type: "rooms.types.guesthouse",
    nameKey: "rooms.names.ble",
    description: "rooms.descriptions.ble",
    images: {
      main: Ble_img_1,
      secondary: Ble_img_2,
      tertiary: Ble_img_3,
      quaternary: Ble_img_4,
      quinary: Ble_img_5,
    },
    maxGuests: 2,
    features: [
      { icon: people, title: "rooms.features.maxGuests", value: 4 },
      { icon: bed, title: "rooms.features.bedKingAndSingle" },
      { icon: dog, title: "rooms.features.pets" },
      { icon: shower, title: "rooms.features.bathroom" },
      { icon: fire, title: "rooms.features.brazier" },
      { icon: spoon, title: "rooms.features.kitchen" },
      { icon: wifi, title: "rooms.features.wifi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946276",
      verification: "fcee1e857b4c7c0814ac06951737c53a3cb6a04b4ef66fed5717b2d013ed0b4b",
      urls: {
        en: "https://login.smoobu.com/en/cockpit/widget/single-calendar/1946276",
        fr: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946276",
        nl: "https://login.smoobu.com/nl/cockpit/widget/single-calendar/1946276"
      }
    }
  },

  1946270: {
    id: 1946270,
    type: "rooms.types.guesthouse",
    nameKey: "rooms.names.logis",
    description: "rooms.descriptions.logis",
    images: {
      main: Logis_img_1,
      secondary: Logis_img_2,
      tertiary: Logis_img_3,
      quaternary: Logis_img_4,
      quinary: Logis_img_5,
      senary: Logis_img_6,
      septenary: Logis_img_7
    },
    maxGuests: 8,
    features: [
      { icon: people, title: "rooms.features.maxGuests", value: 8 },
      { icon: bed, title: "rooms.features.bedDoubleKing" },
      { icon: dog, title: "rooms.features.pets" },
      { icon: shower, title: "rooms.features.twoBathrooms" },
      { icon: spoon, title: "rooms.features.kitchen" },
      { icon: wifi, title: "rooms.features.wifi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946270",
      verification: "7d848002b5314b96a1b0f56b859443aaab0e1a892b6de144078389a1dea3cc4f",
      urls: {
        en: "https://login.smoobu.com/en/cockpit/widget/single-calendar/1946270",
        fr: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946270",
        nl: "https://login.smoobu.com/nl/cockpit/widget/single-calendar/1946270"
      }
    }
  },
};