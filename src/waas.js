const _        = require('lodash');
const bluebird = require('bluebird');
const cheerio  = require('cheerio');
const request  = require('superagent');

const useCache = process.argv.indexOf('cache') > 0;

module.exports = {
    getDirectory
};

function getDirectory() {
    if (useCache) {
        return bluebird.resolve(require('./cache.json'))
            .then(arrayToObject)
        ;
    }

    return bluebird.resolve(request
            .get('https://www.workatastartup.com/directory')
            .set('Cookie', 'psess=sessionCookie')
        )
        .then(resp => cheerio.load(resp.text))
        .then($ => JSON.parse($('[data-react-class="CompanyDirectory"]').attr('data-react-props')))
        .then(props => {
            return props.companies.filter(company => {
                return company.jobs.some(job => job.remote === 'yes' && job.visa === false);
            });
        })
        .then(companies => _.sortBy(companies, company => company.id))
        .then(arrayToObject)
    ;
}

function arrayToObject(array) {
    return array.reduce((obj, company) => ({...obj, [company.id]: company}), {});
}