/**
 * In-console user guide. One topic per page or modal; each action is a short "what it does /
 * when to use it" line so staff can review everything they can do from that screen.
 */
export type HelpTopic = { title: string; intro: string; actions: { label: string; text: string }[]; tips?: string[] };

export const HELP: Record<string, HelpTopic> = {
  dashboard: {
    title: 'Dashboard',
    intro: 'A live snapshot of the shop: how many vehicles are at each stage, which parts are still waiting, and the newest job orders.',
    actions: [
      { label: 'Work in the shop', text: 'The pipeline bar counts job orders per status. Click a segment to open the Job Orders page already filtered to that status.' },
      { label: 'Parts waiting', text: 'Part requests still REQUESTED or ORDERED, grouped by job order. Click one to open the job order and update the request.' },
      { label: 'Latest job orders', text: 'The most recent entries synced from the mobile app. Click a row to open its full sheet.' },
      { label: 'Open job orders', text: 'Jumps to the full Job Orders list with search and filters.' },
    ],
  },
  'job-orders': {
    title: 'Job orders',
    intro: 'Every job order the technicians have filed from the app. Search, change stage, request parts, add charges or reports, and print documents from here.',
    actions: [
      { label: 'Search', text: 'Type a plate, chassis (VIN), engine number, customer name or JO number. Results update as you type.' },
      { label: 'Status filter', text: '“Not finished” shows everything still in the shop; “Finished + released” shows closed work. Pick a single status to narrow further. The category filter limits by PMS, ENGINE, ELECTRICAL, WARRANTY, RECALL or CRASH.' },
      { label: 'Status dropdown', text: 'Changes the job order stage. FOR PARTS ORDER asks which parts to order (you can add several). FOR PAYMENT asks for the labor charges from the price list or typed manually. RELEASED marks every open part request INSTALLED and deducts the parts from stock.' },
      { label: 'Parts requested', text: 'One line per requested part with its own status: REQUESTED → ORDERED → RECEIVED → INSTALLED (or CANCELLED). Setting INSTALLED deducts stock once; changing it back restores the stock.' },
      { label: '🖨 Print', text: 'Opens the document menu. The documents that fit the current stage are listed first: intake checklist while IN PROGRESS, parts request for FOR PARTS ORDER, sales invoice and service invoice for FOR PAYMENT. Any document can be printed at any stage.' },
      { label: '+ Report', text: 'Appends a diagnostic report (findings, photos, videos, part requests) to the job order history.' },
      { label: 'Open a row', text: 'Click anywhere on the row to open the full job order sheet with inspection, media, history and charges.' },
    ],
  },
  'job-order-detail': {
    title: 'Job order sheet',
    intro: 'The complete record of one visit: customer, vehicle, complaint, inspection checklist, intake photos, reports, part requests, charges and status history.',
    actions: [
      { label: 'Vehicle info / History', text: 'Toggle between this visit and every previous job order for the same vehicle. Click a history entry to open it.' },
      { label: 'Status', text: 'Same stage control as the list. Moving to FOR PARTS ORDER / FOR PAYMENT prompts for parts or charges; RELEASED installs all parts and deducts stock.' },
      { label: '+ Add parts', text: 'Pick parts from the catalogue (with photos) or type a manual part; several can be added at once. Each becomes a tracked request.' },
      { label: '+ Add charges', text: 'Labor, parking and fees from the Charges price list, or a manual line with your own amount. These print on the invoices and total up automatically.' },
      { label: '+ Add report', text: 'Diagnostic findings with time and technician, plus photos/videos. Reports appear in the history trail of this job order.' },
      { label: 'Inspection', text: 'The checklist as recorded on intake. NOT OK items show the remarks and the photos/videos taken.' },
      { label: 'Print', text: 'Choose any of the documents; stage-appropriate ones are suggested first.' },
      { label: 'Vehicle profile', text: 'Opens the vehicle page with its full service history.' },
    ],
  },
  vehicles: {
    title: 'Vehicles',
    intro: 'Every unit the shop has ever serviced, with its latest job order and status.',
    actions: [
      { label: 'Search', text: 'Plate, chassis (VIN), engine number, make or model.' },
      { label: 'Open a row', text: 'Shows the vehicle profile: customer, identifiers and the full list of visits with their reports.' },
    ],
  },
  'vehicle-detail': {
    title: 'Vehicle profile',
    intro: 'Identity of the vehicle and its complete service history, newest first.',
    actions: [
      { label: 'History', text: 'One card per job order with its status, category, odometer and the reports attached to that visit.' },
      { label: 'Open', text: 'Opens the full job order sheet for that visit.' },
    ],
  },
  technicians: {
    title: 'Technicians',
    intro: 'Accounts for the mobile app and this console. Technicians sign in on the app; admins can also use the console.',
    actions: [
      { label: '+ New account', text: 'Creates a login with display name, email, password and role (Technician = app only, Admin = app + console).' },
      { label: 'Edit', text: 'Change the display name, role or active flag. Inactive accounts cannot sign in but their history is kept.' },
      { label: 'Password', text: 'Sets a new password for the account (the person is not emailed — tell them directly).' },
      { label: 'Activity', text: 'Everything that person did: vehicles serviced, parts they requested, reports they wrote.' },
      { label: 'Deactivate / Reactivate', text: 'Blocks or restores sign-in without deleting the account.' },
      { label: 'Delete', text: 'Removes the login permanently. Job orders and reports they created remain, credited to their name.' },
    ],
  },
  inventory: {
    title: 'Parts inventory',
    intro: 'The parts catalogue with stock, SRP, photos, remarks and the vehicles each part fits. One stock quantity per part number, even when it fits several brands, models or years.',
    actions: [
      { label: 'Search & filters', text: 'Search by part number, name, alternative number or remarks. Brand, model and year narrow the list independently; status shows AVAILABLE, STOCK LOW (below threshold), NO STOCK or NO DATA (no SRP yet).' },
      { label: '+ New part', text: 'Add a part with photo, price, stock, low-stock threshold, remarks and the brand / model / year rows it fits.' },
      { label: 'Row click', text: 'Opens the part to edit it, add fitments, change the photo or read its audit trail.' },
      { label: 'Checkboxes → Purchase order', text: 'Tick the parts you need to reorder, then Purchase order to set quantities and download an Excel PO. The workbook also carries an Import sheet you can bring back once the parts arrive.' },
      { label: '⇪ Import', text: 'Load parts from Excel, CSV or a Google Sheet. Map the columns, pick a mode (Upsert, Replenish adds stock, Stock only, Price only), write a note, and confirm. Every import is logged with who and when.' },
      { label: '⇩ Template / ⇩ Export Excel', text: 'Template gives you the blank import sheet with the right columns; Export downloads the whole catalogue.' },
      { label: 'Models', text: 'Manage the brand + model + year list used for fitments and the app’s parts search. Duplicates are detected as you type.' },
      { label: 'Import history', text: 'The log of every import: file, mode, note, counts and who ran it.' },
      { label: 'Catalogue requests', text: 'Parts the mechanics requested from the app that are not in the inventory (nicknames, unknown numbers). Link each to an existing part or create it with the proper number, name and fitments — the job order request is rewritten with the exact part and the mechanic’s wording is kept for reference.' },
    ],
    tips: ['Stock goes down automatically when a part request is marked INSTALLED or a vehicle is RELEASED; each change is in the Audit trail with source “install”.'],
  },
  'part-modal': {
    title: 'Part',
    intro: 'Everything about one part number.',
    actions: [
      { label: 'Photo', text: 'Upload a picture; it shows in the console lists and in the app’s parts search and part requests.' },
      { label: 'Details', text: 'Part number, name, alternative number, SRP, stock on hand, low-stock threshold and remarks. Remarks are searchable.' },
      { label: 'Fits', text: 'Add every brand / model / year the part fits. A part can fit many; all share the same stock quantity.' },
      { label: 'Audit trail', text: 'Every change to price, stock, name or photo with who made it and from where (manual, import, install).' },
      { label: 'Delete part', text: 'Removes the part and its fitments; the audit trail keeps the record.' },
    ],
  },
  'import-modal': {
    title: 'Import inventory',
    intro: 'Bring parts in from a spreadsheet.',
    actions: [
      { label: 'File or Google Sheet', text: 'Drop an .xlsx / .csv or paste a Google Sheets link (shared as “anyone with the link”). A PO workbook’s “Import” sheet is picked automatically.' },
      { label: 'Column mapping', text: 'Match your columns to Part Number, Part Name, Alternative, SRP, Stock, Remarks, Brand, Model, Year. Only Part Number is required.' },
      { label: 'Mode', text: 'Upsert creates or updates everything mapped. Replenish ADDS the stock column to what is on hand (use it when a purchase order arrives). Stock only / Price only touch just that field on existing parts.' },
      { label: 'Note', text: 'Required. Say why (e.g. the PO number). It is stored in the import log.' },
      { label: 'Confirm', text: 'A summary asks you to confirm. If the file name was imported before you are warned and can override.' },
    ],
  },
  'purchase-order': {
    title: 'Purchase order',
    intro: 'Turn the selected parts into a supplier order.',
    actions: [
      { label: 'Quantities', text: 'Set how many of each part to order; the suggested figure tops up to the low-stock threshold.' },
      { label: 'Download', text: 'Creates the PO (numbered, logged with who made it) and downloads an Excel file: a “Purchase Order” sheet for the supplier and an “Import” sheet you can import with Replenish when the parts arrive.' },
    ],
  },
  'parts-order': {
    title: 'Parts to order',
    intro: 'Which parts this job order needs. Shown when a job order moves to FOR PARTS ORDER; also available from + Add parts.',
    actions: [
      { label: 'Catalogue', text: 'Search the inventory (photos, stock, SRP) and press + Add. Press again to raise the quantity.' },
      { label: 'Manual part', text: 'Type a part number and name for something not in the catalogue.' },
      { label: 'Selected', text: 'Adjust quantities or remove lines before saving. Each line becomes a part request tracked on the job order.' },
    ],
  },
  'charges-modal': {
    title: 'Labor & charges',
    intro: 'What the customer is billed for besides parts. Shown when a job order moves to FOR PAYMENT; also available from + Add charges.',
    actions: [
      { label: 'Price list', text: 'Pick labor, parking or fees from the Charges page. Quantity × unit amount is computed for you.' },
      { label: 'Manual', text: 'Toggle to type a charge name, unit and amount that is not on the list.' },
      { label: 'Save', text: 'Lines are stored on the job order and print on the Service Invoice; the totals include VAT if one is set in Settings.' },
    ],
  },
  'report-modal': {
    title: 'New report',
    intro: 'A diagnostic report appended to the job order history, credited to you with the time.',
    actions: [
      { label: 'Findings', text: 'Free text (uppercase). Describe what was found and done.' },
      { label: 'Photos / videos', text: 'Attach files; they are stored with the report and shown in the job order sheet and the app.' },
      { label: 'Request parts', text: 'Add the parts this finding needs; they become part requests on the job order.' },
    ],
  },
  charges: {
    title: 'Charges',
    intro: 'The price list for labor, parking and fees that technicians and admins pick from when a job order goes to FOR PAYMENT.',
    actions: [
      { label: '+ New charge', text: 'Code, name, category, unit (per job, per hour, per day…) and amount.' },
      { label: 'Edit / Save', text: 'Change the amount or name; every price change is kept in “Recent price changes”.' },
      { label: 'Activate / Deactivate', text: 'Inactive charges stay in history but cannot be picked for new job orders.' },
      { label: 'Search & category', text: 'Find a charge by name or code; filter by category.' },
      { label: '⇩ Export Excel', text: 'Downloads the full list.' },
    ],
  },
  audit: {
    title: 'Audit trail',
    intro: 'Who changed what, when. Inventory changes (price, stock, name, photo) and job order actions (hand-written part requests matched to the catalogue).',
    actions: [
      { label: 'Filters', text: 'Part number, field, source (manual = edited here, import = spreadsheet, install = stock consumed by a part request) and person.' },
      { label: 'Job orders', text: 'Switch to the job order log to see console actions on a job order, such as a hand-written part request matched to a catalogue part.' },
      { label: '⇩ Export Excel', text: 'Downloads the filtered trail.' },
    ],
  },
  settings: {
    title: 'Settings',
    intro: 'What prints on the documents and who signs them.',
    actions: [
      { label: 'Shop details', text: 'Name, address, phone, email, TIN, VAT rate and the invoice footer line. These appear in the header and footer of every printed document.' },
      { label: 'Named signatories', text: 'Parts custodian (signs the Parts Request) and cashier (signs invoices).' },
      { label: 'Additional signatories', text: 'Extra signature lines per document type, e.g. a service advisor. Ad-hoc signatories can also be added on the print page for one document.' },
      { label: 'Save settings', text: 'Applies to all documents printed from now on.' },
    ],
  },
  print: {
    title: 'Print document',
    intro: 'A preview of the document exactly as it prints (A4). Use the browser dialog to print or save as PDF.',
    actions: [
      { label: 'Print / Save PDF', text: 'Assigns the document number on first print (invoices and parts requests) and opens the print dialog.' },
      { label: 'Include parts', text: 'Service Invoice only: toggle the parts section on or off (on by default).' },
      { label: 'Photo page', text: 'Intake checklist: adds the Visual Inspection Report page with the intake photos.' },
      { label: '+ Add signatory', text: 'Adds a signature line for this print only. Permanent extra signatories live in Settings.' },
    ],
  },
  'technician-modal': {
    title: 'Account',
    intro: 'Create or edit a login.',
    actions: [
      { label: 'Display name', text: 'Printed on documents and shown on reports; uppercase.' },
      { label: 'Role', text: 'Technician = mobile app only. Admin = mobile app and this console.' },
      { label: 'Status', text: 'Inactive accounts cannot sign in.' },
    ],
  },
  'models-modal': {
    title: 'Vehicle models',
    intro: 'The brand / model / year list behind part fitments and the app’s parts search.',
    actions: [
      { label: 'Add', text: 'Pick a brand (the global manufacturer list), type the model and year. Duplicates are flagged before saving.' },
      { label: 'Delete', text: 'Removes a model; its fitments go with it.' },
    ],
  },
  'charge-modal': {
    title: 'Charge',
    intro: 'One line of the price list.',
    actions: [
      { label: 'Code & name', text: 'Short code and the name printed on invoices.' },
      { label: 'Category / unit / amount', text: 'Labor, parking or fee; per job, per hour, per day…; the default amount. Quantity is chosen when the charge is added to a job order.' },
    ],
  },
  'technician-activity': {
    title: 'Technician activity',
    intro: 'Everything one account has done.',
    actions: [
      { label: 'Vehicles serviced', text: 'Job orders they filed or worked on; click to open.' },
      { label: 'Parts requested', text: 'Every part request they raised, with its current status.' },
      { label: 'Reports', text: 'Reports they wrote, newest first.' },
    ],
  },
};
