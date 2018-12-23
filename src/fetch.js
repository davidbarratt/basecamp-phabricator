const fetch = require('node-fetch');

const phabricatorFetch = (method, data, options = {}) => {
  const url = new URL(`api/${method}`, process.env.PHABRICATOR_URL).href;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
    ...options,
  });
};

module.exports = phabricatorFetch;
