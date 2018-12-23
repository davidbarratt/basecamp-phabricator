const phid = require('phid');

const columns = async (db, project, { us_statuses, epic_statuses }) => {
  await db.execute('UPDATE phabricator_project.project SET hasWorkboard = 1 WHERE phid = ?', [project]);

  const statuses = [ ...us_statuses, ...epic_statuses ].reduce( (acc, status) => {
    // If the status already exists, ignore it.
    if ( acc.find( s => s.name === status.name ) ) {
      return acc;
    }

    return [ ...acc, status ];
  }, []);

  const map = await Promise.all(statuses.map(async ({name}, index) => {
    const id = await phid('PCOL');
    const time = Math.floor(Date.now() / 1000);

    let properties = [];
    if ( index === 0 ) {
      properties = {
        isDefault: true
      };
    }

    await db.execute(
      'INSERT INTO phabricator_project.project_column (phid, name, status, sequence, projectPHID, dateCreated, dateModified, properties) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, 0, index, project, time, time, JSON.stringify(properties)]
    );

    return [name, id];
  }));

  return new Map(map);
};

module.exports = columns;
