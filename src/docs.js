const { DateTime } = require('luxon');
const fetch = require('node-fetch');
const { tidyBuffer } = require('libtidy');
const TurndownService = require('turndown');
const basecamp = require('./basecamp');
const phabricator = require('./phabricator');
const formatTransactions = require('./transactions');

// Disable escaping.
TurndownService.prototype.escape = string => string;

const docs = async (db, keys) => {
  const map = new Map();
  const turndownService = new TurndownService({
    emDelimiter: '//',
    codeBlockStyle: 'fenced',
  });

  turndownService.addRule('link', {
    filter: ['a'],
    replacement: (content, node) => {
      if (node.href === content) {
        return content;
      }
      return `[[ ${node.href} | ${content} ]]`;
    }
  });

  turndownService.addRule('unordered-list', {
    filter: ['li'],
    replacement: (content, node) => {
      if (node.parentNode.nodeName === 'UL') {
        return `  - ${content}\n`
      };
      if (node.parentNode.nodeName === 'OL') {
        return `  # ${content}\n`
      };
    }
  });

  turndownService.addRule('pre', {
    filter: ['pre'],
    replacement: (content) => {
      return '\n```\n' + content + '\n```\n';
    }
  });

  const result = await basecamp('documents.json');
  const list = await result.json();

  // Sort the stories by their created date.
  const documents = [ ...list ].sort( (a, b) => (
    DateTime.fromISO(a.created_at).toSeconds() - DateTime.fromISO(b.created_at).toSeconds()
  ));

  for (const { id } of documents) {
    const result = await basecamp(`documents/${id}.json`);
    const { creator, content, title, created_at, updated_at } = await result.json();

    const token = keys.has( creator.id ) ? keys.get( creator.id ) : keys.get( 'default' );

    const cleaned = await tidyBuffer(content, {
      forceOutput: true,
      showBodyOnly: true,
      indent: 'auto',
      wrap: 0,
    });

    const remark = turndownService.turndown(cleaned.output.toString());

    const slug = title.toLowerCase().replace( / |'|\//g, '-' ).replace( /\!/g, '' );

    const create = await phabricator('phriction.create', {
      'api.token': token,
      slug,
      title,
      content: ' ',
    });

    const createData = await create.json();

    if (createData.error_info) {
      throw new Error(createData.error_info);
    }

    const { phid } = createData.result;

    await db.execute('UPDATE phabricator_phriction.phriction_content SET dateCreated = ?, dateModified = ? WHERE documentPHID = ?', [
      DateTime.fromISO(created_at).toSeconds(),
      DateTime.fromISO(created_at).toSeconds(),
      phid,
    ]);

    await db.execute('UPDATE phabricator_phriction.phriction_transaction SET dateCreated = ?, dateModified = ? WHERE objectPHID = ?', [
      DateTime.fromISO(created_at).toSeconds(),
      DateTime.fromISO(created_at).toSeconds(),
      phid,
    ]);

    await db.execute('UPDATE phabricator_phriction.edge SET dateCreated = ? WHERE src = ?', [
      DateTime.fromISO(created_at).toSeconds(),
      phid,
    ]);

    const update = await phabricator('phriction.edit', {
      'api.token': token,
      slug,
      content: remark,
    });

    const updateData = await update.json();

    if (updateData.error_info) {
      throw new Error(updateData.error_info);
    }

    await db.execute('UPDATE phabricator_phriction.phriction_content SET dateCreated = ?, dateModified = ? WHERE documentPHID = ? AND dateCreated = ?', [
      DateTime.fromISO(updated_at).toSeconds(),
      DateTime.fromISO(updated_at).toSeconds(),
      phid,
      updateData.result.dateCreated
    ]);

    await db.execute('UPDATE phabricator_phriction.phriction_transaction SET dateCreated = ?, dateModified = ? WHERE objectPHID = ? AND oldValue = ?', [
      DateTime.fromISO(updated_at).toSeconds(),
      DateTime.fromISO(updated_at).toSeconds(),
      phid,
      '" "',
    ]);

    map.set(id, phid);
  }

  return map;
};

module.exports = docs;
