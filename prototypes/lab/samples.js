/* Search Lens prototype: 100 test searches in 10 lessons, and example index definitions.
   Each test is [text saved in the index, what a shopper types]. */
(function (root) {
'use strict';

var LESSONS = [
  {id: 'forms', name: 'Plurals and word forms', teaches: 'A shopper types "shoe", the product says "Shoes". A stemmer cuts both to the same root.',
    cases: [['Running Shoes for Men', 'shoe'], ['Leather Wallets', 'wallet'], ['Batteries included', 'battery'], ["Women's Boots", 'women boot'],
      ['Cooking Pans set', 'cook pan'], ['Matches in a box', 'match'], ['Studies in Design', 'study'], ['Garden Chairs', 'chair'],
      ['Running Jacket', 'ran'], ['Kitchen Knives', 'knife']]},
  {id: 'case', name: 'Big and small letters', teaches: '"IPHONE" and "iPhone" are different tokens unless a lowercase filter makes them equal.',
    cases: [['iPhone 15 Pro', 'IPHONE'], ['NIKE Air Max', 'nike air max'], ['USB-C Cable', 'usb-c cable'], ['LEGO Star Wars', 'Lego'],
      ['Dell XPS 13', 'dell xps'], ['Smart TV', 'smart tv'], ['PlayStation 5', 'playstation'], ['eBay Gift Card', 'EBAY'],
      ['The North Face Jacket', 'north FACE'], ['AirPods Pro', 'airpods']]},
  {id: 'accents', name: 'Accents and special letters', teaches: 'Shoppers rarely type accents. asciifolding turns "café" into "cafe".',
    cases: [['Café Crème Coffee', 'cafe creme'], ['Jalapeño Chips', 'jalapeno'], ['Crème Brûlée Kit', 'creme brulee'], ['Müller Yogurt', 'muller'],
      ['São Paulo Travel Guide', 'sao paulo'], ['Pokémon Cards', 'pokemon'], ['Naïve Art Print', 'naive art'], ['Façade Paint', 'facade'],
      ['Straße Map Berlin', 'strasse'], ['Smørrebrød Recipes', 'smorrebrod']]},
  {id: 'hyphens', name: 'Hyphens and joined words', teaches: '"Wi-Fi" is cut into "wi" and "fi". The shopper types "wifi". They only meet if the parts are glued back.',
    cases: [['Wi-Fi Router', 'wifi'], ['Cotton T-Shirt', 'tshirt'], ['E-mail Client', 'email'], ['Coca-Cola Bottle', 'coca cola'],
      ['Spider-Man Toy', 'spiderman'], ['X-Box Controller', 'xbox'], ['Re-usable Water Bottle', 'reusable'], ['Hand-made Soap', 'handmade'],
      ['Anti-Virus Software', 'antivirus'], ['Long-sleeve Shirt', 'long sleeve']]},
  {id: 'numbers', name: 'Numbers and units', teaches: '"500ml" is one token, "500 ml" is two. Numbers and units need care.',
    cases: [['Water Bottle 500ml', '500 ml'], ['Samsung 55 inch TV', '55 inch tv'], ['iPhone 15 Pro Max', 'iphone15'], ['Running Shoes Size 42', '42'],
      ['Power Bank 5000mAh', '5000 mah'], ['Laptop 16GB RAM', '16 gb'], ['Socks, pack of 3', '3 pack'], ['Model A1234-B', 'a1234b'],
      ['Firmware Version 2.0', '2.0'], ['4K Monitor 27 inch', '4k monitor']]},
  {id: 'stop', name: 'Little words (stop words)', teaches: 'Words like "the" and "of" are often removed. Sometimes that removes the whole search.',
    cases: [['The Lord of the Rings', 'lord rings'], ['Harry Potter and the Chamber of Secrets', 'harry potter chamber secrets'], ['The Who Live at Leeds', 'the who'],
      ['To Be or Not to Be poster', 'to be or not to be'], ['Shoes for running', 'shoes running'], ['A Tale of Two Cities', 'tale of two cities'],
      ['Bag with zipper', 'bag zipper'], ['Made in Italy', 'italy'], ['Take That Greatest Hits', 'take that'], ['It Ends with Us', 'it ends with us']]},
  {id: 'synonyms', name: 'Same meaning, other word', teaches: 'The product says "Sneakers", the shopper types "trainers". Only a synonym list joins them.',
    cases: [['Sneakers for kids', 'trainers'], ['Television 55 inch', 'tv'], ['Mobile phone case', 'cell phone case'], ['Laptop bag', 'notebook bag'],
      ['Grey Sofa', 'couch'], ['Slim fit Pants', 'trousers'], ['Soda can', 'pop'], ['Bicycle helmet', 'bike helmet'],
      ['Fridge magnet', 'refrigerator magnet'], ['Car charger', 'auto charger']]},
  {id: 'typos', name: 'Typos', teaches: 'Analysis never fixes typos. The query must allow small mistakes with "fuzziness".',
    cases: [['Wireless Headphones', 'hedphones'], ['Mechanical Keyboard', 'keybord'], ['Summer Sandals', 'sandels'], ['Black Umbrella', 'umbrela'],
      ['Silver Necklace', 'neckless'], ['Travel Backpack', 'bagpack'], ['Microwave Oven', 'microwve'], ['Wall Calendar 2026', 'calender'],
      ['Vacuum Cleaner', 'vaccum'], ['Polarized Sunglasses', 'sunglases']]},
  {id: 'partial', name: 'Half-typed words', teaches: 'While typing, the shopper has only "sho". Only fields that save the first letters (edge_ngram) can find "shoes".',
    cases: [['Running Shoes', 'run sho'], ['Bluetooth Speaker', 'blue'], ['Samsung Galaxy', 'sams'], ['Kitchen Knife', 'kitc'],
      ['Headphones', 'head'], ['Watermelon', 'melon'], ['Toothbrush', 'brush'], ['Notebook A5', 'note'],
      ['Sunflower Oil', 'sunf'], ['Keyboard', 'key']]},
  {id: 'symbols', name: 'Brands, codes and symbols', teaches: '"AT&T", "C++" and "H&M" lose their symbols in most tokenizers. Codes need special care.',
    cases: [['AT&T Prepaid SIM', 'at&t'], ['H&M Hoodie', 'h&m'], ['C++ Programming Book', 'c++'], ['C# in Depth', 'c#'],
      ["Levi's 501 Jeans", 'levis'], ['Johnson & Johnson Baby Oil', 'johnson and johnson'], ['SKU AB-1234-XY', 'ab1234xy'], ['100% Cotton Towel', '100%'],
      ['Email support@shop.com', 'support@shop.com'], ['Deal: $19.99 only', '19.99']]}
];

var SHOP = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      char_filter: {
        symbols: {type: 'mapping', mappings: ['& => and', '++ => plusplus', '# => sharp']}
      },
      filter: {
        shop_parts: {type: 'word_delimiter_graph', preserve_original: true, catenate_all: true, split_on_case_change: false},
        shop_synonyms: {type: 'synonym_graph', synonyms: [
          'sneakers, trainers', 'tv, television', 'mobile, cell phone', 'laptop, notebook', 'sofa, couch',
          'pants, trousers', 'soda, pop', 'bicycle, bike', 'fridge, refrigerator', 'car, auto']},
        protected: {type: 'keyword_marker', keywords: ['iphone', 'airpods', 'news']},
        english_stemmer: {type: 'stemmer', language: 'english'},
        first_letters: {type: 'edge_ngram', min_gram: 2, max_gram: 15}
      },
      analyzer: {
        shop_text: {type: 'custom', char_filter: ['html_strip', 'symbols'], tokenizer: 'whitespace',
          filter: ['shop_parts', 'lowercase', 'asciifolding', 'shop_synonyms', 'protected', 'english_stemmer']},
        autocomplete: {type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding', 'first_letters']},
        autocomplete_search: {type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding']}
      },
      normalizer: {
        lower: {type: 'custom', filter: ['lowercase', 'asciifolding']}
      }
    }
  },
  mappings: {
    properties: {
      title: {type: 'text', analyzer: 'shop_text', fields: {
        suggest: {type: 'text', analyzer: 'autocomplete', search_analyzer: 'autocomplete_search'},
        raw: {type: 'keyword'}}},
      description: {type: 'text', analyzer: 'english'},
      brand: {type: 'keyword', normalizer: 'lower'},
      price: {type: 'float'},
      in_stock: {type: 'boolean'},
      created_at: {type: 'date'}
    }
  }
};

var DEFAULTS = {
  mappings: {
    properties: {
      title: {type: 'text', fields: {keyword: {type: 'keyword', ignore_above: 256}}},
      description: {type: 'text'},
      brand: {type: 'keyword'},
      price: {type: 'float'}
    }
  }
};

var ENGLISH = {
  settings: {
    analysis: {
      analyzer: {
        english_folded: {type: 'custom', tokenizer: 'standard',
          filter: ['english_possessive', 'lowercase', 'asciifolding', 'stop', 'english_stem']}
      },
      filter: {
        english_possessive: {type: 'stemmer', language: 'possessive_english'},
        english_stem: {type: 'stemmer', language: 'english'}
      }
    }
  },
  mappings: {
    properties: {
      title: {type: 'text', analyzer: 'english'},
      title_folded: {type: 'text', analyzer: 'english_folded'},
      title_exact: {type: 'text', analyzer: 'whitespace'}
    }
  }
};

var EXAMPLES = [
  {id: 'defaults', name: 'Just the defaults', say: 'What you get when you do not set any analyzer. A good start to compare against.', body: DEFAULTS},
  {id: 'english', name: 'English analyzers', say: 'Three ways to save the same title: built-in english, english with accents removed, and almost no change.', body: ENGLISH},
  {id: 'shop', name: 'Online shop', say: 'A tuned product index: synonyms, accents, hyphens, protected brand words and autocomplete.', body: SHOP}
];

root.LensSamples = {LESSONS: LESSONS, EXAMPLES: EXAMPLES};
})(typeof window !== 'undefined' ? window : globalThis);
