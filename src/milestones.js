const { DateTime } = require('luxon');
const fetch = require('./fetch');
const getColumns = require('./columns');
const formatTransactions = require('./transactions');

const milestones = async (db, keys, project, taiga) => {
  const { milestones } = taiga;
  const map = new Map();

  // Wait for each project to be created before continuing to the next.
  for (const { name, owner, created_date, modified_date, closed } of milestones) {
    const token = keys.has( owner ) ? keys.get( owner ) : keys.get( 'default' );

    const transactions = [
      {
        type: 'name',
        value: name,
      },
      {
        type: 'milestone',
        value: project,
      },
      {
        type: 'icon',
        value: 'goal',
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

    await db.execute('UPDATE phabricator_project.project SET dateCreated = ?, dateModified = ? WHERE phid = ?', [
      DateTime.fromISO(created_date).toSeconds(),
      DateTime.fromISO(modified_date).toSeconds(),
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

    let columns = new Map();
    if ( closed ) {
      await db.execute('UPDATE phabricator_project.project SET status = 100 WHERE phid = ?', [phid]);
    } else {
      columns = await getColumns( db, phid, taiga );
    }

    map.set(name, {
      phid,
      closed,
      columns,
    });
  }

  return map;
};

module.exports = milestones;
