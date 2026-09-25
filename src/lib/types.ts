export interface Player {
  name: string;
  last_seen: number;
  straw_index: number | null;
  last_chat_ms?: number;
  /** Bar mode: how far this player has unwrapped their bar (0..UNWRAP_STEPS). */
  unwrap?: number;
  /** Audit trail, Unix ms. When this player took their straw/bar, and (bar
   *  mode) when they reached the last unwrap step. A bar the host tore open
   *  with "open all the bars" has no `opened_at`. */
  picked_at?: number | null;
  opened_at?: number | null;
}
export interface Suggestion {
  id: string; text: string; author_token: string; author_name: string;
  votes: string[]; created_at: number;
}
export interface ChatMessage {
  id: string; token: string; name: string; text: string; ts: number;
}
export interface CupboardItem {
  id: string; name: string; stock: number; created_at: number;
}
export interface PrizeSnack {
  text: string; author_name: string; votes: number; random: boolean;
}
// `unwrapping` only happens in bar mode: everyone has a bar and is tearing it
// open on their own screen. It ends once every bar is open (or the host opens
// the rest), never early when the golden one turns up.
export type GameState = 'lobby' | 'picking' | 'unwrapping' | 'reveal' | 'done';
/** Straws in a cup, or MOVION chocolate bars with a golden ticket. */
export type GameStyle = 'straws' | 'bars';
export interface Game {
  code: string; state: GameState; created_at: number;
  players: Record<string, Player>; straws: number[] | null;
  winner_token: string | null; creator_token: string | null;
  suggestions: Suggestion[]; prize_snack: PrizeSnack | null;
  prize_given_id: string | null; prize_given_name: string | null;
  chat: ChatMessage[];
  // Timers (absolute Unix-second deadlines). `timer_seconds` is the host's
  // chosen lobby wait duration (null = no auto-start). `lobby_deadline` is when
  // the round auto-starts (bumped by the host's "+30s"). `picking_deadline` is
  // a fixed short window after which picking auto-resolves.
  timer_seconds: number | null;
  lobby_deadline: number | null;
  picking_deadline: number | null;
  /** Absent on games created before bar mode existed — those are straws. */
  style?: GameStyle;
  /** Does the host get a straw/bar? False = the host only oversees (runs the
   *  screen on the wall) and can never win. Absent on older games = true,
   *  which is how the game always worked before. */
  host_plays?: boolean;
  /** Sealed draw, set at Start: sha256 of `JSON.stringify(straws) + ':' +
   *  draw_salt`, hex. The commit is public from Start; the salt stays secret
   *  until the reveal, so the draw can't be guessed from the hash but can be
   *  checked against it afterwards. See drawCommit(). */
  draw_commit?: string | null;
  draw_salt?: string | null;
  /** Unix ms of the draw. */
  drawn_at?: number | null;
}
/** One line of a round's audit trail. Times are Unix ms; `opened_at` is null
 *  for a bar opened by the host's "open all the bars", and absent in straws. */
export interface AuditEntry {
  name: string; bar: number | null; value: number | null;
  picked_at: number | null; opened_at?: number | null;
}
export interface LeaderboardWin {
  name: string; game_code: string; timestamp: number; month: string;
  participants: number; player_names: string[]; prize_snack: string | null;
  /** Everything needed to check the round afterwards (/verify/<code>).
   *  Absent on wins recorded before the sealed draw existed. */
  draw?: { commit: string; salt: string; straws: number[]; drawn_at: number | null };
  audit?: AuditEntry[];
}
export interface PublicPlayer {
  token: string; name: string; online: boolean; picked: boolean;
  straw_index: number | null; is_me: boolean;
  unwrap: number;
}
export interface PublicSuggestion {
  id: string; text: string; author_name: string; mine: boolean;
  votes: number; voted_tokens: string[]; voted: boolean; created_at: number;
}
export interface PublicCupboardItem { id: string; name: string; stock: number; }
export interface PublicChatMessage {
  id: string; name: string; text: string; ts: number; mine: boolean;
}
export interface GameStateResponse {
  code: string; state: GameState; players: PublicPlayer[];
  straws: (number | null)[] | null; winner_token: string | null;
  creator_token: string | null; is_host: boolean; my_token: string | null;
  my_straw: number | null; suggestions: PublicSuggestion[];
  prize_snack: PrizeSnack | null; cupboard: PublicCupboardItem[];
  prize_given_id: string | null; prize_given_name: string | null;
  chat: PublicChatMessage[]; in_game: boolean;
  timer_seconds: number | null;
  lobby_deadline: number | null;
  picking_deadline: number | null;
  style: GameStyle;
  host_plays: boolean;
  /** The host, reported separately. When the host doesn't play they are left
   *  out of `players` entirely, so every count and grid on every screen is
   *  about the people in the draw. */
  host: { name: string; online: boolean; is_me: boolean } | null;
  /** Sealed draw fingerprint, from Start on. The salt only arrives with the
   *  reveal, when the straws are public too. */
  draw_commit: string | null;
  draw_salt: string | null;
}
