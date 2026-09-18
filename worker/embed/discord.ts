import type { EmbedData } from ".";

interface DiscordButton {
  readonly type: 2;
  readonly style: 5;
  readonly label: string;
  readonly url: string;
}

interface DiscordTextDisplay {
  readonly type: 10;
  readonly content: string;
}

interface DiscordSection {
  readonly type: 9;
  readonly components: readonly DiscordTextDisplay[];
  readonly accessory: DiscordButton | DiscordThumbnail;
}

interface DiscordThumbnail {
  readonly type: 11;
  readonly media: { readonly url: string };
  readonly description: string;
}

interface DiscordSeparator {
  readonly type: 14;
  readonly spacing: 1;
}

interface DiscordActionRow {
  readonly type: 1;
  readonly components: readonly DiscordButton[];
}

type DiscordComponent = DiscordSection | DiscordSeparator | DiscordTextDisplay | DiscordActionRow;

interface DiscordComponentEmbed {
  readonly component: {
    readonly type: 17;
    readonly accent_color: number;
    readonly components: readonly DiscordComponent[];
  };
}

const SPOTIFY_GREEN = 0x1db954;

function escapeDiscordMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]~|])/g, "\\$1");
}

function textDisplay(content: string): DiscordTextDisplay {
  return { type: 10, content };
}

function componentCopy(data: EmbedData, openOrigin: string): { subtitle: string; details: string } {
  const subtitle = escapeDiscordMarkdown(data.subtitle);
  switch (data.kind) {
    case "track": {
      const album = escapeDiscordMarkdown(data.album);
      const albumUrl = `${openOrigin}/view?type=album&id=${data.albumId}`;
      const single = data.albumType === "single";
      const albumLine = single ? "" : `on [${album}](${albumUrl})`;
      const metadata = [
        escapeDiscordMarkdown(data.duration),
        single ? "" : `track ${data.trackNumber} of ${data.totalTracks}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        subtitle,
        details: [albumLine, `-# ${metadata}`, `-# ${escapeDiscordMarkdown(data.releaseDate)}`]
          .filter(Boolean)
          .join("\n"),
      };
    }
    case "album":
      return {
        subtitle,
        details: `-# ${data.totalTracks} ${data.totalTracks === 1 ? "track" : "tracks"}\n-# ${escapeDiscordMarkdown(data.releaseDate)}`,
      };
    case "artist":
      return { subtitle, details: `-# ${escapeDiscordMarkdown(data.followers)} followers` };
    case "playlist": {
      const byline = subtitle ? `by ${subtitle}` : "";
      const summary = escapeDiscordMarkdown(data.summary);
      const trackCount = `${data.totalTracks} ${data.totalTracks === 1 ? "track" : "tracks"}`;
      return {
        subtitle: byline,
        details: [summary, `-# ${trackCount}`].filter(Boolean).join("\n"),
      };
    }
  }
}

function artworkUrl(image: string, openOrigin: string): string {
  const url = new URL("/api/artwork", openOrigin);
  url.searchParams.set("src", image);
  url.searchParams.set("v", "3");
  return url.href;
}

export function discordComponentEmbed(data: EmbedData, openOrigin: string): DiscordComponentEmbed {
  const title = escapeDiscordMarkdown(data.title);
  const copy = componentCopy(data, openOrigin);
  const openUrl = `${openOrigin}/view?type=${data.kind}&id=${data.id}`;
  const previewButton: DiscordButton = {
    type: 2,
    style: 5,
    label: "Open with FixSpotify",
    url: openUrl,
  };
  const accessory: DiscordButton | DiscordThumbnail = data.image
    ? {
        type: 11,
        media: { url: artworkUrl(data.image, openOrigin) },
        description: `${data.title} artwork`,
      }
    : previewButton;
  const subtitle =
    data.artistId && data.kind !== "artist" && copy.subtitle
      ? `[${copy.subtitle}](${openOrigin}/view?type=artist&id=${data.artistId})`
      : copy.subtitle;
  const subtitleLine =
    subtitle && (data.kind === "track" || data.kind === "album") ? `by ${subtitle}` : subtitle;
  return {
    component: {
      type: 17,
      accent_color: SPOTIFY_GREEN,
      components: [
        {
          type: 9,
          components: [
            textDisplay(`### [${title}](${openUrl})\n${subtitleLine || `Spotify ${data.kind}`}`),
            ...(copy.details ? [textDisplay(copy.details)] : []),
          ],
          accessory,
        },
        { type: 14, spacing: 1 },
        {
          type: 1,
          components: [
            ...(data.image ? [previewButton] : []),
            {
              type: 2,
              style: 5,
              label: "Spotify",
              url: data.url,
            },
          ],
        },
      ],
    },
  };
}

export function renderDiscordComponentEmbed(data: EmbedData, openOrigin: string): string {
  const json = JSON.stringify(discordComponentEmbed(data, openOrigin))
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `<script id="discord:component-embed" type="application/json">${json}</script>`;
}
