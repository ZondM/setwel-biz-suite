// Ask before dangerous admin actions (forms with data-confirm).
document.querySelectorAll('form[data-confirm]').forEach(function (f) {
  f.addEventListener('submit', function (e) { if (!window.confirm(f.dataset.confirm)) e.preventDefault(); });
});
// Keep the admin menu open on wide screens.
var m = document.querySelector('.adm-menu');
if (m && window.matchMedia('(min-width: 1000px)').matches) m.open = true;
