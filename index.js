const fs = require('fs');
const readline = require('readline');
const {once} = require('events');
const junk = require('junk');

/** @property {string} args.prefix */
/** @property {string} args.suffix */
/** @property {boolean} args.log */
/** @property {number} args.threshold */
const args = require('minimist')(process.argv.slice(2), {
  string: ['prefix', 'suffix'],
  boolean: ['log'],
  alias: {
    p: 'prefix',
    s: 'suffix',
    l: 'log',
    t: 'threshold'
  },
  default: {
    prefix: '',
    suffix: '',
    log: false,
    threshold: 20,
  }
});

console.log(`\x1b[37mBulk File Filter \x1b[90mCopyright © 2019 Lukalot (Luke N. Arnold) All Rights Reserved
\x1b[32m --> Starting process...\x1b[0m`);

(function checkExistingOutputOverwrite() {
  const outputFiles = fs.readdirSync('output_files/')
  // unfortunately, Node.js does not provide a way to automatically filter out hidden system files :(
    .filter((filename) => junk.not(filename) && !filename.startsWith('.'));

  if (outputFiles.length > 0) {
    console.warn('\x1b[33mWARNING: Output directory is not empty! Continuing may result in files being overwritten.\x1b[0m');

    const readlineSync = require('readline-sync');
    const askForDecision = function () {
      const char = readlineSync.keyIn('Press Y to continue as-is, C to clear output folder and continue, or N to abort: ').toLowerCase();

      if (char === 'n') {
        process.exit();
      } else if (char === 'y') {
        // do nothing here, just continue execution
      } else if (char === 'c') {
        console.log('Clearing output directory...');

        for (const file of outputFiles) {
          fs.unlinkSync('output_files/' + file);
        }

        console.log('Output directory cleared.');
      } else {
        askForDecision(); // invalid choice, ask again
      }
    };

    askForDecision();
  }
})();

const targets = [];

async function readTargets() {
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream('targets.txt'),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (line.trim() !== '') {
        const no_quotes = line.toLowerCase().split("'").join("");

        targets.push({
          raw: line,
          underscore: no_quotes.split(' ').join('_'),
          dash: no_quotes.split(' ').join('-'),
          none: no_quotes.split(' ').join('')
        });
      }
    });

    await once(rl, 'close');
    return targets;
  } catch (err) {
    console.error('Failed to process targets.txt:');
    throw err;
  }
}

function checkNameMatch(sourceName, target) {
  const noDigitsName = sourceName.replace(/[0-9]+/g, '');

  if (args.prefix && !noDigitsName.startsWith(args.prefix)) {
    return false;
  }

  if (args.suffix && !noDigitsName.endsWith(args.suffix)) {
    return false;
  }

  const noDigitsLowercaseName = noDigitsName.toLowerCase();

  return (noDigitsLowercaseName.includes(target.underscore)
    || noDigitsLowercaseName.includes(target.dash)
    || noDigitsLowercaseName.includes(target.none));
}

function compareTargetsWithSources(targets) {
  const source_files = fs.readdirSync('source_files/'); // Array of files in the source_files folder
  const matched = [];

  for (let i = 0; i < source_files.length; i++) {
    for (let j = 0; j < targets.length; j++) {
      if (checkNameMatch(source_files[i], targets[j])) {
        fs.copyFileSync('source_files/' + source_files[i], 'output_files/' + source_files[i]);
        matched.push(targets[j].raw);

        if (args.log) {
          const nameMatchPercentage = Math.round((args.prefix.length + targets[j].raw.length + args.suffix.length) / (source_files[i].length) * 100);

          if (nameMatchPercentage < args.threshold) {
            console.log('  \x1b[33m[' + nameMatchPercentage + '%]\x1b[0m MATCH - ' + source_files[i] + ' / ' + targets[j].raw);
          } else {
            console.log('  [' + nameMatchPercentage + '%] MATCH - ' + source_files[i] + ' / ' + targets[j].raw);
          }
        }
      }
    }
  }

  return [targets, matched];
}

function showResults(results) {
  const [targets, matched] = results;
  const targetsNotMatched = targets.filter((target) => !matched.includes(target.raw));

  fs.writeFileSync('disparate_targets.log', `DISPARATE LOG - 'Logging $%&#ed up stuff since 2019'
  Recorded ${targetsNotMatched.length} unmatched targets in last process:\n\n` + targetsNotMatched.map(t => t.raw).join("\n"));

  console.log(`\x1b[32m --> Completed process with ${matched.length} match${(matched.length === 1) ? '' : 'es'}\x1b[0m`);
}

readTargets()
  .then(compareTargetsWithSources)
  .then(showResults)
  .catch(err => console.error(err));
