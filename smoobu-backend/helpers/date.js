// helpers/date.js
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
