// Room Images
import tinyHouse from "../../assets/Chambres/tiny-house-1.jpg";
import tinyHouse2 from "../../assets/Chambres/tiny-house-2.jpg";
import tinyHouse3 from "../../assets/Chambres/tinySnow.jpg";


// images dôme
import dome_img_1 from "../../assets/Chambres/Le Dôme/dome_1.webp"
import dome_img_2 from "../../assets/Chambres/Le Dôme/dome_2.webp"
import dome_img_3 from "../../assets/Chambres/Le Dôme/dome_3.webp"
import dome_img_4 from "../../assets/Chambres/Le Dôme/dome_4.webp"
import dome_img_5 from "../../assets/Chambres/Le Dôme/dome_5.webp"
// images Bulle
import Bulle_img_1 from "../../assets/Chambres/La Bulle/Bulle_1.webp"
import Bulle_img_2 from "../../assets/Chambres/La Bulle/Bulle_2.webp"
import Bulle_img_3 from "../../assets/Chambres/La Bulle/Bulle_3.webp"
import Bulle_img_4 from "../../assets/Chambres/La Bulle/Bulle_4.webp"
import Bulle_img_5 from "../../assets/Chambres/La Bulle/Bulle_5.webp"
import Bulle_img_6 from "../../assets/Chambres/La Bulle/Bulle_6.webp"
// images Blé
import Ble_img_1 from "../../assets/Chambres/De Blé/blé_1.webp"
import Ble_img_2 from "../../assets/Chambres/De Blé/blé_2.webp"
import Ble_img_3 from "../../assets/Chambres/De Blé/blé_3.webp"
import Ble_img_4 from "../../assets/Chambres/De Blé/blé_4.webp"
import Ble_img_5 from "../../assets/Chambres/De Blé/blé_5.webp"
// images Moulin
import Moulin_img_1 from "../../assets/Chambres/Le Moulin/Moulin_1.webp"
import Moulin_img_2 from "../../assets/Chambres/Le Moulin/Moulin_2.webp"
import Moulin_img_3 from "../../assets/Chambres/Le Moulin/Moulin_3.webp"
import Moulin_img_4 from "../../assets/Chambres/Le Moulin/Moulin_4.webp"
import Moulin_img_5 from "../../assets/Chambres/Le Moulin/Moulin_5.webp"
// images Logis
import Logis_img_1 from "../../assets/Chambres/Le Logis/logis_1.webp"
import Logis_img_2 from "../../assets/Chambres/Le Logis/logis_2.webp"
import Logis_img_3 from "../../assets/Chambres/Le Logis/logis_3.webp"
import Logis_img_4 from "../../assets/Chambres/Le Logis/logis_4.webp"
import Logis_img_5 from "../../assets/Chambres/Le Logis/logis_5.webp"
import Logis_img_6 from "../../assets/Chambres/Le Logis/logis_6.webp"
import Logis_img_7 from "../../assets/Chambres/Le Logis/logis_7.webp"

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
    type: "logement insolites",
    name: "La Bulle du Ruisseau",
    description: "Plongez dans l'intimité apaisante de la Bulle du Ruisseau - un cocon insolite niché entre terre et eau, bercé par le chant du ruisseau et les murmures de la nature. Avec son fauteuil Crusoé et son lit king-size, cet espace vous offre un confort raffiné au cœur de la nature. Profitez également du braséro pour des soirées conviviales sous les étoiles, parfaites pour griller des guimauves et partager des moments inoubliables. Réservez dès maintenant et laissez-vous envoûter par la sérénité magique de la Bulle du Ruisseau.",
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
      { icon: people, title: "Max 2 personnes" },
      { icon: bed, title: "Lit king size et matelas chauffant" },
      { icon: dog, title: "Animaux non admis" },
      { icon: toilet, title: "Toilette sêche" },
      { icon: fire, title: "Brasero" },
    ],
    size: "30m²",
    calendarData: {
      id: "1644643fr",
      url: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1644643",
      verification: "d70371945b04df2e536bb400d92cacf6d8570999a385af194dd64661801f9b46"
    }
  },

  1946282: {
    id: 1946282,
    type: "logement insolite",
    name: "Le Dôme des Libellules",
    description: "Plongez dans l’intimité magique du Dôme des Libellules – un refuge insolite au cœur de la nature, conçu pour une escapade romantique. Doté d’un lit King size chauffant et d’une terrasse privée, cet espace offre luxe et sérénité. Niché au coin d’un bois, le site isolé est parfait pour une déconnexion totale. Vous passerez une nuit inoubliable sous les étoiles, bercés par la magie de la nature. Un lit superposé est disponible dans le petit cabanon à côté, idéal pour accueillir des enfants. Profitez également du braséro – BBQ pour des soirées conviviales. Réservez dès maintenant et laissez-vous emporter par la tranquillité du Dôme des Libellules.",
    images: {
      main: dome_img_1,
      secondary: dome_img_2,
      tertiary: dome_img_3,
      quaternary: dome_img_4,
      quinary: dome_img_5
    },
    maxGuests: 4,
    features: [
      { icon: people, title: "Max 2 adultes et 2 enfants" },
      { icon: bed, title: "Lit king size et matelas chauffant" },
      { icon: dog, title: "Animaux non admis" },
      { icon: toilet, title: "Toilette sêche" },
      { icon: heater, title: "Chauffage électrique" },
      { icon: fire, title: "Brasero" },
    ],
    size: "40m²",
    calendarData: {
      id: "1946282fr",
      url: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946282",
      verification: "8dedff27d1d2b0d2872fb29c6ba8c480a5a23b80a7a712c846f6198df9fc9efb"
    }
  },

  1946279: {
    id: 1946279,
    type: "Gîte & Chmabre d'hôte",
    name: "Le Moulin",
    description: "Immergez-vous dans l'atmosphère envoûtante du Moulin- un studio romantique conçu pour deux personnes où confort moderne et charme passé s'entremêlent. Avec son lit Queen size en mezzanine, un canapé-lit douillet pouvant accueillir des enfants, cet espace vous offre une escapade intime et confortable. Ajoutez à cela une cuisine équipée pour des moments conviviaux. Réservez dès maintenant et laissez-vous séduire par le charme irrésistible du Moulin.",
    images: {
      main: Moulin_img_1,
      secondary: Moulin_img_2,
      tertiary: Moulin_img_3,
      quaternary: Moulin_img_4,
      quinary: Moulin_img_5,
    },
    maxGuests: 2,
    features: [
      { icon: people, title: "Max 2 adultes et 2 enfants" },
      { icon: bed, title: "1 lit queen size et 1 canapé lit" },
      { icon: dog, title: "Animaux non admis" },
      { icon: shower, title: "Une salle de bain" },
      { icon: spoon, title: "Cuisine équipée" },
      { icon: wifi, title: "WiFi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946279fr",
      url: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946279",
      verification: "5ef22b823e6c18979c1585d55bf5061d6ea312e1f2a2979fba3ae2657fde3d92"
    }
  },


  1946276: {
    id: 1946276,
    type: "Gîte & Chmabre d'hôte",
    name: "La Chambre de Blé",
    description: "Plongez-vous dans l'intimité de la Chambre de Blé - un refuge douillet au cœur d'une grange restaurée avec soin. Conçue pour accueillir deux adultes et jusqu'à deux enfants, cette chambre rustique allie harmonieusement le charme d'antan et les commodités modernes. Idéale pour une escapade en amoureux ou des vacances en famille, réservez dès maintenant et laissez-vous séduire par l'ambiance chaleureuse de la Chambre de Blé",
    images: {
      main: Ble_img_1,
      secondary: Ble_img_2,
      tertiary: Ble_img_3,
      quaternary: Ble_img_4,
      quinary: Ble_img_5,
    },
    maxGuests: 2,
    features: [
      { icon: people, title: "Max 4 personnes" },
      { icon: bed, title: "1 lit king size et 2 lits simples" },
      { icon: dog, title: "Animaux non admis" },
      { icon: shower, title: "Une salle de bain et 1 toilette" },
      { icon: fire, title: "Brasero" },
      { icon: spoon, title: "Cuisine équipée" },
      { icon: wifi, title: "WiFi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946276fr",
      url: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946276",
      verification: "fcee1e857b4c7c0814ac06951737c53a3cb6a04b4ef66fed5717b2d013ed0b4b"
    }
  },


  1946270: {
    id: 1946270,
    type: "Gîte & Chmabre d'hôte",
    name: "Le Logis",
    description: "Plongez dans l’intimité chaleureuse du Logis – un refuge rustique pouvant accueillir jusqu’à 8 convives, parfait pour des retrouvailles en famille ou entre amis. Niché dans une grange restaurée avec soin, c’est l’invitation à une escapade authentique, où se mêlent confort moderne et charme d’antan. Réservez et laissez-vous envoûter par l’atmosphère unique du Logis.",
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
      { icon: people, title: "Max 8 personnes" },
      { icon: bed, title: "2 lit king size et 4 lits simples" },
      { icon: dog, title: "Animaux non admis" },
      { icon: shower, title: "2 salles de bains et 2 toilettes" },
      { icon: spoon, title: "Cuisine équipée" },
      { icon: wifi, title: "WiFi" },
    ],
    size: "30m²",
    calendarData: {
      id: "1946270fr",
      url: "https://login.smoobu.com/fr/cockpit/widget/single-calendar/1946270",
      verification: "7d848002b5314b96a1b0f56b859443aaab0e1a892b6de144078389a1dea3cc4f"
    }
  },
};
