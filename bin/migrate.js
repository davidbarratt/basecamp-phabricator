#! /usr/local/bin/node
const mysql = require('mysql2/promise');
const { join } = require('path');
const dotenv = require('dotenv');
const getFiles = require('../src/files');

dotenv.config();

const keys = new Map(JSON.parse(process.env.USER_MAP));

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

  await getFiles(db, keys);

  process.exit(0);
  return 0;
};

main();
