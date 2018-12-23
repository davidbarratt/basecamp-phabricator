const { DateTime } = require('luxon');
const fetch = require('./fetch');
const formatTransactions = require('./transactions');

const epics = async (db, keys, users, project, columns, tags, stories, { epics }) => {
  // Sort the stories by their created date.
  const ep = [ ...epics ].sort( (a, b) => (
    DateTime.fromISO(a.created_date).toSeconds() - DateTime.fromISO(b.created_date).toSeconds()
  ));
  const map = new Map();

  // Wait for each story to be created before continuing to the next.
  for (const { owner, subject, ref, assigned_to, status, tags: story_tags, created_date, modified_date, related_user_stories } of ep) {
    const token = keys.has( owner ) ? keys.get( owner ) : keys.get( 'default' );

    let transactions = [
      {
        type: 'title',
        value: subject,
      }
    ];

    if ( assigned_to && users.has( assigned_to ) ) {
      transactions = [
        ...transactions,
        {
          type: 'owner',
          value: users.get( assigned_to ),
        }
      ];
    }

    let projects = [ project ];
    let cols = [];
    if ( columns.get( status ) ) {
      cols = [ ...cols, columns.get( status ) ];
    }

    projects = [
      ...projects,
      ...story_tags.map( tag => tags.get( tag ) )
    ];

    if ( projects ) {
      transactions = [
        ...transactions,
        {
          type: 'projects.set',
          value: projects,
        },
      ];
    }

    if ( cols ) {
      transactions = [
        ...transactions,
        {
          type: 'column',
          value: cols,
        },
      ];
    }

    const subtasks = related_user_stories.map(({user_story}) => {
      return stories.get(user_story);
    });

    if ( subtasks ) {
      transactions = [
        ...transactions,
        {
          type: 'subtasks.set',
          value: subtasks,
        },
      ];
    }

    const result = await fetch('maniphest.edit', {
      'api.token': token,
      ...formatTransactions( transactions ),
    });

    const data = await result.json();

    if (data.error_info) {
      throw new Error(data.error_info);
    }

    const { phid } = data.result.object

    await db.execute('UPDATE phabricator_maniphest.maniphest_task SET dateCreated = ?, dateModified = ? WHERE phid = ?', [
      DateTime.fromISO(created_date).toSeconds(),
      DateTime.fromISO(modified_date).toSeconds(),
      phid,
    ]);

    await db.execute('UPDATE phabricator_maniphest.maniphest_transaction SET dateCreated = ? WHERE objectPHID = ?', [
      DateTime.fromISO(created_date).toSeconds(),
      phid,
    ]);

    await db.execute('UPDATE phabricator_maniphest.edge SET dateCreated = ? WHERE src = ?', [
      DateTime.fromISO(created_date).toSeconds(),
      phid,
    ]);

    map.set(ref, phid);
  }

  return map;
};

module.exports = epics;
