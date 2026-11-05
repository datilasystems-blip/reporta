fetch('http://localhost:4400/health')
  .then(async (r) => console.log('HEALTH:', r.status))
  .catch((e) => console.error('DOWN:', e.message));
