import '../styles/discordEmbed.css'
import cover from '../assets/images/starfall.webp'
import profile from '../assets/images/profile.webp'

function message(link: string, embed = '') {
  return `
    <section class="discord-chat">
      <article class="message">
        <img class="avatar" src="${profile}" alt="" />
        <div class="body">
          <header>
            <span class="username">max</span>
            <time>Today at 7:21 PM</time>
          </header>
          <p class="text"><span class="link">${link}</span></p>
          ${embed}
        </div>
      </article>
    </section>
  `;
}

const richEmbed = `
  <div class="rich-embed">
    <div class="grid">
      <span class="provider">FixSpotify</span>
      <span class="title">Starfall</span>
      <p class="description">By SALEM • 2:48
Track 5 of 11 on Fires in Heaven
Released October 30, 2020</p>
      <img class="thumbnail" src="${cover}" alt="Cover of Fires in Heaven by SALEM" />
    </div>
  </div>
`;

export function initDiscordEmbed() {
  const discordEmbed = `
    <section class="discord-embed">
      <h2>Before</h2>
      ${message('https://open.spotify.com/track/05FpQ41MVtDd1Ft63DZNuv')}
      <h2>After</h2>
      ${message('https://open.fixspotify.com/track/05FpQ41MVtDd1Ft63DZNuv', richEmbed)}
    </section>
  `;
  const discordEmbedContainer = document.getElementById('discord-embed-container');
  if (discordEmbedContainer) {
    discordEmbedContainer.innerHTML = discordEmbed;
  }
}
initDiscordEmbed();
