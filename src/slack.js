const _        = require('lodash');
const bluebird = require('bluebird');
const request  = require('superagent');

const muted    = process.argv.indexOf('muted') > 0;

module.exports = {
    send
};

function send(_companies) {
    const companies = Object.keys(_companies)
        .map(key => _companies[key])
        .map(company => {
            let shortCompany = _.pick(company, [
                'name', 'website', 'location',
                'primary_vertical', 'short_description',
                'logo_url', 'hiring_jobs_url'
            ]);

            let jobs = _.map(company.jobs, job => {
                return {
                    title: job.title,
                    type: job.pretty_job_type,
                    experience: job.pretty_min_experience,
                    salary: `$${job.salary_min} - $${job.salary_max}`,
                    equity: `${job.equity_min}% - ${job.equity_max}%`,
                    skills: _.map(job.skills, skill => skill.name).join(' / ')
                };
            })

            return {...shortCompany, jobs }
        })
    ;

    const ordered = _.sortBy(companies, company => company.name)
        .map(formatCompany);

    if (!ordered.length) {
        return sendText('Nothing new!', 0);
    }

    const promises = _.chunk(ordered, 10)
        .map((chunk, index, arr) => () => {
            const page = `page ${index + 1}/${arr.length}`;

            return sendText(`-----*Start ${page}*\n\n${chunk.join('\n\n\n')}\n\n-----*End ${page}*\n\n`, chunk.length);
        })
    ;

    // Run promises sequentially to keep page order
    return promises.reduce((previousPromise, currentPromise) => previousPromise.then(currentPromise), bluebird.resolve()).then();
}

function formatCompany(company) {
    const title = `*${company.name}* [${company.primary_vertical}] (${company.website}) (${company.location})`;
    const description = company.short_description;
    const hireLink = company.hiring_jobs_url;

    const jobs = '\n\t\t- ' + company.jobs.map(job => {
        return `*${job.title}* [${job.type}] [${job.salary}] [${job.equity}] _${job.skills}_`;
    }).join('\n\t\t- ');

    return `${title}\n\t${description}${hireLink ? '\n\t' + hireLink : ''}\n${jobs}`;
}

function sendText(text, count) {
    return (muted ? bluebird.resolve() :  request.post('postURL')
        .set('Content-type', 'application/json')
        .send({
            text,
            mrkdwn: true
        }))
        .then(() => console.log(`Sent ${count} to slack!`))
        .catch(err => {
            console.log(JSON.stringify(err, null, 2));
            throw err;
        })
    ;
}