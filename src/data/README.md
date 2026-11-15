`india-states-districts.json` is a sorted state-to-district mapping derived from
https://github.com/CodingMation/indian-states-districts/blob/main/data/india_states_districts.json
(retrieved 2026-11-13). The upstream MIT notice is in
`india-states-districts.LICENSE`. Keep this snapshot updated as districts change.

`college-brochures.json` records manually verified official admission documents.
The academic year refers to the admission intake, rather than the full length of
a multi-year programme. Document labels distinguish brochures from notices and
instructions. Empty years mean no document has been verified, not that the
institution has definitively not published one. Keep programme names, official
URLs and verification dates together when adding documents. The UI links directly
to the publisher so visitors receive its latest version.

After editing brochure URLs, run `node scripts/sync-college-brochures.cjs` to update
the legacy single-brochure field used elsewhere. This does not reseed the database.
