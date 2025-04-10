export const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isPastOrToday = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate <= today;
};

export const isToday = (date) => {
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export const isSameDate = (date1, date2) => {
  if (!date1 || !date2) return false;
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

export const generateCalendarMonth = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  // First day of month
  const firstDay = new Date(year, month, 1);

  // Last day of month
  const lastDay = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Adjust for Monday as first day of week
  let firstDayOfWeek = firstDay.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const days = [];

  // Add empty slots for days before the first day of month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ date: null, empty: true });
  }

  // Add days of the month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({ date, empty: false });
  }

  return days;
};

export const getMonthName = (date) => {
  return date.toLocaleString("fr-FR", { month: "long" }).toUpperCase();
};
