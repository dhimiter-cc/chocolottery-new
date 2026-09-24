# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Colleagues in one office (Creative Clicks / Movion, Amsterdam), on their phones or laptops, during a break or a team moment. Everyone opens the homepage directly as well: to start a round, glance at recent games, the leaderboard or the fairness check. Players usually arrive in a game by scanning the host's QR or opening a shared link. The host runs the round, often from a laptop on a big screen, and by default only oversees it.

## Product Purpose
chocolate.lottery decides, as a shared game, who gets the chocolate. A group joins a round, each person picks a straw or a chocolate bar, and one of them is the winner (the longest straw / the bar with the golden ticket). It exists to make a small office ritual fun and fair-feeling. Success is a round that starts in seconds, gets the whole room watching the reveal, and leaves a record people like checking afterwards.

## Positioning
An unofficial side game made by and for the team, not an official company product. Its identity is its own: playful, dry-humoured copy ("One chocolate. Many victims."), with a tongue-in-cheek Fairness Check that compares actual to statistically expected wins.

## Operating Context
- Rounds: lobby (join by code/QR/link, suggest and vote on snacks) → picking → unwrapping (bar mode, each on their own phone) → reveal.
- Host screen is often projected; participants' phones show only their own bar.
- A shared cupboard of physical prizes; the host marks which item was handed over.
- Leaderboard of every win, mirrored to GitHub so it survives redeploys.
- One-off events can run with a special prize (the MOVION Golden Ticket and 1.8 kg Toblerone for the outing on 2026-09-25); these are date-gated in `src/lib/specialPrize.ts` and switch themselves off.

## Capabilities and Constraints
- Astro 6 SSR + Svelte 5 islands, JSON files on disk, client polling (no websockets).
- Two game styles: straws and chocolate bars (host chooses in the lobby).
- No accounts: identity is a cookie; names are free text.
- Leaderboard data per win: winner name, game code, timestamp, month, participant count, player names, prize snack.
- Joining by typing a code on the homepage is no longer needed; people join via QR or link.

## Brand Commitments
- Do not brand the app itself as MOVION: it is not official to the team. Its palette is aubergine with warm gold/amber (the colours of the golden-ticket artwork), used as the app's own identity.
- Event-specific pieces keep their MOVION branding while they're active: the Golden Ticket artwork (`public/golden-ticket.webp`), the personalised Toblerone, and the MOVION wrapper on the chocolate bars.
- Name: chocolate.lottery. Voice: deadpan, office-humour, short.

## Evidence on Hand
- Real win history in `data/leaderboard.json` (served via `/api/fairness` and the leaderboard page).
- No testimonials, metrics or external claims exist; none should be invented.

## Product Principles
1. Starting a round is the fastest thing on any screen.
2. The reveal is the moment: everything builds towards the room watching together.
3. The history is part of the fun; make past games worth looking at.
4. Stay a side game: playful, never corporate.
