const CONFIG = {
  API_BASE: (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://tetris-api-mjkang.onrender.com'
};
