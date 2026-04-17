import type {
  AniListMedia,
  AniListListEntry,
  AniListListEntryFull,
  AniListMediaListCollectionResponse,
  AniListMediaResponse,
  AniListViewerResponse,
  AniListMediaType,
} from '../types/anilist.js';

const ANILIST_URL = 'https://graphql.anilist.co';

const FULL_LIST_QUERY = `
query ($userId: Int, $type: MediaType) {
  MediaListCollection(userId: $userId, type: $type) {
    user {
      id
      name
      avatar { large medium }
      bannerImage
      options {
        titleLanguage
        displayAdultContent
        profileColor
      }
      statistics {
        anime { episodesWatched meanScore count }
        manga { chaptersRead meanScore count }
      }
    }
    lists {
      name
      isCustomList
      entries {
        mediaId
        status
        score(format: POINT_10)
        progress
        progressVolumes
        repeat
        priority
        startedAt { year month day }
        completedAt { year month day }
        notes
        customLists
        updatedAt
        media {
          id
          idMal
          type
          format
          status(version: 2)
          source(version: 2)
          description(asHtml: false)
          episodes
          chapters
          volumes
          season
          seasonYear
          seasonInt
          startDate { year month day }
          endDate { year month day }
          nextAiringEpisode { episode airingAt }
          title { romaji english native }
          synonyms
          genres
          tags { name rank isMediaSpoiler isGeneralSpoiler }
          studios(isMain: true) { nodes { id name isAnimationStudio } }
          averageScore
          meanScore
          popularity
          trending
          favourites
          coverImage { extraLarge large medium color }
          bannerImage
          trailer { id site thumbnail }
          siteUrl
          externalLinks { url site type icon }
          countryOfOrigin
          isLicensed
          isAdult
          relations {
            edges {
              relationType(version: 2)
              node {
                id
                idMal
                type
                format
                status(version: 2)
                title { romaji english native }
                episodes
                chapters
                volumes
                averageScore
                popularity
                coverImage { extraLarge large medium color }
                startDate { year month day }
                season
                seasonYear
                siteUrl
                bannerImage
              }
            }
          }
        }
      }
    }
  }
}
`;

const SINGLE_MEDIA_QUERY = `
query ($mediaId: Int) {
  Media(id: $mediaId) {
    id idMal type format status(version: 2) source(version: 2)
    description(asHtml: false) episodes chapters volumes
    season seasonYear startDate { year month day } endDate { year month day }
    nextAiringEpisode { episode airingAt }
    title { romaji english native } synonyms genres
    tags { name rank isMediaSpoiler isGeneralSpoiler }
    studios(isMain: true) { nodes { id name isAnimationStudio } }
    averageScore meanScore popularity trending favourites
    coverImage { extraLarge large medium color }
    bannerImage trailer { id site thumbnail }
    siteUrl externalLinks { url site type icon }
    countryOfOrigin isLicensed isAdult
    relations {
      edges {
        relationType(version: 2)
        node {
          id idMal type format status(version: 2)
          title { romaji english native }
          episodes chapters volumes averageScore popularity
          coverImage { extraLarge large medium color }
          startDate { year month day } season seasonYear
          source(version: 2) description(asHtml: false)
          genres tags { name rank }
          studios(isMain: true) { nodes { id name } }
          bannerImage
          trailer { id site thumbnail } siteUrl synonyms
          externalLinks { url site type } countryOfOrigin
          isLicensed isAdult nextAiringEpisode { episode airingAt }
        }
      }
    }
  }
}
`;

const VIEWER_QUERY = `
query {
  Viewer {
    id name avatar { large medium } bannerImage
    mediaListOptions {
      animeList { customLists }
      mangaList { customLists }
    }
  }
}
`;

export class AniListError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function anilistGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let json: { data?: T; errors?: Array<{ message: string; status: number }> };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new AniListError(`Invalid JSON response from AniList: ${res.status}`, 'API_ERROR', res.status);
  }

  if (json.errors) {
    const err = json.errors[0];
    throw new AniListError(err.message, 'GRAPHQL_ERROR', err.status || 500);
  }

  if (!res.ok) {
    throw new AniListError(`AniList API error: ${res.status}`, 'API_ERROR', res.status);
  }

  return json.data as T;
}

export async function fetchAniListUserList(
  userId: number,
  type: AniListMediaType = 'ANIME',
  token?: string,
): Promise<{ user: AniListMediaListCollectionResponse['MediaListCollection']['user']; entries: AniListListEntryFull[] }> {
  const data = await anilistGraphQL<AniListMediaListCollectionResponse>(FULL_LIST_QUERY, { userId, type }, token);

  if (!data.MediaListCollection) {
    throw new AniListError('User not found or list is empty', 'USER_NOT_FOUND', 404);
  }

  const { user } = data.MediaListCollection;
  const rawEntries = data.MediaListCollection.lists.flatMap(list => list.entries);

  // The raw entries from AniList have flat fields (mediaId, status, progress, etc.)
  // AND a nested `media` object. We need to separate them into listEntry + media.
  const entries: AniListListEntryFull[] = rawEntries.map((raw: Record<string, unknown>) => {
    const media = raw.media as AniListMedia;
    // Extract list entry fields from the raw flat structure
    const listEntry = {
      mediaId: raw.mediaId as number,
      status: raw.status as string,
      score: raw.score as number | null,
      progress: raw.progress as number,
      progressVolumes: raw.progressVolumes as number | null,
      repeat: raw.repeat as number,
      priority: raw.priority as string,
      startedAt: raw.startedAt as AniListListEntry['startedAt'],
      completedAt: raw.completedAt as AniListListEntry['completedAt'],
      notes: raw.notes as string,
      customLists: raw.customLists as string[],
      updatedAt: raw.updatedAt as number,
    };
    return { listEntry, media };
  });

  return { user, entries };
}

export async function fetchAniListMedia(
  mediaId: number,
  token?: string,
): Promise<AniListMedia> {
  const data = await anilistGraphQL<AniListMediaResponse>(SINGLE_MEDIA_QUERY, { mediaId }, token);

  if (!data.Media) {
    throw new AniListError(`Media not found: ${mediaId}`, 'MEDIA_NOT_FOUND', 404);
  }

  return data.Media;
}

export async function verifyAniListToken(token: string): Promise<{ id: number; name: string; avatar: { large: string; medium: string }; bannerImage: string | null }> {
  const data = await anilistGraphQL<AniListViewerResponse>(VIEWER_QUERY, {}, token);

  if (!data.Viewer) {
    throw new AniListError('Token is invalid or expired', 'INVALID_TOKEN', 401);
  }

  return {
    id: data.Viewer.id,
    name: data.Viewer.name,
    avatar: data.Viewer.avatar,
    bannerImage: data.Viewer.bannerImage,
  };
}
