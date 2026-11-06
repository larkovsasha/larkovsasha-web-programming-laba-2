import './style.css'

const API_BASE = 'https://api.tvmaze.com'
const DEFAULT_LIMIT = 18
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#27272a" />
          <stop offset="1" stop-color="#111113" />
        </linearGradient>
      </defs>
      <rect width="600" height="850" fill="url(#bg)" />
      <circle cx="300" cy="385" r="88" fill="none" stroke="#f55b2f" stroke-width="18" opacity=".75" />
      <path d="M280 340l80 45-80 45z" fill="#f55b2f" />
      <text x="300" y="540" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">КИНОСФЕРА</text>
    </svg>
  `)

const app = document.querySelector('#app')

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="/index.html" aria-label="Киносфера, на главную">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>КИНОСФЕРА</span>
    </a>
    <nav class="main-nav" aria-label="Основная навигация">
      <a href="/index.html#catalog" aria-current="page">Каталог</a>
      <a href="/favorites.html">Избранное</a>
    </nav>
    <a class="favorites-button" href="/favorites.html" id="favoritesButton">
      <span aria-hidden="true">♥</span>
      Избранное
      <span class="favorite-count" id="favoriteCount">0</span>
    </a>
  </header>

  <main id="top">
    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero-backdrop" id="heroBackdrop" aria-hidden="true"></div>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-content">
        <p class="eyebrow"><span></span> Онлайн-коллекция</p>
        <h1 id="heroTitle">Истории, которые хочется досмотреть</h1>
        <p class="hero-copy">
          Исследуйте фильмы и сериалы, находите новое по жанру и сохраняйте понравившееся.
          Новая подборка появляется при каждом открытии каталога.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#catalog">Открыть каталог</a>
          <button class="button button-ghost" type="button" id="randomButton">
            <span aria-hidden="true">↝</span> Случайный выбор
          </button>
        </div>
      </div>
      <div class="hero-fact" aria-label="Информация о каталоге">
        <strong id="heroCount">—</strong>
        <span>позиций в подборке</span>
      </div>
    </section>

    <section class="catalog" id="catalog" aria-labelledby="catalogTitle">
      <div class="section-heading">
        <div>
          <h2 id="catalogTitle">Что посмотреть сегодня</h2>
        </div>
        <p class="section-note" id="resultNote">Подборка популярных проектов</p>
      </div>

      <form class="controls" id="searchForm" role="search">
        <label class="search-field">
          <span class="visually-hidden">Поиск по названию</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
          <input id="searchInput" type="search" placeholder="Название фильма или сериала" autocomplete="off" />
        </label>

        <label class="select-field">
          <span class="visually-hidden">Жанр</span>
          <select id="genreSelect">
            <option value="all">Все жанры</option>
          </select>
        </label>

        <button class="refresh-button" id="refreshButton" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5"></path>
            <path d="M18.5 15a7 7 0 1 1-.7-7.7L20 10"></path>
          </svg>
          Обновить
        </button>
      </form>

      <div class="status" id="status" role="status" aria-live="polite"></div>
      <div class="movie-grid" id="movieGrid" aria-live="polite"></div>
    </section>

  </main>

  <footer class="site-footer">
    <a class="brand brand-footer" href="/index.html">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>КИНОСФЕРА</span>
    </a>
  </footer>

  <dialog class="details-dialog" id="detailsDialog">
    <button class="dialog-close" id="dialogClose" type="button" aria-label="Закрыть">×</button>
    <div id="dialogContent"></div>
  </dialog>
`

const elements = {
  searchForm: document.querySelector('#searchForm'),
  searchInput: document.querySelector('#searchInput'),
  genreSelect: document.querySelector('#genreSelect'),
  refreshButton: document.querySelector('#refreshButton'),
  favoritesButton: document.querySelector('#favoritesButton'),
  favoriteCount: document.querySelector('#favoriteCount'),
  randomButton: document.querySelector('#randomButton'),
  movieGrid: document.querySelector('#movieGrid'),
  status: document.querySelector('#status'),
  resultNote: document.querySelector('#resultNote'),
  heroCount: document.querySelector('#heroCount'),
  heroBackdrop: document.querySelector('#heroBackdrop'),
  detailsDialog: document.querySelector('#detailsDialog'),
  dialogContent: document.querySelector('#dialogContent'),
  dialogClose: document.querySelector('#dialogClose'),
}

const state = {
  shows: [],
  visibleShows: [],
  query: '',
  genre: 'all',
  favorites: new Set(JSON.parse(localStorage.getItem('kinosfera-favorites') || '[]')),
  lastRequest: null,
  controller: null,
}

function stripHtml(html = '') {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content.textContent?.trim() || 'Описание пока не добавлено.'
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(date) {
  if (!date) return 'Год не указан'
  return new Intl.DateTimeFormat('ru-RU', { year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function setLoading() {
  elements.status.className = 'status'
  elements.status.textContent = 'Загрузка…'
  elements.movieGrid.classList.add('is-loading')
  elements.movieGrid.innerHTML = Array.from(
    { length: 8 },
    () => `
      <div class="skeleton-card" aria-hidden="true">
        <span class="skeleton-poster"></span>
        <span class="skeleton-line skeleton-line-wide"></span>
        <span class="skeleton-line"></span>
      </div>
    `,
  ).join('')
}

function setError(error) {
  const message = error.name === 'AbortError' ? null : 'Не удалось загрузить каталог. Проверьте интернет-соединение и повторите попытку.'
  if (!message) return

  elements.movieGrid.classList.remove('is-loading')
  elements.movieGrid.innerHTML = ''
  elements.status.className = 'status status-error'
  elements.status.innerHTML = `
    <span class="status-icon" aria-hidden="true">!</span>
    <div>
      <strong>Что-то пошло не так</strong>
      <p>${message}</p>
    </div>
    <button type="button" id="retryButton">Повторить запрос</button>
  `
  document.querySelector('#retryButton').addEventListener('click', () => state.lastRequest?.())
}

function populateGenres(shows) {
  const previous = elements.genreSelect.value
  const genres = [...new Set(shows.flatMap((show) => show.genres || []))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  )

  elements.genreSelect.innerHTML = `
    <option value="all">Все жанры</option>
    ${genres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join('')}
  `
  elements.genreSelect.value = genres.includes(previous) ? previous : 'all'
  state.genre = elements.genreSelect.value
}

function getFilteredShows() {
  return state.shows.filter((show) => {
    return state.genre === 'all' || show.genres?.includes(state.genre)
  })
}

function renderEmpty() {
  elements.status.className = 'status status-empty'
  elements.status.innerHTML = `
    <span class="status-icon" aria-hidden="true">⌕</span>
    <div>
      <strong>Ничего не найдено</strong>
      <p>Попробуйте изменить запрос или выбрать другой жанр.</p>
    </div>
  `
}

function movieCard(show, index) {
  const year = formatDate(show.premiered)
  const rating = show.rating?.average ? show.rating.average.toFixed(1) : '—'
  const image = show.image?.medium || show.image?.original || PLACEHOLDER_IMAGE
  const genres = show.genres?.slice(0, 2) || []
  const isFavorite = state.favorites.has(show.id)

  return `
    <article class="movie-card" style="--delay: ${Math.min(index * 45, 450)}ms">
      <button class="poster-button" type="button" data-details="${show.id}" aria-label="Подробнее: ${escapeHtml(show.name)}">
        <img src="${escapeHtml(image)}" alt="Постер: ${escapeHtml(show.name)}" loading="lazy" />
        <span class="poster-shade"></span>
        <span class="rating"><span aria-hidden="true">★</span> ${rating}</span>
        <span class="details-label">Подробнее</span>
      </button>
      <div class="card-body">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(show.name)}</h3>
            <p>${year}${show.language ? ` · ${escapeHtml(show.language)}` : ''}</p>
          </div>
          <button
            class="favorite-toggle ${isFavorite ? 'is-favorite' : ''}"
            type="button"
            data-favorite="${show.id}"
            aria-label="${isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}: ${escapeHtml(show.name)}"
            aria-pressed="${isFavorite}"
          >♥</button>
        </div>
        <div class="genre-list">
          ${genres.length ? genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join('') : '<span>Без жанра</span>'}
        </div>
      </div>
    </article>
  `
}

function renderShows() {
  state.visibleShows = getFilteredShows().slice(0, DEFAULT_LIMIT)
  elements.movieGrid.classList.remove('is-loading')
  elements.status.className = 'status'
  elements.status.textContent = ''
  elements.heroCount.textContent = state.visibleShows.length

  if (!state.visibleShows.length) {
    elements.movieGrid.innerHTML = ''
    renderEmpty()
  } else {
    elements.movieGrid.innerHTML = state.visibleShows.map(movieCard).join('')
  }

  const label = state.query ? `Результаты по запросу «${state.query}»` : 'Подборка популярных проектов'
  elements.resultNote.textContent = `${label} · ${state.visibleShows.length}`
  updateFavoriteCounter()
}

function updateHero(show) {
  const image = show?.image?.original || show?.image?.medium
  if (image) {
    elements.heroBackdrop.style.backgroundImage = `url("${image.replaceAll('"', '%22')}")`
  }
}

async function requestShows(url, requestAgain) {
  state.controller?.abort()
  state.controller = new AbortController()
  state.lastRequest = requestAgain
  setLoading()

  try {
    const response = await fetch(url, { signal: state.controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    state.shows = data
      .map((item) => item.show || item)
      .filter((show) => show && show.id)
      .sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))

    populateGenres(state.shows)
    renderShows()
    updateHero(state.shows.find((show) => show.image?.original) || state.shows[0])
  } catch (error) {
    setError(error)
  }
}

function loadPopular(page = Math.floor(Math.random() * 10)) {
  state.query = ''
  elements.searchInput.value = ''
  requestShows(`${API_BASE}/shows?page=${page}`, () => loadPopular(page))
}

function searchShows(query) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    loadPopular()
    return
  }

  state.query = trimmedQuery
  const url = `${API_BASE}/search/shows?q=${encodeURIComponent(trimmedQuery)}`
  requestShows(url, () => searchShows(trimmedQuery))
}

function saveFavorites() {
  localStorage.setItem('kinosfera-favorites', JSON.stringify([...state.favorites]))
}

function updateFavoriteCounter() {
  elements.favoriteCount.textContent = state.favorites.size
}

function toggleFavorite(id, button) {
  const isFavorite = !state.favorites.has(id)
  const show = state.shows.find((item) => item.id === id)

  if (isFavorite) state.favorites.add(id)
  else state.favorites.delete(id)

  saveFavorites()
  updateFavoriteCounter()

  button.classList.toggle('is-favorite', isFavorite)
  button.setAttribute('aria-pressed', String(isFavorite))
  button.setAttribute(
    'aria-label',
    `${isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}: ${show?.name || 'проект'}`,
  )
}

function openDetails(id) {
  const show = state.shows.find((item) => item.id === id)
  if (!show) return

  const image = show.image?.original || show.image?.medium || PLACEHOLDER_IMAGE
  const rating = show.rating?.average ? show.rating.average.toFixed(1) : 'Нет оценки'
  const genres = show.genres?.join(', ') || 'Жанр не указан'
  const summary = stripHtml(show.summary)

  elements.dialogContent.innerHTML = `
    <div class="dialog-poster">
      <img src="${escapeHtml(image)}" alt="Постер: ${escapeHtml(show.name)}" />
    </div>
    <div class="dialog-copy">
      <h2>${escapeHtml(show.name)}</h2>
      <p class="dialog-meta">${formatDate(show.premiered)} · ${escapeHtml(genres)} · ★ ${rating}</p>
      <p>${escapeHtml(summary)}</p>
      <a class="button button-primary" href="${escapeHtml(show.officialSite || show.url)}" target="_blank" rel="noreferrer">
        Страница проекта ↗
      </a>
    </div>
  `
  elements.detailsDialog.showModal()
}

elements.searchForm.addEventListener('submit', (event) => {
  event.preventDefault()
  searchShows(elements.searchInput.value)
})

let searchTimer
elements.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchShows(elements.searchInput.value), 450)
})

elements.genreSelect.addEventListener('change', () => {
  state.genre = elements.genreSelect.value
  renderShows()
})

elements.refreshButton.addEventListener('click', () => {
  state.genre = 'all'
  loadPopular()
})

elements.randomButton.addEventListener('click', () => {
  const pool = state.visibleShows.length ? state.visibleShows : state.shows
  if (!pool.length) return
  openDetails(pool[Math.floor(Math.random() * pool.length)].id)
})

elements.movieGrid.addEventListener('click', (event) => {
  const favoriteButton = event.target.closest('[data-favorite]')
  if (favoriteButton) {
    toggleFavorite(Number(favoriteButton.dataset.favorite), favoriteButton)
    return
  }

  const detailsButton = event.target.closest('[data-details]')
  if (detailsButton) openDetails(Number(detailsButton.dataset.details))
})

elements.dialogClose.addEventListener('click', () => elements.detailsDialog.close())
elements.detailsDialog.addEventListener('click', (event) => {
  if (event.target === elements.detailsDialog) elements.detailsDialog.close()
})

loadPopular()
