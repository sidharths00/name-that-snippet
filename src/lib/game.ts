import { getStore } from "./store";
import { buildSongPool } from "./song-pool";
import { judgeGuess } from "./match";
import type { Room, Round, RoundGuess } from "./types";

const TITLE_POINTS = 1;
const ARTIST_POINTS = 1;
const SPEED_BONUS_MAX = 2;

export async function startGame(room: Room): Promise<Room> {
  if (room.status !== "lobby") throw new Error("Game already started");
  if (room.players.length < 1) throw new Error("Need at least 1 player");

  room.status = "loading-songs";
  room.songPool = buildSongPool(
    room.players,
    room.libraryByPlayer,
    room.settings.rounds,
    room.settings.uniqueTrackRatio,
  );
  if (room.songPool.length === 0) {
    throw new Error("Couldn't find any tracks across the players' libraries");
  }
  // Adjust round count if libraries were too small.
  room.settings.rounds = Math.min(room.settings.rounds, room.songPool.length);
  room.rounds = [];
  room.players = room.players.map((p) => ({ ...p, score: 0 }));
  room.updatedAt = Date.now();
  await persist(room);
  return room;
}

export async function startNextRound(room: Room): Promise<Room> {
  if (room.status === "lobby") throw new Error("Game hasn't started");
  if (room.rounds.length >= room.settings.rounds) {
    return finishGame(room);
  }

  const nextIndex = room.rounds.length;
  const track = room.songPool[nextIndex];
  if (!track) return finishGame(room);

  // For turn-based mode, rotate the active player.
  let activePlayerId: string | null = null;
  if (room.settings.gameMode === "turns") {
    activePlayerId = room.players[nextIndex % room.players.length].id;
  }

  const round: Round = {
    index: nextIndex,
    trackId: track.id,
    startedAt: Date.now(),
    endedAt: null,
    activePlayerId,
    guesses: [],
    winnerId: null,
  };
  room.rounds.push(round);
  room.status = "in-round";
  room.updatedAt = Date.now();
  await persist(room);
  await getStore().publish(room.code, {
    type: "round-started",
    room,
    at: Date.now(),
  });
  return room;
}

export async function submitGuess(
  room: Room,
  playerId: string,
  guessText: string,
): Promise<{ room: Room; guess: RoundGuess }> {
  if (room.status !== "in-round") throw new Error("No round in progress");
  const round = room.rounds[room.rounds.length - 1];
  if (!round) throw new Error("No active round");
  if (round.endedAt) throw new Error("Round already ended");

  const track = room.songPool.find((t) => t.id === round.trackId);
  if (!track) throw new Error("Track missing");

  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Not in this room");

  if (room.settings.gameMode === "turns" && round.activePlayerId !== playerId) {
    throw new Error("Not your turn");
  }

  const judged = judgeGuess(guessText, track.name, track.artists);

  // Track which fields each player has already hit, to award points only once.
  const playerHits = round.guesses.filter((g) => g.playerId === playerId);
  const alreadyTitle = playerHits.some((g) => g.titleHit);
  const alreadyArtist = playerHits.some((g) => g.artistHit);

  const newTitleHit = judged.titleHit && !alreadyTitle;
  const newArtistHit = judged.artistHit && !alreadyArtist;

  const elapsedSec = round.startedAt
    ? (Date.now() - round.startedAt) / 1000
    : room.settings.snippetSeconds;
  const speedFactor = Math.max(
    0,
    1 - elapsedSec / room.settings.snippetSeconds,
  );
  const speedBonus = Math.round(speedFactor * SPEED_BONUS_MAX);

  let points = 0;
  if (newTitleHit) points += TITLE_POINTS;
  if (newArtistHit) points += ARTIST_POINTS;
  // Speed bonus only when they fully complete the round on this guess.
  const completes =
    (newTitleHit || alreadyTitle) && (newArtistHit || alreadyArtist);
  const justCompleted = completes && (newTitleHit || newArtistHit);
  if (justCompleted) points += speedBonus;

  player.score += points;

  const guess: RoundGuess = {
    playerId,
    guess: guessText,
    at: Date.now(),
    titleHit: newTitleHit,
    artistHit: newArtistHit,
    points,
  };
  round.guesses.push(guess);

  if (justCompleted && room.settings.gameMode === "race") {
    round.winnerId = playerId;
    await endRound(room);
  } else {
    room.updatedAt = Date.now();
    await persist(room);
    await getStore().publish(room.code, {
      type: "guess-submitted",
      room,
      data: { guess, playerId, points, completed: justCompleted },
      at: Date.now(),
    });
  }
  return { room, guess };
}

export async function endRound(room: Room): Promise<Room> {
  const round = room.rounds[room.rounds.length - 1];
  if (!round) return room;
  round.endedAt = Date.now();
  room.status = "round-result";
  room.updatedAt = Date.now();
  await persist(room);
  await getStore().publish(room.code, {
    type: "round-ended",
    room,
    at: Date.now(),
  });
  return room;
}

export async function finishGame(room: Room): Promise<Room> {
  room.status = "finished";
  room.updatedAt = Date.now();
  await persist(room);
  await getStore().publish(room.code, {
    type: "game-finished",
    room,
    at: Date.now(),
  });
  return room;
}

async function persist(room: Room) {
  await getStore().setRoom(room);
  await getStore().publish(room.code, {
    type: "room-updated",
    room,
    at: Date.now(),
  });
}
