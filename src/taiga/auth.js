require('isomorphic-fetch');

let authUser;

const getAuthUser = async () => {
  if (authUser) {
    return authUser;
  }

  // Authenticate into Taiga
  authUser = fetch(`${process.env.TAIGA_URL}/api/v1/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'normal',
      username: process.env.TAIGA_USERNAME,
      password: process.env.TAIGA_PASSWORD,
    }),
  }).then(response => response.json()).then(data => {
    return data;
  });

  return authUser;
};

module.exports = {
  getAuthUser,
};
