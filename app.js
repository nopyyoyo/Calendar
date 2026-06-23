const SUPABASE_URL = window.SUPABASE_CONFIG?.url || "";
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || "";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  items: [],
  persons: [],
  personThemeMap: new Map(),
  selectedItem: null,
  formMode: "add",
  editingRowId: null,
  selectedPersonFilter: "",
};

const views = {
  calendar: document.getElementById("calendarView"),
  detail: document.getElementById("detailView"),
  dayList: document.getElementById("dayListView"),
  form: document.getElementById("formView"),
};

const pageTitle = document.getElementById("pageTitle");
const monthLabel = document.getElementById("monthLabel");
const weekdayRow = document.getElementById("weekdayRow");
const calendarGrid = document.getElementById("calendarGrid");
const homeAddBtn = document.getElementById("homeAddBtn");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const backToCalendarBtn = document.getElementById("backToCalendarBtn");
const detailEditBtn = document.getElementById("detailEditBtn");
const detailDeleteBtn = document.getElementById("detailDeleteBtn");
const dayListBackBtn = document.getElementById("dayListBackBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");

const detailDate = document.getElementById("detailDate");
const detailTime = document.getElementById("detailTime");
const detailDateTo = document.getElementById("detailDateTo");
const detailTimeTo = document.getElementById("detailTimeTo");
const detailItem = document.getElementById("detailItem");
const detailDescription = document.getElementById("detailDescription");
const detailPerson = document.getElementById("detailPerson");
const dayListTitle = document.getElementById("dayListTitle");
const dayListBody = document.getElementById("dayListBody");

const formEl = document.getElementById("itemForm");
const formTitle = document.getElementById("formTitle");
const saveBackBtn = document.getElementById("saveBackBtn");
const saveMoreBtn = document.getElementById("saveMoreBtn");
const formMessage = document.getElementById("formMessage");
const dateInput = document.getElementById("dateInput");
const dateToInput = document.getElementById("dateToInput");
const timeInput = document.getElementById("timeInput");
const timeToInput = document.getElementById("timeToInput");
const personOptions = document.getElementById("personOptions");
const personFilterSelect = document.getElementById("personFilterSelect");

const PERSON_THEME_STYLES = {
  blue: { bg: "#cfe8ff", text: "#173b6b", border: "#9cc7f5" },
  pink: { bg: "#ffd8eb", text: "#6a1f49", border: "#f5abc9" },
  red: { bg: "#ffd9d4", text: "#6b1f1f", border: "#f2aba0" },
  green: { bg: "#d9f1d8", text: "#1f5534", border: "#a8d6a7" },
  orange: { bg: "#ffe2c4", text: "#704214", border: "#f1bf8b" },
};

function formatDateKey(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function formatTimeHHMM(value) {
  const raw = safeString(value);
  if (!raw) {
    return "";
  }

  const hhmmMatch = raw.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = hhmmMatch[2];
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:${minute}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const hour = String(parsed.getHours()).padStart(2, "0");
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  return raw;
}

function defaultHourTime() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  return `${hour}:00`;
}

function splitPersons(value) {
  return safeString(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinPersons(persons) {
  return persons
    .map((person) => safeString(person))
    .filter(Boolean)
    .join(", ");
}

function normalizeItem(row) {
  const rowIdValue = Number(row.rowId);
  const rowId = Number.isFinite(rowIdValue) ? rowIdValue : null;
  const date = safeString(row.date);
  const time = safeString(row.time || "");
  const item = safeString(row.item || "");
  const description = safeString(row.description || "");
  const person = safeString(row.person || "");
  const dateTo = safeString(row.dateTo || "");
  const timeTo = safeString(row.timeTo || "");

  return { rowId, date, time, item, description, person, dateTo, timeTo };
}

function ensureSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. Update supabase-config.js.");
  }
}

function getThemeByPerson(personName) {
  return state.personThemeMap.get(safeString(personName).toLowerCase()) || "";
}

function getDefaultTheme() {
  return getThemeByPerson("Default") || "Orange";
}

function getItemTheme(item) {
  const people = splitPersons(item.person);

  if (people.length !== 1) {
    return getDefaultTheme();
  }

  return getThemeByPerson(people[0]) || getDefaultTheme();
}

function themeStyle(themeName) {
  const key = safeString(themeName).toLowerCase();
  return PERSON_THEME_STYLES[key] || PERSON_THEME_STYLES.orange;
}

function applyThemeToElement(element, themeName) {
  const style = themeStyle(themeName);
  element.style.backgroundColor = style.bg;
  element.style.color = style.text;
  element.style.borderColor = style.border;
}

function itemsByDate() {
  const map = new Map();

  // Filter items by person if a filter is selected
  const filteredItems = state.selectedPersonFilter
    ? state.items.filter(item => {
        const people = splitPersons(item.person);
        return people.some(p => p.toLowerCase() === state.selectedPersonFilter.toLowerCase());
      })
    : state.items;

  for (const raw of filteredItems) {
    const entry = normalizeItem(raw);
    if (!entry.date) {
      continue;
    }

    // Add the main entry
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
    map.get(entry.date).push(entry);

    // If there's a dateTo, add the item to all dates in the range
    if (entry.dateTo && entry.dateTo !== entry.date) {
      const startDate = new Date(entry.date + "T00:00:00");
      const endDate = new Date(entry.dateTo + "T00:00:00");

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = formatDateKey(d);
        if (dateKey !== entry.date) {
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          map.get(dateKey).push(entry);
        }
      }
    }
  }

  for (const group of map.values()) {
    group.sort((a, b) => {
      const ta = safeString(a.time);
      const tb = safeString(b.time);

      if (!ta && !tb) {
        return safeString(a.item).localeCompare(safeString(b.item));
      }

      if (!ta) {
        return -1;
      }

      if (!tb) {
        return 1;
      }

      return ta.localeCompare(tb);
    });
  }

  return map;
}

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("hidden", key !== name);
  }

  if (name === "calendar") {
    pageTitle.textContent = "Family Calendar";
    homeAddBtn.classList.remove("hidden");
  }

  if (name === "detail") {
    pageTitle.textContent = "Item Details";
    homeAddBtn.classList.add("hidden");
  }

  if (name === "form") {
    pageTitle.textContent = "Add New Item";
    homeAddBtn.classList.add("hidden");
  }

  if (name === "dayList") {
    pageTitle.textContent = "Day Items";
    homeAddBtn.classList.add("hidden");
  }
}

function compactItemText(itemValue) {
  const text = safeString(itemValue) || "(no item)";
  const maxLen = window.matchMedia("(max-width: 640px)").matches ? 5 : 8;
  return text.slice(0, maxLen);
}

function renderWeekdays() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdayRow.innerHTML = "";
  for (const day of days) {
    const div = document.createElement("div");
    div.className = "weekday-cell";
    div.textContent = day;
    weekdayRow.appendChild(div);
  }
}

function renderCalendar() {
  const today = new Date();
  const currentYear = state.currentMonth.getFullYear();
  const currentMonth = state.currentMonth.getMonth();
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0);

  monthLabel.textContent = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  calendarGrid.innerHTML = "";

  const leadingBlanks = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const trailingBlanks = (7 - ((leadingBlanks + totalDays) % 7)) % 7;
  const totalCells = leadingBlanks + totalDays + trailingBlanks;

  const byDate = itemsByDate();

  for (let cell = 0; cell < totalCells; cell += 1) {
    const dayCell = document.createElement("div");
    dayCell.className = "day-cell";

    let displayDay;
    let actualDate;

    if (cell < leadingBlanks) {
      displayDay = prevMonthLastDay.getDate() - leadingBlanks + cell + 1;
      actualDate = new Date(currentYear, currentMonth - 1, displayDay);
      dayCell.classList.add("outside");
    } else if (cell >= leadingBlanks + totalDays) {
      displayDay = cell - (leadingBlanks + totalDays) + 1;
      actualDate = new Date(currentYear, currentMonth + 1, displayDay);
      dayCell.classList.add("outside");
    } else {
      displayDay = cell - leadingBlanks + 1;
      actualDate = new Date(currentYear, currentMonth, displayDay);
    }

    const dateKey = formatDateKey(actualDate);
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";

    const numberBadge = document.createElement("div");
    numberBadge.className = "day-number";
    numberBadge.textContent = String(displayDay);

    const isToday =
      today.getFullYear() === actualDate.getFullYear() &&
      today.getMonth() === actualDate.getMonth() &&
      today.getDate() === actualDate.getDate();

    if (isToday) {
      numberBadge.classList.add("today");
    }

    dayHeader.appendChild(numberBadge);
    dayCell.appendChild(dayHeader);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "day-items";

    const dayItems = byDate.get(dateKey) || [];
    const capped = dayItems.slice(0, 4);

    for (const item of capped) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item-chip";
      const compactItem = compactItemText(item.item);
      btn.textContent = compactItem;
      applyThemeToElement(btn, getItemTheme(item));
      btn.addEventListener("click", () => openDetail(item));
      itemsWrap.appendChild(btn);
    }

    if (dayItems.length > 4) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "item-chip";
      more.textContent = `+${dayItems.length - 4} more`;
      more.addEventListener("click", () => openDayList(dateKey, dayItems));
      itemsWrap.appendChild(more);
    }

    dayCell.appendChild(itemsWrap);
    calendarGrid.appendChild(dayCell);
  }
}

function openDayList(dateKey, dayItems) {
  dayListTitle.textContent = `Items on ${dateKey}`;
  dayListBody.innerHTML = "";

  if (!dayItems || dayItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "day-list-empty";
    empty.textContent = "No items for this day.";
    dayListBody.appendChild(empty);
    showView("dayList");
    return;
  }

  for (const item of dayItems) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "day-list-item";

    const time = formatTimeHHMM(item.time);
    const prefix = document.createElement("span");
    prefix.className = "day-list-item-time";
    prefix.textContent = time ? `${time} ` : "";
    applyThemeToElement(row, getItemTheme(item));
    row.appendChild(prefix);
    row.appendChild(document.createTextNode(safeString(item.item) || "(no item)"));
    row.addEventListener("click", () => openDetail(item));
    dayListBody.appendChild(row);
  }

  showView("dayList");
}

function openDetail(item) {
  state.selectedItem = normalizeItem(item);
  detailDate.textContent = state.selectedItem.date || "-";
  detailDateTo.textContent = state.selectedItem.dateTo || "-";
  detailTime.textContent = formatTimeHHMM(state.selectedItem.time) || "-";
  detailTimeTo.textContent = formatTimeHHMM(state.selectedItem.timeTo) || "-";
  detailItem.textContent = state.selectedItem.item || "-";
  detailDescription.textContent = state.selectedItem.description || "-";
  detailPerson.textContent = state.selectedItem.person || "-";
  const canMutate = Number.isFinite(state.selectedItem.rowId);
  detailEditBtn.classList.toggle("hidden", !canMutate);
  detailDeleteBtn.classList.toggle("hidden", !canMutate);
  showView("detail");
}

function toPayload(formData) {
  return {
    date: safeString(formData.get("date")),
    time: safeString(formData.get("time")),
    item: safeString(formData.get("item")),
    description: safeString(formData.get("description")),
    person: joinPersons(getSelectedPersons()),
    dateTo: safeString(formData.get("dateTo")),
    timeTo: safeString(formData.get("timeTo")),
  };
}

async function loadPersons() {
  ensureSupabaseConfigured();
  const { data, error } = await supabaseClient
    .from("persons")
    .select("person, color_theme")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load persons. ${error.message}`);
  }

  if (!Array.isArray(data)) {
    state.persons = [];
    state.personThemeMap = new Map();
    return;
  }

  const persons = data
    .map((row) => ({
      person: safeString(row.person),
      colorTheme: safeString(row.color_theme),
    }))
    .filter((row) => row.person);

  state.persons = persons;
  state.personThemeMap = new Map(persons.map((row) => [row.person.toLowerCase(), row.colorTheme]));
}

async function loadItems() {
  ensureSupabaseConfigured();
  const { data, error } = await supabaseClient
    .from("calendar_items")
    .select("id, date, time, item, description, person, date_to, time_to")
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error(`Failed to load items. ${error.message}`);
  }

  if (!Array.isArray(data)) {
    state.items = [];
    return;
  }

  state.items = data.map((row) =>
    normalizeItem({
      rowId: row.id,
      date: row.date,
      time: row.time,
      item: row.item,
      description: row.description,
      person: row.person,
      dateTo: row.date_to,
      timeTo: row.time_to,
    })
  );
}

async function saveItem(payload) {
  ensureSupabaseConfigured();
  const insertPayload = {
    date: safeString(payload.date),
    time: safeString(payload.time) || null,
    item: safeString(payload.item),
    description: safeString(payload.description),
    person: safeString(payload.person),
    date_to: safeString(payload.dateTo) || null,
    time_to: safeString(payload.timeTo) || null,
  };

  const { error } = await supabaseClient.from("calendar_items").insert(insertPayload);
  if (error) {
    throw new Error(`Unable to save item. ${error.message}`);
  }
}

async function updateItem(payload) {
  ensureSupabaseConfigured();
  const rowId = Number(payload.rowId);
  if (!Number.isFinite(rowId)) {
    throw new Error("Invalid rowId.");
  }

  const updatePayload = {
    date: safeString(payload.date),
    time: safeString(payload.time) || null,
    item: safeString(payload.item),
    description: safeString(payload.description),
    person: safeString(payload.person),
    date_to: safeString(payload.dateTo) || null,
    time_to: safeString(payload.timeTo) || null,
  };

  const { error } = await supabaseClient
    .from("calendar_items")
    .update(updatePayload)
    .eq("id", rowId);

  if (error) {
    throw new Error(`Unable to update item. ${error.message}`);
  }
}

async function deleteItem(rowId) {
  ensureSupabaseConfigured();
  const numericRowId = Number(rowId);
  if (!Number.isFinite(numericRowId)) {
    throw new Error("Invalid rowId.");
  }

  const { error } = await supabaseClient
    .from("calendar_items")
    .delete()
    .eq("id", numericRowId);

  if (error) {
    throw new Error(`Unable to delete item. ${error.message}`);
  }
}

function clearForm() {
  formEl.reset();
  dateInput.value = formatDateKey(new Date());
  timeInput.value = "";
  dateToInput.value = "";
  timeToInput.value = "";
  setSelectedPersons([]);
}

function renderPersonOptions() {
  personOptions.innerHTML = "";

  if (!state.persons.length) {
    const empty = document.createElement("p");
    empty.className = "person-options-empty";
    empty.textContent = "No person options available.";
    personOptions.appendChild(empty);
    return;
  }

  const selectablePersons = state.persons.filter(
    (row) => safeString(row.person).toLowerCase() !== "default"
  );

  if (!selectablePersons.length) {
    const empty = document.createElement("p");
    empty.className = "person-options-empty";
    empty.textContent = "No person options available.";
    personOptions.appendChild(empty);
    return;
  }

  for (const row of selectablePersons) {
    const option = document.createElement("label");
    option.className = "person-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "person";
    input.value = row.person;

    const text = document.createElement("span");
    text.textContent = row.person;

    option.appendChild(input);
    option.appendChild(text);
    personOptions.appendChild(option);
  }
}

function renderPersonFilter() {
  // Keep the "All person" option
  while (personFilterSelect.children.length > 1) {
    personFilterSelect.removeChild(personFilterSelect.lastChild);
  }

  const selectablePersons = state.persons.filter(
    (row) => safeString(row.person).toLowerCase() !== "default"
  );

  for (const row of selectablePersons) {
    const option = document.createElement("option");
    option.value = row.person;
    option.textContent = row.person;
    personFilterSelect.appendChild(option);
  }
}

function getSelectedPersons() {
  return Array.from(formEl.querySelectorAll('input[name="person"]:checked')).map((el) => safeString(el.value));
}

function setSelectedPersons(persons) {
  const selected = new Set(persons.map((person) => safeString(person).toLowerCase()));
  const options = formEl.querySelectorAll('input[name="person"]');

  options.forEach((option) => {
    option.checked = selected.has(safeString(option.value).toLowerCase());
  });
}

function fillForm(item) {
  const dateField = formEl.elements.namedItem("date");
  const timeField = formEl.elements.namedItem("time");
  const dateToField = formEl.elements.namedItem("dateTo");
  const timeToField = formEl.elements.namedItem("timeTo");
  const itemField = formEl.elements.namedItem("item");
  const descriptionField = formEl.elements.namedItem("description");
  dateField.value = item.date || "";
  timeField.value = formatTimeHHMM(item.time);
  dateToField.value = item.dateTo || "";
  timeToField.value = formatTimeHHMM(item.timeTo);
  itemField.value = item.item || "";
  descriptionField.value = item.description || "";
  setSelectedPersons(splitPersons(item.person));
}

function setFormMode(mode) {
  state.formMode = mode;

  if (mode === "edit") {
    formTitle.textContent = "Edit Family Item";
    saveBackBtn.textContent = "Save changes and back";
    saveMoreBtn.classList.add("hidden");
    return;
  }

  formTitle.textContent = "Add Family Item";
  saveBackBtn.textContent = "Save and back to calendar";
  saveMoreBtn.classList.remove("hidden");
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.color = isError ? "#b42318" : "#7a4f36";
}

async function openForm() {
  state.editingRowId = null;
  setFormMode("add");
  await loadPersons();
  renderPersonOptions();
  renderPersonFilter();
  clearForm();
  setMessage("");
  showView("form");
}

async function openEditForm(item) {
  const normalized = normalizeItem(item);
  if (!Number.isFinite(normalized.rowId)) {
    alert("This item cannot be edited because rowId is missing.");
    return;
  }

  state.editingRowId = normalized.rowId;
  setFormMode("edit");
  await loadPersons();
  renderPersonOptions();
  fillForm(normalized);
  setMessage("");
  showView("form");
}

async function submitForm(mode) {
  const formData = new FormData(formEl);
  const payload = toPayload(formData);

  if (!payload.date || !payload.item || !payload.person) {
    setMessage("Please complete Date, Item, and Person.", true);
    return;
  }

  try {
    setMessage("Saving...");

    if (state.formMode === "edit") {
      await updateItem({
        rowId: state.editingRowId,
        ...payload,
      });
      await loadItems();
      renderCalendar();
      showView("calendar");
      return;
    }

    await saveItem(payload);

    if (mode === "back") {
      await loadItems();
      renderCalendar();
      showView("calendar");
      return;
    }

    clearForm();
    setMessage("Saved. You can add another item.");
  } catch (error) {
    setMessage(error.message || "Save failed.", true);
  }
}

async function removeSelectedItem() {
  if (!state.selectedItem || !Number.isFinite(state.selectedItem.rowId)) {
    return;
  }

  const ok = confirm("Delete this item?");
  if (!ok) {
    return;
  }

  try {
    await deleteItem(state.selectedItem.rowId);
    await loadItems();
    renderCalendar();
    showView("calendar");
  } catch (error) {
    alert(error.message || "Delete failed.");
  }
}

function registerEvents() {
  homeAddBtn.addEventListener("click", async () => {
    try {
      await openForm();
    } catch (error) {
      setMessage(error.message || "Could not load person options.", true);
    }
  });

  prevMonthBtn.addEventListener("click", () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  personFilterSelect.addEventListener("change", (event) => {
    state.selectedPersonFilter = event.target.value;
    renderCalendar();
  });

  backToCalendarBtn.addEventListener("click", () => {
    showView("calendar");
  });

  detailEditBtn.addEventListener("click", async () => {
    if (!state.selectedItem) {
      return;
    }
    try {
      await openEditForm(state.selectedItem);
    } catch (error) {
      alert(error.message || "Could not open edit form.");
    }
  });

  detailDeleteBtn.addEventListener("click", async () => {
    await removeSelectedItem();
  });

  dayListBackBtn.addEventListener("click", () => {
    showView("calendar");
  });

  cancelFormBtn.addEventListener("click", () => {
    showView("calendar");
  });

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitForm("back");
  });

  saveMoreBtn.addEventListener("click", async () => {
    await submitForm("more");
  });

  timeInput.addEventListener("focus", (event) => {
    if (!event.target.value) {
      event.target.value = defaultHourTime();
    }
  });

  timeToInput.addEventListener("focus", (event) => {
    if (!event.target.value) {
      event.target.value = defaultHourTime();
    }
  });
}

async function init() {
  renderWeekdays();
  registerEvents();
  setFormMode("add");

  try {
    await loadPersons();
    renderPersonOptions();
    renderPersonFilter();
    clearForm();
    await loadItems();
  } catch (error) {
    setMessage(`Could not load data: ${error.message}`, true);
  }

  renderCalendar();
  showView("calendar");
}

init();
