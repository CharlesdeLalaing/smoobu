import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../config/routes";
import Phone from "../../assets/icons8-phone-50 white.png";
import Mail from "../../assets/icons8-mail-48 (2 white.png";
import Pin from "../../assets/icons8-location-50 white.png";
import Insta from "../../assets/icons8-instagram-52 white.png";
import Facebook from "../../assets/icons8-facebook-50 white.png";
import Tiktok from "../../assets/icons8-tik-tok-48 white.png";
import Logo from "../../assets/logoBaseilles.webp";
import French from "../../assets/icons8-french-flag-48.png";
import GreatBritain from "../../assets/icons8-great-britain-48.png";
import Netherland from "../../assets/icons8-netherlands-48.png";

export const HeaderSection = () => {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState("fr");
  const [showAccommodationsSubmenu, setShowAccommodationsSubmenu] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Handle body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMenuOpen]);

  const languages = [
    { code: "fr", name: "FR", flag: French },
    { code: "en", name: "EN", flag: GreatBritain },
    { code: "nl", name: "NL", flag: Netherland },
  ];

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  // Create menu items using routes
  const menuItems = [
    { 
      label: t("header.nav.home"), 
      url: ROUTES.home[currentLanguage] 
    },
    {
      label: t("header.nav.accommodations.title"),
      url: "#",
      submenu: [
        { 
          label: t("header.nav.accommodations.unusual"), 
          url: ROUTES.tinyHouse[currentLanguage] 
        },
        { 
          label: t("header.nav.accommodations.guesthouse"), 
          url: ROUTES.bnb[currentLanguage] 
        },
      ],
    },
    { 
      label: t("header.nav.extras"), 
      url: ROUTES.extras[currentLanguage] 
    },
    { 
      label: t("header.nav.activities"), 
      url: ROUTES.activity[currentLanguage] 
    },
    { 
      label: t("header.nav.aboutUs"), 
      url: ROUTES.whoAreWe[currentLanguage] 
    },
    { 
      label: t("header.nav.info"), 
      url: ROUTES.news[currentLanguage] 
    },
  ];

  const handleLanguageChange = (langCode) => {
    setCurrentLanguage(langCode);
    i18n.changeLanguage(langCode);
  };

  return (
    <header className="z-40 w-full bg-white">
      {/* Top Bar */}
      <div className="bg-[#668E73] text-white h-auto md:h-[44px] font-montserrat">
        <div className="mx-auto flex flex-col md:flex-row justify-between items-center text-xs h-full px-4 py-2 md:py-0 md:px-[5%]">
          {/* Contact Information */}
          <div className="flex w-full md:flex-row md:items-center md:space-x-6 md:w-auto">
            <div className="hidden md:flex items-center gap-2 text-[12px]">
              <img src={Phone} alt="phone" className="h-[18px] w-[18px]" />
              <span className="font-light">{t("header.contact.phone")}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[12px]">
              <img src={Mail} alt="mail" className="h-[18px] w-[18px]" />
              <span className="font-light">{t("header.contact.email")}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[12px]">
              <img src={Pin} alt="location" className="h-[18px] w-[18px]" />
              <span className="font-light">{t("header.contact.address")}</span>
            </div>
          </div>

          {/* Social and Language */}
          <div className="flex items-center mt-2 space-x-4 md:mt-0">
            {/* Language Buttons */}
            {/* <div className="flex items-center gap-2 px-2 py-1 bg-white rounded bg-opacity-10">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`flex items-center justify-center ${
                    currentLanguage === lang.code
                      ? "bg-white bg-opacity-20 rounded p-1"
                      : "p-1"
                  }`}
                >
                  <img
                    src={lang.flag}
                    alt={`Switch to ${lang.name}`}
                    className="h-[20px] w-[20px] rounded-sm"
                  />
                </button>
              ))}
            </div> */}

            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-2 py-1 bg-white bg-opacity-10 rounded hover:bg-opacity-20"
              >
                <img
                  src={currentLang?.flag}
                  alt={`Current language: ${currentLang?.name}`}
                  className="h-5 w-5 rounded-sm"
                />
                <svg 
                  className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="absolute top-full mt-1 bg-white z-50 bg-opacity-1 rounded shadow-lg">
                  {languages.filter(lang => lang.code !== currentLanguage).map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        handleLanguageChange(lang.code);
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white hover:bg-opacity-20"
                    >
                      <img
                        src={lang.flag}
                        alt={`Switch to ${lang.name}`}
                        className="h-5 w-5 rounded-sm"
                      />
                      <span className="text-sm">{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <a href="#" className="hover:text-gray-200">
                <img src={Facebook} alt="facebook" className="h-[18px] w-[18px]" />
              </a>
              <a href="#" className="hover:text-gray-200">
                <img src={Insta} alt="instagram" className="h-[18px] w-[18px]" />
              </a>
              <a href="#" className="hover:text-gray-200">
                <img src={Tiktok} alt="tiktok" className="h-[18px] w-[18px]" />
              </a>
            </div>

            <button className="bg-[#d3b574] text-black p-[10px] font-light text-[12px] whitespace-nowrap">
              {t("header.buttons.giftCard")}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="h-auto md:h-[130px] bg-[#fbfdfb] font-montserrat">
        <nav className="w-full px-4 lg:px-40 h-[100px] md:h-full">
          <div className="relative flex items-center justify-between w-full h-full lg:justify-center">
            <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <img
                src={Logo}
                alt="Logo"
                className="w-[80px] h-[80px] md:w-[100px] md:h-[100px]"
              />
            </div>

            {/* Hamburger Menu Button */}
            <button
              className="p-2 ml-auto lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <div className="w-6 h-0.5 bg-[#668E73] mb-1"></div>
              <div className="w-6 h-0.5 bg-[#668E73] mb-1"></div>
              <div className="w-6 h-0.5 bg-[#668E73]"></div>
            </button>

            {/* Desktop Navigation */}
            <div className="items-center justify-between hidden w-full lg:flex">
              <div className="flex justify-center w-1/3 gap-5 space-x-10">
                <a 
                  href={menuItems[0].url} 
                  className="text-gray-700 text-[16px] font-light"
                >
                  {menuItems[0].label}
                </a>
                <div className="relative group">
                  <a
                    href={menuItems[1].url}
                    className="text-gray-700 text-[16px] font-light flex items-center gap-2"
                  >
                    {menuItems[1].label}
                    <svg
                      className="w-4 h-4 transition-transform group-hover:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </a>
                  <div className="absolute left-0 invisible w-48 py-1 mt-2 transition-all duration-300 bg-white rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-hover:visible">
                    {menuItems[1].submenu.map((subItem, index) => (
                      <a
                        key={index}
                        href={subItem.url}
                        className="block px-4 py-2 text-[16px] text-gray-700 hover:bg-gray-100 font-light"
                      >
                        {subItem.label}
                      </a>
                    ))}
                  </div>
                </div>
                <a 
                  href={menuItems[2].url} 
                  className="text-gray-700 text-[16px] font-light"
                >
                  {menuItems[2].label}
                </a>
              </div>
              <div className="flex justify-start w-1/3 space-x-6">
                {menuItems.slice(3).map((item, index) => (
                  <a 
                    key={index}
                    href={item.url} 
                    className="text-gray-700 text-[16px] font-light"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Mobile Menu */}
            <div 
              className={`fixed top-[144px] right-0 bottom-0 w-full max-w-sm bg-[#668E73] transform transition-transform duration-300 ease-in-out lg:hidden ${
                isMenuOpen ? 'translate-x-0' : 'translate-x-full'
              } z-50`}
            >
              <div className="flex flex-col h-full">
                <div className="flex justify-end p-4">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="text-white"
                  >
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Menu Items */}
                <div className="px-4 pt-2 pb-8 overflow-y-auto">
                  {menuItems.map((item, index) => (
                    <div key={index} className="py-3">
                      {item.submenu ? (
                        <div>
                          <button
                            onClick={() => setShowAccommodationsSubmenu(!showAccommodationsSubmenu)}
                            className="flex items-center justify-between w-full text-white text-lg"
                          >
                            {item.label}
                            <svg
                              className={`w-5 h-5 transition-transform ${
                                showAccommodationsSubmenu ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                          {showAccommodationsSubmenu && (
                            <div className="pl-4 mt-2">
                              {item.submenu.map((subItem, subIndex) => (
                                <a
                                  key={subIndex}
                                  href={subItem.url}
                                  className="block py-2 text-white text-lg"
                                >
                                  {subItem.label}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <a
                          href={item.url}
                          className="block text-white text-lg"
                        >
                          {item.label}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Overlay when menu is open */}
            {isMenuOpen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
                onClick={() => setIsMenuOpen(false)}
              />
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default HeaderSection;