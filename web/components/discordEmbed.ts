import '../styles/discordEmbed.css'
import cover from '../assets/images/so-much-to-tell.webp'
import profile from '../assets/images/profile.webp'

const OPEN_ORIGIN = 'https://open.fixspotify.com'
const demoTrack = {
  id: '2FVTLDhiGL93225Se6nmJQ',
  title: 'so much to tell',
  artist: 'bh',
  artistId: '1dVRx37Q3qfuHf9Ke9u2OU',
  album: 'All Nighter, Vol. 6',
  albumId: '1Thi7GCXPtyG7NfXBOYCTS',
  duration: '4:17',
  position: 'track 3 of 45',
  released: 'February 9, 2021',
} as const

const viewUrl = (type: 'track' | 'artist' | 'album', id: string) =>
  `${OPEN_ORIGIN}/view?type=${type}&id=${id}`

function message(link: string, embed = '') {
  return `
    <section class="discord-chat">
      <article class="message">
        <img class="avatar" src="${profile}" alt="" />
        <div class="body">
          <header>
            <span class="username">Eva</span>
            <time>Today at 7:21 PM</time>
          </header>
          <p class="text"><span class="link">${link}</span></p>
          ${embed}
        </div>
      </article>
    </section>
  `;
}

const externalLinkIcon = `
  <svg class="component-external-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 3h7v7M21 3 10 14M18 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h7" />
  </svg>
`;

const action = (label: string) => `
  <span class="component-action">${label}${externalLinkIcon}</span>
`

const actions = `
  <div class="component-actions">
    ${action('Open with FixSpotify')}
    ${action('Spotify')}
  </div>
`;

const compactEmbed = `
  <div class="component-embed">
    <div class="component-section">
      <div class="component-copy">
        <div class="component-heading">
          <a class="component-title" href="${viewUrl('track', demoTrack.id)}">${demoTrack.title}</a>
          <span class="component-byline">by <a class="component-subtitle" href="${viewUrl('artist', demoTrack.artistId)}">${demoTrack.artist}</a></span>
        </div>
        <div class="component-details">
          <span class="component-album">on <a class="component-album-link" href="${viewUrl('album', demoTrack.albumId)}">${demoTrack.album}</a></span>
          <span class="component-metadata">${demoTrack.duration} · ${demoTrack.position}</span>
          <span class="component-metadata">${demoTrack.released}</span>
        </div>
      </div>
      <div class="component-artwork">
        <img class="component-artwork-background" src="${cover}" alt="" />
        <img class="component-artwork-cover" src="${cover}" alt="Cover of ${demoTrack.album} by ${demoTrack.artist}" />
      </div>
    </div>
    <div class="component-separator"></div>
    ${actions}
  </div>
`;

export function initDiscordEmbed() {
  const discordEmbed = `
    <section class="discord-embed">
      <h2>before</h2>
      ${message(`https://open.spotify.com/track/${demoTrack.id}`)}
      <h2>after</h2>
      ${message(`${OPEN_ORIGIN}/track/${demoTrack.id}`, compactEmbed)}
    </section>
  `;
  const discordEmbedContainer = document.getElementById('discord-embed-container');
  if (discordEmbedContainer) {
    discordEmbedContainer.innerHTML = discordEmbed;
  }
}
initDiscordEmbed();
