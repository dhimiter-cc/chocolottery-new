import type { APIRoute } from 'astro';
import { loadLeaderboard } from '../../lib/game.js';

interface PlayerStats {
  actual_wins: number;
  expected_wins: number;
  tracked: boolean;
  games: Array<{
    game_code: string;
    month: string;
    participants: number;
    chance_pct: number;
    won: boolean;
  }>;
}

export const GET: APIRoute = async () => {
  const data = await loadLeaderboard();
  const wins: any[] = data.wins ?? [];

  const players: Record<string, PlayerStats> = {};
  let totalGames = wins.length;
  let trackedGames = 0;

  for (const w of wins) {
    const winnerName: string | null = w.name ?? null;
    const playerNames: string[] | null = Array.isArray(w.player_names) ? w.player_names : null;

    // Always record actual win
    if (winnerName) {
      if (!players[winnerName]) {
        players[winnerName] = { actual_wins: 0, expected_wins: 0, tracked: false, games: [] };
      }
      players[winnerName].actual_wins++;
    }

    // Distribute expected wins and record game history only when full list is available
    if (playerNames && playerNames.length > 0) {
      trackedGames++;
      const n = playerNames.length;
      const prob = 1 / n;

      const gameEntry = {
        game_code: w.game_code ?? '?',
        month: w.month ?? '',
        participants: n,
        chance_pct: Math.round((100 / n) * 10) / 10,
      };

      for (const pName of playerNames) {
        if (!pName) continue;
        if (!players[pName]) {
          players[pName] = { actual_wins: 0, expected_wins: 0, tracked: false, games: [] };
        }
        players[pName].expected_wins += prob;
        players[pName].tracked = true;
        players[pName].games.push({ ...gameEntry, won: pName === winnerName });
      }
    }
  }

  // Build output
  const out = Object.entries(players).map(([name, p]) => {
    const actual = p.actual_wins;
    const expected = p.expected_wins;
    const tracked = p.tracked;

    let luckScore: number | null = null;
    let verdict: { emoji: string; label: string; class: string } | null = null;

    if (tracked && expected > 0) {
      luckScore = Math.round((actual / expected) * 100) / 100;
      if (luckScore >= 2.0) {
        verdict = { emoji: '🎰', label: 'Suspiciously Lucky', class: 'lucky' };
      } else if (luckScore >= 0.7) {
        verdict = { emoji: '⚖️', label: 'Fair and Square', class: 'fair' };
      } else {
        verdict = { emoji: '😢', label: 'Chronically Unlucky', class: 'unlucky' };
      }
    }

    return {
      name,
      actual_wins: actual,
      expected_wins: tracked ? Math.round(expected * 100) / 100 : null,
      luck_score: luckScore,
      verdict,
      games: p.games,
    };
  });

  // Sort: luck_score desc (nulls last), then actual_wins desc
  out.sort((a, b) => {
    if (a.luck_score === null && b.luck_score === null) {
      return b.actual_wins - a.actual_wins;
    }
    if (a.luck_score === null) return 1;
    if (b.luck_score === null) return -1;
    if (b.luck_score !== a.luck_score) return b.luck_score - a.luck_score;
    return b.actual_wins - a.actual_wins;
  });

  return new Response(
    JSON.stringify({ players: out, total_games: totalGames, tracked_games: trackedGames }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
