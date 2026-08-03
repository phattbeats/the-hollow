# Warfare and Honor

Honor is an online-only currency. Practice and bot matches pay zero Honor, so the Honor Quartermaster is unavailable offline by design.

Fiesta takedown Honor is anti-farm protected by the persisted UTC-day Honor window. Each player's kill count is tracked per victim in `fiestaKillsByVictim`, survives character persistence, and resets at the UTC-day boundary. The taper is 20, 10, 5, then 0 Honor for successive kills against the same victim that day.
