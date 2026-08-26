import '../styles/topCharts.css'
import placeholder from '../assets/images/placeholder.svg'

interface Entry {
  id: string
  name: string
  subtitle: string
  image: string
  count: number
}

const RANGES = [
  ['7d', 'This week'],
  ['30d', 'This month'],
  ['all', 'All time'],
] as const

const TYPES = [
  ['track', 'Tracks'],
  ['album', 'Albums'],
  ['artist', 'Artists'],
] as const

type Range = (typeof RANGES)[number][0]
type Type = (typeof TYPES)[number][0]

let range: Range = '7d'

const escape = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

const formatCount = (n: number) => new Intl.NumberFormat('en-US').format(n)

const itemUrl = (type: Type, id: string) =>
  id ? `https://open.fixspotify.com/${type}/${id}` : ''

const loaded = new Map<string, Promise<Entry[]>>()

// every range is fetched once up front so switching is instant
function fetchTop(type: Type, r: Range): Promise<Entry[]> {
  const key = `${r}:${type}`
  let pending = loaded.get(key)
  if (!pending) {
    pending = fetch(`/api/stats/top?type=${type}&range=${r}&limit=10`)
      .then(res => (res.ok ? res.json() : []))
      .catch(() => [])
    loaded.set(key, pending)
  }
  return pending
}

function renderItem(type: Type, entry: Entry, rank: number) {
  const url = itemUrl(type, entry.id)
  const name = escape(entry.name)
  const title = url ? `<a class="name" href="${escape(url)}">${name}</a>` : `<span class="name">${name}</span>`
  return `
    <li${rank === 1 ? ' class="first"' : ''}>
      <span class="rank">${rank}</span>
      <img src="${escape(entry.image || placeholder)}" alt="" loading="lazy" />
      <div class="meta">
        ${title}
        <span class="sub">${escape(entry.subtitle)}</span>
      </div>
      <span class="count">${formatCount(entry.count)}</span>
    </li>
  `
}

function renderItems(type: Type, entries: Entry[]) {
  return entries.length
    ? entries.map((e, i) => renderItem(type, e, i + 1)).join('')
    : '<li class="empty">nothing yet</li>'
}

// only the lists change, the boxes stay so nothing re-animates under the cursor
async function renderCharts() {
  const results = await Promise.all(TYPES.map(([type]) => fetchTop(type, range)))
  TYPES.forEach(([type], i) => {
    const list = document.getElementById(`chart-${type}`)
    if (list) list.innerHTML = renderItems(type, results[i] ?? [])
  })
}

export function initTopCharts() {
  const container = document.getElementById('top-charts-container')
  if (!container) return

  container.innerHTML = `
    <section class="charts">
      <header>
        <div class="heading">
          <h2>Top charts</h2>
          <p>What people are sharing through fixSpotify.</p>
        </div>
        <div class="ranges">
          ${RANGES.map(([value, label]) => `<button data-range="${value}"${value === range ? ' class="active"' : ''}>${label}</button>`).join('')}
        </div>
      </header>
      <div class="chart-grid">
        ${TYPES.map(([type, label]) => `
          <section class="chart">
            <h3>${label}</h3>
            <ol id="chart-${type}"></ol>
          </section>
        `).join('')}
      </div>
    </section>
  `

  container.querySelectorAll<HTMLButtonElement>('button[data-range]').forEach(button => {
    button.onclick = () => {
      range = button.dataset.range as Range
      container.querySelectorAll('button[data-range]').forEach(b => b.classList.toggle('active', b === button))
      renderCharts()
    }
  })

  renderCharts()
  RANGES.forEach(([r]) => TYPES.forEach(([type]) => fetchTop(type, r)))
}
initTopCharts()
