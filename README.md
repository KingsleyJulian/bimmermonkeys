# Bimmermonkeys Admin Console (Vue 3 + Vite + Supabase)

```bash
cd admin
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/ — host on Netlify / Vercel / Cloudflare Pages / any static host
```

`.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (publishable key). Only accounts whose
`profiles.role = 'admin'` can sign in; technicians are bounced.

## Pages

| Page | What it does |
| --- | --- |
| Dashboard | Counters (in progress / finished / today / vehicles / media / low stock…) and the latest job orders. |
| Job orders | Server-side search on plate, chassis, engine, name or JO #; status + category filters; opens the full sheet: customer, vehicle, complaint, inspection with NOT-OK remarks and per-item media, intake gallery, remarks, and a History tab with every visit + reports. Status can be set to finished / released / reopened. |
| Vehicles | Directory with last visit, last status and owner; vehicle profile is the full history trail with photos, videos and reports per visit. |
| Inventory | Parts grid (status · stock · brand · model · year · block · part number · name · alternative · SRP), filters, Excel export of the current filter, import from .xlsx/.csv or a Google Sheets link with column mapping + preview, part editor with fitments and per-part audit, and the Models manager (brand from the shared make list + typed model with duplicate detection). |
| Audit trail | Every price / quantity / name change: who, when, from → to, source (manual or import). Exportable. |
| Technicians | Create / edit / deactivate / reset password / delete accounts via the `admin-users` edge function; **Activity** shows every vehicle a technician serviced, the parts they requested and the reports they wrote. |
| Charges | Price list (labor, parking, fees, services) with inline amount editing and its own audit; seeded with ~140 labor items. Technicians pick from it when a job goes to FOR PAYMENT. |
| Settings | Shop details for printed documents, parts custodian and cashier names, extra signatories per document. |
| Print | From a job order: Vehicle Intake Checklist, Parts Request, Sales Invoice (parts), Invoice (labor + parts toggle). Numbered documents draw a running number on print; ad-hoc signatories can be added before printing. |

## Bootstrapping the first admin

1. Supabase dashboard → Authentication → Users → **Add user** (email + password, "auto confirm").
2. SQL editor: `update public.profiles set role = 'admin' where id = '<that user id>';`
3. Sign in here. From then on, create everyone else from the Technicians page.

Media in the galleries is served through short-lived signed URLs from the private `media` bucket.
