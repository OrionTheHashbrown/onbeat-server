/**
 * ONBEAT – Seeding track_cues manually
 * 
 * As there are no APIs that is available to return chorus or beat drop timestamps,
 * the seeding of track_cues are done manually and for future implementation, 
 * a better approach would be able to allow the user to submit the marked beat drops
 * and chorus timestamps for a track in our app and we would store it in the database accoridngly.
 *
 * REFERENCE FROM
 * https://spotify.com
 */

insert into public.track_cues
  (spotify_track_id, at_ms, kind, lead_ms, push_bpm, hold_ms, label, source)
values
  -- Hero — Martin Garrix 
  ('4Wu62DoQg1ECGlDKDfo30R',  31000, 'drop', 12000, 6, 24000, null, 'manual'),
  ('4Wu62DoQg1ECGlDKDfo30R',  91000, 'drop', 12000, 6, 22000, null, 'manual'),
  ('4Wu62DoQg1ECGlDKDfo30R', 137000, 'drop', 12000, 6, 23000, null, 'manual'),

  -- stupid song — Olivia Rodrigo 
  ('4LfCY65LvojKjWEnU7fNN4', 101000, 'drop', 12000, 6, 31000, null, 'manual'),
  ('4LfCY65LvojKjWEnU7fNN4', 172000, 'drop', 12000, 6, 32000, null, 'manual'),

  -- Fast — Demi Lovato 
  ('0o7fAE9dLRLx4kGMh3QFot',  52000, 'drop', 12000, 6, 33000, null, 'manual'),
  ('0o7fAE9dLRLx4kGMh3QFot', 131000, 'drop', 12000, 6, 29000, null, 'manual'),

  -- Training Season — Dua Lipa 
  ('6Qb7YsAqH4wWFUMbGsCpap',  47000, 'drop', 12000, 6, 38000, null, 'manual'),
  ('6Qb7YsAqH4wWFUMbGsCpap', 117000, 'drop', 12000, 6, 31000, null, 'manual'),
  ('6Qb7YsAqH4wWFUMbGsCpap', 177000, 'drop', 12000, 6, 33000, null, 'manual'),

  -- 2515 — Wasia Project 
  ('6oJRAA2pF2VK8fmxTncqiG',  69000, 'drop', 12000, 6, 33000, null, 'manual'),
  ('6oJRAA2pF2VK8fmxTncqiG', 135000, 'drop', 12000, 6, 37000, null, 'manual'),

  -- Words (feat. Zara Larsson) — Alesso 
  ('1bgKMxPQU7JIZEhNsM1vFs',  41000, 'drop', 12000, 6, 15000, null, 'manual'),
  ('1bgKMxPQU7JIZEhNsM1vFs', 107000, 'drop', 12000, 6, 14000, null, 'manual'),

  -- Jet Plane — R3HAB 
  ('71uN50XgLYyAJaSXr0TNsY',  50000, 'drop', 12000, 6, 31000, null, 'manual'),
  ('71uN50XgLYyAJaSXr0TNsY', 143000, 'drop', 12000, 6, 17000, null, 'manual'),

  -- Just Keep Watching — Tate McRae
  ('2yWlGEgEfPot0lv3OAjuG3',  38000, 'drop',   12000, null, 18000, null, 'manual'),
  ('2yWlGEgEfPot0lv3OAjuG3',  54000, 'chorus', 12000, null, 30000, null, 'manual'),
  ('2yWlGEgEfPot0lv3OAjuG3',  81000, 'drop',   12000, null, null,  null, 'manual'),

  -- Somebody Come Through — Wasia Project 
  ('4Sz61x2L4mYmtw47NBrzfC',  80000, 'drop', 12000, null, 35000, null, 'manual'),
  ('4Sz61x2L4mYmtw47NBrzfC', 163000, 'drop', 12000, null, null,  null, 'manual'),

  -- little black dress — Artemas 
  ('0gT8dfXzmEBticL3Tavk7K',  25000, 'drop', 12000, null, null, null, 'manual'),
  ('0gT8dfXzmEBticL3Tavk7K',  91000, 'drop', 12000, null, null, null, 'manual'),

  -- S&M — Rihanna 
  ('7ySUcLPVX7KudhnmNcgY2D',  90000, 'drop', 12000, null, null, null, 'manual'),
  ('7ySUcLPVX7KudhnmNcgY2D', 135000, 'drop', 12000, null, null, null, 'manual'),

  -- Side To Side — Ariana Grande 
  ('44ONERBHALxftQNWq6dmyd', 184000, 'drop', 12000, null, null, null, 'manual'),

  -- Blow Your Mind (Mwah) — Dua Lipa 
  ('28sGFFlbg89HBUPQfIe3Cm',  34000, 'drop', 12000, null, null, null, 'manual'),
  ('28sGFFlbg89HBUPQfIe3Cm', 148000, 'drop', 12000, null, null, null, 'manual'),

  -- Part Of Me — Katy Perry 
  ('6yARPLK0PV4heEyh7pVMGz',  89000, 'drop', 12000, null, null, null, 'manual'),
  ('6yARPLK0PV4heEyh7pVMGz', 149000, 'drop', 12000, null, null, null, 'manual'),

  -- Close To You — Gracie Abrams 
  ('5wbg8kepMFoMzHOEuxiI0q', 189000, 'drop', 12000, null, null, null, 'manual'),

  -- Google Me (feat. Alika & Ms Banks) — CLiQ 
  ('6fg2qWBpF8vz2Ywj1TSyx2',  40000, 'drop', 12000, null, null, null, 'manual'),
  ('6fg2qWBpF8vz2Ywj1TSyx2',  87000, 'drop', 12000, null, null, null, 'manual'),

  -- petal — Ariana Grande
  ('70pVCVMGjmIWPbWXDwf11e', 148000, 'drop', 12000, null, null, null, 'manual')

on conflict (spotify_track_id, at_ms) do update set
  kind     = excluded.kind,
  lead_ms  = excluded.lead_ms,
  push_bpm = excluded.push_bpm,
  hold_ms  = excluded.hold_ms,
  label    = excluded.label,
  source   = excluded.source;

select c.spotify_track_id,
       a.title,
       a.artist,
       c.at_ms,
       c.hold_ms,
       a.duration_ms,
       (a.spotify_track_id is null) as unknown_track,
       (c.at_ms >= a.duration_ms)   as past_end
from public.track_cues c
left join public.track_analysis a using (spotify_track_id)
order by a.title nulls last, c.at_ms;
