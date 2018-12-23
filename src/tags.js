const fetch = require('./fetch');
const formatTransactions = require('./transactions');

const tags = async (keys, { tags_colors }) => {
  const map = new Map();

  // Wait for each project to be created before continuing to the next.
  for (const [ name ] of tags_colors) {
    const token = keys.get( 'default' );

    const transactions = [
      {
        type: 'name',
        value: name,
      },
      {
        type: 'icon',
        value: 'tag',
      },
      {
        type: 'color',
        value: 'yellow',
      },
    ];

    const result = await fetch('project.edit', {
      'api.token': token,
      ...formatTransactions( transactions ),
    });

    const data = await result.json();

    if (data.error_info) {
      throw new Error(data.error_info);
    }

    const { phid } = data.result.object

    map.set(name, phid);
  }

  return map;
};

module.exports = tags;
