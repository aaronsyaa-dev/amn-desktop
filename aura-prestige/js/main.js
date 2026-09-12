document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const button = this.querySelector('.btn-submit');
  button.textContent = 'Demande envoyée';
  button.disabled = true;
});
