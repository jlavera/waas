const bluebird = require('bluebird');
const fs       = bluebird.promisifyAll(require('fs'));
const slack    = require('./src/slack');
const waas     = require('./src/waas');

const force    = process.argv.indexOf('force') > 0;

const getDayFileName = day => `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}.json`;

const todayFileName  = getDayFileName(new Date());

// Run with `muted` to avoid messaging Slack
// Run with `cache` to avoid querying WaaS
// Run with `force` to run even if it was already ran today

if (!force && fs.existsSync(`./output/${todayFileName}`)) {
    console.log('Already ran today');
    process.exit();
}

bluebird.all([waas.getDirectory(), getLastCompanies()])
    .tap(results => saveTodayCompanies(results[0]))
    .spread(getDiff)
    .tap(slack.send)
    .catch(err => {
        throw err;
    })
;

function getDiff(today, yesterday) {
    const newCompanies     = [];

    Object.keys(today)
        .forEach(todayKey => {
            if (!yesterday[todayKey]) {
                newCompanies.push(today[todayKey]);
            } else {
                const oldJobIds = yesterday[todayKey].jobs.map(job => job.id);
                const newJobIds =     today[todayKey].jobs.map(job => job.id);

                if (newJobIds.some(jobId => oldJobIds.indexOf(jobId) === -1)) {
                    newCompanies.push(today[todayKey]);
                }
            }
        })
    ;

    return newCompanies;
}

function saveTodayCompanies(companies) {
    return fs.writeFileAsync(`./output/${todayFileName}`, JSON.stringify(companies, null, 2), 'utf8');
}

function getLastCompanies() {
    const files = fs.readdirSync('./output/');

    let older;
    files.forEach(file => {
        if (!older || file > older) {
            older = file;
        }
    });

    return older ? fs.readFileAsync(`./output/${older}`, 'utf8')
            .then(JSON.parse)
        : [];
}
