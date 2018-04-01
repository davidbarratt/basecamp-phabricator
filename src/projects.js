require('isomorphic-fetch');
const { Map } = require('immutable');
const { getHeaders } = require('./taiga/headers.js');
const { getAuthUser } = require('./taiga/auth.js');

let projects;

const getProjects = async () => {
  if (projects) {
    return projects;
  }

  const headers = await getAuthUser();
  const user = await getAuthUser();

  projects = fetch(`${process.env.TAIGA_URL}/api/v1/projects?member=${user.id}`, {
    headers,
  }).then(response => response.json()).then(data => {
    // @TODO Create a map of taiga → phabricator ids!
    return new Map(
      data.map(project => (
        [
          project.id,
          project,
        ]
      ))
    );
  });

  return projects;
};

module.exports = {
  getProjects,
};
