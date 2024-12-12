// Room Images
import tinyHouse from "../../assets/Chambres/tiny-house-1.jpg";
import tinyHouse2 from "../../assets/Chambres/tiny-house-2.jpg";
import tinyHouse3 from "../../assets/Chambres/tinySnow.jpg";

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
  2467648: {
    id: 2467648,
    name: "La porte du Chalet",
    description:
      "Plongez-vous dans l’intimité de la Chambre de Blé – un refuge douillet au cœur d’une grange restaurée avec soin. Conçue pour accueillir deux adultes et jusqu’à deux enfants, cette chambre rustique allie harmonieusement le charme d’antan et les commodités modernes. Idéale pour une escapade en amoureux ou des vacances en famille, réservez dès maintenant et laissez-vous séduire par l’ambiance chaleureuse de la Chambre de Blé",
    images: {
      main: tinyHouse,
      secondary: tinyHouse,
      tertiary: tinyHouse,
    },
    maxGuests: 4,
    features: [
      { icon: wifi, title: "WiFi" },
      { icon: bed, title: "Lit king size et matelas chauffant" },
      { icon: dog, title: "Animaux non admis" },
      { icon: fire, title: "Brasero" },
      { icon: heater, title: "Chauffage électrique" },
      { icon: shower, title: "1 salles de bain et 1 toilette" },
      { icon: spoon, title: "Cuisine équipée" },
      { icon: toilet, title: "Toilette sêche" },
      { icon: people, title: "Max 2 adultes et 2 enfants" },
    ],
    size: "40m²",
    calendarIframe: {
      smallDevices:
        "https://login.smoobu.com/fr/cockpit/widget/show-calendar-iframe/2428698/b0f41e1cdaa98e3e16052ad9121912d4c5971e3457de260cd25d5a54de7fc73e",
      bigDevices:
        "https://login.smoobu.com/fr/cockpit/widget/show-calendar-iframe/2428698/b0f41e1cdaa98e3e16052ad9121912d4c5971e3457de260cd25d5a54de7fc73e",
    },
  },
  2467653: {
    id: 2467653,
    name: "La canne à sucre",
    description:
      "Plongez-vous dans l’intimité de la Chambre de Blé – un refuge douillet au cœur d’une grange restaurée avec soin. Conçue pour accueillir deux adultes et jusqu’à deux enfants, cette chambre rustique allie harmonieusement le charme d’antan et les commodités modernes. Idéale pour une escapade en amoureux ou des vacances en famille, réservez dès maintenant et laissez-vous séduire par l’ambiance chaleureuse de la Chambre de Blé",
    images: {
      main: tinyHouse2,
      secondary: tinyHouse2,
      tertiary: tinyHouse2,
    },
    maxGuests: 2,
    features: [
      { icon: wifi, title: "WiFi" },
      { icon: bed, title: "Lit king size et matelas chauffant" },
      { icon: dog, title: "Animaux non admis" },
      { icon: fire, title: "Brasero" },
      { icon: heater, title: "Chauffage électrique" },
      { icon: shower, title: "1 salles de bain et 1 toilette" },
      { icon: spoon, title: "Cuisine équipée" },
      { icon: toilet, title: "Toilette sêche" },
      { icon: people, title: "Max 2 adultes et 2 enfants" },
    ],
    size: "30m²",
    calendarIframe: {
      smallDevices:
        "https://login.smoobu.com/fr/cockpit/widget/show-calendar-iframe/2428703/38dab3c9ee90c8353a2ceed7b25848d794a3f8b15f44ef189b116150a43243f0",
      bigDevices:
        "https://login.smoobu.com/fr/cockpit/widget/show-calendar-iframe/2428703/38dab3c9ee90c8353a2ceed7b25848d794a3f8b15f44ef189b116150a43243f0",
    },
  },
};
