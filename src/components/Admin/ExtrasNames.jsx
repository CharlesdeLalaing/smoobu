import React, { useState } from 'react';
import { Search, Copy, Check } from 'lucide-react';

const ExtrasList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const extras = [
    "L'essentiel (pour 2) - Personne supplémentaire",
    "Le détente gourmet (pour 2) - Personne supplémentaire",
    "La raclette en détente (pour 2) - Personne supplémentaire",
    "Le romantique gourmet (pour 2) - Personne supplémentaire",
    "La raclette romantique (pour 2) - Personne supplémentaire",
    "Le barbecue détente (pour 2) - Personne supplémentaire",
    "Le romantique barbecue (pour 2) - Personne supplémentaire",
    "Formule petit-déjeuner (2 pers) - Personne supplémentaire",
    "Formule gourmet (2 pers) - Personne supplémentaire",
    "Formule raclette (2 pers) - Personne supplémentaire",
    "Formule barbecue (2 pers) - Personne supplémentaire",
    "Formule SPA (2 pers) - Personne supplémentaire",
    "Formule anniversaire (pour 2) - Personne supplémentaire",
    "L'essentiel (pour 2)",
    "Le détente gourmet (pour 2)",
    "La raclette en détente (pour 2)",
    "Le romantique gourmet (pour 2)",
    "La raclette romantique (pour 2)",
    "Le barbecue détente (pour 2)",
    "Le romantique barbecue (pour 2)",
    "Formule planche apéro (2 pers)",
    "Formule passion (pour 2)",
    "Formule anniversaire (pour 2)",
    "Formule petit-déjeuner (2 pers)",
    "Formule gourmet (2 pers)",
    "Formule raclette (2 pers)",
    "Formule barbecue (2 pers)",
    "Formule SPA (2 pers)",
    "Formule SPA + bouteille (2 pers)",
    "Poulet Tikka Massala",
    "Boulettes sauce tomate",
    "Linguines au saumon fumé",
    "Risotto à la tartufata",
    "Brut de Bioul",
    "Cortil Barco",
    "Terre Charlot",
    "Brune de Leignion",
    "Ambrée à la Cardamome",
    "Triple de Leignion",
    "Blanche à la Bergamote",
    "Blonde aux 4 Céréales",
    "Jus de pomme « Pom d'Happy »",
    "Ritchie Citron/Framboise",
    "Ritchie Orange/Vanille",
    "Ritchie Cola",
    "Ritchie Cola Zéro"
  ];

  const handleCopy = (index, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFilteredExtras = () => {
    let filtered = extras;

    if (filterType === 'formules') {
      filtered = extras.filter(extra => extra.toLowerCase().includes('formule'));
    } else if (filterType === 'boissons') {
      filtered = extras.filter(extra => 
        ['leignion', 'cardamome', 'bergamote', 'céréales', 'bioul', 'cortil', 'charlot', 'ritchie', 'jus'].some(term =>
          extra.toLowerCase().includes(term)
        )
      );
    } else if (filterType === 'plats') {
      filtered = extras.filter(extra => 
        ['boulette', 'waterzooi', 'chili', 'velouté'].some(term => 
          extra.toLowerCase().includes(term)
        )
      );
    } else if (filterType === 'supplements') {
      filtered = extras.filter(extra => 
        extra.toLowerCase().includes('supplémentaire')
      );
    }

    return filtered.filter(extra =>
      extra.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="w-full max-w-7xl p-3 mx-auto md:p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">Liste des Extras</h2>
        
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher un extra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#678D73] focus:border-[#678D73] outline-none"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#678D73] focus:border-[#678D73] outline-none"
          >
            <option value="all">Tous les extras</option>
            <option value="formules">Formules</option>
            <option value="boissons">Boissons</option>
            <option value="plats">Plats</option>
            <option value="supplements">Suppléments</option>
          </select>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="divide-y divide-gray-200">
            {getFilteredExtras().map((extra, index) => (
              <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <span className="text-sm text-gray-900 md:text-base">{extra}</span>
                <button
                  onClick={() => handleCopy(index, extra)}
                  className="p-2 text-gray-500 hover:text-[#678D73] focus:outline-none transition-colors"
                  title="Copier"
                >
                  {copiedId === index ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtrasList;