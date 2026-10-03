/* Search Lens prototype: a made-up cluster for index-explorer.html. Not production code.
   Shapes follow the real answers: GET _cat/indices?format=json&bytes=b, GET /<index>,
   and documents as _source. Sizes are invented; searches run over the few sample documents. */
(function (root) {
'use strict';
var shop = JSON.parse(JSON.stringify(root.LensSamples.EXAMPLES[2].body));
shop.settings.number_of_shards = 2;
shop.settings.refresh_interval = '1s';
shop.mappings.properties.category = {type: 'keyword'};
shop.mappings.properties.tags = {type: 'keyword', normalizer: 'lower'};
shop.mappings.properties.variants = {type: 'nested', properties: {color: {type: 'keyword'}, size: {type: 'keyword'}}};

var P = function (id, title, brand, price, category, desc, tags, inStock, date) {
  return {_id: id, _source: {title: title, description: desc, brand: brand, price: price, category: category, tags: tags, in_stock: inStock, created_at: date}};
};

var PRODUCTS = [
  P('p-1001', 'Nike Air Zoom Pegasus 40 Running Shoes', 'Nike', 129.99, 'running', 'A soft and responsive road running shoe for daily training. Breathable mesh upper.', ['road', 'daily'], true, '2026-03-14'),
  P('p-1002', 'Adidas Ultraboost Light Running Shoe', 'Adidas', 179.95, 'running', 'Light running shoe with Boost cushioning. Made for long runs and comfort.', ['road', 'cushion'], true, '2026-02-02'),
  P('p-1003', 'Nike Revolution 7 Road Running Shoes', 'Nike', 69.99, 'running', 'Simple and comfortable shoes for your first runs. Good value.', ['road', 'beginner'], true, '2026-05-20'),
  P('p-1004', "ASICS Gel-Kayano 30 Women's Running Shoes", 'ASICS', 159.9, 'running', 'Stability shoe for women with GEL cushioning. Supports long distance running.', ['stability'], false, '2026-01-11'),
  P('p-1005', 'Puma Velocity Nitro Running Sneakers', 'Puma', 119.0, 'running', 'Sneakers with Nitro foam for fast running and everyday wear.', ['road'], true, '2026-04-08'),
  P('p-1006', 'Nike Court Vision Low Sneakers', 'Nike', 74.99, 'lifestyle', 'Classic basketball style sneakers for every day. Not made for running.', ['casual'], true, '2026-06-01'),
  P('p-1007', 'Red Running Shoes for Kids', 'KidStep', 39.99, 'kids', 'Bright red shoes for kids who love to run and play. Easy hook and loop closure.', ['kids', 'red'], true, '2026-07-19'),
  P('p-1008', 'Trail Running Backpack 12L', 'Salomon', 89.0, 'accessories', 'A light backpack for trail running with room for water and a jacket.', ['trail'], true, '2026-03-30'),
  P('p-1009', 'Wireless Running Headphones', 'Shokz', 129.95, 'electronics', 'Open-ear wireless headphones that stay in place while running.', ['audio'], true, '2026-08-21'),
  P('p-1010', 'Café Racer Leather Jacket', 'Schott', 349.0, 'clothing', 'Classic leather jacket in the café racer style. Black cowhide.', ['leather'], false, '2025-11-05'),
  P('p-1011', 'Wi-Fi Smart Running Watch', 'Garmin', 299.99, 'electronics', 'GPS running watch with Wi-Fi sync, heart rate and training plans.', ['gps', 'watch'], true, '2026-09-09'),
  P('p-1012', 'Nike Dri-FIT Running T-Shirt Red', 'Nike', 34.99, 'clothing', 'A light red running shirt that keeps you dry. Dri-FIT fabric.', ['red', 'shirt'], true, '2026-08-02')
];

var REVIEWS = [
  ['r-1', 'p-1001', 'Very comfortable shoes. I run 10 km every morning in them.', 5, 'anna_k'],
  ['r-2', 'p-1001', 'Good shoe but the size is small. Order one size up.', 4, 'mike77'],
  ['r-3', 'p-1002', 'The most comfortable running shoe I have ever had.', 5, 'runner_jo'],
  ['r-4', 'p-1003', 'Cheap and fine for short runs. Not comfortable after 5 km.', 3, 'sam'],
  ['r-5', 'p-1004', 'Great support for my knees. Comfortable on long runs.', 5, 'li_wei'],
  ['r-6', 'p-1007', 'My son loves the red color. The shoes broke after two months.', 2, 'parent_pat'],
  ['r-7', 'p-1009', 'The headphones do not fall out while running. Sound is OK.', 4, 'dj_run'],
  ['r-8', 'p-1011', 'Wi-Fi sync is slow, but the watch is accurate.', 3, 'tech_tom']
].map(function (r) { return {_id: r[0], _source: {product_id: r[1], text: r[2], rating: r[3], author: r[4], created_at: '2026-09-1' + r[3]}}; });

var LOG_MAPPING = {
  settings: {number_of_shards: 3, number_of_replicas: 1, refresh_interval: '30s'},
  mappings: {properties: {
    '@timestamp': {type: 'date'}, level: {type: 'keyword'}, service: {type: 'keyword'},
    message: {type: 'text'}, trace_id: {type: 'keyword'},
    http: {properties: {status: {type: 'integer'}, path: {type: 'keyword'}, took_ms: {type: 'long'}}}
  }}
};
var L = function (id, t, level, service, msg, status, path, took) {
  return {_id: id, _source: {'@timestamp': '2026-10-03T' + t + 'Z', level: level, service: service, message: msg, trace_id: 'tr-' + id, http: {status: status, path: path, took_ms: took}}};
};
var LOGS = [
  L('l1', '09:00:01', 'ERROR', 'payment', 'Payment service timeout after 30s while calling the bank', 504, '/pay', 30012),
  L('l2', '09:00:03', 'WARN', 'search', 'Slow search query took 2400 ms on index products', 200, '/search', 2400),
  L('l3', '09:00:04', 'INFO', 'search', 'Search request finished', 200, '/search', 41),
  L('l4', '09:00:09', 'ERROR', 'checkout', 'Checkout failed: payment timeout', 500, '/checkout', 31050),
  L('l5', '09:00:12', 'INFO', 'payment', 'Payment accepted', 200, '/pay', 380),
  L('l6', '09:00:15', 'ERROR', 'search', 'Search cluster returned 429 Too Many Requests', 429, '/search', 12)
];

var GB = 1e9, MB = 1e6;
var INDEXES = [
  {index: 'logs-app-2026.10.03', health: 'green', status: 'open', pri: 3, rep: 1, docs: 41250000, size: 19.6 * GB, body: LOG_MAPPING, documents: LOGS, about: 'Application logs for one day.'},
  {index: 'logs-app-2026.10.02', health: 'green', status: 'open', pri: 3, rep: 1, docs: 40110000, size: 19.1 * GB, body: LOG_MAPPING, documents: LOGS, about: 'Application logs for one day.'},
  {index: 'products', health: 'green', status: 'open', pri: 2, rep: 1, docs: 2140331, size: 8.4 * GB, body: shop, documents: PRODUCTS, about: 'The shop catalogue. This is what customers search.'},
  {index: 'orders-2026', health: 'green', status: 'open', pri: 2, rep: 1, docs: 12400000, size: 6.2 * GB, about: 'Orders placed this year.',
    body: {settings: {number_of_shards: 2, number_of_replicas: 1}, mappings: {properties: {order_id: {type: 'keyword'}, customer_id: {type: 'keyword'}, total: {type: 'scaled_float', scaling_factor: 100}, status: {type: 'keyword'}, placed_at: {type: 'date'}, items: {type: 'nested', properties: {product_id: {type: 'keyword'}, qty: {type: 'integer'}}}}}}},
  {index: 'reviews', health: 'green', status: 'open', pri: 1, rep: 1, docs: 9870112, size: 3.7 * GB, documents: REVIEWS, about: 'Customer reviews of products.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 1}, mappings: {properties: {product_id: {type: 'keyword'}, text: {type: 'text', analyzer: 'english'}, rating: {type: 'byte'}, author: {type: 'keyword'}, created_at: {type: 'date'}}}}},
  {index: 'customers', health: 'yellow', status: 'open', pri: 1, rep: 2, docs: 1204550, size: 2.3 * GB, unassigned: 1, about: 'Customer accounts.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 2}, mappings: {properties: {name: {type: 'text', fields: {keyword: {type: 'keyword'}}}, email: {type: 'keyword'}, city: {type: 'keyword'}, signed_up: {type: 'date'}}}}},
  {index: 'search-clicks', health: 'green', status: 'open', pri: 1, rep: 1, docs: 22000000, size: 1.9 * GB, about: 'Which result a shopper clicked after a search.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 1}, mappings: {properties: {query: {type: 'text', fields: {raw: {type: 'keyword'}}}, product_id: {type: 'keyword'}, position: {type: 'short'}, at: {type: 'date'}}}}},
  {index: 'inventory', health: 'green', status: 'open', pri: 1, rep: 1, docs: 2140331, size: 0.82 * GB, about: 'Stock per product and store.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 1}, mappings: {properties: {product_id: {type: 'keyword'}, store_id: {type: 'keyword'}, qty: {type: 'integer'}, updated_at: {type: 'date'}}}}},
  {index: 'stores', health: 'green', status: 'open', pri: 1, rep: 1, docs: 1480, size: 12 * MB, about: 'Shop locations.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 1}, mappings: {properties: {name: {type: 'text'}, city: {type: 'keyword'}, location: {type: 'geo_point'}}}}},
  {index: 'promotions', health: 'green', status: 'open', pri: 1, rep: 1, docs: 312, size: 4 * MB, about: 'Sales and discount codes.',
    body: {settings: {number_of_shards: 1, number_of_replicas: 1}, mappings: {properties: {code: {type: 'keyword'}, text: {type: 'text'}, starts: {type: 'date'}, ends: {type: 'date'}}}}}
];

var PRESETS = {
  products: [
    {name: 'Simple search', q: {query: {match: {title: 'running shoes'}}}},
    {name: 'Many fields, title counts 3×', q: {query: {multi_match: {query: 'nike running shoes', fields: ['title^3', 'description', 'brand']}}}},
    {name: 'Must + filters', q: {query: {bool: {must: [{match: {title: 'running shoes'}}], filter: [{term: {brand: 'nike'}}, {range: {price: {lte: 120}}}]}}}},
    {name: 'All words must match', q: {query: {match: {title: {query: 'red running shoes', operator: 'and'}}}}},
    {name: 'Mistake: term on a text field', q: {query: {term: {title: 'Running Shoes'}}}},
    {name: 'Half-typed (autocomplete)', q: {query: {match: {'title.suggest': 'run sho'}}}}
  ],
  reviews: [
    {name: 'Simple search', q: {query: {match: {text: 'comfortable shoes'}}}},
    {name: 'Good reviews only', q: {query: {bool: {must: [{match: {text: 'comfortable'}}], filter: [{range: {rating: {gte: 4}}}]}}}}
  ],
  logs: [
    {name: 'Find a word', q: {query: {match: {message: 'timeout'}}}},
    {name: 'Errors about payment', q: {query: {bool: {must: [{match: {message: 'payment'}}], filter: [{term: {level: 'ERROR'}}]}}}}
  ]
};

root.LensCluster = {
  name: 'shop-prod', url: 'https://search.example.com:9200', version: '2.17.0',
  nodes: ['node-1', 'node-2', 'node-3'],
  moreIndexes: 27, systemIndexes: 9,
  indexes: INDEXES,
  presetsFor: function (name) { return PRESETS[name] || (/^logs-/.test(name) ? PRESETS.logs : []); }
};
})(typeof window !== 'undefined' ? window : globalThis);
