export interface Player {
  name: string;
  last_seen: number;
  straw_index: number | null;
  last_chat_ms?: number;
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
export type GameState = 'lobby' | 'picking' | 'reveal' | 'done';
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
}
export interface LeaderboardWin {
  name: string; game_code: string; timestamp: number; month: string;
  participants: number; player_names: string[]; prize_snack: string | null;
}
export interface PublicPlayer {
  token: string; name: string; online: boolean; picked: boolean;
  straw_index: number | null; is_me: boolean;
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
}
