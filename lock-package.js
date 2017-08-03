#!/usr/bin/env node

const fs = require('fs-extra');
const chalk = require('chalk');
const exec = require('child_process').exec;
const ncu = require('npm-check-updates');
const program = require('commander');

const log = console.log;
const error = chalk.bold.red;
const success = chalk.bold.green;
const warn = chalk.bold.yellow;
const excludedDependencies = ['git', 'sassypam'];

program
    .version('0.1.0')
    .usage('[-u -f]')
    .option('-u, --update', 'Check for dependency updates.', checkNPMUpdates)
    .option('-f, --file', 'Package.json file path', lockPackageJSONDependencies)
    .parse(process.argv);

function lockPackageJSONDependencies() {
    getListDependencies()
        .then(loadPackageJSONFile)
        .then(writeToPackageJSONFile)
        .then(result => log(success(result)))
        .catch(err => log(error(err)))
}

/**
 * Get list of dependencies for package.json
 * 
 * @returns 
 */
function getListDependencies() {
    return new Promise((resolve, reject) => {
        const path = process.argv[3] ? process.argv[3].replace('/package.json', '') : '';

        exec(`npm list --depth=0 --json`, { cwd: path }, (err, stdout, stderr) => {
            if (err) {
                reject(err)
                return;
            }

            const npmList = JSON.parse(stdout);

            const dependenciesList = ['dependencies', 'devDependencies'].reduce((list, propName) => {
                for (const key in npmList[propName]) {
                    const hasExclusion = excludedDependencies.some(dep => new RegExp(dep, 'g').test(key));

                    if (npmList[propName].hasOwnProperty(key) && !hasExclusion) {
                        const dependencyInfo = npmList[propName][key];
                        list.push({ name: key, version: dependencyInfo.version })
                    }
                }
                return list;
            }, []);

            resolve(dependenciesList);
        });
    })
}

/**
 * Load package.json file
 * 
 * @param {{versionName:string, name:string, version:string}[]} list 
 * @return {Promise<{packageJSONFilePath:string, jsonFile:object}>}
 */
function loadPackageJSONFile(list) {
    return new Promise((resolve, reject) => {
        const packageJSONFilePath = process.argv[3] || 'package.json';
        fs.readJSON(packageJSONFilePath)
            .then(packageObj => {
                const { dependencies, devDependencies } = packageObj
                list.forEach(item => {
                    if (dependencies[item.name]) {
                        dependencies[item.name] = item.version
                    } else {
                        devDependencies[item.name] = item.version
                    }
                })

                resolve({ packageJSONFilePath, jsonFile: packageObj })
            })
            .catch(err => reject(err))
    })
}

/**
 * Write to package.json
 * 
 * @param {any} { packageJSONFilePath, jsonFile } 
 */
function writeToPackageJSONFile({ packageJSONFilePath, jsonFile }) {
    return new Promise((resolve, reject) => {
        fs.writeJSON(packageJSONFilePath, jsonFile, { spaces: 2 })
            .then(result => resolve('package.json file updated'))
            .catch(err => reject(err))
    })
}

/**
 * Check NPM for dependency updates
 * 
 */
function checkNPMUpdates() {
    const path = process.argv[3] || 'package.json';

    ncu.run({
        // Always specify the path to the package file 
        packageFile: path,
        // Any command-line option can be specified here. 
        // These are set by default: 
        silent: true,
        jsonUpgraded: true
    }).then((upgraded) => {
        log(warn('Dependencies to upgrade:'), upgraded);
    });
}