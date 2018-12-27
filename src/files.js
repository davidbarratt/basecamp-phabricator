const { DateTime } = require('luxon');
const fetch = require('node-fetch');
const basecamp = require('./basecamp');
const phabricator = require('./phabricator');
const formatTransactions = require('./transactions');

const project = async (db, keys) => {
  const map = new Map();

  const result = await basecamp('uploads.json');
  const list = await result.json();

  // Sort the stories by their created date.
  const uploads = [ ...list ].sort( (a, b) => (
    DateTime.fromISO(a.created_at).toSeconds() - DateTime.fromISO(b.created_at).toSeconds()
  ));

  for (const { id: upload_id } of uploads) {
    const result = await basecamp(`uploads/${upload_id}.json`);
    const { attachments } = await result.json();

    // Wait for each story to be created before continuing to the next.
    for (const { id, name, url, creator, created_at, updated_at, linked_source } of attachments) {
      // If there is a linked source, then this is a Google Doc or something...
      if ( linked_source ) {
        continue;
      }

      const token = keys.has( creator.id ) ? keys.get( creator.id ) : keys.get( 'default' );

      const response = await basecamp(url);

      if ( !response.ok ) {
        throw new Error(response.statusText);
      }

      const buffer = await response.buffer();

      const stream = response.body;

      const result = await phabricator('file.allocate', {
        'api.token': token,
        contentLength: buffer.length,
        name,
      });

      const data = await result.json();

      if (data.error_info) {
        throw new Error(data.error_info);
      }

      let { filePHID: phid } = data.result;

      // If no file was allocated, upload directly.
      if ( !phid ) {
        const uploadResponse = await phabricator('file.upload', {
          'api.token': token,
          data_base64: buffer.toString('base64'),
          name,
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.error_info) {
          throw new Error(uploadData.error_info);
        }

        phid = uploadData.result;
      } else {
        // split the file into uploadable chunks if it is smaller than a
        // single chunk.
        const MAX = 4194304;
        let start = 0;
        while (start < buffer.length) {
          // The end and the length might not line up...?
          const end = start + MAX < buffer.length ? start + MAX : buffer.length;
          const chunk = buffer.slice(start, end);
          // Each request must be sync (one after the other). Phabricator does
          // not allow chunks to be uploaded out of order.
          const chunkedResponse = await phabricator('file.uploadchunk', {
            'api.token': token,
            filePHID: phid,
            byteStart: start,
            dataEncoding: 'base64',
            data: chunk.toString('base64')
          });

          // Gracefully handle the error somehow?
          if (!chunkedResponse.ok) {
            throw new Error(data);
          }

          const chunkedResponseData = await chunkedResponse.json();

          if (chunkedResponseData.error_info) {
            throw new Error(chunkedResponseData.error_info);
          }

          start += chunk.length;
        }
      }


      await db.execute('UPDATE phabricator_file.file SET dateCreated = ?, dateModified = ? WHERE phid = ?', [
        DateTime.fromISO(created_at).toSeconds(),
        DateTime.fromISO(updated_at).toSeconds(),
        phid,
      ]);

      await db.execute('UPDATE phabricator_file.file_transaction SET dateCreated = ?, dateModified = ? WHERE objectPHID = ?', [
        DateTime.fromISO(created_at).toSeconds(),
        DateTime.fromISO(updated_at).toSeconds(),
        phid,
      ]);

      await db.execute('UPDATE phabricator_file.edge SET dateCreated = ? WHERE src = ?', [
        DateTime.fromISO(created_at).toSeconds(),
        phid,
      ]);

      map.set(id, phid);
    }
  }

  return map;
};

module.exports = project;
