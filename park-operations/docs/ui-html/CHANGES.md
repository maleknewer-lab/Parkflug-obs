# Update: Personen & Kindersitze (21.11.2026)

Replaces the single "Personen" field with adults / children / child seats.

## Changed files (replace the old ones)
- `css/app.css` – new classes `.g3` (3-column grid) and `.paxbox` (persons box)
- `buchen.html` – booking form: Erwachsene, Kinder (bis 12 J.), Babyschale / Kindersitz / Sitzerhöhung
- `buchung.html` – edit booking: same fields; persons + seats shown in the header
- `tarife.html` – new card "Personen & Kindersitze" (persons included, price per extra person, price per seat, kids count as person, seats on/off) – per brand
- `transfers.html` – banner: open persons (of which kids) + seats to prepare; seat chips per row
- `fahrer.html`, `fahrer-checkin.html` – "2 Erw. + 1 Kind" and seat chips
- `buchungen.html`, `uebersicht.html`, `rechnung.html` – persons/kids display, seat count, invoice line for seats

## Data model
Booking: `adults`, `kids`, `seats {baby, kind, boost}` (persons = adults + kids).
Brand/rate setting: `personsIncluded` (3), `extraPersonPrice` (10 €), `seatPrice` (0 €), `kidsCountAsPerson` (true), `seatsEnabled`.
Seat types: Babyschale 0–15 Monate, Kindersitz 1–4 Jahre, Sitzerhöhung 4–12 Jahre.
