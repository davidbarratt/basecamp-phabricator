const { getAuthUser } = require('./auth.js');

let headers;

const getHeaders = async () => {
  if (headers) {
    return headers;
  }

  headers = getAuthUser().then(user => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.auth_token}`
    };
  });

  return headers;
};

module.exports = {
  getHeaders
};
