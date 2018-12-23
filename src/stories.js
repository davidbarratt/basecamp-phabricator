const { DateTime } = require('luxon');
const fetch = require('./fetch');
const formatTransactions = require('./transactions');

const stories = async (db, keys, users, project, columns, milestones, tags, { user_stories }) => {
  // Sort the stories by their created date.
  const us = [ ...user_stories ].sort( (a, b) => (
    DateTime.fromISO(a.created_date).toSeconds() - DateTime.fromISO(b.created_date).toSeconds()
  ));
  const map = new Map();

  // Wait for each story to be created before continuing to the next.
  for (const { owner, subject, description, ref, assigned_to, role_points, milestone, status, tags: story_tags, is_closed, created_date, modified_date, history } of us) {
    const token = keys.has( owner ) ? keys.get( owner ) : keys.get( 'default' );

    let transactions = [
      {
        type: 'title',
        value: subject,
      },
      {
        type: 'description',
        value: description,
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

    if ( role_points && role_points.length > 0 && role_points[0] && role_points[0].points ) {
      const points = parseInt(role_points[0].points, 10);

      if ( points > 0 ) {
        transactions = [
          ...transactions,
          {
            type: 'points',
            value: points,
          }
        ]
      }
    }

    let projects = [];
    let cols = [];
    if ( milestone && milestones.has( milestone ) ) {
      projects = [ ...projects, milestones.get( milestone ).phid ];
      if ( milestones.get( milestone ).columns.has( status ) ) {
        cols = [ ...cols, milestones.get( milestone ).columns.get( status ) ];
      }
    } else {
      projects = [ ...projects, project ];
      if ( columns.get( status ) ) {
        cols = [ ...cols, columns.get( status ) ];
      }
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

    if ( is_closed ) {
      const h = [ ...history ].reverse();
      let act = h.find((a) => {
        if (!('diff' in a)) {
          return false;
        }

        if (!('is_closed' in a.diff)) {
          return false;
        }

        const [,next] = a.diff.is_closed;

        return next;
      });

      // If no action was found, make one up.
      if ( !act ) {
        act = {
          user: assigned_to ? assigned_to : 'default',
          created_at: modified_date
        };
      }

      const [user] = act.user;

      let trans = [
        {
          type: 'status',
          value: 'resolved',
        }
      ];

      // Do not override the assignment!
      if ( !assigned_to ) {
        trans = [
          ...trans,
          {
            type: 'owner',
            value: '',
          }
        ];
      }

      const result = await fetch('maniphest.edit', {
        'api.token': keys.has( user ) ? keys.get( user ) : keys.get( 'default' ),
        objectIdentifier: phid,
        ...formatTransactions( trans ),
      });

      const data = await result.json();

      if (data.error_info) {
        throw new Error(data.error_info);
      }

      // Assume the last modified date is when it was resolved.
      await db.execute('UPDATE phabricator_maniphest.maniphest_transaction SET dateCreated = ? WHERE objectPHID = ? AND transactionType = ?', [
        DateTime.fromISO(act.created_at).toSeconds(),
        phid,
        'status'
      ]);

      await db.execute('UPDATE phabricator_maniphest.maniphest_task SET closedEpoch = ? WHERE phid = ?', [
        DateTime.fromISO(act.created_at).toSeconds(),
        phid,
      ]);

      // Do not mark the task as updated.
      await db.execute('UPDATE phabricator_maniphest.maniphest_task SET dateModified = ? WHERE phid = ?', [
        DateTime.fromISO(modified_date).toSeconds(),
        phid,
      ]);
    }


    map.set(ref, phid);
  }

  return map;
};

module.exports = stories;
