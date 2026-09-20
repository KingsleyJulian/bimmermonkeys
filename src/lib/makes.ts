type SelectOption<T extends string> = { value: T; label: string };

/**
 * Automobile manufacturers and marques worldwide — mainstream, luxury, commercial, EV
 * start-ups, defunct and regional (including brands assembled or sold in the Philippines).
 * Stored uppercase; add new names anywhere, the list is de-duplicated and sorted at load time.
 */
const RAW_MAKES = [
  // Germany
  'ALPINA', 'AUDI', 'BMW', 'BORGWARD', 'BRABUS', 'GUMPERT', 'ISDERA', 'MAYBACH', 'MERCEDES-AMG', 'MERCEDES-BENZ',
  'OPEL', 'PORSCHE', 'RUF', 'SMART', 'TRABANT', 'VOLKSWAGEN', 'WARTBURG', 'WIESMANN',
  // United Kingdom
  'AC', 'ARIEL', 'ASTON MARTIN', 'AUSTIN', 'AUSTIN-HEALEY', 'BENTLEY', 'BRISTOL', 'CATERHAM', 'DAIMLER',
  'GINETTA', 'HILLMAN', 'JAGUAR', 'JENSEN', 'LAND ROVER', 'LISTER', 'LOTUS', 'MCLAREN', 'MG', 'MINI', 'MORGAN',
  'MORRIS', 'NOBLE', 'RADICAL', 'RELIANT', 'ROLLS-ROYCE', 'ROVER', 'SUNBEAM', 'TRIUMPH', 'TVR', 'VAUXHALL',
  // Italy
  'ABARTH', 'ALFA ROMEO', 'AUTOBIANCHI', 'DALLARA', 'DE TOMASO', 'FERRARI', 'FIAT', 'INNOCENTI', 'IVECO',
  'LAMBORGHINI', 'LANCIA', 'MASERATI', 'PAGANI', 'PININFARINA',
  // France
  'ALPINE', 'BUGATTI', 'CITROEN', 'DACIA', 'DS AUTOMOBILES', 'PANHARD', 'PEUGEOT', 'RENAULT', 'SIMCA', 'TALBOT',
  'VENTURI',
  // Rest of Europe
  'DONKERVOORT', 'KOENIGSEGG', 'LADA', 'MOSKVITCH', 'POLESTAR', 'RIMAC', 'SAAB', 'SEAT', 'SKODA', 'SPYKER', 'TATRA',
  'UAZ', 'VOLVO', 'ZASTAVA', 'ZAZ', 'ZENVO',
  // United States
  'AMC', 'BUICK', 'CADILLAC', 'CHEVROLET', 'CHRYSLER', 'DELOREAN', 'DODGE', 'EAGLE', 'FISKER', 'FORD', 'GMC',
  'HUMMER', 'JEEP', 'LINCOLN', 'LORDSTOWN', 'LUCID', 'MERCURY', 'OLDSMOBILE', 'PACKARD', 'PLYMOUTH', 'PONTIAC',
  'RAM', 'RIVIAN', 'SALEEN', 'SATURN', 'SHELBY', 'STUDEBAKER', 'TESLA', 'VINFAST US',
  // Japan
  'ACURA', 'DAIHATSU', 'DATSUN', 'HINO', 'HONDA', 'INFINITI', 'ISUZU', 'LEXUS', 'MAZDA', 'MITSUBISHI',
  'MITSUBISHI FUSO', 'MITSUOKA', 'NISSAN', 'SCION', 'SUBARU', 'SUZUKI', 'TOYOTA', 'UD TRUCKS',
  // Korea
  'DAEWOO', 'GENESIS', 'HYUNDAI', 'KIA', 'SSANGYONG', 'KGM',
  // China
  'AION', 'AITO', 'ARCFOX', 'AVATR', 'BAIC', 'BESTUNE', 'BYD', 'CHANGAN', 'CHERY', 'DENZA', 'DEEPAL', 'DFSK',
  'DONGFENG', 'EXEED', 'FAW', 'FOTON', 'GAC', 'GEELY', 'GREAT WALL', 'HAVAL', 'HONGQI', 'HUMAN HORIZONS', 'JAC',
  'JAECOO', 'JETOUR', 'JMC', 'LEAPMOTOR', 'LI AUTO', 'LYNK & CO', 'MAXUS', 'MG MOTOR', 'NETA', 'NIO', 'OMODA', 'ORA',
  'ROEWE', 'SAIC', 'SERES', 'SMART CHINA', 'TANK', 'VOYAH', 'WEY', 'WULING', 'XPENG', 'ZEEKR', 'ZOTYE',
  // India & South Asia
  'ASHOK LEYLAND', 'BAJAJ AUTO', 'FORCE MOTORS', 'HINDUSTAN MOTORS', 'MAHINDRA', 'MARUTI SUZUKI', 'PREMIER',
  'TATA',
  // Southeast Asia & Philippines
  'PERODUA', 'PROTON', 'VINFAST', 'SARAO', 'FRANCISCO MOTORS', 'ARMAK',
  // Australia & Other
  'HOLDEN', 'HSV', 'IKA', 'IRAN KHODRO', 'SAIPA', 'TOFAS', 'TOGG',
  // Commercial & specialist
  'DAF', 'MAN', 'SCANIA', 'FREIGHTLINER', 'INTERNATIONAL', 'KENWORTH', 'MACK', 'PETERBILT', 'CFMOTO', 'MV AGUSTA',
] as const;

export const VEHICLE_MAKES: readonly string[] = Array.from(new Set(RAW_MAKES.map((m) => m.toUpperCase()))).sort((a, b) =>
  a.localeCompare(b),
);

export const VEHICLE_MAKE_OPTIONS: readonly SelectOption<string>[] = VEHICLE_MAKES.map((m) => ({ value: m, label: m }));

export const isKnownMake = (value: string) => VEHICLE_MAKES.includes(value);
