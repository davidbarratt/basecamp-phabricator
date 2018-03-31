#! /usr/bin/env node
require('isomorphic-fetch');
const { Map } = require('immutable');

// Authenticate into Taiga
fetch(`${process.env.TAIGA_URL}/api/v1/auth`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'normal',
    username: process.env.TAIGA_USERNAME,
    password: process.env.TAIGA_PASSWORD,
  }),
}).then(response => response.json()).then((data) => {
  const users = new Map([
    [
      data.id,
      data
    ]
  ]);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.auth_token}`
  };

  // Create the state object.
  return new Map({
    taiga: ( new Map() ).set('users', users).set('headers', headers),
  });
}).then((state) => {
  const taiga = state.get('taiga');

  // Projects.
  return fetch(`${process.env.TAIGA_URL}/api/v1/projects?member=${taiga.get('users').first().id}`, {
    headers: taiga.get('headers'),
  }).then(response => response.json()).then(data => {
    const projects = new Map(
      data.map(project => (
        [
          project.id,
          project,
        ]
      ))
    );

    return state.setIn(['taiga', 'projects'], projects)
  });
}).then(state => {
  const taiga = state.get('taiga');

  // All users.
  return Promise.all(taiga.get('projects').map(project => (
    fetch(`${process.env.TAIGA_URL}/api/v1/users?project=${project.id}`, {
      headers: taiga.get('headers')
    })
  )).toArray()).then(responses =>
    Promise.all(responses.map(response => response.json()))
  ).then(data => {
    const users = data.reduce((map, set) => {
      return set.reduce((m, u) => {
        return m.set(u.id, u);
      }, map);
    }, new Map() );

    return state.setIn(['taiga', 'users'], users);
  })
}).then(state => {
  // @TODO Push what we have to Phabricator and build a map?
})
