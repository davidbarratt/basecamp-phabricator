const fetch = require('node-fetch');

const phabricator = (method, data, options = {}) => {
  const url = new URL(`api/${method}`, process.env.PHABRICATOR_URL).href;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Host': process.env.PHABRICATOR_HOST,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
    ...options,
  });
};

module.exports = phabricator;
