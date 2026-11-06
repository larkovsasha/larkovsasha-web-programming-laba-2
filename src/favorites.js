import './style.css'

const API_BASE = 'https://api.tvmaze.com'
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850"><rect width="600" height="850" fill="#1a1a1e"/><circle cx="300" cy="390" r="80" fill="none" stroke="#f55b2f" stroke-width="18"/><path d="M280 345l80 45-80 45z" fill="#f55b2f"/></svg>')

const grid = document.querySelector('#favoritesGrid')
const status = document.querySelector('#favoritesStatus')
const note = document.querySelector('#favoritesNote')
let favorites = new Set(JSON.parse(localStorage.getItem('kinosfera-favorites') || '[]'))
let shows = []

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatYear(date) {
  return date ? new Date(`${date}T00:00:00`).getFullYear() : 'Год не указан'
}

function renderEmpty() {
  grid.innerHTML = ''
  note.textContent = '0 сохранённых проектов'
  status.className = 'status status-empty'
  status.innerHTML = `
    <span class="status-icon" aria-hidden="true">♡</span>
    <div>
      <strong>В избранном пока пусто</strong>
      <p>Вернитесь в каталог и нажмите сердце на понравившейся карточке.</p>
    </div>
    <a class="button button-primary" href="/index.html#catalog">Открыть каталог</a>
  `
}

function render() {
  if (!shows.length) {
    renderEmpty()
    return
  }

  status.className = 'status'
  status.textContent = ''
  note.textContent = `${shows.length} сохранённых проектов`
  grid.innerHTML = shows
    .map((show, index) => {
      const image = show.image?.medium || show.image?.original || PLACEHOLDER_IMAGE
      const rating = show.rating?.average ? show.rating.average.toFixed(1) : '—'
      return `
        <article class="movie-card" style="--delay:${Math.min(index * 45, 360)}ms">
          <a class="poster-button" href="${escapeHtml(show.officialSite || show.url)}" target="_blank" rel="noreferrer" aria-label="Открыть страницу: ${escapeHtml(show.name)}">
            <img src="${escapeHtml(image)}" alt="Постер: ${escapeHtml(show.name)}" />
            <span class="poster-shade"></span>
            <span class="rating"><span aria-hidden="true">★</span> ${rating}</span>
            <span class="details-label">Открыть ↗</span>
          </a>
          <div class="card-body">
            <div class="card-title-row">
              <div>
                <h3>${escapeHtml(show.name)}</h3>
                <p>${formatYear(show.premiered)}${show.language ? ` · ${escapeHtml(show.language)}` : ''}</p>
              </div>
              <button class="favorite-toggle is-favorite" type="button" data-remove="${show.id}" aria-label="Удалить из избранного: ${escapeHtml(show.name)}">♥</button>
            </div>
            <div class="genre-list">
              ${(show.genres || []).slice(0, 2).map((genre) => `<span>${escapeHtml(genre)}</span>`).join('') || '<span>Без жанра</span>'}
            </div>
          </div>
        </article>
      `
    })
    .join('')
}

function showError() {
  grid.innerHTML = ''
  note.textContent = 'Ошибка загрузки'
  status.className = 'status status-error'
  status.innerHTML = `
    <span class="status-icon" aria-hidden="true">!</span>
    <div><strong>Не удалось загрузить избранное</strong><p>Проверьте соединение и повторите запрос.</p></div>
    <button type="button" id="retryFavorites">Повторить запрос</button>
  `
  document.querySelector('#retryFavorites').addEventListener('click', loadFavorites)
}

async function loadFavorites() {
  if (!favorites.size) {
    renderEmpty()
    return
  }

  status.className = 'status'
  status.textContent = 'Загрузка…'
  note.textContent = 'Загрузка…'

  try {
    const responses = await Promise.all([...favorites].map((id) => fetch(`${API_BASE}/shows/${id}`)))
    const failed = responses.find((response) => !response.ok)
    if (failed) throw new Error(`HTTP ${failed.status}`)
    shows = await Promise.all(responses.map((response) => response.json()))
    render()
  } catch {
    showError()
  }
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]')
  if (!button) return
  const id = Number(button.dataset.remove)
  favorites.delete(id)
  localStorage.setItem('kinosfera-favorites', JSON.stringify([...favorites]))
  shows = shows.filter((show) => show.id !== id)
  render()
})

loadFavorites()
