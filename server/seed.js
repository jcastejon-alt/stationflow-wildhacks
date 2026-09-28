// Intentionally fictional demo menu. This is not a Sodexo menu or eligibility list.
const option = (id, label, details = {}) => ({ id, label, available: true, ...details });
const group = (id, label, min, max, choices, kind = 'customization') => ({
  id, label, min, max, kind, options: choices.map(([value, text, details]) => option(value, text, details)),
});
const hubCupSauces = (groupId, optionPrefix) => group(groupId, 'Side sauce · served in a small cup', 0, 2, [[`${optionPrefix}-ranch`, 'Ranch'], [`${optionPrefix}-hub-sauce`, 'Hub sauce']], 'sauce');
const unverifiedPricing = { amountCents: null, currency: 'USD', status: 'unverified', sourceUrl: null, note: 'A current public menu price was not verified.' };
const demoPrice = (amountCents) => ({ amountCents, currency: 'USD', status: 'demo', sourceUrl: null, note: 'Illustrative demo price; not an official campus price.' });

export const stations = [
  { id: 'omelet', locationId: 'cafeteria', physicalStationId: 'cafeteria-grill', queueGroupId: 'cafeteria-grill', name: 'Omelet Station', location: 'Apple Dining Hall', description: 'Build an omelet for your next campus break.', paused: false, capacity: 6, onlineCapacity: 4 },
  { id: 'hamburger', locationId: 'cafeteria', physicalStationId: 'cafeteria-grill', queueGroupId: 'cafeteria-grill', name: 'Hamburger Station', location: 'Apple Dining Hall', description: 'The breakfast grill switches to made-to-order hamburgers at 11 AM.', paused: false, capacity: 6, onlineCapacity: 4 },
  { id: 'sandwich', locationId: 'cafeteria', physicalStationId: 'cafeteria-sandwich', queueGroupId: 'cafeteria-sandwich', name: 'Sandwich Station', location: 'Apple Dining Hall', description: 'Choose your bread, fillings, and finishing touches.', paused: false, capacity: 8, onlineCapacity: 6 },
  { id: 'hub', locationId: 'hub', name: 'The Hub', location: 'The Hub', description: 'Campus favorites, made for your pickup window.', paused: false, capacity: 10, onlineCapacity: 7 },
  { id: 'frothy', locationId: 'frothy', name: 'Frothy Monkey', location: 'Waggoner Library', description: 'Sample coffee and espresso favorites.', paused: false, capacity: 8, onlineCapacity: 6 },
  { id: 'starbucks', locationId: 'starbucks', name: 'We Proudly Serve Starbucks', location: 'Bud Robinson Building', description: 'Espresso, tea, and a little study break.', paused: false, capacity: 8, onlineCapacity: 6 },
];

export const items = [
  {
    id: 'build-your-omelet', stationId: 'omelet', name: 'Your morning omelet',
    description: 'A made-to-order demo omelet with your favorite fillings.', category: 'Build your own', available: true, exchangeEligible: false,
    groups: [
      group('eggs', 'Eggs', 1, 1, [['whole-eggs', 'Whole eggs'], ['egg-whites', 'Egg whites']]),
      group('omelet-protein', 'Protein', 0, 2, [['ham', 'Ham'], ['turkey-sausage', 'Turkey sausage']]),
      group('omelet-cheese', 'Cheese', 0, 1, [['cheddar', 'Cheddar'], ['mozzarella', 'Mozzarella']]),
      group('omelet-vegetables', 'Vegetables', 0, 5, [['spinach', 'Spinach'], ['tomato', 'Tomato'], ['mushroom', 'Mushroom'], ['onion', 'Onion'], ['bell-pepper', 'Bell pepper']]),
    ],
  },
  {
    id: 'build-your-hamburger', stationId: 'hamburger', name: 'Your grill hamburger',
    description: 'Choose lettuce, cheese, pickles, or tomato. All sauces are available in person at the cafeteria and are not online choices. Demo menu; confirm station availability.', category: 'From the grill', available: true, exchangeEligible: false,
    groups: [
      group('hamburger-toppings', 'Ingredients', 0, 4, [['grill-lettuce', 'Lettuce'], ['grill-cheese', 'Cheese'], ['grill-pickles', 'Pickles'], ['grill-tomato', 'Tomato']]),
    ],
  },
  {
    id: 'build-your-sandwich', stationId: 'sandwich', name: 'Your signature sandwich',
    description: 'Bread and fillings reflect a photographed station sign. Vinegar, honey mustard, Caesar, and toast levels are additional demo choices; confirm availability on campus.', category: 'Build your own', available: true, exchangeEligible: false,
    groups: [
      group('bread', 'Bread', 1, 1, [['wheat', 'Wheat bread'], ['white', 'White bread']]),
      group('sandwich-protein', 'Protein', 1, 1, [['turkey', 'Turkey breast'], ['smoked-ham', 'Smoked ham'], ['roast-beef', 'Roast beef'], ['chicken-caesar', 'Chicken Caesar']]),
      group('sandwich-cheese', 'Cheese', 0, 1, [['american', 'American'], ['swiss', 'Swiss'], ['cheddar', 'Cheddar']]),
      group('sandwich-vegetables', 'Vegetables', 0, 7, [['lettuce', 'Leaf lettuce'], ['sliced-tomato', 'Tomato'], ['banana-peppers', 'Banana peppers'], ['green-peppers', 'Green peppers'], ['red-onion', 'Onions'], ['pickles', 'Pickles'], ['cucumbers', 'Cucumbers']]),
      group('sauces', 'Sauce', 0, 2, [['chipotle-mayo', 'Chipotle mayo'], ['ranch', 'Ranch'], ['mayonnaise', 'Mayonnaise'], ['mustard', 'Mustard'], ['vinegar', 'Vinegar', { note: 'Additional demo option; not listed on the photographed station sign.' }], ['honey-mustard', 'Honey mustard', { note: 'Additional demo option; not listed on the photographed station sign.' }], ['caesar', 'Caesar', { note: 'Additional demo option; not listed on the photographed station sign.' }]], 'sauce'),
      group('sandwich-toast', 'How toasted?', 1, 1, [['sandwich-untoasted', 'Not toasted'], ['sandwich-light', 'Lightly toasted'], ['sandwich-medium', 'Medium toasted'], ['sandwich-extra', 'Extra toasted']]),
    ],
  },
  {
    id: 'build-your-wrap', stationId: 'sandwich', name: 'Your custom wrap',
    description: 'Wrap and fillings reflect a photographed station sign. Vinegar, honey mustard, Caesar, and toast levels are additional demo choices; confirm availability on campus.', category: 'Build your own', available: true, exchangeEligible: false,
    groups: [
      group('wrap-base', 'Wrap', 1, 1, [['wrap-flour', '12-inch Flour tortilla'], ['wrap-wheat', '12-inch Wheat tortilla']]),
      group('wrap-protein', 'Protein', 1, 1, [['wrap-turkey', 'Turkey breast'], ['wrap-smoked-ham', 'Smoked ham'], ['wrap-roast-beef', 'Roast beef'], ['wrap-chicken-caesar', 'Chicken Caesar']]),
      group('wrap-cheese', 'Cheese', 0, 1, [['wrap-american', 'American'], ['wrap-swiss', 'Swiss'], ['wrap-cheddar', 'Cheddar']]),
      group('wrap-vegetables', 'Vegetables', 0, 7, [['wrap-lettuce', 'Leaf lettuce'], ['wrap-tomato', 'Tomato'], ['wrap-banana-peppers', 'Banana peppers'], ['wrap-green-peppers', 'Green peppers'], ['wrap-onion', 'Onions'], ['wrap-pickles', 'Pickles'], ['wrap-cucumbers', 'Cucumbers']]),
      group('wrap-sauces', 'Sauce', 0, 2, [['wrap-chipotle-mayo', 'Chipotle mayo'], ['wrap-ranch', 'Ranch'], ['wrap-mayonnaise', 'Mayonnaise'], ['wrap-mustard', 'Mustard'], ['wrap-vinegar', 'Vinegar', { note: 'Additional demo option; not listed on the photographed station sign.' }], ['wrap-honey-mustard', 'Honey mustard', { note: 'Additional demo option; not listed on the photographed station sign.' }], ['wrap-caesar', 'Caesar', { note: 'Additional demo option; not listed on the photographed station sign.' }]], 'sauce'),
      group('wrap-toast', 'How toasted?', 1, 1, [['wrap-untoasted', 'Not toasted'], ['wrap-light', 'Lightly toasted'], ['wrap-medium', 'Medium toasted'], ['wrap-extra', 'Extra toasted']]),
    ],
  },
  {
    id: 'chicken-tenders', stationId: 'hub', name: 'Chicken tenders',
    description: 'Crispy tenders. Ranch and Hub sauce can be ordered in separate cups; other sauces are self-serve in person. Fictional meal-swipe example.', category: 'Favorites', available: true, exchangeEligible: true,
    pricing: unverifiedPricing,
    groups: [hubCupSauces('tender-dip', 'tender')],
  },
  {
    id: 'hub-burger', stationId: 'hub', name: 'Hub burger',
    description: 'Choose lettuce, cheese, pickles, or tomato. Ranch and Hub sauce come separately in a small cup; other sauces are freely available at the self-serve counter and are not online modifiers. Fictional exchange example.', category: 'Favorites', available: true, exchangeEligible: true,
    pricing: unverifiedPricing,
    groups: [
      group('burger-toppings', 'Ingredients', 0, 4, [['burger-lettuce', 'Lettuce'], ['burger-cheese', 'Cheese'], ['burger-pickles', 'Pickles'], ['burger-tomato', 'Tomato']]),
      hubCupSauces('burger-sauce', 'burger'),
    ],
  },
  {
    id: 'veggie-wrap', stationId: 'hub', name: 'Garden veggie wrap',
    description: 'A fresh vegetable wrap. Ranch and Hub sauce can be ordered in separate cups; other sauces are self-serve in person. Fictional demo item.', category: 'Wraps & greens', available: true, exchangeEligible: false,
    pricing: unverifiedPricing,
    groups: [
      group('wrap-fillings', 'Customize your wrap', 0, 3, [['wrap-spinach', 'Spinach'], ['wrap-tomato', 'Tomato'], ['wrap-cucumber', 'Cucumber']]),
      hubCupSauces('wrap-sauce', 'veggie-wrap'),
    ],
  },
  {
    id: 'chicken-wrap', stationId: 'hub', name: 'Grilled chicken wrap',
    description: 'A grilled chicken wrap. Ranch and Hub sauce can be ordered in separate cups; other sauces are self-serve in person. Fictional demo item.', category: 'Wraps & greens', available: true, exchangeEligible: false,
    pricing: unverifiedPricing,
    groups: [
      group('chicken-wrap-fillings', 'Customize your wrap', 0, 3, [['chicken-wrap-lettuce', 'Lettuce'], ['chicken-wrap-tomato', 'Tomato'], ['chicken-wrap-cheese', 'Cheddar']]),
      hubCupSauces('chicken-wrap-sauce', 'chicken-wrap'),
    ],
  },
  {
    id: 'garden-salad', stationId: 'hub', name: 'Garden salad',
    description: 'Greens and vegetables. Ranch and Hub sauce can be ordered in separate cups; other sauces are self-serve in person. Fictional demo item.', category: 'Wraps & greens', available: true, exchangeEligible: false,
    groups: [hubCupSauces('salad-dressing', 'salad')],
  },
  { id: 'seasoned-fries', stationId: 'hub', name: 'Seasoned fries', description: 'A warm, crisp side. Fictional demo item.', category: 'Sides & drinks', available: true, exchangeEligible: false, pricing: unverifiedPricing, groups: [] },
  { id: 'iced-tea', stationId: 'hub', name: 'Iced tea', description: 'A refreshing demo drink, served over ice.', category: 'Sides & drinks', available: true, exchangeEligible: false, pricing: unverifiedPricing, groups: [group('tea-style', 'Tea', 1, 1, [['sweet-tea', 'Sweet'], ['unsweet-tea', 'Unsweet']])] },
];

// Prices are clearly fictional examples, not published campus prices.
const hubDemoPrices = { 'chicken-tenders': 849, 'hub-burger': 899, 'veggie-wrap': 749, 'chicken-wrap': 849, 'garden-salad': 649, 'seasoned-fries': 299, 'iced-tea': 199 };
for (const item of items) item.pricing ??= unverifiedPricing;
for (const item of items.filter((candidate) => candidate.stationId === 'hub')) item.pricing = demoPrice(hubDemoPrices[item.id]);

// Representative examples based on the Frothy brand menu and Trevecca's location
// categories. Exact campus stock, modifiers, prices, and exchange rules are unknown.
const milk = (prefix, frothy = false, required = false) => group(`${prefix}-milk`, required ? 'Milk' : 'Add milk', required ? 1 : 0, 1, [
  [`${prefix}-whole`, 'Whole milk'], [`${prefix}-oat`, 'Oat milk'],
  ...(frothy ? [[`${prefix}-almond`, 'Almond milk']] : []),
  ...(!frothy ? [[`${prefix}-two-percent`, '2% milk'], [`${prefix}-almond`, 'Almond milk']] : []),
]);
const sweetener = (prefix) => group(`${prefix}-sweetener`, 'Add sweetener', 0, 1, [[`${prefix}-sugar`, 'Sugar'], [`${prefix}-honey`, 'Honey']]);
const coffeeGroups = (prefix, frothy = false) => [
  group(`${prefix}-temperature`, 'Temperature', 1, 1, [[`${prefix}-hot`, 'Hot'], [`${prefix}-iced`, 'Iced']]),
  milk(prefix, frothy, true),
];
const frothyFlavor = (prefix) => group(`${prefix}-flavor`, 'Flavor', 0, 1, [
  [`${prefix}-vanilla`, 'Vanilla'], [`${prefix}-banana`, 'Banana'],
  [`${prefix}-hazelnut`, 'Hazelnut'], [`${prefix}-lavender`, 'Lavender'],
]);
items.push(
  { id: 'frothy-latte', stationId: 'frothy', name: 'Café latte', description: 'Espresso and milk, hot or iced.', category: 'Espresso & lattes', available: true, exchangeEligible: false, groups: [...coffeeGroups('frothy-latte', true), frothyFlavor('frothy-latte')] },
  { id: 'frothy-coffee', stationId: 'frothy', name: 'Drip coffee', description: 'Brewed coffee with optional milk or sweetener.', category: 'Coffee', available: true, exchangeEligible: false, groups: [milk('frothy-coffee', true), sweetener('frothy-coffee')] },
  { id: 'frothy-espresso', stationId: 'frothy', name: 'Double espresso', description: 'A short, bold coffee break.', category: 'Espresso & lattes', available: true, exchangeEligible: false, groups: [] },
  { id: 'frothy-cold-brew', stationId: 'frothy', name: 'Cold brew', description: 'Chilled coffee with optional milk or flavor.', category: 'Coffee', available: true, exchangeEligible: false, groups: [milk('frothy-cold-brew', true), frothyFlavor('frothy-cold-brew')] },
  { id: 'frothy-mocha', stationId: 'frothy', name: 'Mocha latte', description: 'Espresso, milk, and a chocolate note, hot or iced.', category: 'Espresso & lattes', available: true, exchangeEligible: false, groups: coffeeGroups('frothy-mocha', true) },
  { id: 'frothy-chai', stationId: 'frothy', name: 'Chai latte', description: 'Spiced tea with milk, hot or iced.', category: 'Tea & more', available: true, exchangeEligible: false, groups: coffeeGroups('frothy-chai', true) },
  { id: 'starbucks-latte', stationId: 'starbucks', name: 'Espresso latte', description: 'Espresso and milk with an optional flavor.', category: 'Espresso drinks', available: true, exchangeEligible: false, groups: [...coffeeGroups('starbucks-latte'), group('starbucks-latte-flavor', 'Flavor', 0, 1, [['starbucks-latte-vanilla', 'Vanilla'], ['starbucks-latte-caramel', 'Caramel']])] },
  { id: 'starbucks-coffee', stationId: 'starbucks', name: 'Drip coffee', description: 'Brewed coffee with optional milk or sweetener.', category: 'Coffee & tea', available: true, exchangeEligible: false, groups: [milk('starbucks-coffee'), sweetener('starbucks-coffee')] },
  { id: 'starbucks-tea', stationId: 'starbucks', name: 'Iced tea', description: 'A cool tea break with optional sweetener.', category: 'Coffee & tea', available: true, exchangeEligible: false, groups: [sweetener('starbucks-tea')] },
  { id: 'starbucks-bakery-combo', stationId: 'starbucks', name: 'Muffin + drip coffee combo', description: 'Choose a muffin with drip coffee. Fictional meal-swipe example; campus combo and eligibility are unverified.', category: 'Meal swipe combo', available: true, exchangeEligible: true, groups: [
    group('starbucks-combo-muffin', 'Muffin', 1, 1, [['starbucks-combo-blueberry', 'Blueberry muffin'], ['starbucks-combo-chocolate', 'Chocolate chip muffin']]),
    milk('starbucks-combo-coffee'), sweetener('starbucks-combo-coffee'),
  ] },
);
const coffeeDemoPrices = {
  'frothy-latte': 475, 'frothy-coffee': 325, 'frothy-espresso': 300,
  'frothy-cold-brew': 425, 'frothy-mocha': 525, 'frothy-chai': 475,
  'starbucks-latte': 475, 'starbucks-coffee': 325, 'starbucks-tea': 300,
  'starbucks-bakery-combo': 695,
};
for (const item of items) item.pricing ??= unverifiedPricing;
for (const item of items.filter((candidate) => ['frothy', 'starbucks'].includes(candidate.stationId))) item.pricing = demoPrice(coffeeDemoPrices[item.id]);
