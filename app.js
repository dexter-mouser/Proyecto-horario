/**
 * MODELO
 * Representa una única clase dentro del horario.
 */
class ScheduleEntry {
  constructor({ id, day, subject, room, start, end }) {
    this.id = id;
    this.day = day;
    this.subject = subject;
    this.room = room;
    this.start = start; // "HH:MM", 24 horas
    this.end = end;     // "HH:MM", 24 horas
  }
}

/**
 * REPOSITORIO
 * Guarda el estado en memoria y expone las operaciones sobre las clases.
 * La app no usa almacenamiento del navegador: los datos viven mientras
 * la pestaña está abierta. Para conservarlos, usar exportar/importar.
 */
class ScheduleStore {
  constructor() {
    this.entries = [];
    this.nextId = 1;
  }

  add(data) {
    const entry = new ScheduleEntry({ id: this.nextId++, ...data });
    this.entries.push(entry);
    return entry;
  }

  update(id, data) {
    const entry = this.getById(id);
    if (!entry) return null;
    Object.assign(entry, data);
    return entry;
  }

  remove(id) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  getById(id) {
    return this.entries.find((entry) => entry.id === id) || null;
  }

  getByDay(day, filterText = '') {
    const needle = filterText.trim().toLowerCase();

    return this.entries
      .filter((entry) => entry.day === day)
      .filter((entry) => {
        if (!needle) return true;
        return entry.subject.toLowerCase().includes(needle)
          || entry.room.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  count() {
    return this.entries.length;
  }

  toJSON() {
    return JSON.stringify(this.entries, null, 2);
  }

  loadFromJSON(json) {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) throw new Error('Formato inválido');

    this.entries = raw.map((item) => new ScheduleEntry(item));
    this.nextId = this.entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
  }
}

/**
 * CONTROLADOR DE INTERFAZ
 * Conecta el repositorio con el DOM: dibuja el tablero, maneja el
 * formulario y responde a las acciones de editar, eliminar,
 * buscar, exportar e importar.
 */
class ScheduleApp {
  static DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  static MINUTE_STEPS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  constructor(store) {
    this.store = store;
    this.searchText = '';

    this.cacheDom();
    this.populateTimeSelects();
    this.bindEvents();
    this.render();
    this.tick();

    setInterval(() => this.tick(), 15000);
  }

  // ---------------------------------------------------------
  // Utilidades de fecha y hora
  // ---------------------------------------------------------

  getTodayIndex() {
    const jsDay = new Date().getDay(); // 0 = domingo ... 6 = sábado
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 0 };
    return map[jsDay];
  }

  getOrderedDays() {
    const todayIndex = this.getTodayIndex();
    return ScheduleApp.DAYS.slice(todayIndex).concat(ScheduleApp.DAYS.slice(0, todayIndex));
  }

  nowAsMinutes() {
    const now = new Date();
    return (now.getHours() * 60) + now.getMinutes();
  }

  toMinutes(hhmm) {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  /** Devuelve la hora actual en formato 24 horas: "HH:MM". */
  formatNow() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // ---------------------------------------------------------
  // DOM
  // ---------------------------------------------------------

  cacheDom() {
    this.dom = {
      board: document.getElementById('board'),
      subtitle: document.getElementById('subtitle'),
      clockText: document.getElementById('clockText'),
      nowBanner: document.getElementById('nowBanner'),
      nowBannerText: document.getElementById('nowBannerText'),
      formCard: document.getElementById('formCard'),
      formTitle: document.getElementById('formTitle'),
      form: document.getElementById('classForm'),
      entryId: document.getElementById('entryId'),
      inputDay: document.getElementById('inputDay'),
      inputSubject: document.getElementById('inputSubject'),
      inputRoom: document.getElementById('inputRoom'),
      inputStartHour: document.getElementById('inputStartHour'),
      inputStartMin: document.getElementById('inputStartMin'),
      inputEndHour: document.getElementById('inputEndHour'),
      inputEndMin: document.getElementById('inputEndMin'),
      btnAdd: document.getElementById('btnAdd'),
      btnCancel: document.getElementById('btnCancel'),
      btnExport: document.getElementById('btnExport'),
      btnImport: document.getElementById('btnImport'),
      fileImport: document.getElementById('fileImport'),
      searchInput: document.getElementById('searchInput'),
      toastContainer: document.getElementById('toastContainer'),
    };
  }

  /** Llena los selects de hora (00-23) y minutos (pasos de 5) del formulario. */
  populateTimeSelects() {
    const hourOptions = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
    const hourHtml = hourOptions.map((h) => `<option value="${h}">${h}</option>`).join('');
    const minHtml = ScheduleApp.MINUTE_STEPS.map((m) => `<option value="${m}">${m}</option>`).join('');

    this.dom.inputStartHour.innerHTML = hourHtml;
    this.dom.inputEndHour.innerHTML = hourHtml;
    this.dom.inputStartMin.innerHTML = minHtml;
    this.dom.inputEndMin.innerHTML = minHtml;
  }

  bindEvents() {
    this.dom.btnAdd.addEventListener('click', () => this.openForm());
    this.dom.btnCancel.addEventListener('click', () => this.closeForm());
    this.dom.form.addEventListener('submit', (event) => this.handleSubmit(event));
    this.dom.btnExport.addEventListener('click', () => this.exportJSON());
    this.dom.btnImport.addEventListener('click', () => this.dom.fileImport.click());
    this.dom.fileImport.addEventListener('change', (event) => this.importJSON(event));

    this.dom.searchInput.addEventListener('input', (event) => {
      this.searchText = event.target.value;
      this.render();
    });

    this.dom.board.addEventListener('click', (event) => {
      const editBtn = event.target.closest('[data-action="edit"]');
      const deleteBtn = event.target.closest('[data-action="delete"]');
      if (editBtn) this.openForm(Number(editBtn.dataset.id));
      if (deleteBtn) this.handleDelete(Number(deleteBtn.dataset.id));
    });
  }

  // ---------------------------------------------------------
  // Reloj y clase en curso
  // ---------------------------------------------------------

  tick() {
    this.dom.clockText.textContent = this.formatNow();
    this.updateNowBanner();
    this.refreshLiveHighlights();
  }

  getCurrentEntry() {
    const today = ScheduleApp.DAYS[this.getTodayIndex()];
    const nowMin = this.nowAsMinutes();

    return this.store.getByDay(today).find((entry) => {
      return this.toMinutes(entry.start) <= nowMin && nowMin < this.toMinutes(entry.end);
    }) || null;
  }

  updateNowBanner() {
    const entry = this.getCurrentEntry();

    if (entry) {
      this.dom.nowBanner.classList.remove('is-idle');
      this.dom.nowBannerText.innerHTML =
        `Ahora mismo: <strong>${this.escape(entry.subject)}</strong> en ${this.escape(entry.room)} (hasta ${entry.end})`;
    } else {
      this.dom.nowBanner.classList.add('is-idle');
      this.dom.nowBannerText.textContent = 'No tienes ninguna clase en este momento';
    }
  }

  refreshLiveHighlights() {
    const entry = this.getCurrentEntry();

    document.querySelectorAll('.class-card').forEach((card) => {
      const isLive = !!entry && Number(card.dataset.id) === entry.id;
      card.classList.toggle('is-live', isLive);
    });
  }

  // ---------------------------------------------------------
  // Formulario
  // ---------------------------------------------------------

  openForm(id = null) {
    this.clearErrors();
    this.dom.form.reset();

    if (id) {
      this.fillFormForEdit(id);
    } else {
      this.fillFormForNew();
    }

    this.dom.formCard.classList.add('is-open');
    setTimeout(() => this.dom.inputSubject.focus(), 200);
  }

  fillFormForEdit(id) {
    const entry = this.store.getById(id);
    const [startHour, startMin] = entry.start.split(':');
    const [endHour, endMin] = entry.end.split(':');

    this.dom.formTitle.innerHTML = '<svg class="icon"><use href="#i-pencil"/></svg> Editar clase';
    this.dom.entryId.value = entry.id;
    this.dom.inputDay.value = entry.day;
    this.dom.inputSubject.value = entry.subject;
    this.dom.inputRoom.value = entry.room;
    this.dom.inputStartHour.value = startHour;
    this.dom.inputStartMin.value = this.closestMinuteStep(startMin);
    this.dom.inputEndHour.value = endHour;
    this.dom.inputEndMin.value = this.closestMinuteStep(endMin);
  }

  fillFormForNew() {
    this.dom.formTitle.innerHTML = '<svg class="icon"><use href="#i-book"/></svg> Nueva clase';
    this.dom.entryId.value = '';
    this.dom.inputDay.value = ScheduleApp.DAYS[this.getTodayIndex()];
    this.dom.inputStartHour.value = '07';
    this.dom.inputStartMin.value = '00';
    this.dom.inputEndHour.value = '09';
    this.dom.inputEndMin.value = '00';
  }

  /** Ajusta un minuto libre (ej. de un JSON importado) al paso de 5 más cercano. */
  closestMinuteStep(minute) {
    const target = Number(minute);
    return ScheduleApp.MINUTE_STEPS.reduce((closest, step) => {
      return Math.abs(Number(step) - target) < Math.abs(Number(closest) - target) ? step : closest;
    }, '00');
  }

  closeForm() {
    this.dom.formCard.classList.remove('is-open');
    this.clearErrors();
  }

  clearErrors() {
    document.querySelectorAll('.field--error').forEach((field) => field.classList.remove('field--error'));
  }

  validate(data) {
    let valid = true;
    const markError = (fieldId) => {
      document.getElementById(fieldId).classList.add('field--error');
      valid = false;
    };

    if (!data.day) markError('fieldDay');
    if (!data.subject.trim()) markError('fieldSubject');
    if (!data.room.trim()) markError('fieldRoom');
    if (data.end <= data.start) markError('fieldEnd');

    return valid;
  }

  handleSubmit(event) {
    event.preventDefault();
    this.clearErrors();

    const data = {
      day: this.dom.inputDay.value,
      subject: this.dom.inputSubject.value.trim(),
      room: this.dom.inputRoom.value.trim(),
      start: `${this.dom.inputStartHour.value}:${this.dom.inputStartMin.value}`,
      end: `${this.dom.inputEndHour.value}:${this.dom.inputEndMin.value}`,
    };

    if (!this.validate(data)) return;

    const id = this.dom.entryId.value;
    if (id) {
      this.store.update(Number(id), data);
      this.toast('Clase actualizada', 'ok');
    } else {
      this.store.add(data);
      this.toast('Clase guardada', 'ok');
    }

    this.closeForm();
    this.render();
  }

  handleDelete(id) {
    const entry = this.store.getById(id);
    if (!entry) return;

    const confirmed = confirm(`¿Eliminar "${entry.subject}" (${entry.day})?`);
    if (!confirmed) return;

    const card = this.dom.board.querySelector(`.class-card[data-id="${id}"]`);
    if (!card) {
      this.store.remove(id);
      this.render();
      return;
    }

    card.classList.add('is-removing');
    card.addEventListener('transitionend', () => this.finishDelete(id), { once: true });
    setTimeout(() => this.finishDelete(id), 400); // respaldo si no dispara transitionend
  }

  finishDelete(id) {
    if (!this.store.getById(id)) return;
    this.store.remove(id);
    this.toast('Clase eliminada', 'danger');
    this.render();
  }

  // ---------------------------------------------------------
  // Exportar / importar
  // ---------------------------------------------------------

  exportJSON() {
    const blob = new Blob([this.store.toJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'mi-horario.json';
    link.click();

    URL.revokeObjectURL(url);
    this.toast('Horario exportado', 'ok');
  }

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.loadFromJSON(reader.result);
        this.render();
        this.toast('Horario importado', 'ok');
      } catch (error) {
        this.toast('No se pudo leer el archivo', 'danger');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------
  // Notificaciones
  // ---------------------------------------------------------

  toast(message, kind = 'ok') {
    const icon = kind === 'ok' ? 'i-check' : 'i-trash';
    const el = document.createElement('div');
    el.className = `toast ${kind === 'ok' ? 'toast--ok' : ''}`;
    el.innerHTML = `<svg class="icon"><use href="#${icon}"/></svg> ${message}`;

    this.dom.toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2200);
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  render() {
    this.renderSubtitle();

    const todayIndex = this.getTodayIndex();
    const orderedDays = this.getOrderedDays();

    this.dom.board.innerHTML = orderedDays
      .map((day, position) => this.renderDayColumn(day, position, todayIndex))
      .join('');

    this.refreshLiveHighlights();
  }

  renderSubtitle() {
    const total = this.store.count();
    this.dom.subtitle.textContent = total === 0
      ? 'Sin clases registradas todavía'
      : `${total} clase${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'} esta semana`;
  }

  renderDayColumn(day, position, todayIndex) {
    const isToday = ScheduleApp.DAYS.indexOf(day) === todayIndex;
    const entries = this.store.getByDay(day, this.searchText);
    const cardsHtml = entries.length
      ? entries.map((entry, index) => this.renderCard(entry, index)).join('')
      : '<p class="day-column__empty">Sin clases</p>';

    return `
      <section class="day-column${isToday ? ' is-today' : ''}" style="--i:${position}">
        <header class="day-column__header">
          <div class="day-column__name-wrap">
            <span class="day-column__name">${day}</span>
            ${isToday ? '<span class="today-badge">HOY</span>' : ''}
          </div>
          <span class="day-column__count">${entries.length}</span>
        </header>
        <div class="day-column__list">${cardsHtml}</div>
      </section>
    `;
  }

  renderCard(entry, index) {
    return `
      <article class="class-card" data-id="${entry.id}" style="--ci:${index}">
        <div class="class-card__actions">
          <button class="icon-btn" data-action="edit" data-id="${entry.id}" title="Editar" aria-label="Editar clase">
            <svg class="icon"><use href="#i-pencil"/></svg>
          </button>
          <button class="icon-btn" data-action="delete" data-id="${entry.id}" title="Eliminar" aria-label="Eliminar clase">
            <svg class="icon"><use href="#i-trash"/></svg>
          </button>
        </div>
        <div class="class-card__time">
          <svg class="icon"><use href="#i-clock"/></svg> ${entry.start} – ${entry.end}
        </div>
        <div class="class-card__subject">${this.escape(entry.subject)}</div>
        <div class="class-card__room">
          <svg class="icon"><use href="#i-pin"/></svg> ${this.escape(entry.room)}
        </div>
      </article>
    `;
  }

  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
const store = new ScheduleStore();
new ScheduleApp(store);
