#! /usr/local/bin/node
const mysql = require('mysql2/promise');
const { join } = require('path');
const dotenv = require('dotenv');
const getProject = require('../src/project');
const getUsers = require('../src/users');
const getColumns = require('../src/columns');
const getMilestones = require('../src/milestones');
const getTags = require('../src/tags');
const getStories = require('../src/stories');
const getEpics = require('../src/epics');

dotenv.config();

const data = require(join(process.cwd(), process.env.TAIGA_EXPORT));
const keys = new Map(Object.entries(JSON.parse(process.env.USER_MAP)));

const main = async () => {
  // Ensure a default API key.
  if ( !keys.has( 'default' ) ) {
    throw new Error('No default API key provided');
  }

  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password:  process.env.MYSQL_PASSWORD,
  });

  const [users, tags] = await Promise.all([
    getUsers(keys),
    getTags(keys, data),
  ]);
  const project = await getProject(db, keys, users, data);
  const [columns, milestones] = await Promise.all([
    getColumns(db, project, data),
    getMilestones(db, keys, project, data),
  ]);

  const stories = await getStories(db, keys, users, project, columns, milestones, tags, data);

  await getEpics(db, keys, users, project, columns, tags, stories, data);

  process.exit(0);
  return 0;
};

main();
