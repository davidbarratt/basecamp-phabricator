const fetch = require('node-fetch');

const basecamp = (item, options = {}) => {
  const url = new URL(item, `https://basecamp.com/${process.env.BASECAMP_ACCOUNT}/api/v1/projects/${process.env.BASECAMP_PROJECT}/`).href;

  const credentials = Buffer.from(`${process.env.BASECAMP_USER}:${process.env.BASECAMP_PASSWORD}`).toString('base64');

  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    ...options,
  });
};

module.exports = basecamp;
