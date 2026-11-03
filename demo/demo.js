document.addEventListener('submit', event => {
  event.preventDefault();
  const message = document.getElementById('demo-message');
  if (message) message.textContent = 'Demo only. No data was submitted.';
});
