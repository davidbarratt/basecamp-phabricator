const { DateTime } = require('luxon');
const fetch = require('./fetch');
const formatTransactions = require('./transactions');

const project = async (db, keys, users, { name, description, owner, created_date }) => {
  const token = keys.has( owner ) ? keys.get( owner ) : keys.get( 'default' );

  const transactions = [
    {
      type: 'name',
      value: name,
    },
    {
      type: 'description',
      value: description,
    },
    {
      type: 'members.set',
      value: [ ...users.values() ]
    }
  ];
  const result = await fetch('project.edit', {
    'api.token': token,
    ...formatTransactions( transactions ),
  });

  const data = await result.json();

  if (data.error_info) {
    throw new Error(data.error_info)
  }

  const phid = data.result.object.phid;

  await db.execute('UPDATE phabricator_project.project SET dateCreated = ? WHERE phid = ?', [
    DateTime.fromISO(created_date).toSeconds(),
    phid,
  ]);

  await db.execute('UPDATE phabricator_project.project_slug SET dateCreated = ? WHERE projectPHID = ?', [
    DateTime.fromISO(created_date).toSeconds(),
    phid,
  ]);

  await db.execute('UPDATE phabricator_project.project_transaction SET dateCreated = ? WHERE objectPHID = ?', [
    DateTime.fromISO(created_date).toSeconds(),
    phid,
  ]);

  await db.execute('UPDATE phabricator_project.edge SET dateCreated = ? WHERE src = ?', [
    DateTime.fromISO(created_date).toSeconds(),
    phid,
  ]);

  return phid;
};

module.exports = project;
