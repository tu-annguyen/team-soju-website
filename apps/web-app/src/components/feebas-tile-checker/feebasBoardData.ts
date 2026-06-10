import type {
  BoardResponse,
  FeebasBoard,
  FeebasLeaderboard,
  FeebasVotesResponse,
  TileStatus,
} from './shared';

type Params = {
  activeLocation: string;
  actorFingerprint: string;
  loadBoardMessage: string;
  normalizedApiBaseUrl: string;
};

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

function normalizeVotesResponse(body: unknown) {
  if (!body) return new Map<string, TileStatus>();

  const payload = body as Partial<FeebasVotesResponse | BoardResponse>;
  const data = payload.data as FeebasVotesResponse['data'] | FeebasBoard | undefined;
  const tiles = Array.isArray(data?.tiles) ? data.tiles : [];

  return new Map(tiles.map((tile) => [
    tile.tileId,
    (tile.currentUserVote || 'unchecked') as TileStatus,
  ]));
}

function normalizeLeaderboardResponse(body: unknown) {
  if (!body) return undefined;

  const payload = body as { data?: FeebasLeaderboard | FeebasBoard };
  if (Array.isArray((payload.data as FeebasLeaderboard | undefined)?.entries)) {
    return payload.data as FeebasLeaderboard;
  }

  return (payload.data as FeebasBoard | undefined)?.leaderboard;
}

async function fetchOptionalJson(url: string, init: RequestInit) {
  const response = await Promise.resolve(fetch(url, init)).catch(() => null);
  if (!response?.ok) return null;
  return response.json().catch(() => null);
}

export async function fetchFeebasBoardData({
  activeLocation,
  actorFingerprint,
  loadBoardMessage,
  normalizedApiBaseUrl,
}: Params) {
  const actorQuery = buildQuery({ actorFingerprint });

  const boardResponse = await Promise.resolve(fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}/public`, {
    credentials: 'include',
  })).catch(() => null);
  const fallbackBoardResponse = boardResponse?.ok
    ? null
    : await Promise.resolve(fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}${actorQuery}`, {
        credentials: 'include',
      })).catch(() => null);
  const resolvedBoardResponse = boardResponse?.ok ? boardResponse : fallbackBoardResponse;

  if (!resolvedBoardResponse) {
    throw new Error(loadBoardMessage);
  }

  const boardPayload: BoardResponse = await resolvedBoardResponse.json();

  if (!resolvedBoardResponse.ok || !boardPayload.success) {
    throw new Error(boardPayload.message || loadBoardMessage);
  }

  const [votesPayload, leaderboardPayload] = await Promise.all([
    fetchOptionalJson(`${normalizedApiBaseUrl}/feebas/${activeLocation}/votes${actorQuery}`, {
      credentials: 'include',
    }),
    fetchOptionalJson(`${normalizedApiBaseUrl}/feebas/${activeLocation}/leaderboard`, {
      credentials: 'include',
    }),
  ]);
  const currentVotesByTile = normalizeVotesResponse(votesPayload);
  const leaderboard = normalizeLeaderboardResponse(leaderboardPayload) || boardPayload.data.leaderboard;

  return {
    ...boardPayload.data,
    ...(leaderboard ? { leaderboard } : {}),
    tiles: boardPayload.data.tiles.map((tile) => ({
      ...tile,
      currentUserVote: currentVotesByTile.get(tile.tileId) || tile.currentUserVote || 'unchecked',
    })),
  };
}
