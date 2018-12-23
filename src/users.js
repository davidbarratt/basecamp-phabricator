const fetch = require('./fetch');

const users = async (keys) => {
  const data = await Promise.all(
    [ ...keys ].map(async ([user, key]) => {
      const response = await fetch('user.whoami', {
        'api.token': key,
      });

      const { result } = await response.json();

      return [user, result.phid];
    })
  );

  return new Map(data);
};

module.exports = users;
