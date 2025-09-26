#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment');
const chokidar = require('chokidar');
const path = require('path');
const Datastore = require('nedb');


console.log(chalk.blue('- Starting the Folder Activity Monitor -'));

if (fs.existsSync('./config.json')) {
  // read in the config file
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  console.log(chalk.green('Running with the following configuration:'));
  console.log(JSON.stringify(config, null, 2));

  // get the absolute file path
  let folderPath = path.resolve(config.folder);
  let nedbPath = path.resolve(config.db);

  db = new Datastore({
    filename: nedbPath,
    autoload: true,
    timestampData: true,
    inMemoryOnly: false
  });
  db.persistence.setAutocompactionInterval(1000 * 60 * 60); // Every hour run compaction on the db

  // set whether we are going to record the initial folder scan
  let logging = config.logFromStart;
  let initialFileCountFlag = true;
  let counter = 0;

  process.stdout.write('Files Identified: '+counter);

  // start watching the folder of interest
  chokidar.watch(folderPath, config.chokidarOptions)
  .on('all', (event, path, details) => {

    // Counting the number of files during the initial scan
    if (initialFileCountFlag) {
      counter++;
      process.stdout.write('\r\x1b[K');
      process.stdout.write('Files Identified: '+counter);
    }

    if (logging) {

      let doc = {};
      if (details) {
        doc = details;
      }
      doc.path = path;
      doc.event = event;
      // console.log(JSON.stringify(doc, null, 2));

      db.insert(doc, function (err, newDoc) {
        // do nothing at the moment - could be logged
      });

    }

  })
  .on('error', (error) => {
    // fail silently and carry on monitoring - could be logged
  })
  .on('ready', () => {
    process.stdout.write('\n');
    console.log('Initial Scan Complete - Found', counter, 'Files');
    counter = 0;
    logging = true;
    initialFileCountFlag = false;
  });

} else {
  console.log(chalk.red('Error: config.json not found in folder'));
}
